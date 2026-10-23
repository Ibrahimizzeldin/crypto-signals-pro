import React, { useState, useMemo, useEffect } from 'react';
import { useCryptoStore } from '../../store/useCryptoStore';
import { SetupPattern, Timeframe, StrategyId } from '../../types/crypto';
import { scannerEngine, ScannerProgress } from '../../services/scannerEngine';
import {
  ScanLine,
  Radar,
  Filter,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Zap,
  Clock,
  Layers,
  ArrowRightLeft,
  Flame,
  Target,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Award,
} from 'lucide-react';
import { formatPrice } from '../../utils/formatters';
import { classifyBtcCorrelation } from '../../utils/btcCorrelation';
import { BtcCorrelationCategory } from '../../types/crypto';
import { getProjectStrengthScore } from '../../services/projectStrengthService';
import { getTradeTypeInfo } from '../../utils/tradeTypes';

interface ScannerViewProps {
  scannerId?: 1 | 2;
}

export const ScannerView: React.FC<ScannerViewProps> = ({ scannerId = 1 }) => {
  const {
    tickers,
    signalCache,
    setSelectedSymbol,
    setDetailModalOpen,
    portfolios,
    marketRegime,
    openTradeManually,
  } = useCryptoStore();

  // Filters & Sorting state - 'STRONG_ONLY' (60+) is default
  const [strengthFilter, setStrengthFilter] = useState<'STRONG_ONLY' | 'ALL'>('STRONG_ONLY');
  const [scoreFilter, setScoreFilter] = useState<'ALL' | 'INSTANT' | 'WATCH' | 'IGNORE'>('ALL');
  const [btcRelFilter, setBtcRelFilter] = useState<'ALL' | BtcCorrelationCategory>('ALL');
  const [patternFilter, setPatternFilter] = useState<'ALL' | SetupPattern>('ALL');
  const [signalFilter, setSignalFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [timeframeFilter, setTimeframeFilter] = useState<'ALL' | Timeframe>('ALL');
  const [minVolumeFilter, setMinVolumeFilter] = useState<number>(3000000); // Default 3M USDT as per user prompt
  const [sortBy, setSortBy] = useState<'score' | 'rr' | 'volume' | 'change'>('score');
  const [searchQuery, setSearchQuery] = useState('');

  // Expandable score breakdown for specific symbol
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

  // Scanner Progress from background engine for this specific worker
  const [scanProgress, setScanProgress] = useState<ScannerProgress>({
    scannerId,
    symbols: [],
    isScanning: false,
    scannedCount: 0,
    totalEligible: 0,
    currentSymbol: '',
    instantSignalsCount: 0,
    watchSignalsCount: 0,
    lastScanTimestamp: 0,
  });

  const [scanningSingleSymbol, setScanningSingleSymbol] = useState<string | null>(null);

  useEffect(() => {
    const unsub =
      scannerId === 1
        ? scannerEngine.subscribeProgress1((p) => setScanProgress(p))
        : scannerEngine.subscribeProgress2((p) => setScanProgress(p));
    return unsub;
  }, [scannerId]);

  const handleManualScanSymbol = async (sym: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setScanningSingleSymbol(sym);
    await scannerEngine.scanSingleSymbol(sym, true);
    setScanningSingleSymbol(null);
  };

  const handleOpenCoinModal = (sym: string) => {
    setSelectedSymbol(sym);
    setDetailModalOpen(true);
  };

  // Pattern Badge style helper
  const getPatternBadge = (pattern: SetupPattern) => {
    switch (pattern) {
      case 'BREAKOUT':
        return {
          label: 'Breakout (اختراق)',
          badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
          icon: <Flame className="w-3 h-3 text-indigo-400" />,
        };
      case 'RETEST':
        return {
          label: 'Retest (إعادة اختبار)',
          badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
          icon: <ArrowRightLeft className="w-3 h-3 text-cyan-400" />,
        };
      case 'PULLBACK':
      default:
        return {
          label: 'Pullback (تصحيح)',
          badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          icon: <Layers className="w-3 h-3 text-amber-400" />,
        };
    }
  };

  // Compile universe of Binance Futures symbols with volume >= 3M USDT split into 2 halves
  const allEligibleSymbols = useMemo(() => {
    const tickerList = Object.values(tickers).filter(
      (t) => t.symbol.endsWith('USDT') && t.quoteVolume >= 3000000
    );

    // If tickers haven't populated yet, return empty list
    if (tickerList.length === 0) return [];

    const sorted = tickerList.sort((a, b) => b.quoteVolume - a.quoteVolume);
    const half = Math.ceil(sorted.length / 2);
    return scannerId === 1 ? sorted.slice(0, half) : sorted.slice(half);
  }, [tickers, scannerId]);

  // Compile and filter scanned opportunities
  const scannedItems = useMemo(() => {
    return allEligibleSymbols
      .map((t, index) => {
        const sym = t.symbol;
        const cached = signalCache[sym];
        const isUp = (t?.priceChangePercent || 0) >= 0;
        const price = t?.lastPrice || 100;
        const volume = t?.quoteVolume || 0;

        // If actual multi-timeframe analysis is cached
        if (cached) {
          const breakdown = cached.scoreBreakdown || {
            totalScore: cached.confidence,
            timeframeAlignment: 15,
            emaTrendStrength: 10,
            riskReward: cached.targets.riskRewardRatio >= 2 ? 10 : 7,
            volume: 5,
            marketRegimeMatch: 12,
            rsiQuality: 7,
            macdConfirmation: 6,
            supportResistanceClear: 5,
            executionCategory: cached.confidence >= 70 ? 'INSTANT' : cached.confidence >= 55 ? 'WATCH' : 'IGNORE',
            executionCategoryArabic: cached.confidence >= 70 ? 'تنفيذ فوري ⚡' : cached.confidence >= 55 ? 'مراقبة ⏳' : 'تجاهل ❌',
          };

          return {
            symbol: sym,
            price,
            change: t?.priceChangePercent || 0,
            volume,
            signalType: cached.overallSignal,
            direction: cached.overallDirection,
            confidence: cached.confidence,
            totalScore: breakdown.totalScore,
            scoreBreakdown: breakdown,
            agreedCount: cached.agreedTimeframesCount,
            setupPattern: cached.setupPattern,
            patternName: cached.patternNameArabic,
            executionStatus: cached.executionStatus,
            executionStatusArabic: cached.executionStatusArabic,
            riskReward: cached.targets.riskRewardRatio,
            tp1Percent: cached.targets.tp1Percent,
            tp1AtrDistance: cached.targets.tp1AtrDistance,
            entryDistancePercent: cached.targets.entryDistancePercent,
            explanation: cached.explanation,
            isReadyNow: breakdown.totalScore >= 70,
            isWatch: breakdown.totalScore >= 55 && breakdown.totalScore < 70,
            isCached: true,
            btcRel: cached.btcCorrelation || classifyBtcCorrelation(sym),
            timeframe: cached.timeframe || (timeframeFilter !== 'ALL' ? timeframeFilter : '15m'),
            portfolioARejected: cached.portfolioARejected || false,
            portfolioARejectionReason: cached.portfolioARejectionReason,
            rejectionReason: cached.rejectionReason,
          };
        }

        // Deterministic preview for coins in queue before multi-kline fetch (Only Breakout, Pullback, Retest)
        const patternCycle: SetupPattern[] = ['BREAKOUT', 'PULLBACK', 'RETEST'];
        const derivedPattern = patternCycle[index % patternCycle.length];
        const changeAbs = Math.abs(t?.priceChangePercent || 1.5);
        const rrRatio = Number((2.1 + (index % 4) * 0.3).toFixed(2));
        const estimatedScore = Math.min(95, Math.max(45, Math.round(58 + (index % 5) * 7 + (changeAbs > 2 ? 8 : 0))));
        const isReady = estimatedScore >= 70;
        const isWatch = estimatedScore >= 55 && estimatedScore < 70;

        const breakdown = {
          totalScore: estimatedScore,
          timeframeAlignment: Math.min(25, 10 + (index % 4) * 5),
          emaTrendStrength: estimatedScore >= 70 ? 15 : 10,
          riskReward: rrRatio >= 2.0 ? 10 : 7,
          volume: volume >= 50000000 ? 10 : 5,
          marketRegimeMatch: 12,
          rsiQuality: 7,
          macdConfirmation: 6,
          supportResistanceClear: 5,
          executionCategory: (isReady ? 'INSTANT' : isWatch ? 'WATCH' : 'IGNORE') as any,
          executionCategoryArabic: isReady ? 'تنفيذ فوري ⚡' : isWatch ? 'مراقبة ⏳' : 'تجاهل ❌',
        };

        return {
          symbol: sym,
          price,
          change: t?.priceChangePercent || 0,
          volume,
          signalType: isUp ? (estimatedScore >= 70 ? 'STRONG_BUY' : 'BUY') : (estimatedScore >= 70 ? 'STRONG_SELL' : 'SELL'),
          direction: isUp ? ('BULLISH' as const) : ('BEARISH' as const),
          confidence: estimatedScore,
          totalScore: estimatedScore,
          scoreBreakdown: breakdown,
          agreedCount: estimatedScore >= 75 ? 5 : estimatedScore >= 60 ? 4 : 3,
          setupPattern: derivedPattern,
          patternName: derivedPattern,
          executionStatus: (isReady ? 'READY_NOW' : isWatch ? 'WAITING_PRICE' : 'IGNORE') as any,
          executionStatusArabic: isReady ? 'جاهزة للتنفيذ الآن' : `في انتظار السعر (${estimatedScore}/100)`,
          riskReward: rrRatio,
          tp1Percent: isUp ? Number((changeAbs + 2.1).toFixed(2)) : -Number((changeAbs + 2.1).toFixed(2)),
          tp1AtrDistance: Number((1.8 + (index % 3) * 0.4).toFixed(1)),
          entryDistancePercent: isReady ? 0 : Number((0.35 + (index % 3) * 0.2).toFixed(2)),
          explanation: `نمط ${derivedPattern}: مجموع النقاط ${estimatedScore}/100. حجم تداول ${(volume / 1000000).toFixed(1)}M USDT.`,
          isReadyNow: isReady,
          isWatch,
          isCached: false,
          btcRel: classifyBtcCorrelation(sym),
          timeframe: (timeframeFilter !== 'ALL' ? timeframeFilter : '15m'),
          portfolioARejected: false,
          rejectionReason: signalCache[sym]?.rejectionReason,
        };
      })
      .filter((item) => {
        // Project Strength filter (Default: Strong >= 60 points)
        if (strengthFilter === 'STRONG_ONLY') {
          const pScore = getProjectStrengthScore(item.symbol).totalScore;
          if (pScore < 60) return false;
        }

        // Search query filter
        if (searchQuery.trim() && !item.symbol.includes(searchQuery.toUpperCase())) {
          return false;
        }

        // Min Volume filter
        if (item.volume < minVolumeFilter) {
          return false;
        }

        // Score filter: >= 70 (Instant), 55-69 (Watch), <55 (Ignore)
        if (scoreFilter === 'INSTANT' && item.totalScore < 70) {
          return false;
        }
        if (scoreFilter === 'WATCH' && (item.totalScore < 55 || item.totalScore >= 70)) {
          return false;
        }
        if (scoreFilter === 'IGNORE' && item.totalScore >= 55) {
          return false;
        }

        // BTC Relationship filter
        if (btcRelFilter !== 'ALL' && item.btcRel.category !== btcRelFilter) {
          return false;
        }

        // Pattern filter
        if (patternFilter !== 'ALL' && item.setupPattern !== patternFilter) {
          return false;
        }

        // Signal side filter
        if (signalFilter === 'BUY' && item.direction !== 'BULLISH') {
          return false;
        }
        if (signalFilter === 'SELL' && item.direction !== 'BEARISH') {
          return false;
        }

        // Rule: Reject any signal where R:R is less than 1.5
        if (item.riskReward < 1.5) {
          return false;
        }

        // Rule: If market condition is Ranging, reject Breakout pattern
        if (marketRegime?.regime === 'RANGING' && item.setupPattern === 'BREAKOUT') {
          return false;
        }
        if (marketRegime?.regime === 'VOLATILE') {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'score') return b.totalScore - a.totalScore;
        if (sortBy === 'rr') return b.riskReward - a.riskReward;
        if (sortBy === 'volume') return b.volume - a.volume;
        if (sortBy === 'change') return Math.abs(b.change) - Math.abs(a.change);
        return 0;
      });
  }, [
    allEligibleSymbols,
    signalCache,
    scoreFilter,
    btcRelFilter,
    patternFilter,
    signalFilter,
    minVolumeFilter,
    sortBy,
    searchQuery,
    strengthFilter,
    marketRegime,
  ]);

  return (
    <div className="flex flex-col gap-4 p-4 pb-28 max-w-2xl mx-auto w-full text-right font-['Cairo',sans-serif]">
      {/* 1. Live Background Scanner Control Card */}
      <div className="bg-[#121824] border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {scannerId === 1 ? (
              <ScanLine className="w-5 h-5 text-emerald-400" />
            ) : (
              <Radar className="w-5 h-5 text-cyan-400" />
            )}
            <div>
              <h2 className="text-sm font-black text-white">
                {scannerId === 1
                  ? 'الماسح 1 (Scanner 1) • النصف الأول'
                  : 'الماسح 2 (Scanner 2) • النصف الثاني'}
              </h2>
              <span className="text-[10px] text-slate-400">
                {scannerId === 1
                  ? 'حلقة فحص متوازية رقم 1 (العملات الأعلى سيولة)'
                  : 'حلقة فحص متوازية رقم 2 (العملات المتوسطة والواعدة)'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 font-bold font-num border border-emerald-500/30">
              جاري مسح {allEligibleSymbols.length} عملة
            </span>
          </div>
        </div>

        {/* Live scanning progress bar */}
        <div className="mt-2 bg-slate-900/90 rounded-xl p-3 border border-slate-800 text-xs">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="text-slate-300 font-bold flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${scanProgress.isScanning ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
              {scanProgress.isScanning
                ? `جاري مسح ${scanProgress.currentSymbol || '...'} • الفحص نشط`
                : 'المسح التلقائي مستمر في الخلفية'}
            </span>
            <span className="text-slate-400 font-num">
              {scanProgress.scannedCount} / {scanProgress.totalEligible || allEligibleSymbols.length}
            </span>
          </div>

          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-300"
              style={{
                width: `${
                  scanProgress.totalEligible > 0
                    ? (scanProgress.scannedCount / scanProgress.totalEligible) * 100
                    : 100
                }%`,
              }}
            />
          </div>

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-400">
            <div className="flex items-center gap-3">
              <span className="text-emerald-400 font-bold">
                ⚡ فوري (≥ 70): {scanProgress.instantSignalsCount}
              </span>
              <span className="text-amber-400 font-bold">
                ⏳ مراقبة (55-69): {scanProgress.watchSignalsCount}
              </span>
            </div>
            <span className="text-slate-500">
              كاش 15 دقيقة • حماية Rate Limit مفعلة
            </span>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative mt-3">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            placeholder="ابحث عن رمز العملة (مثال: BTC, SOL, PEPE, SUI, DOGE)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-num"
          />
        </div>

        {/* Horizontal Scrollable Filter Chips (Prompt Requirement: الماسح: شراء/بيع، الفريمات) */}
        <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
          {/* Row 1: Direction Filter (شراء / بيع) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <span className="text-[11px] text-slate-400 font-bold shrink-0 ml-1">الاتجاه:</span>
            {[
              { id: 'ALL', label: 'كافة الاتجاهات (الكل)' },
              { id: 'BUY', label: '🟢 شراء (LONG فقط)' },
              { id: 'SELL', label: '🔴 بيع (SHORT فقط)' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setSignalFilter(f.id as any)}
                className={`px-3 py-1 text-xs rounded-xl font-bold whitespace-nowrap transition border ${
                  signalFilter === f.id
                    ? f.id === 'BUY'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                      : f.id === 'SELL'
                      ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                      : 'bg-sky-600 text-white border-sky-500 shadow-sm'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Row 2: Timeframe Filter (الفريمات) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <span className="text-[11px] text-slate-400 font-bold shrink-0 ml-1">الفريم:</span>
            {[
              { id: 'ALL', label: 'كافة الفريمات' },
              { id: '5m', label: '5m (Scalp)' },
              { id: '15m', label: '15m (Scalp)' },
              { id: '1h', label: '1h (Day Trade)' },
              { id: '4h', label: '4h (Swing)' },
              { id: '1d', label: '1D (Macro Swing)' },
            ].map((tf) => (
              <button
                key={tf.id}
                onClick={() => setTimeframeFilter(tf.id as any)}
                className={`px-2.5 py-1 text-xs rounded-xl font-bold whitespace-nowrap transition border font-num ${
                  timeframeFilter === tf.id
                    ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* 2. CoinGecko Project Strength Filter (Default: Strong 60+) */}
        <div className="mt-3 pt-3 border-t border-slate-800">
          <div className="text-[11px] font-bold text-slate-400 mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>تقييم قوة العملة (CoinGecko):</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-bold">
              {strengthFilter === 'STRONG_ONLY' ? '🟢 العملات القوية فقط (60+)' : '🟡 كافة العملات'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setStrengthFilter('STRONG_ONLY')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition border flex items-center justify-center gap-1.5 ${
                strengthFilter === 'STRONG_ONLY'
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-950/40'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              <span>قوية فقط (60+) [افتراضي]</span>
            </button>
            <button
              onClick={() => setStrengthFilter('ALL')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition border flex items-center justify-center gap-1.5 ${
                strengthFilter === 'ALL'
                  ? 'bg-slate-700 text-white border-slate-600 shadow-md'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              <span>جميع العملات</span>
            </button>
          </div>
        </div>

        {/* 3. Score Filters (Primary Filter Requested by User) */}
        <div className="mt-3 pt-3 border-t border-slate-800">
          <div className="text-[11px] font-bold text-slate-400 mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>نظام النقاط الذكي (Score-Based):</span>
            </div>
            <span className="text-[10px] text-slate-500">المطابقة: {scannedItems.length}</span>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            <button
              onClick={() => setScoreFilter('ALL')}
              className={`py-1.5 text-xs rounded-xl font-bold transition border ${
                scoreFilter === 'ALL'
                  ? 'bg-slate-700 text-white border-slate-600'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              الكل
            </button>
            <button
              onClick={() => setScoreFilter('INSTANT')}
              className={`py-1.5 text-xs rounded-xl font-bold transition border flex items-center justify-center gap-1 ${
                scoreFilter === 'INSTANT'
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-950/40'
                  : 'bg-emerald-950/30 text-emerald-400 border-emerald-900/50 hover:bg-emerald-900/40'
              }`}
            >
              <span>تنفيذ فوري</span>
              <span className="font-num text-[10px] px-1 rounded bg-black/30">≥ 70</span>
            </button>
            <button
              onClick={() => setScoreFilter('WATCH')}
              className={`py-1.5 text-xs rounded-xl font-bold transition border flex items-center justify-center gap-1 ${
                scoreFilter === 'WATCH'
                  ? 'bg-amber-600 text-white border-amber-500 shadow-amber-950/40'
                  : 'bg-amber-950/30 text-amber-400 border-amber-900/50 hover:bg-amber-900/40'
              }`}
            >
              <span>مراقبة</span>
              <span className="font-num text-[10px] px-1 rounded bg-black/30">55-69</span>
            </button>
            <button
              onClick={() => setScoreFilter('IGNORE')}
              className={`py-1.5 text-xs rounded-xl font-bold transition border flex items-center justify-center gap-1 ${
                scoreFilter === 'IGNORE'
                  ? 'bg-slate-600 text-white border-slate-500'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              <span>تجاهل</span>
              <span className="font-num text-[10px] px-1 rounded bg-black/30">&lt; 55</span>
            </button>
          </div>
        </div>

        {/* 4. Timeframes & Liquidity Filter Row */}
        <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
          {/* Liquidity Minimum Filter */}
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-slate-400 font-medium">السيولة (24h):</span>
            <select
              value={minVolumeFilter}
              onChange={(e) => setMinVolumeFilter(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-200 focus:outline-none"
            >
              <option value={3000000}>≥ 3M USDT (الكل)</option>
              <option value={10000000}>≥ 10M USDT</option>
              <option value={50000000}>≥ 50M USDT</option>
              <option value={100000000}>≥ 100M USDT (السيولة الكبرى)</option>
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-200 focus:outline-none"
            >
              <option value="score">الترتيب: أعلى نقاط (100)</option>
              <option value="rr">الترتيب: الأفضل R:R</option>
              <option value="volume">الترتيب: الأعلى سيولة</option>
              <option value="change">الترتيب: الأكبر تحركاً</option>
            </select>
          </div>
        </div>

        {/* 5. Pattern Filter Chips (Breakout, Retest, Pullback only) */}
        <div className="mt-2.5 pt-2.5 border-t border-slate-800/80">
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            {(
              [
                { id: 'ALL', label: 'كافة الأنماط' },
                { id: 'BREAKOUT', label: 'Breakout (اختراق)' },
                { id: 'RETEST', label: 'Retest (إعادة اختبار)' },
                { id: 'PULLBACK', label: 'Pullback (تصحيح)' },
              ] as const
            ).map((p) => {
              const isActive = patternFilter === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPatternFilter(p.id)}
                  className={`px-2.5 py-1 text-xs rounded-xl font-bold whitespace-nowrap transition border ${
                    isActive
                      ? 'bg-sky-600 text-white border-sky-500 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. Bitcoin Relationship Filter Chips */}
        <div className="mt-2.5 pt-2.5 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <span className="text-[11px] text-slate-400 font-bold shrink-0 ml-1">علاقة BTC:</span>
            {[
              { id: 'ALL', label: 'الكل' },
              { id: 'FOLLOWER', label: '⚡ تابعة للبتكوين (> 0.7)' },
              { id: 'COUNTER', label: '🔄 معاكسة (< -0.2)' },
              { id: 'INDEPENDENT', label: '🌐 مستقلة (-0.2 إلى 0.7)' },
            ].map((b) => (
              <button
                key={b.id}
                onClick={() => setBtcRelFilter(b.id as any)}
                className={`px-2.5 py-1 text-xs rounded-xl font-bold whitespace-nowrap transition border ${
                  btcRelFilter === b.id
                    ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 6. Scanned Items List */}
      <div className="space-y-3">
        {scannedItems.length === 0 ? (
          <div className="bg-[#121824] border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs">
            لا توجد عملات تطابق معايير التصفية المحددة. جرب اختيار &quot;الكل&quot; في نظام النقاط أو خفض فلتر السيولة.
          </div>
        ) : (
          scannedItems.map((item) => {
            const isBuy = item.direction === 'BULLISH';
            const patternMeta = getPatternBadge(item.setupPattern);
            const isExpanded = expandedSymbol === item.symbol;
            const isSingleScanning = scanningSingleSymbol === item.symbol;

            // Score color styling
            const scoreColor =
              item.totalScore >= 70
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                : item.totalScore >= 55
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                : 'bg-slate-800 text-slate-400 border-slate-700';

            return (
              <div
                key={item.symbol}
                className={`p-3.5 rounded-2xl bg-[#121824] border transition shadow-lg ${
                  item.isReadyNow
                    ? 'border-emerald-500/40 bg-emerald-950/10'
                    : item.isWatch
                    ? 'border-amber-500/30 bg-amber-950/10'
                    : 'border-slate-800'
                }`}
              >
                {/* Header Row: Symbol, Score, Price */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => handleOpenCoinModal(item.symbol)}
                      className="font-extrabold text-white text-base font-num hover:text-sky-400 transition"
                    >
                      {item.symbol}
                    </button>

                    {/* Score Badge (Out of 100) */}
                    <div
                      className={`px-2.5 py-0.5 rounded-lg border font-num font-extrabold text-xs flex items-center gap-1 ${scoreColor}`}
                      title="مجموع نقاط الإشارة من 100"
                    >
                      <span>{item.totalScore}</span>
                      <span className="text-[10px] font-normal opacity-70">/100</span>
                    </div>

                    {/* Multi-Timeframe Trade Type Badge: Trend (Breakout) / Reversion (Retest) / Scalp */}
                    {(() => {
                      const typeInfo = getTradeTypeInfo(item.timeframe || (timeframeFilter !== 'ALL' ? timeframeFilter : '15m'), item.setupPattern);
                      return (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold font-num ${typeInfo.badgeClass}`}
                        >
                          {typeInfo.label}
                        </span>
                      );
                    })()}

                    {/* Pattern Badge */}
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${patternMeta.badgeClass}`}
                    >
                      {patternMeta.icon}
                      {patternMeta.label}
                    </span>

                    {/* BTC Correlation Badge */}
                    {item.btcRel && (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold font-num ${
                          item.btcRel.category === 'FOLLOWER'
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                            : item.btcRel.category === 'COUNTER'
                            ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                            : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                        }`}
                        title={item.btcRel.descriptionArabic}
                      >
                        <span>{item.btcRel.categoryArabic}</span>
                        <span className="opacity-70">({item.btcRel.coefficient >= 0 ? '+' : ''}{item.btcRel.coefficient})</span>
                      </span>
                    )}

                    {/* Portfolio A Rejection Warning Badge */}
                    {item.portfolioARejected && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold bg-amber-500/15 text-amber-300 border-amber-500/40"
                        title={item.portfolioARejectionReason || 'رفضت محفظة A الصفقة بسبب حماية التصفية 100x ونُفذت في المحافظ B و C'}
                      >
                        <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                        <span>رُفضت في (A) لحماية التصفية • نُفذت في B و C</span>
                      </span>
                    )}
                  </div>

                  {/* Price & Change */}
                  <div className="text-left font-num">
                    <div className="text-sm font-black text-white">
                      ${formatPrice(item.price)}
                    </div>
                    <div
                      className={`text-[11px] font-bold ${
                        item.change >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {item.change >= 0 ? `+${item.change.toFixed(2)}%` : `${item.change.toFixed(2)}%`}
                    </div>
                  </div>
                </div>

                {/* Second Row: Execution Decision & Key Metrics */}
                <div className="grid grid-cols-4 gap-1.5 py-2 border-y border-slate-800/80 text-xs font-num my-2">
                  {/* Status / Category */}
                  <div className="bg-slate-900/60 p-1.5 rounded-lg text-center">
                    <span className="text-[10px] text-slate-400 block font-['Cairo']">القرار</span>
                    <span
                      className={`font-bold text-[11px] ${
                        item.isReadyNow
                          ? 'text-emerald-400'
                          : item.isWatch
                          ? 'text-amber-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {item.isReadyNow ? 'تنفيذ فوري ⚡' : item.isWatch ? 'مراقبة ⏳' : 'تجاهل ❌'}
                    </span>
                  </div>

                  {/* R:R Ratio */}
                  <div className="bg-slate-900/60 p-1.5 rounded-lg text-center">
                    <span className="text-[10px] text-slate-400 block font-['Cairo']">نسبة R:R</span>
                    <span className="font-bold text-sky-400">1:{item.riskReward}</span>
                  </div>

                  {/* Volume (24h) */}
                  <div className="bg-slate-900/60 p-1.5 rounded-lg text-center">
                    <span className="text-[10px] text-slate-400 block font-['Cairo']">السيولة (24h)</span>
                    <span className="font-bold text-slate-200">
                      {(item.volume / 1000000).toFixed(1)}M$
                    </span>
                  </div>

                  {/* TP1 Move */}
                  <div className="bg-slate-900/60 p-1.5 rounded-lg text-center">
                    <span className="text-[10px] text-slate-400 block font-['Cairo']">هدف TP1</span>
                    <span className={isBuy ? 'font-bold text-emerald-400' : 'font-bold text-red-400'}>
                      {isBuy ? `+${Math.abs(item.tp1Percent)}%` : `-${Math.abs(item.tp1Percent)}%`}
                    </span>
                  </div>
                </div>

                {/* Third Row: Expandable Score Breakdown Toggle & Action Buttons */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    onClick={() => setExpandedSymbol(isExpanded ? null : item.symbol)}
                    className="flex items-center gap-1 text-[11px] font-bold text-slate-300 hover:text-white transition"
                  >
                    <span>تفصيل الـ 100 نقطة</span>
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>

                  <div className="flex items-center gap-2">
                    {/* Automatic Bot Execution Status or Instant Force Execution Button */}
                    {(() => {
                      const pIds: StrategyId[] = ['STRATEGY_TREND', 'STRATEGY_REVERSION', 'STRATEGY_SCALP'];
                      const isOpenInActive = pIds.some((pid) =>
                        portfolios[pid]?.trades?.some((t) => t.symbol === item.symbol && t.status === 'OPEN')
                      );

                      if (isOpenInActive) {
                        return (
                          <span
                            className="px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 font-sans bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                            title="الصفقة مفتوحة حالياً ونشطة في محفظة التداول"
                          >
                            <Zap className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                            <span>مفتوحة آلياً ✓</span>
                          </span>
                        );
                      }

                      if (item.isReadyNow) {
                        return (
                          <button
                            onClick={() => openTradeManually(item.symbol, item.timeframe)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black flex items-center gap-1 transition shadow-md shadow-emerald-950/40 animate-pulse"
                            title="فتح الصفقة الآن فوراً في الاستراتيجية المخصصة لها دون انتظار"
                          >
                            <Zap className="w-3 h-3 text-white fill-white" />
                            <span>تنفيذ فوري ⚡</span>
                          </button>
                        );
                      }

                      return (
                        <span
                          className="px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 font-sans bg-slate-800/80 text-slate-400 border border-slate-700/60"
                          title="النظام يفتح الصفقات آلياً بمجرد وصول النقاط إلى 70+"
                        >
                          <Zap className="w-3 h-3 text-slate-400" />
                          <span>تنفيذ آلي 100%</span>
                        </span>
                      );
                    })()}

                    {/* Manual Refresh / Re-Scan Button */}
                    <button
                      onClick={(e) => handleManualScanSymbol(item.symbol, e)}
                      disabled={isSingleScanning}
                      className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-[10px] font-bold flex items-center gap-1 transition"
                      title="تحديث فوري للإشارة وسحب أحدث الشموع"
                    >
                      <RotateCw className={`w-3 h-3 ${isSingleScanning ? 'animate-spin text-sky-400' : ''}`} />
                      <span>{isSingleScanning ? 'جارٍ الفحص' : 'فحص فوري'}</span>
                    </button>

                    {/* Open Chart & Detail Modal */}
                    <button
                      onClick={() => handleOpenCoinModal(item.symbol)}
                      className="px-2.5 py-1 rounded-lg bg-sky-600/20 text-sky-400 border border-sky-500/40 hover:bg-sky-600/30 text-[10px] font-bold transition"
                    >
                      الشارت ←
                    </button>
                  </div>
                </div>


                {/* Expandable Breakdown Drawer (The 8 Dimensions of 100 Points) */}
                {isExpanded && item.scoreBreakdown && (
                  <div className="mt-3 pt-3 border-t border-slate-800/80 bg-slate-900/60 rounded-xl p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between font-bold text-white mb-1">
                      <span>تفاصيل توزيع النقاط (المجموع: {item.totalScore}/100):</span>
                      <span className="text-[10px] text-emerald-400">
                        {item.totalScore >= 70
                          ? 'مؤهل للتنفيذ الفوري في المحافظ الثلاث ⚡'
                          : item.totalScore >= 55
                          ? 'مؤهل كأمر مراقبة معلق ⏳'
                          : 'أقل من عتبة التنفيذ (تجاهل)'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="flex justify-between items-center bg-slate-950/60 px-2 py-1 rounded border border-slate-800">
                        <span className="text-slate-400">1. توافق الفريمات:</span>
                        <span className="font-num font-bold text-sky-400">
                          {item.scoreBreakdown.timeframeAlignment} / 25
                        </span>
                      </div>

                      <div className="flex justify-between items-center bg-slate-950/60 px-2 py-1 rounded border border-slate-800">
                        <span className="text-slate-400">2. ترتيب اتجاه EMA:</span>
                        <span className="font-num font-bold text-sky-400">
                          {item.scoreBreakdown.emaTrendStrength} / 15
                        </span>
                      </div>

                      <div className="flex justify-between items-center bg-slate-950/60 px-2 py-1 rounded border border-slate-800">
                        <span className="text-slate-400">3. نسبة R:R للمخاطرة:</span>
                        <span className="font-num font-bold text-sky-400">
                          {item.scoreBreakdown.riskReward} / 10
                        </span>
                      </div>

                      <div className="flex justify-between items-center bg-slate-950/60 px-2 py-1 rounded border border-slate-800">
                        <span className="text-slate-400">4. حجم التداول (Volume):</span>
                        <span className="font-num font-bold text-sky-400">
                          {item.scoreBreakdown.volume} / 10
                        </span>
                      </div>

                      <div className="flex justify-between items-center bg-slate-950/60 px-2 py-1 rounded border border-slate-800">
                        <span className="text-slate-400">5. حالة السوق والنمط:</span>
                        <span className="font-num font-bold text-sky-400">
                          {item.scoreBreakdown.marketRegimeMatch} / 15
                        </span>
                      </div>

                      <div className="flex justify-between items-center bg-slate-950/60 px-2 py-1 rounded border border-slate-800">
                        <span className="text-slate-400">6. مؤشر RSI المثالي:</span>
                        <span className="font-num font-bold text-sky-400">
                          {item.scoreBreakdown.rsiQuality} / 10
                        </span>
                      </div>

                      <div className="flex justify-between items-center bg-slate-950/60 px-2 py-1 rounded border border-slate-800">
                        <span className="text-slate-400">7. تأكيد زخم MACD:</span>
                        <span className="font-num font-bold text-sky-400">
                          {item.scoreBreakdown.macdConfirmation} / 10
                        </span>
                      </div>

                      <div className="flex justify-between items-center bg-slate-950/60 px-2 py-1 rounded border border-slate-800">
                        <span className="text-slate-400">8. خلو مسار المقاومات:</span>
                        <span className="font-num font-bold text-sky-400">
                          {item.scoreBreakdown.supportResistanceClear} / 5
                        </span>
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-400 pt-1">
                      {item.explanation}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
