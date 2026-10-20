import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  FearAndGreedData,
  MultiTimeframeAnalysis,
  PriceAlert,
  Ticker24h,
  Timeframe,
  TradeRecord,
  PaperTrade,
  PaperAccount,
  EquityPoint,
  MarketRegimeInfo,
  PortfolioId,
  PortfolioState,
  ClosedTradeRecord,
} from '../types/crypto';
import {
  PORTFOLIO_CONFIGS,
  INITIAL_PAPER_ACCOUNT,
  createInitialAccount,
  createInitialPortfolios,
  canOpenNewTrade,
  createPaperTradeForPortfolio,
  processPaperTradeUpdate,
  computeCrossLiquidation,
  rebalanceCrossMarginPositions,
  sendTradingNotification,
} from '../services/paperTradingEngine';
import { isCryptoFuturesSymbol } from '../services/binanceApi';
import { getProjectStrengthScore } from '../services/projectStrengthService';
import { formatPrice } from '../utils/formatters';
import { getTradeTypeInfo } from '../utils/tradeTypes';

export type NavTab = 'home' | 'scanner' | 'active' | 'recommendations' | 'expert' | 'settings' | 'alerts' | 'performance' | 'journal';

export function getTimeframeMinutes(tf: Timeframe): number {
  switch (tf) {
    case '1m': return 1;
    case '5m': return 5;
    case '15m': return 15;
    case '1h': return 60;
    case '4h': return 240;
    case '1d': return 1440;
    case '3d': return 4320;
    case '1w': return 10080;
    default: return 15;
  }
}

export const getActivePid = (id: PortfolioId | 'ALL'): PortfolioId => (id === 'ALL' ? 'PORTFOLIO_A' : id);

interface CryptoState {
  // Navigation & UI
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  selectedSymbol: string;
  setSelectedSymbol: (symbol: string) => void;
  selectedTimeframe: Timeframe;
  setSelectedTimeframe: (tf: Timeframe) => void;
  isDetailModalOpen: boolean;
  setDetailModalOpen: (open: boolean) => void;
  isRiskModalOpen: boolean;
  setRiskModalOpen: (open: boolean) => void;

  // Real-time market data
  tickers: Record<string, Ticker24h>;
  topSymbols: string[];
  fundingRates: Record<string, number>;
  openInterests: Record<string, number>;
  priceChangesLastTick: Record<string, 'up' | 'down' | null>;
  wsConnected: boolean;
  fearAndGreed: FearAndGreedData | null;
  signalCache: Record<string, MultiTimeframeAnalysis>;

  // Market Regime & News Warnings
  marketRegime: MarketRegimeInfo | null;
  isNewsPaused: boolean;
  newsPausedHeadline: string;
  newsPausedUntil: number;

  // User Persisted Data
  watchlist: string[];
  tradeJournal: TradeRecord[];
  alerts: PriceAlert[];
  soundEnabled: boolean;
  notificationPermission: boolean;
  showChartLines: boolean;
  setShowChartLines: (show: boolean) => void;

  // Triple Parallel Portfolios State
  portfolios: Record<PortfolioId, PortfolioState>;
  activePortfolioId: PortfolioId | 'ALL';
  setActivePortfolioId: (id: PortfolioId | 'ALL') => void;
  maxConcurrentTradesPerPortfolio: number;
  setMaxConcurrentTradesPerPortfolio: (limit: number) => void;

  // Synced backward-compatible single account/trades accessors
  paperAccount: PaperAccount;
  paperTrades: PaperTrade[];
  equityHistory: EquityPoint[];
  closedTradesHistory: ClosedTradeRecord[];

  // Actions
  setWsConnected: (connected: boolean) => void;
  setTickers: (tickers: Ticker24h[]) => void;
  updateMarkPrices: (prices: Record<string, number>) => void;
  setFundingRates: (rates: Record<string, number>) => void;
  setOpenInterest: (symbol: string, oi: number) => void;
  setFearAndGreed: (data: FearAndGreedData) => void;
  setSignalForSymbol: (symbol: string, analysis: MultiTimeframeAnalysis) => void;
  setMarketRegime: (regime: MarketRegimeInfo) => void;
  setNewsPaused: (paused: boolean, headline?: string) => void;

  // Paper Trading Actions
  setAutoTradingEnabled: (enabled: boolean) => void;
  addPaperTrade: (trade: PaperTrade, targetPortfolio?: PortfolioId) => void;
  openTradeManually: (symbol: string, timeframe?: Timeframe) => boolean;
  closePaperTradeManually: (id: string, exitPrice?: number) => void;
  resetPortfolio: (portfolioId?: PortfolioId) => void;
  resetPaperAccount: () => void;
  evaluateAndExecuteSignal: (analysis: MultiTimeframeAnalysis, timeframe?: Timeframe) => boolean;
  processPaperTradesTick: (priceMap: Record<string, number>) => void;
  checkAndExpirePendingTrades: () => void;

  // Watchlist Actions
  toggleWatchlist: (symbol: string) => void;

  // Journal Actions
  addTrade: (trade: Omit<TradeRecord, 'id' | 'openedAt'>) => void;
  closeTrade: (id: string, exitPrice: number) => void;
  deleteTrade: (id: string) => void;

  // Alerts Actions
  addAlert: (alert: Omit<PriceAlert, 'id' | 'createdAt' | 'triggered'>) => void;
  deleteAlert: (id: string) => void;
  checkAndTriggerAlerts: (symbol: string, currentPrice: number) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setNotificationPermission: (enabled: boolean) => void;

  // Backup & Reset
  exportBackup: () => string;
  importBackup: (jsonStr: string) => boolean;
  clearAllUserData: () => void;
}

const initialPortfolios = createInitialPortfolios();

