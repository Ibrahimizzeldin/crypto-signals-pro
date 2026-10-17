import React, { useState, useMemo } from 'react';
import { useCryptoStore } from '../../store/useCryptoStore';
import { MultiTimeframeAnalysis } from '../../types/crypto';
import { CoinIcon } from '../common/CoinIcon';
import { getPatternEmoji } from '../../utils/cryptoLogos';
import { formatPrice } from '../../utils/formatters';
import { isCryptoFuturesSymbol } from '../../services/binanceApi';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Copy,
  Check,
  ExternalLink,
  Target,
  Shield,
  Layers,
  ArrowUpDown,
  Search,
  Zap,
} from 'lucide-react';

import { getProjectStrengthScore } from '../../services/projectStrengthService';

export const RecommendationsView: React.FC = () => {
  const {
    signalCache,
    tickers,
    wsConnected,
    marketRegime,
    setSelectedSymbol,
    setDetailModalOpen,
  } = useCryptoStore();

  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [sortBy, setSortBy] = useState<'CONFIDENCE' | 'TIME' | 'RR'>('CONFIDENCE');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Extract all valid recommendations with Smart Filtering (Rule: Max 15, <6h, entry diff <=1%, regime check)
  const recommendations = useMemo(() => {
    const now = Date.now();
    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

    const list = Object.values(signalCache).filter((s) => {
      // 1. Must be verified crypto futures
      if (!isCryptoFuturesSymbol(s.symbol) || s.executionStatus === 'IGNORE') return false;

      // 2. Reject losing patterns (Only Retest, Breakout, Pullback allowed)
      if ((s.setupPattern as string) === 'REVERSAL' || (s.setupPattern as string) === 'RANGE') return false;

      // 3. Reject coins with CoinGecko project strength < 60
      const strength = getProjectStrengthScore(s.symbol);
      if (strength.totalScore < 60) return false;

      // 4. Rule: Remove recommendation if older than 6 hours
      if (s.timestamp && (now - s.timestamp) > SIX_HOURS_MS) {
        return false;
      }

      // 5. Rule: Remove if it missed the entry price by > 1%
      const livePrice = tickers[s.symbol]?.lastPrice || s.currentPrice || s.targets.entry;
      const entryPrice = s.targets.entry;
      if (entryPrice > 0 && livePrice > 0) {
        const priceDiff = Math.abs(livePrice - entryPrice) / entryPrice;
        if (priceDiff > 0.01) {
          return false;
        }
      }

      // 6. Rule: Remove if market conditions changed (Regime mismatch)
      if (marketRegime) {
        if (marketRegime.regime === 'VOLATILE') return false;
        if (marketRegime.allowedTradeSides === 'LONG_ONLY' && s.overallDirection !== 'BULLISH') return false;
        if (marketRegime.allowedTradeSides === 'SHORT_ONLY' && s.overallDirection !== 'BEARISH') return false;
      }

      return true;
    });

    // Filter by direction & search
    const filtered = list.filter((item) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toUpperCase();
        if (!item.symbol.includes(q)) return false;
      }

      if (directionFilter === 'BUY') {
        return item.overallDirection === 'BULLISH';
      }
      if (directionFilter === 'SELL') {
        return item.overallDirection === 'BEARISH';
      }
      return true;
    });

    // Sort by Quality Score (Total Score / Confidence) or user selection
    const sorted = filtered.sort((a, b) => {
      const scoreA = a.scoreBreakdown?.totalScore ?? a.confidence;
      const scoreB = b.scoreBreakdown?.totalScore ?? b.confidence;
      if (sortBy === 'CONFIDENCE') {
        return scoreB - scoreA;
      }
      if (sortBy === 'RR') {
        return (b.targets?.riskRewardRatio || 0) - (a.targets?.riskRewardRatio || 0);
      }
      // TIME
      return (b.timestamp || 0) - (a.timestamp || 0);
    });

    // Rule: Show ONLY the top 15 recommendations (حسب نقاط الجودة)
    return sorted.slice(0, 15);
  }, [signalCache, tickers, marketRegime, directionFilter, sortBy, searchQuery]);

  // Copy recommendation data as clean Arabic text to clipboard
  const handleCopy = (analysis: MultiTimeframeAnalysis) => {
    const isLong = analysis.overallDirection === 'BULLISH';
    const cleanSym = analysis.symbol.replace('USDT', '');
    const currentPrice = tickers[analysis.symbol]?.lastPrice || analysis.currentPrice;

    const text = `🎯 توصية تداول عقود آجلة (Futures Signal)
🪙 العملة: ${cleanSym}/USDT
📈 الاتجاه: ${isLong ? '🟢 شراء (LONG)' : '🔴 بيع (SHORT)'}
⚡ النمط: ${getPatternEmoji(analysis.setupPattern)} ${analysis.patternNameArabic}
🎯 الثقة: ${analysis.confidence}% | توافق الفريمات: ${analysis.agreedTimeframesCount}/6

💵 سعر الإشارة: ${formatPrice(analysis.targets.entry)}
⚡ السعر اللحظي: ${formatPrice(currentPrice)}
🛑 وقف الخسارة (SL): ${formatPrice(analysis.targets.sl)} (${analysis.targets.slPercent}%) [${analysis.targets.slCalculationReason || 'SL محسوب من: ATR × 1.5'}]
🎯 الهدف 1 (TP1): ${formatPrice(analysis.targets.tp1)} (+${analysis.targets.tp1Percent}%)
🎯 الهدف 2 (TP2): ${formatPrice(analysis.targets.tp2)} (+${analysis.targets.tp2Percent}%)
${analysis.targets.tp3 ? `🎯 الهدف 3 (TP3): ${formatPrice(analysis.targets.tp3)} (+${analysis.targets.tp3Percent}%)` : ''}
⚖️ نسبة العائد للمخاطرة (R:R): 1:${analysis.targets.riskRewardRatio}

📊 التحليل: ${analysis.explanation || 'إشارة مؤكدة بتوافق الفريمات والزخم'}`;

    navigator.clipboard.writeText(text);
    setCopiedId(analysis.symbol);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleOpenChart = (symbol: string) => {
    setSelectedSymbol(symbol);
    setDetailModalOpen(true);
  };

  return (
    <div className="flex flex-col gap-4 p-4 pb-24 max-w-6xl mx-auto w-full text-right" dir="rtl">
      {/* Top Header Card */}
      <div className="bg-[#121824] border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500/20 to-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md">
              <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base md:text-lg font-black text-white">
                  مركز التوصيات اللحظية (Live Recommendations)
                </h1>
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                  <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
                  <span>تحديث حي 500ms</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                أعلى 15 توصية نشطة مفلترة ذكياً (خلال 6 ساعات • فرق دخول ≤ 1% • متوافقة مع اتجاه السوق)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-num">
            <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 block">أعلى التوصيات (Max 15)</span>
              <span className="text-sm font-black text-emerald-400">{recommendations.length} / 15</span>
            </div>
          </div>
        </div>

        {/* Filter and Sort Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
          {/* Direction Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setDirectionFilter('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                directionFilter === 'ALL'
                  ? 'bg-sky-500 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              الكل ({Object.values(signalCache).filter((s) => isCryptoFuturesSymbol(s.symbol)).length})
            </button>
            <button
              onClick={() => setDirectionFilter('BUY')}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition ${
                directionFilter === 'BUY'
                  ? 'bg-emerald-500 text-white shadow'
                  : 'text-slate-400 hover:text-emerald-300'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>شراء</span>
            </button>
            <button
              onClick={() => setDirectionFilter('SELL')}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition ${
                directionFilter === 'SELL'
                  ? 'bg-rose-500 text-white shadow'
                  : 'text-slate-400 hover:text-rose-300'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>بيع</span>
            </button>
          </div>

          {/* Sort Selector & Search */}
          <div className="flex items-center gap-2 flex-1 max-w-md justify-end">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                placeholder="بحث عن رمز العملة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-8 pl-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-num"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs text-slate-400">
              <ArrowUpDown className="w-3.5 h-3.5 mr-1 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer pr-1"
              >
                <option value="CONFIDENCE" className="bg-slate-900">الأعلى ثقة</option>
                <option value="RR" className="bg-slate-900">أعلى R:R</option>
                <option value="TIME" className="bg-slate-900">الأحدث وقتاً</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations Cards Grid */}
      {recommendations.length === 0 ? (
        <div className="bg-[#121824] border border-slate-800 rounded-2xl p-12 text-center shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-400 mx-auto mb-3">
            <Sparkles className="w-6 h-6 text-sky-400/60 animate-pulse" />
          </div>
          <h3 className="text-sm md:text-base font-black text-white mb-1">
            جاري فحص وتوليد التوصيات اللحظية...
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            محرك التحليل متعدد الفريمات يفحص سيولة Binance Futures ويظهر التوصيات عند استيفاء نسبة ثقة 70%+ وتوافق المؤشرات.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {recommendations.map((rec) => {
            const isLong = rec.overallDirection === 'BULLISH';
            const livePrice = tickers[rec.symbol]?.lastPrice || rec.currentPrice;
            const progressMin = Math.min(rec.targets.entry, rec.targets.sl);
            const progressMax = Math.max(rec.targets.tp1, rec.targets.entry);
            const progressRange = progressMax - progressMin || 1;
            const offset = Math.max(0, Math.min(progressRange, livePrice - progressMin));
            const progressPct = Math.min(100, Math.max(0, (offset / progressRange) * 100));

            const isCopied = copiedId === rec.symbol;

            return (
              <div
                key={rec.symbol}
                className="bg-[#121824] border border-slate-800 hover:border-slate-700 rounded-2xl p-4 shadow-xl transition-all flex flex-col justify-between space-y-3 relative overflow-hidden group"
              >
                {/* Header: Logo, Symbol, Signal, Pattern, Confidence */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <CoinIcon symbol={rec.symbol} size="md" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-black text-white font-num">{rec.symbol}</span>
                          {/* Signal Badge */}
                          <span
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black ${
                              isLong
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            }`}
                          >
                            {isLong ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            <span>{rec.overallSignal === 'STRONG_BUY' ? 'شراء قوي ⚡' : rec.overallSignal === 'STRONG_SELL' ? 'بيع قوي ⚡' : isLong ? 'شراء' : 'بيع'}</span>
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 block font-sans">
                          توافق {rec.agreedTimeframesCount} من 6 فريمات
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Pattern Badge */}
                      <span className="flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-[11px] font-bold">
                        <span>{getPatternEmoji(rec.setupPattern)}</span>
                        <span>{rec.patternNameArabic}</span>
                      </span>

                      {/* Confidence Score Pill */}
                      <div className="px-2.5 py-1 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 font-num font-black text-xs">
                        {rec.confidence}%
                      </div>
                    </div>
                  </div>

                  {/* Concise Analysis Summary */}
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1 text-xs mb-2">
                    <p className="text-[11px] font-bold text-slate-200 leading-snug">
                      {rec.explanation || `${rec.patternNameArabic} مع زخم إيجابي وتوافق زمني`}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 pt-1 border-t border-slate-800/60 font-num">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-sky-300">
                        R:R 1:{rec.targets.riskRewardRatio}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300">
                        {rec.executionCategoryArabic || 'جاهزة للتنفيذ'}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300">
                        السعر اللحظي: ${formatPrice(livePrice)}
                      </span>
                    </div>
                  </div>

                  {/* Target Table (Entry, SL, TP1, TP2, TP3, R:R) */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 p-2 rounded-xl bg-black/40 border border-slate-800/80 text-[11px] font-num mb-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">الدخول</span>
                      <span className="font-black text-white">{formatPrice(rec.targets.entry)}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">SL</span>
                      <span className="font-bold text-rose-400">
                        {formatPrice(rec.targets.sl)}
                        <span className="text-[9px] block text-rose-500">({rec.targets.slPercent}%)</span>
                        <span className="text-[8px] block text-amber-400 font-sans">{rec.targets.slCalculationReason || 'ATR × 1.5'}</span>
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">TP1</span>
                      <span className="font-bold text-emerald-400">
                        {formatPrice(rec.targets.tp1)}
                        <span className="text-[9px] block text-emerald-500">(+{rec.targets.tp1Percent}%)</span>
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">TP2</span>
                      <span className="font-bold text-emerald-300">
                        {formatPrice(rec.targets.tp2)}
                        <span className="text-[9px] block text-emerald-400">(+{rec.targets.tp2Percent}%)</span>
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">TP3</span>
                      <span className="font-bold text-emerald-200">
                        {rec.targets.tp3 ? formatPrice(rec.targets.tp3) : '—'}
                        {rec.targets.tp3Percent ? (
                          <span className="text-[9px] block text-emerald-400">(+{rec.targets.tp3Percent}%)</span>
                        ) : null}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">R:R</span>
                      <span className="font-black text-sky-400">
                        1:{rec.targets.riskRewardRatio}
                      </span>
                    </div>
                  </div>

                  {/* Visual Price Tracker Bar between SL and TP1 */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-num">
                      <span className="text-rose-400">SL: {formatPrice(rec.targets.sl)}</span>
                      <span className="text-slate-300 font-sans font-bold">
                        موقع السعر (${formatPrice(livePrice)})
                      </span>
                      <span className="text-emerald-400">TP1: {formatPrice(rec.targets.tp1)}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden relative border border-slate-800">
                      <div
                        className={`h-full transition-all duration-500 ${
                          isLong ? 'bg-gradient-to-r from-emerald-500 to-sky-400' : 'bg-gradient-to-r from-rose-500 to-amber-400'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Actions: Open Chart & Copy Data */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/70">
                  <button
                    onClick={() => handleCopy(rec)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs font-bold transition active:scale-95"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-sky-400" />}
                    <span>{isCopied ? 'تم نسخ التوصية!' : 'نسخ البيانات'}</span>
                  </button>

                  <button
                    onClick={() => handleOpenChart(rec.symbol)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition active:scale-95 shadow-md shadow-sky-950/30"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>فتح الشارت</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
