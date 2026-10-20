import {
  PaperTrade,
  PaperTradeStatus,
  PaperCloseReason,
  PaperAccount,
  EquityPoint,
  MultiTimeframeAnalysis,
  Timeframe,
  SetupPattern,
  MarketRegimeInfo,
  PortfolioId,
  PortfolioConfig,
  PortfolioState,
} from '../types/crypto';
import { formatPrice } from '../utils/formatters';
import { getTradeTypeInfo } from '../utils/tradeTypes';

// Portfolio Configurations for Cross Margin Trading with Leverage Liquidation Protection
export const PORTFOLIO_CONFIGS: Record<PortfolioId, PortfolioConfig> = {
  PORTFOLIO_A: {
    id: 'PORTFOLIO_A',
    name: 'المحفظة A (100x)',
    shortName: 'A (100x)',
    leverage: 100,
    marginPerTrade: 10, // $10 margin for $1,000 position size ($1,000 ÷ 100)
    positionSize: 1000,
    maxConcurrentTrades: 9999, // Unlimited trades while free margin permits
    liquidationDistancePercent: 1.0, // 1.0% liquidation distance for 100x leverage
    badgeColor: 'rose',
    description: 'Cross Margin • رافعة 100x • حجم $1,000 • هامش $10 • مسافة تصفية 1.0%',
  },
  PORTFOLIO_B: {
    id: 'PORTFOLIO_B',
    name: 'المحفظة B (50x)',
    shortName: 'B (50x)',
    leverage: 50,
    marginPerTrade: 20, // $20 margin for $1,000 position size ($1,000 ÷ 50)
    positionSize: 1000,
    maxConcurrentTrades: 9999, // Unlimited trades while free margin permits
    liquidationDistancePercent: 2.0, // 2.0% liquidation distance for 50x leverage
    badgeColor: 'amber',
    description: 'Cross Margin • رافعة 50x • حجم $1,000 • هامش $20 • مسافة تصفية 2.0%',
  },
  PORTFOLIO_C: {
    id: 'PORTFOLIO_C',
    name: 'المحفظة C (25x)',
    shortName: 'C (25x)',
    leverage: 25,
    marginPerTrade: 40, // $40 margin for $1,000 position size ($1,000 ÷ 25)
    positionSize: 1000,
    maxConcurrentTrades: 9999, // Unlimited trades while free margin permits
    liquidationDistancePercent: 4.0, // 4.0% liquidation distance for 25x leverage
    badgeColor: 'emerald',
    description: 'Cross Margin • رافعة 25x • حجم $1,000 • هامش $40 • مسافة تصفية 4.0%',
  },
};

/**
 * Computes Cross Margin liquidation price and distance for an individual trade
 * based on current portfolio Equity and total exposure across all open trades.
 *
 * Rules:
 * - Equity at price P = Balance + Sum of PnL across all open trades.
 * - Liquidation occurs when Equity = 0.
 * - For N open trades (each $1,000 size), total exposure = N * 1000.
 * - Distance to liquidation % = (Equity / (N * 1000)) * 100%.
 * - Example: 1 trade ($1000 size, Equity $1000) -> 100% distance -> Long liq at 0.
 * - Example: 10 trades ($10,000 exposure, Equity $1000) -> 10% distance -> Long at 100 liq at 90.
 */
export function computeCrossLiquidation(
  entryPrice: number,
  side: 'LONG' | 'SHORT',
  equity: number,
  openTradesCount: number,
  positionSize = 1000
): { liquidationPrice: number; liquidationDistancePercent: number } {
  const count = Math.max(1, openTradesCount);
  const totalExposure = count * positionSize;
  const currentEquity = Math.max(0, equity);

  const bufferRatio = totalExposure > 0 ? currentEquity / totalExposure : 1.0;
  const liquidationDistancePercent = Number((bufferRatio * 100).toFixed(2));

  let liquidationPrice: number;
  if (side === 'LONG') {
    liquidationPrice = Math.max(0, Number((entryPrice * (1 - bufferRatio)).toFixed(8)));
  } else {
    liquidationPrice = Number((entryPrice * (1 + bufferRatio)).toFixed(8));
  }

  return {
    liquidationPrice,
    liquidationDistancePercent,
  };
}

/**
 * Rebalances and recalculates liquidation price and distance for all open Cross Margin positions
 */
export function rebalanceCrossMarginPositions(
  trades: PaperTrade[],
  balance: number
): PaperTrade[] {
  const activeOpen = trades.filter((t) => t.status === 'OPEN');
  if (activeOpen.length === 0) return trades;

  const totalUnrealized = activeOpen.reduce((acc, t) => acc + (t.netPnl || 0), 0);
  const currentEquity = Math.max(0, balance + totalUnrealized);
  const totalExposure = activeOpen.length * 1000;

  return trades.map((t) => {
    if (t.status === 'OPEN') {
      const crossLiq = computeCrossLiquidation(
        t.actualEntryPrice,
        t.side,
        currentEquity,
        activeOpen.length,
        t.positionSize || 1000
      );
      return {
        ...t,
        liquidationPrice: crossLiq.liquidationPrice,
        liquidationDistancePercent: crossLiq.liquidationDistancePercent,
        totalExposure,
      };
    }
    return t;
  });
}