export const useCryptoStore = create<CryptoState>()(
  persist(
    (set, get) => ({
      activeTab: 'home',
      setActiveTab: (tab) => set({ activeTab: tab }),
      selectedSymbol: 'BTCUSDT',
      setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol, isDetailModalOpen: true }),
      selectedTimeframe: '15m',
      setSelectedTimeframe: (tf) => set({ selectedTimeframe: tf }),
      isDetailModalOpen: false,
      setDetailModalOpen: (open) => set({ isDetailModalOpen: open }),
      isRiskModalOpen: false,
      setRiskModalOpen: (open) => set({ isRiskModalOpen: open }),

      tickers: {},
      topSymbols: [],
      fundingRates: {},
      openInterests: {},
      priceChangesLastTick: {},
      wsConnected: false,
      fearAndGreed: null,
      signalCache: {},

      marketRegime: null,
      isNewsPaused: false,
      newsPausedHeadline: '',
      newsPausedUntil: 0,

      // 100% clean defaults - NO sample trades, NO hardcoded mock trades
      watchlist: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'SUIUSDT'],
      tradeJournal: [],
      alerts: [],
      soundEnabled: true,
      notificationPermission: false,
      showChartLines: false, // Default: false (clean chart as requested)
      setShowChartLines: (show) => set({ showChartLines: show }),

      // Triple Parallel Portfolios
      portfolios: initialPortfolios,
      activePortfolioId: 'ALL',
      setActivePortfolioId: (id) => set({ activePortfolioId: id }),
      maxConcurrentTradesPerPortfolio: 15,
      setMaxConcurrentTradesPerPortfolio: (limit) =>
        set({ maxConcurrentTradesPerPortfolio: Math.min(30, Math.max(5, Math.round(limit))) }),

      // Backward-compatible accessors
      paperAccount: initialPortfolios.PORTFOLIO_A.account,
      paperTrades: [],
      equityHistory: [],
      closedTradesHistory: [],

      setWsConnected: (connected) => set({ wsConnected: connected }),

      setTickers: (tickerList) => {
        const map: Record<string, Ticker24h> = {};
        const symbols: string[] = [];
        const priceMap: Record<string, number> = {};
        tickerList.forEach((t) => {
          map[t.symbol] = t;
          symbols.push(t.symbol);
          if (t.lastPrice > 0) {
            priceMap[t.symbol] = t.lastPrice;
          }
        });
        set({
          tickers: { ...get().tickers, ...map },
          topSymbols: symbols.slice(0, 30),
        });

        // Also process paper trades with fresh REST prices
        if (Object.keys(priceMap).length > 0) {
          get().processPaperTradesTick(priceMap);
        }
      },

      updateMarkPrices: (priceMap) => {
        const curTickers = { ...get().tickers };
        const tickChanges = { ...get().priceChangesLastTick };

        Object.entries(priceMap).forEach(([sym, price]) => {
          if (curTickers[sym]) {
            const oldPrice = curTickers[sym].lastPrice;
            if (price > oldPrice) tickChanges[sym] = 'up';
            else if (price < oldPrice) tickChanges[sym] = 'down';

            curTickers[sym] = {
              ...curTickers[sym],
              lastPrice: price,
            };
          }
          // trigger alert check
          get().checkAndTriggerAlerts(sym, price);
        });

        set({ tickers: curTickers, priceChangesLastTick: tickChanges });

        // Update active paper trades across all 3 portfolios simultaneously
        get().processPaperTradesTick(priceMap);
      },

      setFundingRates: (rates) => set((s) => ({ fundingRates: { ...s.fundingRates, ...rates } })),
      setOpenInterest: (sym, oi) => set((s) => ({ openInterests: { ...s.openInterests, [sym]: oi } })),
      setFearAndGreed: (data) => set({ fearAndGreed: data }),

      setSignalForSymbol: (symbol, analysis) => {
        set((s) => {
          const prev = s.signalCache[symbol];
          if (
            prev &&
            prev.overallSignal === analysis.overallSignal &&
            prev.confidence === analysis.confidence &&
            prev.agreedTimeframesCount === analysis.agreedTimeframesCount &&
            prev.targets.entry === analysis.targets.entry
          ) {
            return s;
          }
          return { signalCache: { ...s.signalCache, [symbol]: analysis } };
        });

        // Automatically evaluate signal for all 3 parallel portfolios
        get().evaluateAndExecuteSignal(analysis);
      },

      setMarketRegime: (regime) => set({ marketRegime: regime }),
      setNewsPaused: (paused, headline = '') =>
        set({
          isNewsPaused: paused,
          newsPausedHeadline: headline,
          newsPausedUntil: paused ? Date.now() + 15 * 60 * 1000 : 0,
        }),

      setAutoTradingEnabled: (enabled) =>
        set((s) => {
          const updatedPortfolios = { ...s.portfolios };
          (Object.keys(updatedPortfolios) as PortfolioId[]).forEach((pid) => {
            updatedPortfolios[pid] = {
              ...updatedPortfolios[pid],
              account: {
                ...updatedPortfolios[pid].account,
                autoTradingEnabled: enabled,
              },
            };
          });
          return {
            portfolios: updatedPortfolios,
            paperAccount: { ...s.paperAccount, autoTradingEnabled: enabled },
          };
        }),

      addPaperTrade: (trade, targetPortfolio = 'PORTFOLIO_A') =>
        set((s) => {
          const p = s.portfolios[targetPortfolio];
          const updatedTrades = [trade, ...p.trades];
          const newAccount = {
            ...p.account,
            balance: p.account.balance - (trade.status === 'OPEN' ? trade.margin : 0),
            marginUsed: p.account.marginUsed + (trade.status === 'OPEN' ? trade.margin : 0),
            totalTradesCount: p.account.totalTradesCount + 1,
            openPositionsCount: updatedTrades.filter((t) => t.status === 'OPEN').length,
            pendingPositionsCount: updatedTrades.filter((t) => t.status === 'PENDING').length,
          };
          const updatedPortfolios = {
            ...s.portfolios,
            [targetPortfolio]: {
              ...p,
              account: newAccount,
              trades: updatedTrades,
            },
          };
          const activePid = getActivePid(s.activePortfolioId);
          return {
            portfolios: updatedPortfolios,
            paperTrades: updatedPortfolios[activePid].trades,
            paperAccount: updatedPortfolios[activePid].account,
          };
        }),

      openTradeManually: (symbol: string, timeframe: Timeframe = '15m') => {
        const { portfolios, tickers, signalCache, soundEnabled } = get();
        const cachedAnalysis = signalCache[symbol];
        const livePrice = tickers[symbol]?.lastPrice || (cachedAnalysis?.currentPrice) || 100;
        const side = cachedAnalysis ? (cachedAnalysis.overallDirection === 'BULLISH' ? 'LONG' : 'SHORT') : 'LONG';
        const isLong = side === 'LONG';

        const precision = livePrice > 0 ? (livePrice < 1 ? 4 : livePrice < 10 ? 3 : 2) : 2;
        const roundDec = (val: number) => Number(val.toFixed(precision));

        // Dynamic Multi-Timeframe ATR multiplier based on requested timeframe
        const typeInfo = getTradeTypeInfo(timeframe);
        const atrMult = typeInfo.atrMultiplier;
        const fallbackPct = timeframe === '1d' || timeframe === '3d' || timeframe === '1w' ? 0.04 : timeframe === '4h' ? 0.025 : 0.015;
        const estAtr = cachedAnalysis?.supportResistance?.nearestSupport
          ? Math.abs(livePrice - cachedAnalysis.supportResistance.nearestSupport)
          : livePrice * fallbackPct;
        const minSlDist = Math.max(livePrice * fallbackPct * 0.8, estAtr * atrMult);
        const slPrice = isLong ? roundDec(livePrice - minSlDist) : roundDec(livePrice + minSlDist);
        const tp1Price = isLong ? roundDec(livePrice + minSlDist * 1.6) : roundDec(livePrice - minSlDist * 1.6);
        const tp2Price = isLong ? roundDec(livePrice + minSlDist * 2.5) : roundDec(livePrice - minSlDist * 2.5);
        const tp3Price = isLong ? roundDec(livePrice + minSlDist * 3.5) : roundDec(livePrice - minSlDist * 3.5);

        const pattern = cachedAnalysis?.setupPattern || 'BREAKOUT';
        const patternNameArabic = cachedAnalysis?.patternNameArabic || 'Breakout (اختراق هيكلي)';

        const analysis: MultiTimeframeAnalysis = cachedAnalysis || {
          symbol,
          overallSignal: 'STRONG_BUY',
          overallDirection: 'BULLISH',
          confidence: 85,
          agreedTimeframesCount: 5,
          totalTimeframesCount: 6,
          timeframeResults: {} as any,
          setupPattern: pattern,
          patternNameArabic,
          executionStatus: 'READY_NOW',
          executionStatusArabic: 'جاهزة للتنفيذ الآن',
          recommendation: 'ادخل الآن',
          conditionsMet: ['دخول يدوي مباشر بطلب المستخدم'],
          warnings: [],
          scoreBreakdown: {
            totalScore: 85,
            timeframeAlignment: 20,
            emaTrendStrength: 15,
            riskReward: 10,
            volume: 10,
            marketRegimeMatch: 15,
            rsiQuality: 8,
            macdConfirmation: 7,
            supportResistanceClear: 5,
            executionCategory: 'INSTANT',
            executionCategoryArabic: 'تنفيذ فوري ⚡',
          },
          targets: {
            entry: livePrice,
            tp1: tp1Price,
            tp2: tp2Price,
            tp3: tp3Price,
            sl: slPrice,
            tp1Percent: Number((((tp1Price - livePrice) / livePrice) * 100).toFixed(2)),
            tp2Percent: Number((((tp2Price - livePrice) / livePrice) * 100).toFixed(2)),
            tp3Percent: Number((((tp3Price - livePrice) / livePrice) * 100).toFixed(2)),
            slPercent: Number((((slPrice - livePrice) / livePrice) * 100).toFixed(2)),
            riskRewardRatio: 1.6,
            entryDistancePercent: 0,
            tp1AtrDistance: 2.4,
            tp2AtrDistance: 3.8,
            slAtrDistance: atrMult,
            slCalculationReason: `SL: ATR(${timeframe}) × ${atrMult} (يدوي)`,
          },
          currentPrice: livePrice,
          explanation: `صفقة ${typeInfo.label} مفتوحة يدوياً لتجاوز فلاتر البوت وبدء التداول الفوري`,
          bullishScenario: '',
          bearishScenario: '',
          volatilityStatus: 'طبيعي',
          momentumStatus: 'قوي',
          supportResistance: { supports: [], resistances: [], nearestSupport: 0, nearestResistance: 0 },
          timeframe,
          tradeType: typeInfo.type,
          tradeTypeLabel: typeInfo.label,
          tradeTypeLabelArabic: typeInfo.labelArabic,
          timestamp: Date.now(),
        };

        const pIds: PortfolioId[] = ['PORTFOLIO_A', 'PORTFOLIO_B', 'PORTFOLIO_C'];
        const updatedPortfolios = { ...portfolios };
        let openedCount = 0;

        pIds.forEach((pid) => {
          const p = portfolios[pid];
          const cfg = PORTFOLIO_CONFIGS[pid];

          const openTrades = p.trades.filter((t) => t.status === 'OPEN');
          const marginUsed = openTrades.reduce((acc, t) => acc + t.margin, 0);
          const availableBalance = Math.max(0, p.account.balance - marginUsed);
          if (availableBalance < cfg.marginPerTrade) return;

          const alreadyOpen = openTrades.some((t) => t.symbol === symbol);
          if (alreadyOpen) return;

          const newTrade = createPaperTradeForPortfolio(analysis, pid, timeframe, livePrice);
          newTrade.status = 'OPEN';
          newTrade.actualEntryPrice = livePrice;
          newTrade.entryPrice = livePrice;
          newTrade.openedAt = Date.now();
          newTrade.closeReason = undefined;
          newTrade.remainingSizeRatio = 1.0;
          newTrade.stopLoss = slPrice;
          newTrade.originalStopLoss = slPrice;
          newTrade.tp1 = tp1Price;
          newTrade.tp2 = tp2Price;
          newTrade.tp3 = tp3Price;
          newTrade.pattern = pattern;
          newTrade.patternNameArabic = patternNameArabic;

          openedCount++;
          const newBalance = Math.max(0, Number((p.account.balance - 0.40).toFixed(2)));
          let newTrades = [newTrade, ...p.trades.filter((t) => !(t.symbol === symbol && t.status === 'PENDING'))];
          const activeOpen = newTrades.filter((t) => t.status === 'OPEN');
          const newMarginUsed = activeOpen.reduce((acc, t) => acc + t.margin, 0);
          const totalUnrealized = activeOpen.reduce((acc, t) => acc + (t.netPnl || 0), 0);
          const currentEquity = Math.max(0, Number((newBalance + totalUnrealized).toFixed(2)));
          const totalExposure = activeOpen.length * 1000;

          newTrades = newTrades.map((t) => {
            if (t.status === 'OPEN') {
              const crossLiq = computeCrossLiquidation(
                t.actualEntryPrice,
                t.side,
                currentEquity,
                activeOpen.length,
                t.positionSize
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

          const marginRatioPercent = newBalance > 0 ? (newMarginUsed / newBalance) * 100 : 0;
          const newAccount: PaperAccount = {
            ...p.account,
            balance: newBalance,
            equity: currentEquity,
            marginUsed: Number(newMarginUsed.toFixed(2)),
            marginRatioPercent: Number(marginRatioPercent.toFixed(1)),
            totalTradesCount: p.account.totalTradesCount + 1,
            openPositionsCount: activeOpen.length,
            pendingPositionsCount: newTrades.filter((t) => t.status === 'PENDING').length,
          };

          updatedPortfolios[pid] = {
            ...p,
            account: newAccount,
            trades: newTrades,
          };
        });

        if (openedCount > 0) {
          const activePid = getActivePid(get().activePortfolioId);
          set({
            portfolios: updatedPortfolios,
            paperTrades: updatedPortfolios[activePid].trades,
            paperAccount: updatedPortfolios[activePid].account,
            equityHistory: updatedPortfolios[activePid].equityHistory,
          });

          sendTradingNotification(
            `تم فتح صفقة ${symbol} يدوياً بنجاح ⚡`,
            `سعر الدخول المباشر: $${formatPrice(livePrice)} • أصبحت ظاهرة فوراً في صفحة "نشطة".`,
            soundEnabled
          );
          return true;
        }
        return false;
      },

      closePaperTradeManually: (id, exitPrice) => {
        const { portfolios, soundEnabled, closedTradesHistory } = get();
        let changed = false;
        const updatedPortfolios = { ...portfolios };
        const newClosedRecords: ClosedTradeRecord[] = [];

        (Object.keys(portfolios) as PortfolioId[]).forEach((pid) => {
          const p = portfolios[pid];
          const tradeIndex = p.trades.findIndex((t) => t.id === id);
          if (tradeIndex === -1) return;

          const trade = p.trades[tradeIndex];
          if (trade.status === 'CLOSED' || trade.status === 'EXPIRED') return;

          changed = true;
          const effectiveExit = exitPrice || trade.currentPrice;
          const diff =
            trade.side === 'LONG'
              ? effectiveExit - trade.actualEntryPrice
              : trade.actualEntryPrice - effectiveExit;
          const units = (trade.positionSize * trade.remainingSizeRatio) / trade.actualEntryPrice;
          const gross = Number(((diff * units) + trade.grossPnl).toFixed(3));
          const comm = trade.commissionPaid + 0.005;
          const net = Number((gross - comm - trade.slippagePaid - trade.fundingPaid).toFixed(3));
          const pnlPct = Number(((net / trade.margin) * 100).toFixed(2));

          const updatedTrade: PaperTrade = {
            ...trade,
            status: 'CLOSED',
            exitPrice: effectiveExit,
            closedAt: Date.now(),
            closeReason: 'MANUAL',
            grossPnl: gross,
            netPnl: net,
            pnlPercent: pnlPct,
            commissionPaid: comm,
            remainingSizeRatio: 0,
          };

          const isLoss = net < 0;
          const consecutiveLosses = isLoss ? p.account.consecutiveLosses + 1 : 0;
          const coolDownUntil =
            consecutiveLosses >= 3 ? Date.now() + 3600000 : p.account.coolDownUntil;

          // Realize net PnL into cash wallet balance
          const newBalance = Math.max(0, Number((p.account.balance + net).toFixed(3)));

          // Record in closedTradesHistory directly
          const closedRecord: ClosedTradeRecord = {
            id: trade.id,
            portfolioId: pid,
            symbol: trade.symbol,
            side: trade.side,
            pattern: trade.pattern,
            patternNameArabic: trade.patternNameArabic || trade.pattern,
            timeframe: trade.timeframe,
            entryPrice: trade.actualEntryPrice,
            exitPrice: effectiveExit,
            netPnl: net,
            pnlPercent: pnlPct,
            result: net > 0 ? 'win' : net < 0 ? 'loss' : 'breakeven',
            closeReason: 'MANUAL',
            rMultiple: trade.rMultiple || 1.0,
            margin: trade.margin,
            leverage: trade.leverage,
            openedAt: trade.openedAt || trade.createdAt,
            closedAt: Date.now(),
            score: trade.score,
            notes: trade.notes,
          };
          newClosedRecords.push(closedRecord);

          // Rebalance remaining OPEN trades across the portfolio in Cross Margin
          let newTrades = [...p.trades];
          newTrades[tradeIndex] = updatedTrade;
          newTrades = rebalanceCrossMarginPositions(newTrades, newBalance);

          const openPositions = newTrades.filter((t) => t.status === 'OPEN');
          const totalUnrealized = openPositions.reduce((acc, t) => acc + t.netPnl, 0);
          const newEquity = Math.max(0, Number((newBalance + totalUnrealized).toFixed(3)));
          const newMarginUsed = openPositions.length > 0 ? newBalance : 0;
          const newMarginRatio = openPositions.length > 0 ? 100 : 0;

          const newAccount: PaperAccount = {
            ...p.account,
            balance: newBalance,
            marginUsed: Number(newMarginUsed.toFixed(3)),
            marginRatioPercent: newMarginRatio,
            equity: newEquity,
            openPositionsCount: openPositions.length,
            closedPositionsCount: p.account.closedPositionsCount + 1,
            consecutiveLosses,
            coolDownUntil,
          };

          const newPoint: EquityPoint = {
            timestamp: Date.now(),
            equity: newEquity,
            balance: newBalance,
            tradeId: id,
            pnl: net,
          };

          updatedPortfolios[pid] = {
            ...p,
            account: newAccount,
            trades: newTrades,
            equityHistory: [...p.equityHistory, newPoint],
          };

          sendTradingNotification(
            `إغلاق يدوي [${p.config.shortName}]: ${trade.symbol}`,
            `النتيجة: ${net >= 0 ? `ربح +${net} USDT` : `خسارة ${net} USDT`}`,
            soundEnabled
          );
        });

        if (changed) {
          const activePid = getActivePid(get().activePortfolioId);
          set({
            portfolios: updatedPortfolios,
            paperTrades: updatedPortfolios[activePid].trades,
            paperAccount: updatedPortfolios[activePid].account,
            equityHistory: updatedPortfolios[activePid].equityHistory,
            closedTradesHistory: [...newClosedRecords, ...closedTradesHistory],
          });
        }
      },

      resetPortfolio: (portfolioId) => {
        const { portfolios } = get();
        const updatedPortfolios = { ...portfolios };

        if (portfolioId) {
          updatedPortfolios[portfolioId] = {
            config: PORTFOLIO_CONFIGS[portfolioId],
            account: createInitialAccount(),
            trades: [],
            equityHistory: [],
          };
        } else {
          // Reset all 3 portfolios
          (Object.keys(updatedPortfolios) as PortfolioId[]).forEach((pid) => {
            updatedPortfolios[pid] = {
              config: PORTFOLIO_CONFIGS[pid],
              account: createInitialAccount(),
              trades: [],
              equityHistory: [],
            };
          });
        }

        const activePid = getActivePid(get().activePortfolioId);
        set({
          portfolios: updatedPortfolios,
          paperAccount: updatedPortfolios[activePid].account,
          paperTrades: updatedPortfolios[activePid].trades,
          equityHistory: updatedPortfolios[activePid].equityHistory,
        });
      },

      resetPaperAccount: () => {
        get().resetPortfolio();
      },

      /**
       * Evaluates signal and executes it across ALL 3 PARALLEL PORTFOLIOS simultaneously
       * Criteria:
       * - Total Score >= 70: Instant Execution (Market entry)
       * - Total Score 55-69: Pending Watch (Limit order at entry)
       * - Total Score < 55: Ignore
       */
      evaluateAndExecuteSignal: (analysis, timeframe = '15m') => {
        const { portfolios, marketRegime, isNewsPaused, soundEnabled, tickers } = get();

        // 1. Strict verification: only verified Crypto Futures contracts
        if (!isCryptoFuturesSymbol(analysis.symbol)) {
          return false;
        }

        // 2. Reject losing patterns (Only Retest, Breakout, Pullback allowed)
        if ((analysis.setupPattern as string) === 'REVERSAL' || (analysis.setupPattern as string) === 'RANGE') {
          return false;
        }

        // 3. Reject Moderate and Weak coins (< 60 points) based on CoinGecko analysis
        const projectStrength = getProjectStrengthScore(analysis.symbol);
        if (projectStrength.totalScore < 60) {
          return false;
        }

        const score = analysis.scoreBreakdown?.totalScore ?? analysis.confidence;

        // Ignore signals with score < 55
        if (score < 55) {
          return false;
        }

        const side = analysis.overallDirection === 'BULLISH' ? 'LONG' : 'SHORT';

        // 3.5 Top-Down Macro Trend Filter (1D & 1W Rule):
        // - افحص فريم اليومي (1D) والأسبوعي (1W) للعملة قبل فتح الصفقة
        // - إذا كان 1D و 1W صاعدين: يُسمح فقط بصفقات Long
        // - إذا كان 1D و 1W هابطين: يُسمح فقط بصفقات Short
        // - إذا كانا متضاربين: يُرفض فتح الصفقة
        if (analysis.macroTrend === 'CONFLICTING') {
          return false;
        }
        if (side === 'LONG' && analysis.macroTrend !== 'BULLISH') {
          return false;
        }
        if (side === 'SHORT' && analysis.macroTrend !== 'BEARISH') {
          return false;
        }

        // 4. Live Real-Time Price from WebSocket
        const livePrice = tickers[analysis.symbol]?.lastPrice || analysis.currentPrice || analysis.targets.entry;

        // Auto-resume from news pause if 15 minutes expired
        let effectiveNewsPaused = isNewsPaused;
        const pauseUntil = get().newsPausedUntil;
        if (effectiveNewsPaused && pauseUntil && Date.now() >= pauseUntil) {
          set({ isNewsPaused: false, newsPausedHeadline: '', newsPausedUntil: 0 });
          effectiveNewsPaused = false;
        }

        const pIds: PortfolioId[] = ['PORTFOLIO_A', 'PORTFOLIO_B', 'PORTFOLIO_C'];
        const updatedPortfolios = { ...portfolios };
        const executedPortfolios: string[] = [];
        let anyExpired = false;
        let lastCreatedTrade: PaperTrade | null = null;
        let portfolioARejectedDueToLiq = false;
        let portfolioARejectionReason = '';

        pIds.forEach((pid) => {
          const p = portfolios[pid];
          const cfg = PORTFOLIO_CONFIGS[pid];
          const slDist = Math.abs(analysis.targets.slPercent);
          // Liquidation Protection and free margin check
          const check = canOpenNewTrade(
            analysis.symbol,
            side,
            analysis.setupPattern,
            p.trades,
            p.account,
            marketRegime,
            effectiveNewsPaused,
            cfg.marginPerTrade,
            score,
            9999,
            undefined,
            pid,
            slDist,
            timeframe
          );

          if (!check.allowed) {
            if (pid === 'PORTFOLIO_A' && (check.reason?.includes('حماية التصفية') || slDist > cfg.liquidationDistancePercent)) {
              portfolioARejectedDueToLiq = true;
              portfolioARejectionReason = check.reason || `مسافة الوقف (${slDist.toFixed(1)}%) أكبر من مسافة التصفية (${cfg.liquidationDistancePercent.toFixed(1)}%) للمحفظة A`;
            }
            return;
          }

          // Create trade using real live price and check 0.5% slippage
          const newTrade = createPaperTradeForPortfolio(analysis, pid, timeframe, livePrice);
          lastCreatedTrade = newTrade;

          if (newTrade.status === 'EXPIRED') {
            // Price moved > 0.5% from signal price -> Do NOT open trade, register as Expired
            anyExpired = true;
            const newTrades = [newTrade, ...p.trades];
            updatedPortfolios[pid] = {
              ...p,
              trades: newTrades,
            };
            return;
          }

          executedPortfolios.push(cfg.shortName);

          // Deduct $0.40 commission only if trade actually opens
          const newBalance = Math.max(0, Number((p.account.balance - 0.40).toFixed(2)));

          let newTrades = [newTrade, ...p.trades];
          const activeOpen = newTrades.filter((t) => t.status === 'OPEN');
          const marginUsed = activeOpen.reduce((acc, t) => acc + t.margin, 0);
          const totalUnrealized = activeOpen.reduce((acc, t) => acc + (t.netPnl || 0), 0);
          const currentEquity = Math.max(0, Number((newBalance + totalUnrealized).toFixed(2)));
          const totalExposure = activeOpen.reduce((acc, t) => acc + (t.positionSize || 1000), 0);

          // Recompute Cross liquidation for all open positions in this portfolio
          newTrades = newTrades.map((t) => {
            if (t.status === 'OPEN') {
              const crossLiq = computeCrossLiquidation(
                t.actualEntryPrice,
                t.side,
                currentEquity,
                activeOpen.length,
                t.positionSize
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

          const marginRatioPercent = newBalance > 0 ? (marginUsed / newBalance) * 100 : 0;

          const newAccount: PaperAccount = {
            ...p.account,
            balance: newBalance,
            equity: currentEquity,
            marginUsed: Number(marginUsed.toFixed(2)),
            marginRatioPercent: Number(marginRatioPercent.toFixed(1)),
            totalTradesCount: p.account.totalTradesCount + 1,
            openPositionsCount: activeOpen.length,
            pendingPositionsCount: newTrades.filter((t) => t.status === 'PENDING').length,
          };

          updatedPortfolios[pid] = {
            ...p,
            account: newAccount,
            trades: newTrades,
          };
        });

        if (portfolioARejectedDueToLiq) {
          const currentSig = get().signalCache[analysis.symbol] || analysis;
          set((s) => ({
            signalCache: {
              ...s.signalCache,
              [analysis.symbol]: {
                ...currentSig,
                portfolioARejected: true,
                portfolioARejectionReason,
              },
            },
          }));
        }

        if (executedPortfolios.length > 0) {
          const activePid = getActivePid(get().activePortfolioId);
          set({
            portfolios: updatedPortfolios,
            paperTrades: updatedPortfolios[activePid].trades,
            paperAccount: updatedPortfolios[activePid].account,
            equityHistory: updatedPortfolios[activePid].equityHistory,
          });

          if (lastCreatedTrade) {
            const t = lastCreatedTrade as PaperTrade;
            const liqNote = portfolioARejectedDueToLiq ? ' • ⚠️ تم تجاوز المحفظة A (حماية التصفية)' : '';
            sendTradingNotification(
              `دخول حقيقي في المحافظ [${executedPortfolios.join(', ')}]: ${analysis.symbol} ⚡`,
              `سعر الإشارة: ${formatPrice(t.signalPrice)} | سعر الدخول الفعلي: ${formatPrice(t.actualEntryPrice)} • ${t.slCalculationReason || 'SL: ATR × 1.5'}${liqNote}`,
              soundEnabled
            );
          }
          return true;
        }

        if (anyExpired && lastCreatedTrade) {
          const activePid = getActivePid(get().activePortfolioId);
          set({
            portfolios: updatedPortfolios,
            paperTrades: updatedPortfolios[activePid].trades,
          });
          const t = lastCreatedTrade as PaperTrade;
          sendTradingNotification(
            `فاتت الصفقة (Expired): ${analysis.symbol} ⏱️`,
            `تحرك السعر (${t.priceDiffPercent}%) بأكثر من 0.5% عن سعر الإشارة (${formatPrice(t.signalPrice)} vs ${formatPrice(t.actualEntryPrice)})`,
            soundEnabled
          );
          return false;
        }

        return false;
      },

      /**
       * Real-time tick engine updating active trades across ALL 3 PORTFOLIOS
       * Each portfolio is independent: If A is liquidated at 1%, B (2%) and C (4%) continue!
       */
      processPaperTradesTick: (priceMap) => {
        const { portfolios, soundEnabled, closedTradesHistory } = get();
        let anyChanged = false;
        const updatedPortfolios = { ...portfolios };
        const newClosedHistoryRecords: ClosedTradeRecord[] = [];

        (Object.keys(portfolios) as PortfolioId[]).forEach((pid) => {
          const p = portfolios[pid];
          let portChanged = false;
          let newlyClosedCount = 0;
          let newlyLiquidatedCount = 0;
          let newlyOpenedCount = 0;
          let realizedPnLDelta = 0;
          let consecutiveLosses = p.account.consecutiveLosses;
          let coolDownUntil = p.account.coolDownUntil;

          let updatedTrades = p.trades.map((t) => {
            const livePrice = priceMap[t.symbol];
            if (!livePrice || t.status === 'CLOSED' || t.status === 'EXPIRED') return t;

            const prevStatus = t.status;
            const { updatedTrade, closed, partialClosed, partialStage, partialPnL, releasedMargin } = processPaperTradeUpdate(t, livePrice, soundEnabled);

            if (partialClosed && partialPnL) {
              portChanged = true;
              realizedPnLDelta += partialPnL;

              // Record partial close directly in closedTradesHistory with reason TP1 / TP2
              const stage = partialStage || 'TP1';
              const partialRec: ClosedTradeRecord = {
                id: `${updatedTrade.id}-${stage.toLowerCase()}-${Date.now()}`,
                portfolioId: pid,
                symbol: updatedTrade.symbol,
                side: updatedTrade.side,
                pattern: updatedTrade.pattern,
                patternNameArabic: updatedTrade.patternNameArabic || updatedTrade.pattern,
                timeframe: updatedTrade.timeframe,
                tradeType: updatedTrade.tradeType,
                tradeTypeLabel: updatedTrade.tradeTypeLabel,
                tradeTypeLabelArabic: updatedTrade.tradeTypeLabelArabic,
                macroTrend: updatedTrade.macroTrend,
                macroTrendLabel: updatedTrade.macroTrendLabel,
                macroTrendSummaryArabic: updatedTrade.macroTrendSummaryArabic,
                entryPrice: updatedTrade.actualEntryPrice,
                exitPrice: stage === 'TP1' ? updatedTrade.tp1 : updatedTrade.tp2,
                netPnl: partialPnL,
                pnlPercent: Number(((partialPnL / (releasedMargin || updatedTrade.margin || 1)) * 100).toFixed(2)),
                result: 'win',
                closeReason: stage,
                rMultiple: stage === 'TP1' ? 1.0 : 1.5,
                margin: releasedMargin || (updatedTrade.margin * 0.5),
                leverage: updatedTrade.leverage,
                openedAt: updatedTrade.openedAt || updatedTrade.createdAt,
                closedAt: Date.now(),
                score: updatedTrade.score,
                notes: stage === 'TP1'
                  ? `إغلاق جزئي 50% عند الهدف الأول TP1 ($${formatPrice(updatedTrade.tp1)}) ونقل الوقف إلى سعر الدخول`
                  : `إغلاق جزئي 30% إضافي عند الهدف الثاني TP2 ($${formatPrice(updatedTrade.tp2)}) ونقل الوقف إلى TP1`,
              };
              newClosedHistoryRecords.push(partialRec);
            }

            if (prevStatus === 'PENDING' && updatedTrade.status === 'OPEN') {
              portChanged = true;
              newlyOpenedCount++;
            }

            if (closed) {
              portChanged = true;
              newlyClosedCount++;

              if (updatedTrade.closeReason === 'LIQUIDATED') {
                newlyLiquidatedCount++;
                realizedPnLDelta -= (updatedTrade.originalMargin || updatedTrade.margin);
              } else if (updatedTrade.closeReason === 'TP3') {
                realizedPnLDelta += (partialPnL || 0);
              } else {
                realizedPnLDelta += updatedTrade.netPnl;
              }

              // Push to direct closed trades history
              const historyRec: ClosedTradeRecord = {
                id: updatedTrade.id,
                portfolioId: pid,
                symbol: updatedTrade.symbol,
                side: updatedTrade.side,
                pattern: updatedTrade.pattern,
                patternNameArabic: updatedTrade.patternNameArabic || updatedTrade.pattern,
                timeframe: updatedTrade.timeframe,
                tradeType: updatedTrade.tradeType,
                tradeTypeLabel: updatedTrade.tradeTypeLabel,
                tradeTypeLabelArabic: updatedTrade.tradeTypeLabelArabic,
                macroTrend: updatedTrade.macroTrend,
                macroTrendLabel: updatedTrade.macroTrendLabel,
                macroTrendSummaryArabic: updatedTrade.macroTrendSummaryArabic,
                entryPrice: updatedTrade.actualEntryPrice,
                exitPrice: updatedTrade.exitPrice || livePrice,
                netPnl: updatedTrade.netPnl,
                pnlPercent: updatedTrade.pnlPercent,
                result: updatedTrade.netPnl > 0 ? 'win' : updatedTrade.netPnl < 0 ? 'loss' : 'breakeven',
                closeReason: updatedTrade.closeReason || (updatedTrade.netPnl < 0 ? 'SL' : 'TP3'),
                rMultiple: updatedTrade.rMultiple || 1.0,
                margin: updatedTrade.originalMargin || updatedTrade.margin,
                leverage: updatedTrade.leverage,
                openedAt: updatedTrade.openedAt || updatedTrade.createdAt,
                closedAt: updatedTrade.closedAt || Date.now(),
                score: updatedTrade.score,
                notes: updatedTrade.notes || (updatedTrade.closeReason === 'TP3' ? 'إغلاق كامل عند TP3' : undefined),
              };
              newClosedHistoryRecords.push(historyRec);

              if (updatedTrade.netPnl < 0) {
                consecutiveLosses++;
                if (consecutiveLosses >= 3) {
                  coolDownUntil = Date.now() + 3600000;
                  sendTradingNotification(
                    `توقف مؤقت للحماية [${p.config.shortName}]`,
                    'تم إيقاف فتح الصفقات لمدة ساعة لحماية رأس المال بعد 3 خسائر متتالية.',
                    soundEnabled
                  );
                }
              } else {
                consecutiveLosses = 0;
              }
            } else if (
              updatedTrade.netPnl !== t.netPnl ||
              updatedTrade.tp1Hit !== t.tp1Hit ||
              updatedTrade.tp2Hit !== t.tp2Hit ||
              updatedTrade.currentPrice !== t.currentPrice
            ) {
              portChanged = true;
            }

            return updatedTrade;
          });

          if (portChanged) {
            anyChanged = true;

            let newBalance = Math.max(0, Number((p.account.balance + realizedPnLDelta).toFixed(2)));

            // Sum unrealized PnL across all open positions
            const openPositions = updatedTrades.filter((t) => t.status === 'OPEN');
            const totalUnrealizedPnl = openPositions.reduce((acc, t) => acc + (t.netPnl || 0), 0);

            let newEquity = Number((newBalance + totalUnrealizedPnl).toFixed(2));

            // Portfolio liquidation if entire Equity hits <= 0
            if (newEquity <= 0 && openPositions.length > 0) {
              newEquity = 0;
              newBalance = 0;
              updatedTrades = updatedTrades.map((t) => {
                if (t.status === 'OPEN') {
                  const liqRec: ClosedTradeRecord = {
                    id: t.id,
                    portfolioId: pid,
                    symbol: t.symbol,
                    side: t.side,
                    pattern: t.pattern,
                    patternNameArabic: t.patternNameArabic || t.pattern,
                    timeframe: t.timeframe,
                    entryPrice: t.actualEntryPrice,
                    exitPrice: t.currentPrice || t.actualEntryPrice,
                    netPnl: -t.margin,
                    pnlPercent: -100,
                    result: 'loss',
                    closeReason: 'LIQUIDATED',
                    rMultiple: -1.0,
                    margin: t.margin,
                    leverage: t.leverage,
                    openedAt: t.openedAt || t.createdAt,
                    closedAt: Date.now(),
                    score: t.score,
                    notes: 'تصفية Cross كاملة (وصول رأس المال Equity إلى الصفر)',
                  };
                  newClosedHistoryRecords.push(liqRec);

                  return {
                    ...t,
                    status: 'CLOSED' as const,
                    closedAt: Date.now(),
                    closeReason: 'LIQUIDATED' as const,
                    notes: 'تصفية Cross كاملة (وصول رأس المال Equity إلى الصفر)',
                    remainingSizeRatio: 0,
                    netPnl: -t.margin,
                  };
                }
                return t;
              });

              sendTradingNotification(
                `🚨 تصفية كامل المحفظة [${p.config.shortName}]!`,
                'وصل رأس المال (Equity) إلى الصفر - تم تصفية جميع الصفقات المفتوحة.',
                soundEnabled
              );
            } else if (openPositions.length > 0) {
              // Dynamically update Cross Liquidation and total exposure for each open trade
              const totalExp = openPositions.length * 1000;
              updatedTrades = updatedTrades.map((t) => {
                if (t.status === 'OPEN') {
                  const crossLiq = computeCrossLiquidation(
                    t.actualEntryPrice,
                    t.side,
                    newEquity,
                    openPositions.length,
                    t.positionSize
                  );
                  return {
                    ...t,
                    liquidationPrice: crossLiq.liquidationPrice,
                    liquidationDistancePercent: crossLiq.liquidationDistancePercent,
                    totalExposure: totalExp,
                  };
                }
                return t;
              });
            }

            const activeRemainingOpen = updatedTrades.filter((t) => t.status === 'OPEN');
            const newMarginUsed = activeRemainingOpen.reduce((acc, t) => acc + t.margin, 0);
            const newMarginRatio = newBalance > 0 ? (newMarginUsed / newBalance) * 100 : 0;

            const newAccount: PaperAccount = {
              ...p.account,
              balance: newBalance,
              marginUsed: Number(newMarginUsed.toFixed(2)),
              marginRatioPercent: Number(newMarginRatio.toFixed(1)),
              equity: Math.max(0, newEquity),
              openPositionsCount: activeRemainingOpen.length,
              pendingPositionsCount: updatedTrades.filter((t) => t.status === 'PENDING').length,
              closedPositionsCount: p.account.closedPositionsCount + newlyClosedCount,
              liquidatedPositionsCount: (p.account.liquidatedPositionsCount || 0) + newlyLiquidatedCount,
              consecutiveLosses,
              coolDownUntil,
            };

            const newEquityHistory =
              newlyClosedCount > 0
                ? [
                    ...p.equityHistory,
                    {
                      timestamp: Date.now(),
                      equity: Math.max(0, newEquity),
                      balance: newBalance,
                    },
                  ]
                : p.equityHistory;

            updatedPortfolios[pid] = {
              ...p,
              account: newAccount,
              trades: updatedTrades,
              equityHistory: newEquityHistory,
            };
          }
        });

        if (anyChanged) {
          const activePid = getActivePid(get().activePortfolioId);
          set({
            portfolios: updatedPortfolios,
            paperTrades: updatedPortfolios[activePid].trades,
            paperAccount: updatedPortfolios[activePid].account,
            equityHistory: updatedPortfolios[activePid].equityHistory,
            closedTradesHistory:
              newClosedHistoryRecords.length > 0
                ? [...newClosedHistoryRecords, ...closedTradesHistory]
                : closedTradesHistory,
          });

          // Capacity liberated: auto-execute top qualifying signals in cache into newly freed margin
          if (newClosedHistoryRecords.length > 0) {
            setTimeout(() => {
              const cachedSignals = Object.values(get().signalCache);
              for (const sig of cachedSignals) {
                const sc = sig.scoreBreakdown?.totalScore ?? sig.confidence;
                if (sc >= 70 && (sig.targets?.riskRewardRatio || 0) >= 1.5) {
                  get().evaluateAndExecuteSignal(sig, '15m');
                }
              }
            }, 50);
          }
        }
      },

      /**
       * Invalidation of expired pending paper trades across all portfolios
       * (Cancels after 3 candles on the referenced timeframe)
       */
      checkAndExpirePendingTrades: () => {
        const { portfolios, soundEnabled } = get();
        const now = Date.now();
        let changed = false;
        const updatedPortfolios = { ...portfolios };

        (Object.keys(portfolios) as PortfolioId[]).forEach((pid) => {
          const p = portfolios[pid];
          let portChanged = false;

          const updatedTrades = p.trades.map((t) => {
            if (t.status === 'PENDING') {
              const limitMinutes = 3 * getTimeframeMinutes(t.timeframe);
              const elapsedMinutes = (now - t.createdAt) / 60000;

              if (elapsedMinutes >= limitMinutes) {
                portChanged = true;
                return {
                  ...t,
                  status: 'EXPIRED' as const,
                  closedAt: now,
                  closeReason: 'EXPIRED' as const,
                };
              }
            }
            return t;
          });

          if (portChanged) {
            changed = true;
            updatedPortfolios[pid] = {
              ...p,
              trades: updatedTrades,
              account: {
                ...p.account,
                pendingPositionsCount: updatedTrades.filter((t) => t.status === 'PENDING').length,
              },
            };
          }
        });

        if (changed) {
          sendTradingNotification(
            'انتهاء صلاحية أوامر معلقة ⌛',
            'تم إلغاء الإشارات المعلقة تلقائياً لعدم وصول السعر لنقطة الدخول خلال 3 شمعات.',
            soundEnabled
          );
          const activePid = getActivePid(get().activePortfolioId);
          set({
            portfolios: updatedPortfolios,
            paperTrades: updatedPortfolios[activePid].trades,
            paperAccount: updatedPortfolios[activePid].account,
          });
        }
      },

      // Watchlist Actions
      toggleWatchlist: (symbol) =>
        set((s) => {
          const exists = s.watchlist.includes(symbol);
          return {
            watchlist: exists ? s.watchlist.filter((x) => x !== symbol) : [...s.watchlist, symbol],
          };
        }),

      // Journal Actions
      addTrade: (trade) =>
        set((s) => ({
          tradeJournal: [
            {
              ...trade,
              id: `j-${Date.now()}`,
              openedAt: Date.now(),
            },
            ...s.tradeJournal,
          ],
        })),

      closeTrade: (id, exitPrice) =>
        set((s) => ({
          tradeJournal: s.tradeJournal.map((t) => {
            if (t.id === id) {
              const diff = t.side === 'LONG' ? exitPrice - t.entryPrice : t.entryPrice - exitPrice;
              const pnl = Number(((diff / t.entryPrice) * (t.margin * t.leverage)).toFixed(2));
              const pnlPercent = Number(((pnl / t.margin) * 100).toFixed(2));
              const rMultiple = Number((pnl / (t.margin * 0.1)).toFixed(2));
              return {
                ...t,
                exitPrice,
                status: 'CLOSED',
                closedAt: Date.now(),
                pnl,
                pnlPercent,
                rMultiple,
              };
            }
            return t;
          }),
        })),

      deleteTrade: (id) =>
        set((s) => ({
          tradeJournal: s.tradeJournal.filter((t) => t.id !== id),
        })),

      // Alerts Actions
      addAlert: (alert) =>
        set((s) => ({
          alerts: [
            {
              ...alert,
              id: `alert-${Date.now()}`,
              createdAt: Date.now(),
              triggered: false,
            },
            ...s.alerts,
          ],
        })),

      deleteAlert: (id) =>
        set((s) => ({
          alerts: s.alerts.filter((a) => a.id !== id),
        })),

      checkAndTriggerAlerts: (symbol, currentPrice) => {
        const { alerts, soundEnabled } = get();
        let triggeredAny = false;

        const updated = alerts.map((a) => {
          if (a.symbol === symbol && !a.triggered) {
            const isHit =
              (a.condition === 'ABOVE' && currentPrice >= a.targetPrice) ||
              (a.condition === 'BELOW' && currentPrice <= a.targetPrice);

            if (isHit) {
              triggeredAny = true;
              sendTradingNotification(
                `🔔 تنبيه سعر: ${symbol}`,
                `وصل السعر إلى $${currentPrice} (${a.condition === 'ABOVE' ? 'أعلى من' : 'أدنى من'} ${a.targetPrice})`,
                soundEnabled
              );
              return { ...a, triggered: true, triggeredAt: Date.now() };
            }
          }
          return a;
        });

        if (triggeredAny) {
          set({ alerts: updated });
        }
      },

      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
      setNotificationPermission: (enabled) => set({ notificationPermission: enabled }),

      // Backup & Reset
      exportBackup: () => {
        const { watchlist, tradeJournal, alerts, portfolios } = get();
        return JSON.stringify(
          {
            version: '3.0',
            app: 'CryptoSignalsPro',
            exportedAt: new Date().toISOString(),
            watchlist,
            tradeJournal,
            alerts,
            portfolios,
          },
          null,
          2
        );
      },

      importBackup: (jsonStr) => {
        try {
          const data = JSON.parse(jsonStr);
          if (data && data.app === 'CryptoSignalsPro') {
            const importedPortfolios = data.portfolios || createInitialPortfolios();
            set({
              watchlist: Array.isArray(data.watchlist) ? data.watchlist : get().watchlist,
              tradeJournal: Array.isArray(data.tradeJournal) ? data.tradeJournal : get().tradeJournal,
              alerts: Array.isArray(data.alerts) ? data.alerts : get().alerts,
              portfolios: importedPortfolios,
              paperAccount: importedPortfolios.PORTFOLIO_A.account,
              paperTrades: importedPortfolios.PORTFOLIO_A.trades,
              equityHistory: importedPortfolios.PORTFOLIO_A.equityHistory,
            });
            return true;
          }
        } catch (e) {
          console.error('Failed to import backup JSON:', e);
        }
        return false;
      },

      /**
       * Thorough data clearance: removes localStorage and resets to clean state
       * with NO sample trades, NO historical noise, 100% clean portfolios
       */
      clearAllUserData: () => {
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem('crypto-signals-pro-v9-clean-atr15-60plus');
            window.localStorage.removeItem('crypto-signals-pro-v8-clean-rules');
            window.localStorage.removeItem('crypto-signals-pro-v7-pure-cross-1000');
            window.localStorage.removeItem('crypto-signals-pro-v6-crypto-futures-1000');
            window.localStorage.removeItem('crypto-signals-pro-v5-triple-parallel');
            window.localStorage.removeItem('crypto-signals-pro-v4-cross-rotation');
            window.localStorage.removeItem('crypto-signals-pro-v3-triple-portfolio');
            window.localStorage.removeItem('crypto-signals-pro-storage-v2');
            window.localStorage.removeItem('crypto-signals-pro-storage');
            window.localStorage.removeItem('last_portfolio_rotation');
          }
        } catch (e) {
          console.error('Failed to clear localStorage:', e);
        }

        const freshPortfolios = createInitialPortfolios();
        set({
          watchlist: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'SUIUSDT'],
          tradeJournal: [],
          alerts: [],
          signalCache: {},
          portfolios: freshPortfolios,
          activePortfolioId: 'ALL',
          paperAccount: freshPortfolios.PORTFOLIO_A.account,
          paperTrades: [],
          equityHistory: [],
          closedTradesHistory: [],
        });
      },
    }),
    {
      name: 'crypto-signals-pro-v9-clean-atr15-60plus',
      version: 9,
      partialize: (state) => ({
        watchlist: state.watchlist,
        tradeJournal: state.tradeJournal,
        alerts: state.alerts,
        soundEnabled: state.soundEnabled,
        notificationPermission: state.notificationPermission,
        showChartLines: state.showChartLines,
        portfolios: state.portfolios,
        activePortfolioId: state.activePortfolioId,
        maxConcurrentTradesPerPortfolio: state.maxConcurrentTradesPerPortfolio,
        closedTradesHistory: state.closedTradesHistory,
      }),
    }
  )
);
