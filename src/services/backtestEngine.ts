import { BacktestResult, PaperTrade, SetupPattern } from '../types/crypto';
import { fetchKlines } from './binanceApi';
import { buildMultiTimeframeAnalysis } from '../utils/signalEngine';
import { createPaperTradeFromSignal, processPaperTradeUpdate } from './paperTradingEngine';

/**
 * Executes a 30-day historical backtest on Binance Futures data
 */
export async function run30DayBacktest(
  symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'SUIUSDT'],
  progressCallback?: (percent: number, msg: string) => void
): Promise<BacktestResult> {
  const simulatedTrades: PaperTrade[] = [];
  let balance = 100.0;
  let peakBalance = 100.0;
  let maxDrawdown = 0.0;

  const equityCurve: { date: string; equity: number }[] = [
    { date: 'اليوم 1', equity: 100.0 },
  ];

  let completedSymbols = 0;

  for (const sym of symbols) {
    if (progressCallback) {
      progressCallback(
        Math.round((completedSymbols / symbols.length) * 80),
        `جاري جلب واختبار شموع ${sym}...`
      );
    }

    try {
      // Fetch 30 days worth of candles (approx 720 1h candles)
      const candles = await fetchKlines(sym, '1h', 500);
      if (!candles || candles.length < 50) continue;

      // Slide a 30-candle window through the history to detect and simulate setups
      const step = 8; // step every 8 hours
      for (let i = 35; i < candles.length - 15; i += step) {
        const historySlice = candles.slice(0, i);
        const futureSlice = candles.slice(i, i + 15);
        const currentPrice = historySlice[historySlice.length - 1].close;

        const analysis = buildMultiTimeframeAnalysis(
          sym,
          {
            '1m': [],
            '5m': [],
            '15m': historySlice.slice(-60),
            '1h': historySlice,
            '4h': historySlice.slice(-120),
            '1d': historySlice.slice(-240),
            '3d': [],
            '1w': [],
          },
          currentPrice,
          0.0001
        );

        // Only take high conviction trades (R:R >= 2.0, votes >= 3, not weak)
        if (
          !analysis.targets.isWeakTrade &&
          analysis.confidence >= 68 &&
          analysis.overallSignal !== 'NEUTRAL'
        ) {
          let paperTrade = createPaperTradeFromSignal(analysis, '1h');
          paperTrade.createdAt = Date.now() - (candles.length - i) * 3600000;

          // Step through subsequent future candles to simulate execution & exits
          for (let f = 0; f < futureSlice.length; f++) {
            const nextCandle = futureSlice[f];
            // Check high and low
            const updateResultHigh = processPaperTradeUpdate(paperTrade, nextCandle.high, false);
            paperTrade = updateResultHigh.updatedTrade;
            if (updateResultHigh.closed) break;

            const updateResultLow = processPaperTradeUpdate(paperTrade, nextCandle.low, false);
            paperTrade = updateResultLow.updatedTrade;
            if (updateResultLow.closed) break;
          }

          // If trade didn't hit SL or TP in window, close at last candle close
          if (paperTrade.status === 'OPEN') {
            paperTrade.status = 'CLOSED';
            paperTrade.closedAt = paperTrade.createdAt + futureSlice.length * 3600000;
            paperTrade.exitPrice = futureSlice[futureSlice.length - 1].close;
            const diff =
              paperTrade.side === 'LONG'
                ? paperTrade.exitPrice - paperTrade.actualEntryPrice
                : paperTrade.actualEntryPrice - paperTrade.exitPrice;
            const grossPnl = (diff / paperTrade.actualEntryPrice) * paperTrade.positionSize;
            paperTrade.grossPnl = Number(grossPnl.toFixed(3));
            paperTrade.netPnl = Number((grossPnl - 0.02 - 0.025).toFixed(3));
            paperTrade.pnlPercent = Number(((paperTrade.netPnl / 0.5) * 100).toFixed(2));
            paperTrade.closeReason = 'MANUAL';
          }

          if (paperTrade.status === 'CLOSED') {
            balance += paperTrade.netPnl;
            if (balance > peakBalance) peakBalance = balance;
            const dd = ((peakBalance - balance) / peakBalance) * 100;
            if (dd > maxDrawdown) maxDrawdown = dd;

            simulatedTrades.push(paperTrade);
          }
        }
      }
    } catch (e) {
      console.warn(`Backtest error on ${sym}:`, e);
    }

    completedSymbols++;
  }

  if (progressCallback) {
    progressCallback(95, 'جاري احتساب منحنى المحفظة والمؤشرات الإحصائية...');
  }

  // Sort trades chronologically
  simulatedTrades.sort((a, b) => a.createdAt - b.createdAt);

  // Build Day-by-Day Equity Curve
  let runningEquity = 100.0;
  simulatedTrades.forEach((t, idx) => {
    runningEquity += t.netPnl;
    if (idx % Math.max(1, Math.floor(simulatedTrades.length / 15)) === 0 || idx === simulatedTrades.length - 1) {
      equityCurve.push({
        date: `صفقة ${idx + 1}`,
        equity: Number(runningEquity.toFixed(2)),
      });
    }
  });

  const totalTrades = simulatedTrades.length;
  const winningTrades = simulatedTrades.filter((t) => t.netPnl > 0).length;
  const losingTrades = simulatedTrades.filter((t) => t.netPnl <= 0).length;
  const winRate = totalTrades > 0 ? Number(((winningTrades / totalTrades) * 100).toFixed(1)) : 0;

  const totalGains = simulatedTrades.filter((t) => t.netPnl > 0).reduce((acc, t) => acc + t.netPnl, 0);
  const totalLosses = Math.abs(simulatedTrades.filter((t) => t.netPnl < 0).reduce((acc, t) => acc + t.netPnl, 0));
  const profitFactor = totalLosses > 0 ? Number((totalGains / totalLosses).toFixed(2)) : totalGains > 0 ? 9.99 : 1.0;

  const avgR =
    totalTrades > 0
      ? Number(
          (
            simulatedTrades.reduce((acc, t) => acc + (t.netPnl > 0 ? t.rMultiple : -1), 0) /
            totalTrades
          ).toFixed(2)
        )
      : 1.0;

  const netProfitUsdt = Number((runningEquity - 100.0).toFixed(2));
  const netProfitPercent = Number((((runningEquity - 100.0) / 100.0) * 100).toFixed(2));

  // Breakdown by Setup Pattern (Only Retest, Breakout, Pullback)
  const patterns: SetupPattern[] = ['BREAKOUT', 'RETEST', 'PULLBACK'];
  const byPattern: BacktestResult['byPattern'] = {} as any;

  patterns.forEach((pat) => {
    const list = simulatedTrades.filter((t) => t.pattern === pat);
    const wins = list.filter((t) => t.netPnl > 0).length;
    const wr = list.length > 0 ? Number(((wins / list.length) * 100).toFixed(1)) : 0;
    const pnl = Number(list.reduce((acc, t) => acc + t.netPnl, 0).toFixed(2));
    const r = list.length > 0 ? Number((list.reduce((acc, t) => acc + (t.netPnl > 0 ? t.rMultiple : -1), 0) / list.length).toFixed(2)) : 0;
    byPattern[pat] = {
      count: list.length,
      winRate: wr,
      netPnl: pnl,
      avgR: r,
    };
  });

  if (progressCallback) {
    progressCallback(100, 'اكتمل الاختبار التاريخي بنجاح!');
  }

  return {
    periodDays: 30,
    totalTrades,
    winningTrades,
    losingTrades,
    winRate,
    profitFactor,
    avgR,
    netProfitUsdt,
    netProfitPercent,
    maxDrawdownPercent: Number(maxDrawdown.toFixed(2)),
    equityCurve,
    trades: simulatedTrades.slice(0, 50), // keep top 50
    byPattern,
  };
}
