export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '3d' | '1w';

export type SignalType = 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
export type DirectionType = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type SignalStrength = 'HIGH' | 'MEDIUM' | 'LOW';

export type SetupPattern = 'BREAKOUT' | 'RETEST' | 'PULLBACK';
export type TradeExecutionStatus = 'READY_NOW' | 'WAITING_PRICE' | 'IGNORE';

export interface SignalScoreBreakdown {
  totalScore: number; // 0 to 100
  timeframeAlignment: number; // 0 to 25 (5 pts per matching timeframe)
  emaTrendStrength: number; // 0 to 15 (EMA 20/50/200 alignment)
  riskReward: number; // 0 to 10 (>= 1:2 -> 10, >= 1:1.5 -> 7, >= 1:1 -> 3)
  volume: number; // 0 to 10 (>1.5x -> 10, >1.2x -> 5)
  marketRegimeMatch: number; // 0 to 15 (market regime match with setup)
  rsiQuality: number; // 0 to 10 (RSI in ideal zone)
  macdConfirmation: number; // 0 to 10 (MACD confirmation)
  supportResistanceClear: number; // 0 to 5 (no blocking S/R hurdle)
  executionCategory: 'INSTANT' | 'WATCH' | 'IGNORE'; // >=70: instant, 55-69: watch, <55: ignore
  executionCategoryArabic: string; // 'تنفيذ فوري' | 'مراقبة / معلق' | 'تجاهل'
}

export type BtcCorrelationCategory = 'FOLLOWER' | 'COUNTER' | 'INDEPENDENT';

export interface BtcCorrelationInfo {
  coefficient: number; // e.g. 0.85, -0.32, 0.45
  category: BtcCorrelationCategory;
  categoryArabic: string; // 'تابعة للبتكوين' | 'معاكسة للبتكوين' | 'مستقلة'
  descriptionArabic: string;
}

export interface Ticker24h {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  quoteVolume: number;
  fundingRate?: number;
  openInterest?: number;
}