// Clusters for Correlation Filter
export const CORRELATION_CLUSTERS: Record<string, string[]> = {
  L1: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT', 'AVAXUSDT', 'SUIUSDT', 'NEARUSDT', 'DOTUSDT', 'ATOMUSDT'],
  MEME: ['DOGEUSDT', 'SHIBUSDT', 'PEPEUSDT', 'BONKUSDT', 'WIFUSDT', 'FLOKIUSDT'],
  L2: ['ARBUSDT', 'OPUSDT', 'STRKUSDT', 'POLUSDT', 'IMXUSDT'],
  AI: ['RENDERUSDT', 'FETUSDT', 'TAOUSDT', 'NEARUSDT', 'GRTUSDT'],
  DEFI: ['LINKUSDT', 'UNIUSDT', 'AAVEUSDT', 'INJUSDT', 'MKRUSDT', 'RUNEUSDT'],
};

export function getSymbolCluster(symbol: string): string {
  for (const [cluster, symbols] of Object.entries(CORRELATION_CLUSTERS)) {
    if (symbols.includes(symbol)) return cluster;
  }
  return 'OTHER';
}

/**
 * Triggers Browser Notification & Audio if permission is granted
 */
export function sendTradingNotification(title: string, body: string, soundEnabled = true) {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/pwa-192x192.png',
      });
    } catch (e) {
      // ignore notification errors
    }
  }

  // Play crisp acoustic confirmation sound
  if (soundEnabled && typeof window !== 'undefined') {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.08); // A5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {}
  }
}

/**
 * Helper to create a pristine empty account starting with 1,000 USDT
 */
export const createInitialAccount = (): PaperAccount => ({
  initialBalance: 1000,
  balance: 1000,
  equity: 1000,
  marginUsed: 0,
  totalTradesCount: 0,
  openPositionsCount: 0,
  pendingPositionsCount: 0,
  closedPositionsCount: 0,
  liquidatedPositionsCount: 0,
  consecutiveLosses: 0,
  coolDownUntil: 0,
  autoTradingEnabled: true,
  lastFundingDeduction: Date.now(),
});

export const INITIAL_PAPER_ACCOUNT: PaperAccount = createInitialAccount();

/**
 * Initialize 3 completely empty parallel portfolios starting with 1,000 USDT each
 * No mock or sample trades - starts 100% clean!
 */
export const createInitialPortfolios = (): Record<PortfolioId, PortfolioState> => ({
  PORTFOLIO_A: {
    config: PORTFOLIO_CONFIGS.PORTFOLIO_A,
    account: createInitialAccount(),
    trades: [],
    equityHistory: [],
  },
  PORTFOLIO_B: {
    config: PORTFOLIO_CONFIGS.PORTFOLIO_B,
    account: createInitialAccount(),
    trades: [],
    equityHistory: [],
  },
  PORTFOLIO_C: {
    config: PORTFOLIO_CONFIGS.PORTFOLIO_C,
    account: createInitialAccount(),
    trades: [],
    equityHistory: [],
  },
});

// Empty array for backward compatibility - no mock trades
export const SAMPLE_PAPER_TRADES: PaperTrade[] = [];

/**
 * Checks if a new trade is allowed based on:
 * 1. Cool-down status
 * 2. News pause
 * 3. Market Regime
 * 4. Coin already has open/pending trade in this portfolio
 * 5. Sufficient available margin (no cap on trade count as long as margin permits)
 */
