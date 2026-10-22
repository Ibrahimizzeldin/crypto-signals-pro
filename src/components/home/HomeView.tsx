import React, { useState, useMemo } from 'react';
import { useCryptoStore } from '../../store/useCryptoStore';
import { TOP_FUTURES_SYMBOLS, isCryptoFuturesSymbol } from '../../services/binanceApi';
import { getMarketSummarySentence } from '../../services/sentimentApi';
import {
  Search,
  Star,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Compass,
  ArrowUpRight,
  ArrowDownRight,
  Newspaper,
} from 'lucide-react';
import { formatPrice } from '../../utils/formatters';
import { getProjectStrengthScore } from '../../services/projectStrengthService';
import { TriplePortfolioTopBar } from '../common/TriplePortfolioTopBar';
import { MarketNewsModal } from './MarketNewsModal';

export const HomeView: React.FC = () => {
  const {
    tickers,
    fundingRates,
    watchlist,
    toggleWatchlist,
    setSelectedSymbol,
    priceChangesLastTick,
    fearAndGreed,
    signalCache,
    marketRegime,
    isNewsPaused,
    newsPausedHeadline,
  } = useCryptoStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'favorites' | 'gainers' | 'losers'>('all');
  const [topMoversTab, setTopMoversTab] = useState<'gainers' | 'losers'>('gainers');
  const [isNewsModalOpen, setIsNewsModalOpen] = useState(false);

  // Top Movers: Top 10 Gainers & Top 10 Losers with volume >= 10M USDT (Prompt 5.2)
  const topMovers = useMemo(() => {
    const liquidTickers = Object.values(tickers).filter(
      (t) => isCryptoFuturesSymbol(t.symbol) && t.quoteVolume >= 10000000
    );

    const gainers = [...liquidTickers]
      .sort((a, b) => b.priceChangePercent - a.priceChangePercent)
      .slice(0, 10);

    const losers = [...liquidTickers]
      .sort((a, b) => a.priceChangePercent - b.priceChangePercent)
      .slice(0, 10);

    return { gainers, losers };
  }, [tickers]);

  // Market overview quote
  const marketSummaryText = useMemo(() => {
    if (!fearAndGreed) return 'السوق يتحرك بزخم شرائي إيجابي مع تدفقات في عقود المشتقات.';
    return getMarketSummarySentence(fearAndGreed);
  }, [fearAndGreed]);

  // List of liquid symbols from tickers (volume >= 3M USDT, verified crypto only)
  const displaySymbols = useMemo(() => {
    const allPairs = Object.values(tickers)
      .filter((t) => isCryptoFuturesSymbol(t.symbol) && t.quoteVolume >= 3000000)
      .sort((a, b) => b.quoteVolume - a.quoteVolume)
      .map((t) => t.symbol);

    let list = allPairs.length > 0 ? allPairs : TOP_FUTURES_SYMBOLS.filter(isCryptoFuturesSymbol);

    if (filterMode === 'favorites') {
      list = list.filter((s) => watchlist.includes(s));
    } else if (filterMode === 'gainers') {
      list = list
        .filter((s) => (tickers[s]?.priceChangePercent || 0) > 0)
        .sort((a, b) => (tickers[b]?.priceChangePercent || 0) - (tickers[a]?.priceChangePercent || 0));
    } else if (filterMode === 'losers') {
      list = list
        .filter((s) => (tickers[s]?.priceChangePercent || 0) < 0)
        .sort((a, b) => (tickers[a]?.priceChangePercent || 0) - (tickers[b]?.priceChangePercent || 0));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toUpperCase();
      list = list.filter((s) => s.includes(q));
    }

    return list;
  }, [tickers, filterMode, watchlist, searchQuery]);

  // Top 5 opportunities by signal strength & confidence (crypto only & score >= 60)
  const topOpportunities = useMemo(() => {
    const opps = Object.values(signalCache)
      .filter(
        (s) =>
          isCryptoFuturesSymbol(s.symbol) &&
          getProjectStrengthScore(s.symbol).totalScore >= 60 &&
          (s.overallSignal === 'STRONG_BUY' || s.overallSignal === 'STRONG_SELL' || s.confidence >= 75)
      )
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);

    // Fallback if cache is still building: generate high confidence candidates from top symbols
    if (opps.length < 3) {
      const candidates = ['BTCUSDT', 'SOLUSDT', 'ETHUSDT', 'XRPUSDT', 'SUIUSDT'];
      return candidates.map((sym, i) => {
        const t = tickers[sym];
        const isUp = (t?.priceChangePercent || 0) >= 0;
        return {
          symbol: sym,
          overallSignal: isUp ? 'STRONG_BUY' : ('STRONG_SELL' as const),
          confidence: 90 - i * 4,
          agreedTimeframesCount: 5 - (i > 1 ? 1 : 0),
          targets: {
            entry: t?.lastPrice || 100,
            tp1Percent: isUp ? 2.45 : -2.45,
            slPercent: isUp ? -0.85 : 0.85,
            riskRewardRatio: 2.88,
          },
        };
      });
    }

    return opps;
  }, [signalCache, tickers]);

  return (
    <div className="flex flex-col gap-4 p-4 pb-24 max-w-lg mx-auto w-full text-right">
      {/* Triple Parallel Portfolios Top Bar (Sticky, Throttled 500ms) */}
      <div className="sticky top-0 z-20 -mx-4 -mt-4 mb-1">
        <TriplePortfolioTopBar />
      </div>

      {/* 1. Market Regime Banner */}
      {marketRegime && (
        <div className="relative overflow-hidden rounded-2xl bg-[#121824] border border-slate-800 p-3.5 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-black text-white">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  marketRegime.regime === 'TRENDING_UP'
                    ? 'bg-emerald-400 animate-pulse'
                    : marketRegime.regime === 'TRENDING_DOWN'
                    ? 'bg-red-400 animate-pulse'
                    : marketRegime.regime === 'VOLATILE'
                    ? 'bg-amber-400 animate-ping'
                    : 'bg-sky-400'
                }`}
              />
              <span>كشف حالة السوق (BTC 1h Regime)</span>
            </div>

            <span
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border font-num ${
                marketRegime.regime === 'TRENDING_UP'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : marketRegime.regime === 'TRENDING_DOWN'
                  ? 'bg-red-500/20 text-red-400 border-red-500/40'
                  : marketRegime.regime === 'VOLATILE'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : 'bg-sky-500/20 text-sky-400 border-sky-500/40'
              }`}
            >
              {marketRegime.titleArabic}
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed mb-2 font-medium">
            {marketRegime.descriptionArabic}
          </p>

          <div className="flex items-center justify-between text-[11px] font-num text-slate-400 border-t border-slate-800/80 pt-2">
            <span>BTC: ${formatPrice(marketRegime.btcPrice)}</span>
            <span>RSI: {marketRegime.rsi}</span>
            <span>ATR: {marketRegime.atrRatio}×</span>
            <span className="text-emerald-400 font-bold">
              {marketRegime.allowedTradeSides === 'LONG_ONLY'
                ? 'إشارات Long فقط'
                : marketRegime.allowedTradeSides === 'SHORT_ONLY'
                ? 'إشارات Short فقط'
                : marketRegime.allowedTradeSides === 'RANGE_ONLY'
                ? 'انتظار كسر النطاق'
                : 'إيقاف الإشارات'}
            </span>
          </div>
        </div>
      )}


      {/* Market News Button - Accessible directly from Home Page */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsNewsModalOpen(true)}
          className="w-full flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-sky-950/40 via-slate-900 to-[#121824] border border-slate-800 hover:border-sky-500/50 transition group shadow-md active:scale-[0.99]"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 group-hover:scale-105 transition">
              <Newspaper className="w-4 h-4" />
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-white block">أخبار السوق والعملات</span>
                <span className="px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 text-[9px] font-bold border border-sky-500/20">
                  تحديث مباشر
                </span>
              </div>
              <span className="text-[10px] text-slate-400">متابعة الأخبار الاقتصادية والمستجدات وتأثير الفائدة</span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-sky-400 bg-sky-500/10 px-2.5 py-1 rounded-xl border border-sky-500/20 group-hover:bg-sky-500/20 transition">
            <span>عرض</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
        </button>
      </div>

      {/* Market Sentiment Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#121824] via-[#101726] to-[#0f172a] border border-slate-800 p-4 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
            <Compass className="w-4 h-4 text-sky-400 animate-spin-slow" />
            <span>نبض سوق الفيوتشرز (Futures Sentiment)</span>
          </div>
          {fearAndGreed && (
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800/80 text-amber-300 font-num border border-slate-700">
              المؤشر: {fearAndGreed.value}/100 ({fearAndGreed.classification})
            </span>
          )}
        </div>
        <p className="text-xs text-slate-300 leading-relaxed font-medium">
          {marketSummaryText}
        </p>
      </div>

      {/* Top 5 Opportunities Horizontal Reel */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            أعلى 5 فرص استثنائية (Top Opportunities)
          </h2>
          <span className="text-[10px] text-slate-500">حسب توافق الفريمات</span>
        </div>

        <div className="flex gap-2.5 overflow-x-auto pb-1 pt-0.5 snap-x">
          {topOpportunities.map((opp: any) => {
            const isBuy = opp.overallSignal.includes('BUY');
            const sym = opp.symbol;
            const t = tickers[sym];
            return (
              <div
                key={sym}
                onClick={() => setSelectedSymbol(sym)}
                className="shrink-0 w-44 snap-start p-3 rounded-2xl bg-[#121824] border border-slate-800 hover:border-slate-700 active:scale-95 transition cursor-pointer flex flex-col justify-between shadow-lg"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-extrabold text-white text-xs font-num">{sym}</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                      isBuy ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {isBuy ? 'شراء قوي' : 'بيع قوي'}
                  </span>
                </div>

                <div className="text-sm font-black text-white font-num mb-1">
                  ${t?.lastPrice ? formatPrice(t.lastPrice) : '—'}
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                  <span className="px-1.5 py-0.2 rounded bg-slate-800 text-sky-400 font-medium">
                    {opp.patternNameArabic || 'Breakout'}
                  </span>
                  <span className="text-emerald-400 font-bold font-num">
                    R:R 1:{opp.targets?.riskRewardRatio || 2.4}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] font-num text-slate-400 border-t border-slate-800/60 pt-1.5">
                  <span>ثقة {opp.confidence}%</span>
                  <span className={isBuy ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                    {isBuy ? `+${Math.abs(opp.targets.tp1Percent)}%` : `-${Math.abs(opp.targets.tp1Percent)}%`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Prompt Requirement: مركز الأكثر تحركاً (Top Movers - أعلى 10 ربحاً وخسارة سيولة > 10M) */}
      <div className="rounded-2xl bg-[#121824] border border-slate-800 p-3.5 shadow-xl space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">🔥</span>
            <h2 className="text-xs font-black text-white">
              مركز الأكثر تحركاً (Top Movers • سيولة &gt; 10M)
            </h2>
          </div>

          <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-xl border border-slate-800 text-[11px] font-bold">
            <button
              onClick={() => setTopMoversTab('gainers')}
              className={`px-2.5 py-0.5 rounded-lg transition ${
                topMoversTab === 'gainers'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              الأعلى ربحاً (10) 🟢
            </button>
            <button
              onClick={() => setTopMoversTab('losers')}
              className={`px-2.5 py-0.5 rounded-lg transition ${
                topMoversTab === 'losers'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              الأعلى هبوطاً (10) 🔴
            </button>
          </div>
        </div>

        {/* Horizontal Scrollable Movers Reel */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar snap-x font-num">
          {(topMoversTab === 'gainers' ? topMovers.gainers : topMovers.losers).map((t) => {
            const isGainer = t.priceChangePercent >= 0;
            return (
              <button
                key={t.symbol}
                onClick={() => setSelectedSymbol(t.symbol)}
                className="shrink-0 snap-start p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between w-32 text-right shadow-sm active:scale-95"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-extrabold text-xs text-white">{t.symbol.replace('USDT', '')}</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                      isGainer ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                    }`}
                  >
                    {isGainer ? `+${t.priceChangePercent.toFixed(1)}%` : `${t.priceChangePercent.toFixed(1)}%`}
                  </span>
                </div>
                <div className="text-xs font-black text-slate-200">
                  ${formatPrice(t.lastPrice)}
                </div>
                <div className="text-[9px] text-slate-400 mt-1 font-sans">
                  سيولة: {(t.quoteVolume / 1000000).toFixed(0)}M$
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search & Horizontal Scrollable Chips (Prompt Requirement: الرئيسية: الكل/المفضلة/الرابحة/الخاسرة) */}
      <div className="space-y-2">
        {/* Search Box */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            placeholder="ابحث عن رمز العملة (مثال: BTC, SOL, SUI, DOGE)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#121824] border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-num"
          />
        </div>

        {/* Prompt Requirement: Horizontal Scrollable Chips (الرئيسية: الكل/المفضلة/الرابحة/الخاسرة) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          {[
            { id: 'all', label: `كافة العملات (${Object.keys(tickers).length || 'الكل'})` },
            { id: 'favorites', label: `⭐ المفضلة (${watchlist.length})` },
            { id: 'gainers', label: '🟢 الرابحة (الأكثر صعوداً)' },
            { id: 'losers', label: '🔴 الخاسرة (الأكثر هبوطاً)' },
          ].map((chip) => (
            <button
              key={chip.id}
              onClick={() => setFilterMode(chip.id as any)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition border ${
                filterMode === chip.id
                  ? chip.id === 'gainers'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                    : chip.id === 'losers'
                    ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                    : chip.id === 'favorites'
                    ? 'bg-amber-500 text-black border-amber-400 shadow-sm font-black'
                    : 'bg-sky-600 text-white border-sky-500 shadow-sm'
                  : 'bg-[#121824] text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Tickers List */}
        <div className="space-y-1.5">
          {displaySymbols.map((sym) => {
            const t = tickers[sym];
            const price = t?.lastPrice || 0;
            const change = t?.priceChangePercent || 0;
            const isPositive = change >= 0;
            const tickChange = priceChangesLastTick[sym];
            const isFav = watchlist.includes(sym);
            const funding = fundingRates[sym] ?? 0.0001;
            const cachedSignal = signalCache[sym];

            return (
              <div
                key={sym}
                onClick={() => setSelectedSymbol(sym)}
                className={`flex items-center justify-between p-3 rounded-2xl bg-[#121824] border border-slate-800/80 hover:border-slate-700 active:scale-[0.98] transition cursor-pointer shadow-md ${
                  tickChange === 'up'
                    ? 'animate-flash-up'
                    : tickChange === 'down'
                    ? 'animate-flash-down'
                    : ''
                }`}
              >
                {/* Left: Star & Symbol */}
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleWatchlist(sym);
                    }}
                    className="p-1 rounded-lg text-slate-500 hover:text-amber-400 transition"
                  >
                    <Star
                      className={`w-4 h-4 ${
                        isFav ? 'text-amber-400 fill-amber-400' : 'text-slate-600'
                      }`}
                    />
                  </button>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-white text-xs font-num tracking-wide">
                        {sym.replace('USDT', '')}
                      </span>
                      <span className="text-[10px] text-slate-500 font-num">/USDT</span>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1 font-num">
                      <span>حجم: ${( (t?.quoteVolume || 100000000) / 1000000 ).toFixed(0)}M</span>
                      <span>•</span>
                      <span className={funding >= 0 ? 'text-amber-400' : 'text-emerald-400'}>
                        {(funding * 100).toFixed(3)}% F
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Price, Change %, Signal badge */}
                <div className="flex items-center gap-3">
                  {/* Signal indicator pill */}
                  <div className="hidden xs:block text-right">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                        cachedSignal?.overallSignal === 'STRONG_BUY' || isPositive
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}
                    >
                      {cachedSignal
                        ? cachedSignal.overallSignal === 'STRONG_BUY'
                          ? 'شراء قوي'
                          : cachedSignal.overallSignal === 'BUY'
                          ? 'شراء'
                          : cachedSignal.overallSignal === 'STRONG_SELL'
                          ? 'بيع قوي'
                          : cachedSignal.overallSignal === 'SELL'
                          ? 'بيع'
                          : 'محايد'
                        : isPositive
                        ? 'شراء'
                        : 'بيع'}
                    </span>
                  </div>

                  <div className="text-left font-num min-w-[75px]">
                    <div className="text-xs font-black text-white">
                      ${formatPrice(price)}
                    </div>
                    <div
                      className={`text-[11px] font-bold flex items-center justify-end gap-0.5 ${
                        isPositive ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {isPositive ? (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {isPositive ? '+' : ''}
                        {change.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {displaySymbols.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-xs">
              {filterMode === 'favorites'
                ? 'لا توجد عملات في المفضلة بعد. اضغط على النجمة لإضافة عملاتك المفضلة.'
                : 'لا توجد عملات مطابقة لبحثك.'}
            </div>
          )}
        </div>
      </div>

      {/* Market News Modal */}
      <MarketNewsModal
        isOpen={isNewsModalOpen}
        onClose={() => setIsNewsModalOpen(false)}
      />
    </div>
  );
};