export interface Candle {
  time: number; // in seconds for lightweight-charts
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorValues {
  ema20?: number;
  ema50?: number;
  ema200?: number;
  rsi?: number;
  macd?: {
    macd: number;
    signal: number;
    histogram: number;
  };
  bollinger?: {
    upper: number;
    middle: number;
    lower: number;
  };
  atr?: number;
}

export interface SupportResistance {
  resistances: number[];
  supports: number[];
  nearestResistance: number;
  nearestSupport: number;
}

export interface TimeframeSignal {
  timeframe: Timeframe;
  direction: 'صاعد' | 'هابط' | 'محايد';
  signal: 'شراء' | 'بيع' | 'انتظار';
  strength: 'عالية' | 'متوسطة' | 'منخفضة';
  score: number; // -100 to 100
  rsi: number;
  trendReason: string;
}

export interface TradeTarget {
  entry: number;
  tp1: number;
  tp2: number;
  tp3?: number;
  sl: number;
  tp1Percent: number;
  tp2Percent: number;
  tp3Percent?: number;
  slPercent: number;
  riskRewardRatio: number;
  tp1AtrDistance: number; // in multiples of ATR, e.g. 1.8x
  tp2AtrDistance: number;
  tp3AtrDistance?: number;
  slAtrDistance: number;
  entryDistancePercent: number; // % distance from current price to proposed entry
  isWeakTrade: boolean;
  weakTradeReason?: string;
  slCalculationReason?: string;
  atr14?: number;
}

export interface MultiTimeframeAnalysis {
  symbol: string;
  overallSignal: SignalType;
  overallDirection: DirectionType;
  confidence: number; // 0 to 100
  agreedTimeframesCount: number;
  totalTimeframesCount: number;
  timeframeResults: Record<Timeframe, TimeframeSignal>;
  setupPattern: SetupPattern;
  patternNameArabic: string;
  executionStatus: TradeExecutionStatus;
  executionStatusArabic: string;
  executionCategory?: string;
  executionCategoryArabic?: string;
  recommendation: 'ادخل الآن' | 'انتظر السعر' | 'تجاهل';
  conditionsMet: string[];
  warnings: string[];
  scoreBreakdown: SignalScoreBreakdown;
  targets: TradeTarget;
  currentPrice: number;
  explanation: string;
  bullishScenario: string;
  bearishScenario: string;
  volatilityStatus: string;
  momentumStatus: string;
  supportResistance: SupportResistance;
  btcCorrelation?: BtcCorrelationInfo;
  projectStrength?: ProjectStrengthScore;
  timestamp: number;
}

export interface TradeRecord {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  leverage: number;
  entryPrice: number;
  exitPrice?: number;
  stopLoss: number;
  takeProfit: number;
  margin: number; // in USDT
  status: 'OPEN' | 'CLOSED';
  pnl?: number;
  pnlPercent?: number;
  rMultiple?: number;
  reason?: string;
  openedAt: number;
  closedAt?: number;
  projectStrength?: ProjectStrengthScore;
}

export interface PriceAlert {
  id: string;
  symbol: string;
  condition: 'ABOVE' | 'BELOW';
  targetPrice: number;
  createdPrice: number;
  createdAt: number;
  triggered: boolean;
  triggeredAt?: number;
  note?: string;
}

export interface FearAndGreedData {
  value: number;
  classification: string;
  timestamp: string;
}

export interface MarketNewsItem {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  publishedTimestamp?: number;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  imageUrl?: string;
  categories?: string[];
  body?: string;
  isHighImpact?: boolean;
}

export interface BinanceAnnouncementItem {
  id: string;
  title: string;
  code?: string;
  type?: number;
  releaseDate: number;
  classification: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'; // 🟢 Will List/Will Add/Partnership | 🔴 Will Delist/Will Remove/Security Issue | 🟡 Neutral
  affectedSymbol?: string; // e.g. 'BTC' or 'BTCUSDT'
  actionUrl?: string;
}

export type ProjectStrengthTier =
  | 'VERY_STRONG' // 80-100 🟢 قوي جداً
  | 'STRONG'      // 60-79 🟢 قوي
  | 'MODERATE'    // 40-59 🟡 متوسط
  | 'WEAK'        // 20-39 🔴 ضعيف
  | 'VERY_WEAK';  // 0-19 🔴 ضعيف جداً

export interface ProjectStrengthScore {
  symbol: string; // e.g. 'BTCUSDT'
  baseAsset: string; // e.g. 'BTC'
  name: string;
  totalScore: number; // 0 - 100
  tier: ProjectStrengthTier;
  tierArabic: string; // 'قوي جداً' | 'قوي' | 'متوسط' | 'ضعيف' | 'ضعيف جداً'
  marketCapScore: number; // 0 - 30
  ageScore: number; // 0 - 20
  volToMcRatioScore: number; // 0 - 20
  communityScore: number; // 0 - 15
  categoryScore: number; // 0 - 15
  categoryName: string; // 'Layer 1' | 'DeFi' | 'Layer 2' | 'AI' | 'Meme' | 'Gaming' | 'Other'
  marketCapUsd: number;
  volume24hUsd: number;
  volToMcRatio: number;
  ageYears: number;
  coinGeckoRank: number;
  updatedAt: number;
}

export type MarketRegime = 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGING' | 'VOLATILE';

export interface MarketRegimeInfo {
  regime: MarketRegime;
  titleArabic: string;
  descriptionArabic: string;
  allowedTradeSides: 'LONG_ONLY' | 'SHORT_ONLY' | 'RANGE_ONLY' | 'HALTED';
  btcPrice: number;
  ema20: number;
  ema50: number;
  ema200: number;
  rsi: number;
  atrRatio: number; // current ATR / avg ATR
  updatedAt: number;
}

export type PortfolioId = 'PORTFOLIO_A' | 'PORTFOLIO_B' | 'PORTFOLIO_C';

export interface PortfolioConfig {
  id: PortfolioId;
  name: string; // e.g. 'المحفظة A (الرافعة 100x)'
  shortName: string; // 'المحفظة A'
  leverage: number; // 100, 50, 25
  marginPerTrade: number; // 10, 20, 40
  positionSize: number; // 1000
  maxConcurrentTrades: number; // 20 for A, 15 for B, 10 for C
  liquidationDistancePercent: number;
  badgeColor: string; // 'rose' | 'amber' | 'emerald'
  description: string;
}

export type PaperTradeStatus = 'PENDING' | 'OPEN' | 'CLOSED' | 'EXPIRED';

export type PaperCloseReason =
  | 'TP1'
  | 'TP2'
  | 'TP3'
  | 'SL'
  | 'TRAILING_STOP'
  | 'MANUAL'
  | 'EXPIRED'
  | 'LIQUIDATED';

export interface PaperTrade {
  id: string;
  portfolioId?: PortfolioId;
  symbol: string;
  side: 'LONG' | 'SHORT';
  pattern: SetupPattern;
  patternNameArabic: string;
  timeframe: Timeframe;
  status: PaperTradeStatus;
  entryPrice: number;
  signalPrice: number; // سعر الإشارة الأصلي X
  actualEntryPrice: number; // سعر الدخول الفعلي Y
  priceDiffPercent?: number; // فارق السعر بين الإشارة والفعلي %
  slCalculationReason?: string; // 'SL محسوب من: ATR × 1.5'
  currentPrice: number;
  exitPrice?: number;
  stopLoss: number;
  originalStopLoss: number;
  tp1: number;
  tp2: number;
  tp3?: number;
  tp1Hit: boolean;
  tp2Hit: boolean;
  tp3Hit: boolean;
  slMovedToBreakeven: boolean;
  trailingActive: boolean;
  trailingDistance: number; // 1x ATR
  highestPriceSeen: number; // for Long trailing stop
  lowestPriceSeen: number;  // for Short trailing stop
  margin: number; // 10 USDT (A), 20 (B), 40 (C)
  originalMargin?: number;
  leverage: number; // 100x (A), 50x (B), 25x (C)
  positionSize: number; // 1000 USDT fixed
  remainingSizeRatio: number; // 1.0 -> 0.5 after TP1 -> 0.2 after TP2 -> 0 after TP3/SL
  liquidationPrice: number; // Cross Margin liquidation price
  liquidationDistancePercent: number; // Distance % to Cross liquidation
  totalExposure?: number; // Total open exposure of portfolio ($1000 * count)
  commissionPaid: number; // 0.04% round trade ($0.40)
  slippagePaid: number;   // 0.05% in + 0.05% out
  fundingPaid: number;    // funding rate applied every 8h
  grossPnl: number;
  netPnl: number;         // grossPnl - commission - slippage - funding
  pnlPercent: number;     // on margin
  rMultiple: number;
  candlesElapsed: number; // candle count elapsed while PENDING (limit: 3)
  cluster: string;        // correlation cluster: 'L1' | 'MEME' | 'L2' | 'AI' | 'DEFI' | 'OTHER'
  btcCorrelation?: BtcCorrelationInfo;
  projectStrength?: ProjectStrengthScore;
  projectStrengthScore?: number;
  projectStrengthTierArabic?: string;
  score?: number;         // Signal score out of 100
  scoreBreakdown?: SignalScoreBreakdown;
  createdAt: number;
  openedAt?: number;
  closedAt?: number;
  closeReason?: PaperCloseReason;
  notes?: string;
}

export interface ClosedTradeRecord {
  id: string;
  portfolioId: PortfolioId;
  symbol: string;
  side: 'LONG' | 'SHORT';
  pattern: SetupPattern;
  patternNameArabic: string;
  timeframe: Timeframe;
  entryPrice: number;
  exitPrice: number;
  netPnl: number;
  pnlPercent: number;
  result: 'win' | 'loss' | 'breakeven';
  closeReason: PaperCloseReason;
  rMultiple: number;
  margin: number;
  leverage: number;
  openedAt: number;
  closedAt: number;
  score?: number;
  notes?: string;
}

export interface EquityPoint {
  timestamp: number;
  equity: number;
  balance: number;
  tradeId?: string;
  pnl?: number;
}

export interface PaperAccount {
  initialBalance: number; // default 100 USDT
  balance: number;        // available balance in USDT
  equity: number;         // balance + unrealized PnL
  marginUsed: number;     // total active margin used in USDT
  marginRatioPercent?: number; // e.g. 100%, 50%, 33.3%
  totalTradesCount: number;
  openPositionsCount: number;
  pendingPositionsCount: number;
  closedPositionsCount: number;
  liquidatedPositionsCount: number;
  consecutiveLosses: number;
  coolDownUntil: number;  // timestamp if cool-down is active
  autoTradingEnabled: boolean;
  lastFundingDeduction: number;
}

export interface PortfolioState {
  config: PortfolioConfig;
  account: PaperAccount;
  trades: PaperTrade[];
  equityHistory: EquityPoint[];
}

export interface OrderBlock {
  type: 'BULLISH' | 'BEARISH';
  high: number;
  low: number;
  startIndex: number;
  mitigated: boolean;
}

export interface FairValueGap {
  type: 'BULLISH' | 'BEARISH';
  top: number;
  bottom: number;
  index: number;
  filled: boolean;
}

export interface SmartMoneyConcepts {
  orderBlocks: OrderBlock[];
  fvgList: FairValueGap[];
  bos: { type: 'BULLISH' | 'BEARISH'; price: number; index: number } | null;
  choch: { type: 'BULLISH' | 'BEARISH'; price: number; index: number } | null;
  equalHighs: number[];
  equalLows: number[];
}

export interface IchimokuValues {
  tenkan: number | null;
  kijun: number | null;
  senkouA: number | null;
  senkouB: number | null;
  chikou: number | null;
}

export interface PivotPointsData {
  pivot: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
}

export interface BacktestResult {
  periodDays: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  avgR: number;
  netProfitUsdt: number;
  netProfitPercent: number;
  maxDrawdownPercent: number;
  equityCurve: { date: string; equity: number }[];
  trades: PaperTrade[];
  byPattern: Record<SetupPattern, { count: number; winRate: number; netPnl: number; avgR: number }>;
}