export function canOpenNewTrade(
  symbol: string,
  side: 'LONG' | 'SHORT',
  pattern: SetupPattern,
  activeTrades: PaperTrade[],
  account: PaperAccount,
  marketRegime: MarketRegimeInfo | null,
  isNewsPaused: boolean,
  marginRequired = 10,
  signalScore = 70,
  maxPositionsLimit = 15,
  coinPauseUntil = 0,
  portfolioId?: PortfolioId,
  targetSlPercent?: number,
  timeframe?: Timeframe
): { allowed: boolean; reason?: string } {
  // 1. Check coin-specific pause (from Binance announcement)
  if (coinPauseUntil && coinPauseUntil > Date.now()) {
    const minsLeft = Math.ceil((coinPauseUntil - Date.now()) / 60000);
    return {
      allowed: false,
      reason: `تم تعليق الصفقات مؤقتاً على ${symbol} (${minsLeft} دقيقة) لوجود إعلان رسمي من Binance`,
    };
  }

  // 2. Check auto trading toggle
  if (!account.autoTradingEnabled) {
    return { allowed: false, reason: 'التداول الافتراضي التلقائي معطل حالياً' };
  }

  // 3. Check News pause (max 15 mins)
  if (isNewsPaused) {
    return { allowed: false, reason: 'تم تعليق الصفقات مؤقتاً بسبب أخبار عاجلة عالية التأثير (حتى 15 دقيقة)' };
  }

  // 4. Check Market Regime
  if (marketRegime) {
    if (marketRegime.regime === 'VOLATILE' || marketRegime.allowedTradeSides === 'HALTED') {
      return { allowed: false, reason: 'توقف مؤقت للصفقات بسبب تقلب حاد في السوق (Volatile)' };
    }
    if (marketRegime.allowedTradeSides === 'LONG_ONLY' && side !== 'LONG') {
      return { allowed: false, reason: 'حالة السوق صاعدة - يُسمح بصفقات Long فقط' };
    }
    if (marketRegime.allowedTradeSides === 'SHORT_ONLY' && side !== 'SHORT') {
      return { allowed: false, reason: 'حالة السوق هابطة - يُسمح بصفقات Short فقط' };
    }
    if (marketRegime.regime === 'RANGING' && pattern === 'BREAKOUT') {
      return { allowed: false, reason: 'حالة السوق: انتظار كسر النطاق - يُمنع نمط Breakout حتى تأكيد الكسر' };
    }
  }

  // 5. Check Cool-down after 3 consecutive losses
  if (account.coolDownUntil > Date.now()) {
    const minsLeft = Math.ceil((account.coolDownUntil - Date.now()) / 60000);
    return { allowed: false, reason: `فترة تهدئة مؤقتة متبقية (${minsLeft} دقيقة) بسبب 3 خسائر متتالية` };
  }

  // 6. الصفقات غير محدودة طالما يوجد رصيد حر (تم إلغاء الحد الأقصى 20/15/10 نهائياً)
  const openTrades = activeTrades.filter((t) => t.status === 'OPEN');

  // 7. Coin uniqueness within THIS portfolio (no duplicate trade on the same symbol in same portfolio)
  const existingOnSymbol = activeTrades.some(
    (t) => (t.status === 'OPEN' || t.status === 'PENDING') && t.symbol === symbol
  );
  if (existingOnSymbol) {
    return { allowed: false, reason: `توجد صفقة مفتوحة بالفعل لعملة ${symbol} في هذه المحفظة` };
  }

  // 8. Liquidation Protection Check (حماية التصفية):
  // ارفض الصفقة في المحفظة التي يكون فيها مسافة SL أكبر من مسافة التصفية
  if (portfolioId && targetSlPercent && targetSlPercent > 0) {
    const cfg = PORTFOLIO_CONFIGS[portfolioId];
    if (targetSlPercent > cfg.liquidationDistancePercent) {
      return {
        allowed: false,
        reason: `حماية التصفية (${cfg.shortName}): مسافة وقف الخسارة (${targetSlPercent.toFixed(1)}%) أكبر من مسافة التصفية للرافعة (${cfg.liquidationDistancePercent.toFixed(1)}%) - تم رفض الصفقة لحماية المحفظة`,
      };
    }
  }

  // 9. Margin Check (Rule: إذا وصل رصيد محفظة لأقل من الهامش المطلوب، توقف عن فتح صفقات جديدة فيها)
  const marginUsed = openTrades.reduce((acc, t) => acc + t.margin, 0);
  const availableBalance = Math.max(0, account.balance - marginUsed);
  if (availableBalance < marginRequired) {
    return {
      allowed: false,
      reason: `الرصيد المتاح ($${availableBalance.toFixed(2)}) أقل من الهامش المطلوب ($${marginRequired})`,
    };
  }

  return { allowed: true };
}

/**
 * Creates a Paper Trade specifically configured for a given portfolio:
 * - Portfolio A (100x): $1000 size, $10 margin, 1.0% liquidation
 * - Portfolio B (50x): $1000 size, $20 margin, 2.0% liquidation
 * - Portfolio C (25x): $1000 size, $40 margin, 4.0% liquidation
 */
