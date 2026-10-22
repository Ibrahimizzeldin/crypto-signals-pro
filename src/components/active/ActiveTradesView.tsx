import React, { useState, useMemo } from 'react';
import { useCryptoStore } from '../../store/useCryptoStore';
import { StrategyId, PaperTrade } from '../../types/crypto';
import { STRATEGY_CONFIGS } from '../../services/paperTradingEngine';
import { formatPrice } from '../../utils/formatters';
import { CoinIcon } from '../common/CoinIcon';
import { getPatternEmoji } from '../../utils/cryptoLogos';
import {
  TrendingUp,
  TrendingDown,
  Target,
  Shield,
  Activity,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  XCircle,
  Clock,
  Sparkles,
  Zap,
  ShieldCheck,
} from 'lucide-react';
import { getTradeTypeInfo } from '../../utils/tradeTypes';

export const ActiveTradesView: React.FC = () => {
  const {
    portfolios,
    tickers,
    wsConnected,
    setSelectedSymbol,
    setDetailModalOpen,
  } = useCryptoStore();

  const [selectedStrategy, setSelectedStrategy] = useState<StrategyId>('STRATEGY_TREND');

  // Get all active OPEN trades for the selected strategy
  const openTrades = useMemo(() => {
    const list: PaperTrade[] = [];
    const p = portfolios[selectedStrategy];

    if (p?.trades) {
      p.trades.forEach((t) => {
        if (t.status === 'OPEN') {
          list.push(t);
        }
      });
    }

    // Smart Sorting:
    // Sort open trades descending:
    // Trades closest to TP1 or highest profit (PnL) at the TOP.
    return list.sort((a, b) => {
      const entryA = a.actualEntryPrice || a.entryPrice;
      const curA = a.currentPrice || tickers[a.symbol]?.lastPrice || entryA;
      const tp1A = a.tp1;
      let progressA = 0;
      if (a.side === 'LONG' && tp1A > entryA) {
        progressA = ((curA - entryA) / (tp1A - entryA)) * 100;
      } else if (a.side === 'SHORT' && tp1A < entryA) {
        progressA = ((entryA - curA) / (entryA - tp1A)) * 100;
      }

      const entryB = b.actualEntryPrice || b.entryPrice;
      const curB = b.currentPrice || tickers[b.symbol]?.lastPrice || entryB;
      const tp1B = b.tp1;
      let progressB = 0;
      if (b.side === 'LONG' && tp1B > entryB) {
        progressB = ((curB - entryB) / (tp1B - entryB)) * 100;
      } else if (b.side === 'SHORT' && tp1B < entryB) {
        progressB = ((entryB - curB) / (entryB - tp1B)) * 100;
      }

      const scoreA = (a.netPnl || 0) * 10 + progressA;
      const scoreB = (b.netPnl || 0) * 10 + progressB;

      return scoreB - scoreA;
    });
  }, [portfolios, selectedStrategy, tickers]);

  // Overall Strategy summaries for the 3 strategies
  const strategySummaries = useMemo(() => {
    const sIds: StrategyId[] = ['STRATEGY_TREND', 'STRATEGY_REVERSION', 'STRATEGY_SCALP'];
    return sIds.map((sid) => {
      const p = portfolios[sid];
      const cfg = STRATEGY_CONFIGS[sid];
      const open = p?.trades?.filter((t) => t.status === 'OPEN') || [];
      const floatingPnl = open.reduce((acc, t) => acc + (t.netPnl || 0), 0);
      const balance = p?.account?.balance || 1000;
      const equity = Math.max(0, balance + floatingPnl);
      return {
        sid,
        cfg,
        balance,
        equity,
        floatingPnl,
        openCount: open.length,
      };
    });
  }, [portfolios]);

  const handleOpenChart = (symbol: string) => {
    setSelectedSymbol(symbol);
    setDetailModalOpen(true);
  };

  return (
    <div className="flex flex-col gap-4 p-4 pb-24 max-w-5xl mx-auto w-full text-right" dir="rtl">
      {/* 1. Header & Quick Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#121824] border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-sky-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md">
            <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base md:text-lg font-black text-white">
                الصفقات المفتوحة (Active Positions)
              </h1>
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
                <span>مباشر 500ms</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              تصفية فورية حسب استراتيجيات التداول الثلاث: تتبع الترند، الارتداد، والمضاربة السريعة (25x)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold font-num text-slate-300">
            صفقات {STRATEGY_CONFIGS[selectedStrategy]?.name}: <span className="text-emerald-400 font-black">{openTrades.length}</span>
          </span>
        </div>
      </div>

      {/* 2. Three Horizontal Chips at the Top (Requirement 4) */}
      <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-900/90 rounded-2xl border border-slate-800 shadow-inner">
        <button
          onClick={() => setSelectedStrategy('STRATEGY_TREND')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
            selectedStrategy === 'STRATEGY_TREND'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950/40 border border-indigo-400'
              : 'text-slate-400 hover:text-white bg-slate-950/40'
          }`}
        >
          <span>[Trend] تتبع الترند</span>
          <span className="font-num px-1.5 py-0.5 rounded-full text-[10px] bg-black/40 text-emerald-300 font-extrabold">
            {portfolios.STRATEGY_TREND?.trades?.filter((t) => t.status === 'OPEN').length || 0}
          </span>
        </button>

        <button
          onClick={() => setSelectedStrategy('STRATEGY_REVERSION')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
            selectedStrategy === 'STRATEGY_REVERSION'
              ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-950/40 border border-cyan-400'
              : 'text-slate-400 hover:text-white bg-slate-950/40'
          }`}
        >
          <span>[Reversion] الارتداد</span>
          <span className="font-num px-1.5 py-0.5 rounded-full text-[10px] bg-black/40 text-emerald-300 font-extrabold">
            {portfolios.STRATEGY_REVERSION?.trades?.filter((t) => t.status === 'OPEN').length || 0}
          </span>
        </button>

        <button
          onClick={() => setSelectedStrategy('STRATEGY_SCALP')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
            selectedStrategy === 'STRATEGY_SCALP'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/40 border border-amber-400'
              : 'text-slate-400 hover:text-white bg-slate-950/40'
          }`}
        >
          <span>[Scalp] المضاربة (5m)</span>
          <span className="font-num px-1.5 py-0.5 rounded-full text-[10px] bg-black/40 text-emerald-300 font-extrabold">
            {portfolios.STRATEGY_SCALP?.trades?.filter((t) => t.status === 'OPEN').length || 0}
          </span>
        </button>
      </div>

      {/* 3. Three Strategy Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {strategySummaries.map((s) => {
          const isSelected = selectedStrategy === s.sid;
          return (
            <button
              key={s.sid}
              onClick={() => setSelectedStrategy(s.sid)}
              className={`p-3.5 rounded-2xl text-right transition-all border ${
                isSelected
                  ? 'bg-slate-800/90 border-emerald-500 shadow-lg shadow-emerald-950/20 ring-1 ring-emerald-500/50'
                  : 'bg-[#121824] border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-200">{s.cfg.name}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold font-num ${
                  s.sid === 'STRATEGY_TREND'
                    ? 'bg-indigo-500/20 text-indigo-300'
                    : s.sid === 'STRATEGY_REVERSION'
                    ? 'bg-cyan-500/20 text-cyan-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}>
                  رافعة {s.cfg.leverage}x • مخاطرة 1%
                </span>
              </div>

              <div className="flex items-baseline justify-between mb-1 font-num">
                <span className="text-[11px] text-slate-400">القيمة الإجمالية:</span>
                <span className="text-base font-black text-white">
                  ${s.equity.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] font-num text-slate-400 border-t border-slate-800/70 pt-2">
                <span>صفقات مفتوحة: <strong className="text-slate-200">{s.openCount}</strong></span>
                <span className={s.floatingPnl >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                  {s.floatingPnl >= 0 ? '+' : ''}${s.floatingPnl.toFixed(2)}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 4. Open Trades List with Progress Bar & Smart Sorting */}
      {openTrades.length === 0 ? (
        <div className="bg-[#121824] border border-slate-800/80 rounded-2xl p-12 text-center shadow-lg">
          <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 mx-auto flex items-center justify-center text-slate-500 mb-4 animate-pulse">
            <Zap className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-base font-bold text-white mb-2">لا توجد صفقات مفتوحة حالياً لهذه الاستراتيجية</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed mb-4">
            الماسحان 1 و 2 يقومان بمسح السوق بالتوازي وتوجيه الفرص تلقائياً للاستراتيجية المناسبة:
            الاختراقات لـ Trend، والارتداد لـ Reversion، وفريم 5m لـ Scalp.
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-emerald-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>الماسح المزدوج يعمل في الخلفية عبر كافة العقود</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {openTrades.map((trade, idx) => {
            const isLong = trade.side === 'LONG';
            const livePrice = tickers[trade.symbol]?.lastPrice || trade.currentPrice || trade.actualEntryPrice;
            const entryPrice = trade.actualEntryPrice || trade.entryPrice;
            const tp1Price = trade.tp1;
            const slPrice = trade.stopLoss;
            const pnl = trade.netPnl || 0;
            const isProfitable = pnl >= 0;

            // Calculate progress towards TP1
            let tp1Progress = 0;
            if (isLong && tp1Price > entryPrice) {
              tp1Progress = ((livePrice - entryPrice) / (tp1Price - entryPrice)) * 100;
            } else if (!isLong && tp1Price < entryPrice) {
              tp1Progress = ((entryPrice - livePrice) / (entryPrice - tp1Price)) * 100;
            }

            // Clamped progress percentage for visual bar (0% - 100%)
            const barWidth = Math.max(0, Math.min(100, Math.round(tp1Progress)));
            const strategyName = trade.portfolioId ? STRATEGY_CONFIGS[trade.portfolioId]?.shortName : 'Trend 25x';
            const typeInfo = getTradeTypeInfo(trade.timeframe || '15m');
            const isProtected = trade.positionSize < 250;

            return (
              <div
                key={trade.id}
                className="bg-[#121824] border border-slate-800 rounded-2xl p-4 shadow-lg hover:border-slate-700 transition"
              >
                {/* Top Row: Symbol, Side, Trade Type badge (Scalp/Swing), Portfolio badge, Liquidation Protection */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => handleOpenChart(trade.symbol)}
                      className="flex items-center gap-2 hover:opacity-80 transition text-right"
                    >
                      <CoinIcon symbol={trade.symbol} size="md" />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-black text-white font-num tracking-wide">
                            {trade.symbol.replace('USDT', '')}
                          </span>
                          <span className="text-[10px] text-slate-500 font-num">/USDT</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              isLong
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-red-500/15 text-red-400 border border-red-500/30'
                            }`}
                          >
                            {isLong ? 'LONG شراء' : 'SHORT بيع'}
                          </span>
                          {/* Multi-Timeframe Trade Type Badge: Scalp (15m) / Swing (1D) */}
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-num ${typeInfo.badgeClass}`}>
                            {typeInfo.label}
                          </span>
                          {/* Top-Down Daily & Weekly Macro Trend Badge */}
                          {trade.macroTrend && (
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold font-num ${
                                trade.macroTrend === 'BULLISH'
                                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                  : trade.macroTrend === 'BEARISH'
                                  ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                  : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              }`}
                              title={trade.macroTrendSummaryArabic || 'اتجاه الفريمات الكبيرة 1D و 1W'}
                            >
                              {trade.macroTrendLabel || (trade.macroTrend === 'BULLISH' ? 'Daily & Weekly صاعد 🟢' : 'Daily & Weekly هابط 🔴')}
                            </span>
                          )}
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/60 font-num">
                            {strategyName}
                          </span>
                          {isProtected && (
                            <span
                              className="text-[10px] px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 font-bold font-num flex items-center gap-1"
                              title={`حماية التصفية نشطة: تم تعديل حجم الصفقة إلى $${trade.positionSize} لتأمين مسافة تصفية آمنة تتجاوز الوقف`}
                            >
                              <ShieldCheck className="w-3 h-3 text-purple-400" />
                              حماية التصفية (${trade.positionSize})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 font-medium">
                          <span>{getPatternEmoji(trade.pattern)} {trade.patternNameArabic || trade.pattern}</span>
                          <span>•</span>
                          <span className="font-num font-bold text-slate-300">{trade.timeframe}</span>
                          <span>•</span>
                          <span className="text-slate-500 font-num">
                            {new Date(trade.openedAt || trade.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* PnL Display */}
                  <div className="text-left font-num">
                    <div className={`text-base font-black ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isProfitable ? '+' : ''}${pnl.toFixed(2)}
                    </div>
                    <div className={`text-[11px] font-bold ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
                      {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                    </div>
                  </div>
                </div>

                {/* Requirement 1: "سعر الإشارة: X | سعر الدخول الفعلي: Y" */}
                <div className="bg-slate-900/90 rounded-xl p-2.5 border border-slate-800/90 mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-num">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-[11px]">سعر الإشارة:</span>
                    <span className="text-slate-200 font-bold">${formatPrice(trade.signalPrice || trade.entryPrice)}</span>
                  </div>
                  <span className="text-slate-700">|</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-[11px]">سعر الدخول الفعلي:</span>
                    <span className="text-emerald-400 font-bold">${formatPrice(trade.actualEntryPrice || trade.entryPrice)}</span>
                  </div>
                  <span className="text-slate-700">|</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-[11px]">السعر الحالي:</span>
                    <span className="text-white font-bold">${formatPrice(livePrice)}</span>
                  </div>
                </div>

                {/* Requirement 2: "شريط تقدم" (Progress Bar) نحو الهدف الأول (TP1) */}
                <div className="mb-3 bg-slate-900/80 rounded-xl p-3 border border-slate-800">
                  <div className="flex items-center justify-between text-xs mb-1.5 font-num">
                    <div className="flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-slate-300 font-bold">نسبة الاقتراب من الهدف الأول (TP1)</span>
                    </div>
                    <span className={`font-black ${tp1Progress >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {tp1Progress >= 0 ? `+${tp1Progress.toFixed(1)}%` : `${tp1Progress.toFixed(1)}%`}
                    </span>
                  </div>

                  {/* Progress Bar Container */}
                  <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        tp1Progress >= 100
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400 animate-pulse'
                          : tp1Progress > 0
                          ? 'bg-gradient-to-r from-sky-500 to-emerald-400'
                          : 'bg-slate-700'
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 font-num">
                    <span>الدخول: ${formatPrice(entryPrice)}</span>
                    <span className="text-emerald-400 font-bold">الهدف 1: ${formatPrice(tp1Price)}</span>
                  </div>
                </div>

                {/* Targets & SL info */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-num bg-slate-900/40 rounded-xl p-2.5 border border-slate-800/60 mb-3">
                  <div>
                    <span className="text-slate-500 block text-[10px]">وقف الخسارة (SL)</span>
                    <span className="text-red-400 font-bold">${formatPrice(slPrice)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">الهدف 1 (TP1)</span>
                    <span className="text-emerald-400 font-bold">${formatPrice(trade.tp1)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">الهدف 2 (TP2)</span>
                    <span className="text-emerald-400 font-bold">${formatPrice(trade.tp2)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">سعر التصفية المقدر</span>
                    <span className="text-amber-400 font-bold">
                      {trade.liquidationPrice > 0 ? `$${formatPrice(trade.liquidationPrice)}` : 'آمن جداً'}
                    </span>
                  </div>
                </div>

                {/* Requirement 4: "SL محسوب من: ATR × 1.5" */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400 border-t border-slate-800/70 pt-2.5">
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-sky-400" />
                    <span className="text-sky-300 font-medium">
                      {trade.slCalculationReason || 'SL محسوب من: ATR × 1.5'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[11px] font-bold flex items-center gap-1.5 font-sans">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>إغلاق آلي 100% (TP/SL)</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