export function createPaperTradeForPortfolio(
  analysis: MultiTimeframeAnalysis,
  portfolioId: PortfolioId,
  timeframe: Timeframe = '15m',
  liveMarketPrice?: number
): PaperTrade {
  const config = PORTFOLIO_CONFIGS[portfolioId];
  const isReadyNow = analysis.executionStatus === 'READY_NOW';
  const side = analysis.overallDirection === 'BULLISH' ? 'LONG' : 'SHORT';
  const isBullish = side === 'LONG';

  // 1. Signal price vs Real-time live price from WebSocket
  const signalPrice = analysis.targets.entry;
  const livePrice = liveMarketPrice && liveMarketPrice > 0 ? liveMarketPrice : (analysis.currentPrice || signalPrice);

  // Precision formatting
  const precision = livePrice > 0 ? (livePrice < 1 ? 4 : livePrice < 10 ? 3 : 2) : 2;
  const roundDec = (val: number) => Number(val.toFixed(precision));

  // 2. Execution determination:
  // If it's INSTANT execution ('تنفيذ فوري' / READY_NOW / Total Score >= 70):
  // Execute immediately at market live price without expiration!
  const priceDiffPercent = signalPrice > 0 ? Number(((Math.abs(livePrice - signalPrice) / signalPrice) * 100).toFixed(2)) : 0;
  const isInstantExecution = isReadyNow || (analysis.scoreBreakdown?.totalScore ?? analysis.confidence) >= 70;
  const hasExpired = !isInstantExecution && priceDiffPercent > 0.5;

  let actualEntryPrice = roundDec(livePrice);
  const status: PaperTradeStatus = hasExpired ? 'EXPIRED' : (isInstantExecution ? 'OPEN' : 'PENDING');
  const closeReason: PaperCloseReason | undefined = hasExpired ? 'EXPIRED' : undefined;

  // 3. If diff <= 0.5%:
  // * افتح الصفقة بالسعر الحقيقي الحالي.
  // * أعد حساب SL و TP1/TP2/TP3 بناءً على سعر الدخول الجديد (بنفس النسب المئوية).
  const tp1Percent = analysis.targets.tp1Percent;
  const tp2Percent = analysis.targets.tp2Percent;
  const tp3Percent = analysis.targets.tp3Percent;
  const slPercent = analysis.targets.slPercent;

  let tp1 = analysis.targets.tp1;
  let tp2 = analysis.targets.tp2;
  let tp3 = analysis.targets.tp3;
  let sl = analysis.targets.sl;

  if (!hasExpired) {
    if (isBullish) {
      tp1 = roundDec(actualEntryPrice * (1 + Math.abs(tp1Percent) / 100));
      tp2 = roundDec(actualEntryPrice * (1 + Math.abs(tp2Percent) / 100));
      tp3 = tp3Percent ? roundDec(actualEntryPrice * (1 + Math.abs(tp3Percent) / 100)) : undefined;
      sl = roundDec(actualEntryPrice * (1 - Math.abs(slPercent) / 100));
    } else {
      tp1 = roundDec(actualEntryPrice * (1 - Math.abs(tp1Percent) / 100));
      tp2 = roundDec(actualEntryPrice * (1 - Math.abs(tp2Percent) / 100));
      tp3 = tp3Percent ? roundDec(actualEntryPrice * (1 - Math.abs(tp3Percent) / 100)) : undefined;
      sl = roundDec(actualEntryPrice * (1 + Math.abs(slPercent) / 100));
    }
  }

  // 4. Calculate stop-loss distance %
  const slDistPercent = actualEntryPrice > 0 ? Number((Math.abs((actualEntryPrice - sl) / actualEntryPrice) * 100).toFixed(2)) : Math.abs(slPercent);
  const isLargeTimeframe = timeframe === '4h' || timeframe === '1d' || timeframe === '3d' || timeframe === '1w';

  // 5. Dynamic Liquidation Protection:
  // إذا كانت مسافة الاستوب (مثلاً 5%) أكبر من مسافة التصفية في المحفظة (1% في 100x):
  // تقليل حجم الصفقة (Position Size) تلقائياً لزيادة مسافة التصفية لتكون آمنة وأكبر من مسافة الاستوب
  let positionSize = 1000;
  let effectiveLeverage = config.leverage;
  const allocatedMargin = config.marginPerTrade;
  let isLiquidationProtected = false;

  if (slDistPercent > config.liquidationDistancePercent) {
    // توفير مسافة تصفية آمنة تتجاوز الوقف بهامش 35%
    const safeLiqDistance = slDistPercent * 1.35;
    const maxSafeLev = Math.max(1, Math.min(config.leverage, Math.floor(100 / safeLiqDistance)));
    effectiveLeverage = maxSafeLev;
    positionSize = Math.max(50, Math.round(allocatedMargin * effectiveLeverage));
    isLiquidationProtected = true;
  }

  // Multi-Timeframe trade categorization
  const typeInfo = getTradeTypeInfo(timeframe || analysis.timeframe || '15m');

  // Commission $0.40 only if trade actually opens
  const commissionPaid = hasExpired ? 0 : 0.40;
  const slippagePaid = 0;

  const crossLiq = computeCrossLiquidation(actualEntryPrice, side, 1000, 1, positionSize);
  const trailingDist = (analysis.targets.tp1AtrDistance || 1.8) * Math.abs(tp1 - actualEntryPrice) * 0.5;
  const scoreVal = analysis.scoreBreakdown?.totalScore ?? analysis.confidence;
  const slCalculationReason = analysis.targets.slCalculationReason || 'SL محسوب من: ATR × 1.5';

  const liqNote = isLiquidationProtected
    ? ` • 🛡️ درع حماية التصفية: تم تعديل الحجم إلى $${positionSize} (رافعة ${effectiveLeverage}x) لتأمين مسافة تصفية ${(100 / effectiveLeverage).toFixed(1)}% تتجاوز الوقف (${slDistPercent.toFixed(1)}%)`
    : '';

  const notes = hasExpired
    ? `فاتت الصفقة (Expired): فارق السعر (${priceDiffPercent}% > 0.5%) بين الإشارة (${formatPrice(signalPrice)}) والحقيقي (${formatPrice(livePrice)})`
    : `${analysis.patternNameArabic} • ${typeInfo.label} • ${slCalculationReason} • سعر الإشارة: ${formatPrice(signalPrice)} | سعر الدخول الفعلي: ${formatPrice(actualEntryPrice)}${liqNote}`;

  return {
    id: `trade-${portfolioId.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    portfolioId,
    symbol: analysis.symbol,
    side,
    pattern: analysis.setupPattern,
    patternNameArabic: analysis.patternNameArabic,
    timeframe,
    tradeType: typeInfo.type,
    tradeTypeLabel: typeInfo.label,
    tradeTypeLabelArabic: typeInfo.labelArabic,
    status,
    entryPrice: actualEntryPrice,
    signalPrice,
    actualEntryPrice,
    priceDiffPercent,
    slCalculationReason,
    currentPrice: livePrice,
    stopLoss: sl,
    originalStopLoss: sl,
    tp1,
    tp2,
    tp3,
    tp1Hit: false,
    tp2Hit: false,
    tp3Hit: false,
    slMovedToBreakeven: false,
    trailingActive: false,
    trailingDistance: trailingDist,
    highestPriceSeen: actualEntryPrice,
    lowestPriceSeen: actualEntryPrice,
    margin: allocatedMargin,
    originalMargin: allocatedMargin,
    leverage: effectiveLeverage,
    positionSize,
    remainingSizeRatio: hasExpired ? 0 : 1.0,
    liquidationPrice: crossLiq.liquidationPrice,
    liquidationDistancePercent: isLiquidationProtected ? Number((100 / effectiveLeverage).toFixed(1)) : crossLiq.liquidationDistancePercent,
    totalExposure: positionSize,
    commissionPaid,
    slippagePaid,
    fundingPaid: 0,
    grossPnl: 0,
    netPnl: 0,
    pnlPercent: 0,
    rMultiple: 0,
    candlesElapsed: 0,
    cluster: getSymbolCluster(analysis.symbol),
    btcCorrelation: analysis.btcCorrelation,
    projectStrength: analysis.projectStrength,
    projectStrengthScore: analysis.projectStrength?.totalScore,
    projectStrengthTierArabic: analysis.projectStrength?.tierArabic,
    score: scoreVal,
    scoreBreakdown: analysis.scoreBreakdown,
    macroTrend: analysis.macroTrend,
    macroTrendLabel: analysis.macroTrendLabel,
    macroTrendSummaryArabic: analysis.macroTrendSummaryArabic,
    createdAt: Date.now(),
    openedAt: status === 'OPEN' ? Date.now() : undefined,
    closedAt: hasExpired ? Date.now() : undefined,
    closeReason,
    notes,
  };
}

export function createTriplePaperTradesFromSignal(
  analysis: MultiTimeframeAnalysis,
  timeframe: Timeframe = '15m',
  livePrice?: number
): Record<PortfolioId, PaperTrade> {
  return {
    PORTFOLIO_A: createPaperTradeForPortfolio(analysis, 'PORTFOLIO_A', timeframe, livePrice),
    PORTFOLIO_B: createPaperTradeForPortfolio(analysis, 'PORTFOLIO_B', timeframe, livePrice),
    PORTFOLIO_C: createPaperTradeForPortfolio(analysis, 'PORTFOLIO_C', timeframe, livePrice),
  };
}

// Backward compatibility alias
export function createPaperTradeFromSignal(
  analysis: MultiTimeframeAnalysis,
  timeframe: Timeframe = '15m',
  livePrice?: number
): PaperTrade {
  return createPaperTradeForPortfolio(analysis, 'PORTFOLIO_A', timeframe, livePrice);
}

/**
 * Updates an active Paper Trade with the latest market price & tick rules
 * Accurately processes Cross Liquidation, TP1, TP2, TP3, Trailing Stop, and Stop Loss
 */
export function processPaperTradeUpdate(
  trade: PaperTrade,
  currentPrice: number,
  soundEnabled = true
): {
  updatedTrade: PaperTrade;
  closed: boolean;
  partialClosed?: boolean;
  partialStage?: 'TP1' | 'TP2' | 'TP3';
  partialPnL?: number;
  releasedMargin?: number;
  notification?: { title: string; body: string };
} {
  // If trade is already CLOSED or EXPIRED, no-op
  if (trade.status === 'CLOSED' || trade.status === 'EXPIRED') {
    return { updatedTrade: trade, closed: false };
  }

  const updated: PaperTrade = { ...trade, currentPrice };
  const portfolioConfig = trade.portfolioId ? PORTFOLIO_CONFIGS[trade.portfolioId] : PORTFOLIO_CONFIGS.PORTFOLIO_A;
  const portfolioLabel = portfolioConfig.shortName;

  // 1. If PENDING: check if price touches entry level
  if (updated.status === 'PENDING') {
    const isTouched =
      updated.side === 'LONG'
        ? currentPrice <= updated.entryPrice
        : currentPrice >= updated.entryPrice;

    if (isTouched) {
      // Check 0.5% slippage on trigger
      const diffPct = updated.signalPrice > 0 ? (Math.abs(currentPrice - updated.signalPrice) / updated.signalPrice) * 100 : 0;
      if (diffPct > 0.5) {
        updated.status = 'EXPIRED';
        updated.closeReason = 'EXPIRED';
        updated.closedAt = Date.now();
        updated.notes = `فاتت الصفقة (Expired): تحرك السعر بنسبة ${diffPct.toFixed(2)}% (> 0.5%) عن سعر الإشارة (${formatPrice(updated.signalPrice)})`;
        const notif = {
          title: `فاتت صفقة معلقة [${portfolioLabel}]: ${updated.symbol}`,
          body: `تحرك السعر بفارق ${diffPct.toFixed(2)}% عن الإشارة - تم تسجيلها كـ Expired.`,
        };
        sendTradingNotification(notif.title, notif.body, soundEnabled);
        return { updatedTrade: updated, closed: true, notification: notif };
      }

      updated.status = 'OPEN';
      updated.actualEntryPrice = currentPrice;
      updated.openedAt = Date.now();
      updated.highestPriceSeen = currentPrice;
      updated.lowestPriceSeen = currentPrice;

      const notif = {
        title: `تفعيل أمر معلق [${portfolioLabel}]: ${updated.symbol}`,
        body: `سعر الإشارة: ${formatPrice(updated.signalPrice)} | الدخول الفعلي: ${formatPrice(currentPrice)} - مفتوحة الآن.`,
      };
      sendTradingNotification(notif.title, notif.body, soundEnabled);
      return { updatedTrade: updated, closed: false, notification: notif };
    }

    return { updatedTrade: updated, closed: false };
  }

  // 2. If OPEN: Update high/low watermark
  if (currentPrice > updated.highestPriceSeen) updated.highestPriceSeen = currentPrice;
  if (currentPrice < updated.lowestPriceSeen) updated.lowestPriceSeen = currentPrice;

  // Calculate live unrealized PnL on remaining position size according to exact user formula:
  // PnL = (currentPrice - entryPrice) * size * (1 if Long, -1 if Short) / entryPrice
  const activePositionSize = updated.positionSize * updated.remainingSizeRatio;
  const rawPnl =
    updated.actualEntryPrice > 0
      ? ((currentPrice - updated.actualEntryPrice) / updated.actualEntryPrice) *
        activePositionSize *
        (updated.side === 'LONG' ? 1 : -1)
      : 0;

  // Total net PnL includes locked gross profit from partial TPs plus live raw PnL
  const totalNetPnl = Number((updated.grossPnl + rawPnl).toFixed(2));
  updated.netPnl = totalNetPnl;
  updated.pnlPercent =
    updated.margin > 0 ? Number(((totalNetPnl / updated.margin) * 100).toFixed(2)) : 0;

  const riskPerUnit = Math.abs(updated.actualEntryPrice - updated.originalStopLoss);
  const rewardPerUnit =
    updated.side === 'LONG'
      ? currentPrice - updated.actualEntryPrice
      : updated.actualEntryPrice - currentPrice;
  updated.rMultiple = riskPerUnit > 0 ? Number((rewardPerUnit / riskPerUnit).toFixed(2)) : 1.0;
    updated.side === 'LONG'
      ? currentPrice - updated.actualEntryPrice
      : updated.actualEntryPrice - currentPrice;
  updated.rMultiple = riskPerUnit > 0 ? Number((rewardPerUnit / riskPerUnit).toFixed(2)) : 1.0;

  // 3. Move Stop Loss to Break-even when 50% of distance towards TP1 is reached
  if (!updated.slMovedToBreakeven && updated.actualEntryPrice > 0 && updated.tp1 > 0) {
    const isLong = updated.side === 'LONG';
    const totalDist = isLong ? updated.tp1 - updated.actualEntryPrice : updated.actualEntryPrice - updated.tp1;
    const coveredDist = isLong ? currentPrice - updated.actualEntryPrice : updated.actualEntryPrice - currentPrice;
    if (totalDist > 0 && coveredDist >= 0.5 * totalDist) {
      updated.slMovedToBreakeven = true;
      updated.stopLoss = updated.actualEntryPrice;
      const notif = {
        title: `تأمين الصفقة (Break-even) [${portfolioLabel}]: ${updated.symbol} 🛡️`,
        body: `قطع السعر 50% من المسافة نحو TP1 - تم نقل الوقف تلقائياً إلى سعر الدخول ${formatPrice(updated.actualEntryPrice)}.`,
      };
      sendTradingNotification(notif.title, notif.body, soundEnabled);
    }
  }

  // 4. Check TP1 (Actual 50% Partial Close, Move SL to Entry Break-even, & Liberate 50% Margin)
  const isTp1Reached =
    !updated.tp1Hit &&
    (updated.side === 'LONG' ? currentPrice >= updated.tp1 : currentPrice <= updated.tp1);

  if (isTp1Reached) {
    updated.tp1Hit = true;
    const origMargin = updated.originalMargin || updated.margin;
    // Lock in profit for 50% of the position
    const closedSize = updated.positionSize * 0.5;
    const unitsClosed = closedSize / updated.actualEntryPrice;
    const lockedGrossPnl =
      updated.side === 'LONG'
        ? (updated.tp1 - updated.actualEntryPrice) * unitsClosed
        : (updated.actualEntryPrice - updated.tp1) * unitsClosed;
    const comm = 0.20; // 50% commission
    const lockedNetPnl = Number((lockedGrossPnl - comm).toFixed(2));

    updated.grossPnl += lockedGrossPnl;
    updated.remainingSizeRatio = 0.5; // Remaining: 50%
    const releasedMargin = Number((origMargin * 0.5).toFixed(2));
    updated.margin = Number((origMargin * 0.5).toFixed(2)); // Remaining margin: 50%
    updated.commissionPaid += comm;

    // Rule: عند وصول السعر إلى TP1: أغلق 50% من حجم الصفقة فوراً، وحدّث الرصيد، وانقل وقف الخسارة إلى سعر الدخول.
    updated.stopLoss = updated.actualEntryPrice;
    updated.slMovedToBreakeven = true;
    updated.slCalculationReason = 'نقل الوقف لسعر الدخول بعد TP1 (Break-even)';

    // تفعيل Trailing SL لحماية الأرباح عند استمرار السعر بعد TP1
    updated.trailingActive = true;
    const atrDist = updated.trailingDistance > 0 ? updated.trailingDistance : Math.abs(updated.tp1 - updated.actualEntryPrice) * 0.5;
    updated.trailingDistance = atrDist;

    const notif = {
      title: `${updated.symbol} حقق TP1! [${portfolioLabel}] 🎯`,
      body: `تحقيق الهدف الأول عند ${formatPrice(updated.tp1)} - إغلاق 50% فوراً (+${lockedNetPnl} USDT)، نقل الوقف للدخول، وتحرير $${releasedMargin} من الهامش.`,
    };
    sendTradingNotification(notif.title, notif.body, soundEnabled);
    return {
      updatedTrade: updated,
      closed: false,
      partialClosed: true,
      partialStage: 'TP1',
      partialPnL: lockedNetPnl,
      releasedMargin,
      notification: notif,
    };
  }

  // 5. Update Trailing Stop after TP1 is hit (moves 1.0 x ATR behind peak price)
  if (updated.trailingActive && updated.tp1Hit && !updated.tp2Hit) {
    const atrDist = updated.trailingDistance > 0 ? updated.trailingDistance : Math.abs(updated.tp1 - updated.actualEntryPrice) * 0.5;
    if (updated.side === 'LONG') {
      const newSl = updated.highestPriceSeen - atrDist;
      if (newSl > updated.stopLoss) {
        updated.stopLoss = newSl;
      }
    } else {
      const newSl = updated.lowestPriceSeen + atrDist;
      if (newSl < updated.stopLoss) {
        updated.stopLoss = newSl;
      }
    }
  }

  // 6. Check TP2 (Close 30% additional, move SL to TP1, & Liberate 30% Margin)
  const isTp2Reached =
    updated.tp1Hit &&
    !updated.tp2Hit &&
    (updated.side === 'LONG' ? currentPrice >= updated.tp2 : currentPrice <= updated.tp2);

  if (isTp2Reached) {
    updated.tp2Hit = true;
    const origMargin = updated.originalMargin || (updated.margin / 0.5);
    const closedSize = updated.positionSize * 0.3;
    const unitsClosed = closedSize / updated.actualEntryPrice;
    const lockedGross =
      updated.side === 'LONG'
        ? (updated.tp2 - updated.actualEntryPrice) * unitsClosed
        : (updated.actualEntryPrice - updated.tp2) * unitsClosed;
    const comm = 0.12;
    const lockedNet = Number((lockedGross - comm).toFixed(2));

    updated.grossPnl += lockedGross;
    updated.remainingSizeRatio = 0.2; // Remaining: 20%
    const releasedMargin = Number((origMargin * 0.3).toFixed(2));
    updated.margin = Number((origMargin * 0.2).toFixed(2)); // Remaining margin: 20%
    updated.commissionPaid += comm;

    // Rule: عند وصول السعر إلى TP2: أغلق 30% إضافية، وانقل وقف الخسارة إلى TP1.
    updated.stopLoss = updated.tp1;
    updated.slCalculationReason = 'نقل الوقف إلى TP1 بعد تحقيق TP2 لحجز الأرباح';

    const notif = {
      title: `${updated.symbol} حقق TP2! [${portfolioLabel}] 🚀`,
      body: `تحقيق الهدف الثاني عند ${formatPrice(updated.tp2)} - إغلاق 30% إضافية (+${lockedNet} USDT)، نقل الوقف إلى TP1، وتحرير $${releasedMargin} من الهامش.`,
    };
    sendTradingNotification(notif.title, notif.body, soundEnabled);
    return {
      updatedTrade: updated,
      closed: false,
      partialClosed: true,
      partialStage: 'TP2',
      partialPnL: lockedNet,
      releasedMargin,
      notification: notif,
    };
  }

  // 7. Check TP3 (Close remaining 20% and close the entire trade)
  if (updated.tp3 && !updated.tp3Hit && updated.tp2Hit) {
    const isTp3Reached =
      updated.side === 'LONG' ? currentPrice >= updated.tp3 : currentPrice <= updated.tp3;
    if (isTp3Reached) {
      updated.tp3Hit = true;
      updated.status = 'CLOSED';
      updated.closedAt = Date.now();
      updated.closeReason = 'TP3';
      updated.exitPrice = updated.tp3;

      const remainingUnits = (updated.positionSize * updated.remainingSizeRatio) / updated.actualEntryPrice;
      const finalGross =
        updated.side === 'LONG'
          ? (updated.tp3 - updated.actualEntryPrice) * remainingUnits
          : (updated.actualEntryPrice - updated.tp3) * remainingUnits;

      updated.grossPnl += finalGross;
      updated.remainingSizeRatio = 0;
      updated.commissionPaid += 0.08;
      const finalRemainingNet = Number((finalGross - 0.08).toFixed(2));
      updated.netPnl = Number((updated.grossPnl - updated.commissionPaid - updated.slippagePaid - updated.fundingPaid).toFixed(3));
      const origMargin = updated.originalMargin || 10;
      updated.pnlPercent = Number(((updated.netPnl / origMargin) * 100).toFixed(2));

      const releasedMargin = updated.margin;
      updated.margin = 0;

      const notif = {
        title: `${updated.symbol} بلغ TP3 بالكامل! [${portfolioLabel}] 🏆`,
        body: `إغلاق الـ 20% المتبقية عند أقصى هدف ${formatPrice(updated.tp3)} بربح إجمالي +${updated.netPnl} USDT (+${updated.rMultiple}R).`,
      };
      sendTradingNotification(notif.title, notif.body, soundEnabled);
      return {
        updatedTrade: updated,
        closed: true,
        partialStage: 'TP3',
        partialPnL: finalRemainingNet,
        releasedMargin,
        notification: notif,
      };
    }
  }

  // 8. Check Stop Loss / Trailing Stop Trigger
  const isSlHit =
    updated.side === 'LONG'
      ? currentPrice <= updated.stopLoss
      : currentPrice >= updated.stopLoss;

  if (isSlHit) {
    updated.status = 'CLOSED';
    updated.closedAt = Date.now();
    updated.exitPrice = updated.stopLoss;
    updated.closeReason = updated.trailingActive ? 'TRAILING_STOP' : 'SL';

    // Calculate final outcome for whatever remaining percentage was left
    const remainingUnits = (updated.positionSize * updated.remainingSizeRatio) / updated.actualEntryPrice;
    const slPnl =
      updated.side === 'LONG'
        ? (updated.stopLoss - updated.actualEntryPrice) * remainingUnits
        : (updated.actualEntryPrice - updated.stopLoss) * remainingUnits;

    updated.grossPnl += slPnl;
    updated.remainingSizeRatio = 0;
    updated.commissionPaid += 0.05;
    updated.netPnl = Number((updated.grossPnl - updated.commissionPaid - updated.slippagePaid - updated.fundingPaid).toFixed(3));
    updated.pnlPercent = Number(((updated.netPnl / updated.margin) * 100).toFixed(2));

    const isProfit = updated.netPnl > 0;
    const notif = {
      title: `إغلاق صفقة ${updated.symbol} [${portfolioLabel}] (${updated.closeReason === 'TRAILING_STOP' ? 'Trailing Stop' : 'Stop Loss'})`,
      body: `صفقة ${updated.symbol} مغلقة عند ${formatPrice(updated.exitPrice)} - النتيجة: ${
        isProfit ? `ربح +${updated.netPnl} USDT (+${updated.rMultiple}R)` : `خسارة ${updated.netPnl} USDT`
      }`,
    };
    sendTradingNotification(notif.title, notif.body, soundEnabled);
    return { updatedTrade: updated, closed: true, notification: notif };
  }

  return { updatedTrade: updated, closed: false };
}
