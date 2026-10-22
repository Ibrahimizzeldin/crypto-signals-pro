import React, { useState, useMemo } from 'react';
import { useCryptoStore } from '../../store/useCryptoStore';
import { SetupPattern, Timeframe, PaperTrade, StrategyId } from '../../types/crypto';
import { STRATEGY_CONFIGS } from '../../services/paperTradingEngine';
import { exportTradesToCSV, exportWeeklyPDFReport } from '../../utils/reportsExporter';
import { formatPrice } from '../../utils/formatters';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  ShieldAlert,
  Flame,
  Target,
  Clock,
  RotateCcw,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Award,
  Zap,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Trash2,
  Activity,
  Sparkles,
} from 'lucide-react';

export const PerformanceView: React.FC = () => {
  const {
    portfolios,
    activePortfolioId,
    setActivePortfolioId,
    marketRegime,
    isNewsPaused,
    setAutoTradingEnabled,
    closePaperTradeManually,
    resetPortfolio,
    clearAllUserData,
    setSelectedSymbol,
  } = useCryptoStore();

  const [patternFilter, setPatternFilter] = useState<'ALL' | SetupPattern>('ALL');
  const [outcomeFilter, setOutcomeFilter] = useState<'ALL' | 'WIN' | 'LOSS' | 'LIQUIDATED' | 'TP1' | 'TP2' | 'TP3' | 'SL'>('ALL');
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3500);
  };

  // Compute detailed statistics for each strategy
  const portfolioStats = useMemo(() => {
    const pIds: StrategyId[] = ['STRATEGY_TREND', 'STRATEGY_REVERSION', 'STRATEGY_SCALP'];

    const computed = pIds.map((pid) => {
      const p = portfolios[pid];
      const trades = p?.trades || [];
      const closed = trades.filter((t) => t.status === 'CLOSED');
      const open = trades.filter((t) => t.status === 'OPEN');
      const pending = trades.filter((t) => t.status === 'PENDING');

      const wins = closed.filter((t) => t.netPnl > 0);
      const losses = closed.filter((t) => t.netPnl < 0 && t.closeReason !== 'LIQUIDATED');
      const liquidations = closed.filter((t) => t.closeReason === 'LIQUIDATED');
      const openWins = open.filter((t) => (t.netPnl || 0) > 0);

      const totalClosed = closed.length;
      const totalAll = totalClosed + open.length;

      // Win Rate = (closed winning + floating winning) / total trades (Requirement 3)
      const totalWinRate = totalAll > 0 ? Number((((wins.length + openWins.length) / totalAll) * 100).toFixed(1)) : 0;
      const closedWinRate = totalClosed > 0 ? Number(((wins.length / totalClosed) * 100).toFixed(1)) : 0;
      const winRate = totalWinRate;

      const totalGains = wins.reduce((acc, t) => acc + t.netPnl, 0);
      const totalLosses =
        Math.abs(losses.reduce((acc, t) => acc + t.netPnl, 0)) +
        Math.abs(liquidations.reduce((acc, t) => acc + t.netPnl, 0));

      // Profit Factor: if no closed losses display "∞" or "—", if no gains "0", else ratio
      let profitFactorStr = '—';
      if (totalGains === 0 && totalLosses === 0) {
        profitFactorStr = '—';
      } else if (totalGains === 0 && totalLosses > 0) {
        profitFactorStr = '0.00';
      } else if (totalGains > 0 && totalLosses === 0) {
        profitFactorStr = '∞';
      } else if (totalLosses > 0) {
        profitFactorStr = (totalGains / totalLosses).toFixed(2);
      }

      const realizedPnl = Number(
        closed.reduce((acc, t) => acc + (t.closeReason === 'LIQUIDATED' ? -t.margin : t.netPnl), 0).toFixed(2)
      );
      const floatingPnl = Number(
        open.reduce((acc, t) => acc + (t.netPnl || 0), 0).toFixed(2)
      );
      const totalCombinedPnl = Number((realizedPnl + floatingPnl).toFixed(2));
      const initialBal = p.account.initialBalance || 1000;
      const liveEquity = Math.max(0, Number((initialBal + totalCombinedPnl).toFixed(2)));
      const netPnlPercent = Number((((liveEquity - initialBal) / initialBal) * 100).toFixed(2));

      // Calculate max drawdown from equity history & current equity
      let peak = initialBal;
      let maxDd = 0;
      p.equityHistory.forEach((pt) => {
        if (pt.equity > peak) peak = pt.equity;
        const dd = peak > 0 ? ((peak - pt.equity) / peak) * 100 : 0;
        if (dd > maxDd) maxDd = dd;
      });
      if (liveEquity > peak) peak = liveEquity;
      const currentDd = peak > 0 ? ((peak - liveEquity) / peak) * 100 : 0;
      if (currentDd > maxDd) maxDd = currentDd;

      // Liquidation rate %
      const liquidationRatePercent =
        totalAll > 0 ? Number(((liquidations.length / totalAll) * 100).toFixed(1)) : 0;

      return {
        id: pid,
        config: STRATEGY_CONFIGS[pid],
        account: {
          ...p.account,
          equity: liveEquity,
        },
        trades,
        closed,
        open,
        pending,
        totalTrades: trades.length,
        closedCount: totalClosed,
        openCount: open.length,
        pendingCount: pending.length,
        winsCount: wins.length,
        lossesCount: losses.length,
        liquidationsCount: liquidations.length,
        liquidationRatePercent,
        winRate,
        totalWinRate,
        closedWinRate,
        profitFactor: profitFactorStr,
        realizedPnl,
        floatingPnl,
        netPnl: totalCombinedPnl,
        netPnlPercent,
        liveEquity,
        maxDrawdown: Number(maxDd.toFixed(1)),
      };
    });

    // Identify the best performing strategy based on net PnL (or lowest liquidations / drawdown if tied)
    let best = computed[0];
    computed.forEach((p) => {
      if (p.netPnl > best.netPnl) {
        best = p;
      } else if (p.netPnl === best.netPnl && p.liquidationsCount < best.liquidationsCount) {
        best = p;
      }
    });

    return {
      list: computed,
      bestId: computed.some((p) => p.closedCount > 0 || p.openCount > 0) ? best.id : null,
      map: {
        STRATEGY_TREND: computed[0],
        STRATEGY_REVERSION: computed[1],
        STRATEGY_SCALP: computed[2],
      } as Record<StrategyId, typeof computed[0]>,
    };
  }, [portfolios]);

  // Current trades being viewed based on active tab
  const displayedTrades = useMemo(() => {
    if (activePortfolioId === 'ALL') {
      // Combined trades from all strategies
      return [
        ...(portfolios.STRATEGY_TREND?.trades || []),
        ...(portfolios.STRATEGY_REVERSION?.trades || []),
        ...(portfolios.STRATEGY_SCALP?.trades || []),
      ];
    }
    return portfolios[activePortfolioId]?.trades || [];
  }, [portfolios, activePortfolioId]);

  // Filtered Closed Trades
  const filteredClosedTrades = useMemo(() => {
    return displayedTrades.filter((t) => {
      if (t.status !== 'CLOSED') return false;
      if (patternFilter !== 'ALL' && t.pattern !== patternFilter) return false;
      if (outcomeFilter === 'WIN' && t.netPnl <= 0) return false;
      if (outcomeFilter === 'LOSS' && (t.netPnl >= 0 || t.closeReason === 'LIQUIDATED')) return false;
      if (outcomeFilter === 'LIQUIDATED' && t.closeReason !== 'LIQUIDATED') return false;
      if (outcomeFilter === 'TP1' && t.closeReason !== 'TP1') return false;
      if (outcomeFilter === 'TP2' && t.closeReason !== 'TP2') return false;
      if (outcomeFilter === 'TP3' && t.closeReason !== 'TP3') return false;
      if (outcomeFilter === 'SL' && t.closeReason !== 'SL') return false;
      return true;
    });
  }, [displayedTrades, patternFilter, outcomeFilter]);

  // Active open & pending trades
  const currentOpenTrades = useMemo(() => {
    return displayedTrades.filter((t) => t.status === 'OPEN');
  }, [displayedTrades]);

  const currentPendingTrades = useMemo(() => {
    return displayedTrades.filter((t) => t.status === 'PENDING');
  }, [displayedTrades]);

  // Pattern breakdown for active view - Only Retest, Breakout, Pullback (Reversal & Range removed)
  const patternBreakdown = useMemo(() => {
    const patterns: SetupPattern[] = ['BREAKOUT', 'RETEST', 'PULLBACK'];
    const names: Record<SetupPattern, string> = {
      BREAKOUT: 'Breakout (اختراق)',
      RETEST: 'Retest (إعادة اختبار)',
      PULLBACK: 'Pullback (تصحيح)',
    };

    const closed = displayedTrades.filter((t) => t.status === 'CLOSED');

    return patterns.map((p) => {
      const list = closed.filter((t) => t.pattern === p);
      const wins = list.filter((t) => t.netPnl > 0).length;
      const liqs = list.filter((t) => t.closeReason === 'LIQUIDATED').length;
      const winRate = list.length > 0 ? Number(((wins / list.length) * 100).toFixed(1)) : 0;
      const net = Number(list.reduce((acc, t) => acc + t.netPnl, 0).toFixed(2));
      return {
        pattern: p,
        title: names[p],
        count: list.length,
        winRate,
        liquidations: liqs,
        netPnl: net,
      };
    });
  }, [displayedTrades]);

  const handleExportCSV = () => {
    exportTradesToCSV(displayedTrades, (err) => showNotification(err));
    showNotification('تم تنزيل سجل الصفقات بصيغة CSV بنجاح!');
  };

  const handleExportPDF = () => {
    const targetAccount = activePortfolioId === 'ALL' || !portfolios[activePortfolioId] ? portfolios.STRATEGY_TREND.account : portfolios[activePortfolioId].account;
    const targetStats = activePortfolioId === 'ALL' || !portfolioStats.map[activePortfolioId] ? portfolioStats.map.STRATEGY_TREND : portfolioStats.map[activePortfolioId];
    exportWeeklyPDFReport(targetAccount, displayedTrades, {
      winRate: targetStats.winRate,
      profitFactor: parseFloat(targetStats.profitFactor) || (targetStats.profitFactor === '∞' ? 9.99 : 0),
      avgR: 1.5,
      netPnl: targetStats.netPnl,
      maxDrawdown: targetStats.maxDrawdown,
    });
  };

  const handleConfirmClear = () => {
    clearAllUserData();
    setConfirmClearOpen(false);
    showNotification('تم مسح جميع البيانات بنجاح والبدء بحساب نظيف 100%!');
  };

  return (
    <div className="flex flex-col gap-4 p-3 md:p-4 pb-28 max-w-6xl mx-auto w-full text-right">
      {/* Toast Notification */}
      {actionMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-emerald-600/90 text-white text-xs font-bold shadow-2xl flex items-center gap-2 backdrop-blur border border-emerald-400">
          <CheckCircle2 className="w-4 h-4" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Confirmation Modal for Clearing Data */}
      {confirmClearOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#121824] border border-red-500/40 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-red-400">
              <Trash2 className="w-5 h-5" />
              <h3 className="text-base font-black text-white">مسح كافة البيانات والبدء من الصفر؟</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              سيتم حذف جميع الصفقات وسجل الأداء من الذاكرة المحلية (localStorage) وإعادة تعيين المحافظ الثلاث (A, B, C) إلى رصيد 100 USDT بحالة فارغة تماماً دون أي صفقات افتراضية.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmClearOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirmClear}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-500 transition shadow-lg shadow-red-900/40"
              >
                نعم، امسح كل شيء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Header & Quick Actions */}
      <div className="bg-gradient-to-l from-[#121824] via-[#0f172a] to-[#121824] border border-slate-800/80 rounded-2xl p-4 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base md:text-lg font-black text-white">
                  لوحة أداء التداول الافتراضي (Paper Trading)
                </h1>
                <p className="text-[11px] md:text-xs text-slate-400">
                  مقارنة مباشرة بين 3 رافعات مالية (100x vs 50x vs 25x) على نفس إشارات السوق اللحظية
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            {/* Auto Trading Status Badge */}
            <button
              onClick={() => setAutoTradingEnabled(!portfolios.STRATEGY_TREND.account.autoTradingEnabled)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
                portfolios.STRATEGY_TREND.account.autoTradingEnabled
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${portfolios.STRATEGY_TREND.account.autoTradingEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              <span>{portfolios.STRATEGY_TREND.account.autoTradingEnabled ? 'التداول التلقائي: نشط' : 'التداول التلقائي: متوقف'}</span>
            </button>

            {/* Clear All Data */}
            <button
              onClick={() => setConfirmClearOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/30 flex items-center gap-1.5 transition"
              title="مسح كل البيانات والبدء بحساب نظيف"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>مسح البيانات</span>
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>تصدير CSV</span>
            </button>

            {/* Export PDF */}
            <button
              onClick={handleExportPDF}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition"
            >
              <FileText className="w-3.5 h-3.5 text-sky-400" />
              <span>تقرير PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Educational Banner: The Leverage Risk Lab */}
      <div className="bg-gradient-to-r from-rose-950/20 via-amber-950/20 to-emerald-950/20 border border-slate-800 rounded-2xl p-3.5 text-xs">
        <div className="flex items-center gap-2 mb-2 font-bold text-slate-200">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>مختبر مقارنة الرافعات المالية (The Leverage Risk Experiment):</span>
        </div>
        <p className="text-slate-300 leading-relaxed text-[11px] mb-2.5">
          كل إشارة معتمدة تُفتح في <strong>المحافظ الثلاث في نفس اللحظة بحجم موحد $1,000</strong> مع نفس الأرباح بالدولار. الفرق فقط في الرافعة، الهامش المحجوز، ومسافة التصفية. كل محفظة مستقلة: إذا صُفّيت A تستمر B و C. أقصى حد 3 صفقات متزامنة لكل محفظة.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300">
            <span className="font-black block text-rose-400 mb-0.5">المحفظة A • رافعة 100x</span>
            <span>حجم $1,000 • هامش محجوز <strong>$10</strong> • تصفية عند <strong>1.0%</strong></span>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
            <span className="font-black block text-amber-400 mb-0.5">المحفظة B • رافعة 50x</span>
            <span>حجم $1,000 • هامش محجوز <strong>$20</strong> • تصفية عند <strong>2.0%</strong></span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
            <span className="font-black block text-emerald-400 mb-0.5">المحفظة C • رافعة 25x</span>
            <span>حجم $1,000 • هامش محجوز <strong>$40</strong> • تصفية عند <strong>4.0%</strong></span>
          </div>
        </div>
      </div>

      {/* Triple Portfolio Comparison Table (Section 2 from Prompt) */}
      <div className="bg-[#121824] border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-black text-white">جدول المقارنة المباشر بين المحافظ الثلاث</h2>
          </div>
          <span className="text-[11px] text-slate-400">رأس مال البداية: 1,000 USDT لكل محفظة (3,000 USDT إجمالي)</span>
        </div>

        {/* Comparison Table Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                <th className="py-2.5 px-3 font-bold">المحفظة</th>
                <th className="py-2.5 px-3 font-bold">السيولة (Equity = رصيد + عائم)</th>
                <th className="py-2.5 px-3 font-bold">الرصيد الحر</th>
                <th className="py-2.5 px-3 font-bold">الهامش المستخدم</th>
                <th className="py-2.5 px-3 font-bold">التعرض الكلي</th>
                <th className="py-2.5 px-3 font-bold text-center">الصفقات (مفتوحة / مغلقة)</th>
                <th className="py-2.5 px-3 font-bold">صافي الربح / الخسارة</th>
                <th className="py-2.5 px-3 font-bold">Win Rate الكلي</th>
                <th className="py-2.5 px-3 font-bold text-center">التقييم</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {portfolioStats.list.map((p) => {
                const isBest = portfolioStats.bestId === p.id;
                const isPositive = p.netPnl >= 0;
                const marginUsed = p.open.reduce((acc, t) => acc + (t.margin || 0), 0);
                const freeBalance = Math.max(0, p.account.balance - marginUsed);
                const totalExposure = p.openCount * 1000;
                const isEquityUnder50 = p.account.equity < p.account.initialBalance * 0.5;

                return (
                  <tr
                    key={p.id}
                    onClick={() => setActivePortfolioId(p.id)}
                    className={`cursor-pointer transition hover:bg-slate-800/40 ${
                      activePortfolioId === p.id ? 'bg-slate-800/60' : ''
                    }`}
                  >
                    {/* Portfolio Info */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            p.config.badgeColor === 'rose'
                              ? 'bg-rose-500'
                              : p.config.badgeColor === 'amber'
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                        />
                        <div>
                          <span className="font-black text-white block text-xs">{p.config.shortName}</span>
                          <span className="text-[10px] text-slate-400 block font-num">
                            حجم $1,000 • هامش ${p.config.marginPerTrade} • حد {p.config.maxConcurrentTrades || 20}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Balance & Equity with 50% Warning */}
                    <td className="py-3 px-3 font-num">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-black text-sm block ${
                            p.account.equity >= p.account.initialBalance ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          ${p.account.equity.toFixed(2)}
                        </span>
                        {isEquityUnder50 && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-black animate-pulse">
                            ⚠️ انخفاض &lt; 50%
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block">
                        الرصيد: ${p.account.balance.toFixed(2)} • الأولي: ${p.account.initialBalance}
                      </span>
                    </td>

                    {/* Free Balance Column */}
                    <td className="py-3 px-3 font-num">
                      <span className="font-black text-emerald-400 text-xs block">
                        ${freeBalance.toFixed(2)}
                      </span>
                      <span className="text-[9px] text-slate-500 block">
                        جاهز لحماية الصفقات
                      </span>
                    </td>

                    {/* Margin Used Column */}
                    <td className="py-3 px-3 font-num">
                      <span className="font-black text-sky-400 text-xs block">
                        ${marginUsed.toFixed(1)}
                      </span>
                      <span className="text-[9px] text-slate-500 block">
                        ${p.config.marginPerTrade} لكل صفقة
                      </span>
                    </td>

                    {/* Total Exposure Column */}
                    <td className="py-3 px-3 font-num">
                      <span className="font-black text-amber-400 text-xs block">
                        ${totalExposure}
                      </span>
                      <span className="text-[9px] text-slate-500 block">
                        {p.openCount} صفقات × $1,000
                      </span>
                    </td>

                    {/* Open & Closed Count */}
                    <td className="py-3 px-3 text-center font-num">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 font-black text-xs">
                          {p.openCount} مفتوحة
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-bold text-xs">
                          {p.closedCount} مغلقة
                        </span>
                      </div>
                    </td>

                    {/* Net PnL (Realized + Floating) */}
                    <td className="py-3 px-3 font-num">
                      <div className={`flex items-center gap-1 font-black ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        <span>{isPositive ? `+${p.netPnl}` : `${p.netPnl}`} USDT</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block">
                        محقق: <strong className={p.realizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{p.realizedPnl >= 0 ? '+' : ''}${p.realizedPnl}</strong> • عائم: <strong className={p.floatingPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{p.floatingPnl >= 0 ? '+' : ''}${p.floatingPnl}</strong>
                      </span>
                    </td>

                    {/* Win Rate */}
                    <td className="py-3 px-3 font-num">
                      <span className="font-black text-white text-xs">{p.totalWinRate}%</span>
                      <span className="text-[10px] text-slate-400 block font-sans">
                        مغلقة: {p.closedWinRate}% • ربح: {p.profitFactor}
                      </span>
                    </td>

                    {/* Evaluation Badge */}
                    <td className="py-3 px-3 text-center">
                      {isBest ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black">
                          <Award className="w-3 h-3 text-amber-400" />
                          الأفضل أداءً 🏆
                        </span>
                      ) : p.liquidationsCount > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold">
                          عالية المخاطر ⚠️
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                          الأكثر استقراراً 🛡️
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Total Row */}
            <tfoot>
              <tr className="border-t-2 border-slate-700 bg-slate-900/90 font-bold text-white text-xs">
                <td className="py-3 px-3 font-black text-sky-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>المجموع الإجمالي</span>
                </td>
                <td className="py-3 px-3 font-num">
                  <span
                    className={`font-black text-sm block ${
                      portfolioStats.list.reduce((acc, p) => acc + p.account.equity, 0) >= 3000
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    ${portfolioStats.list.reduce((acc, p) => acc + p.account.equity, 0).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-400 block font-normal">
                    من أصل 3,000 USDT
                  </span>
                </td>
                {/* Total Free Balance */}
                <td className="py-3 px-3 font-num">
                  <span className="font-black text-emerald-400 text-xs block">
                    ${portfolioStats.list
                      .reduce((acc, p) => {
                        const mUsed = p.open.reduce((sum, t) => sum + (t.margin || 0), 0);
                        return acc + Math.max(0, p.account.balance - mUsed);
                      }, 0)
                      .toFixed(2)}
                  </span>
                  <span className="text-[9px] text-slate-500 block">إجمالي حر</span>
                </td>
                {/* Total Margin Used */}
                <td className="py-3 px-3 font-num">
                  <span className="font-black text-sky-400 text-xs block">
                    ${portfolioStats.list
                      .reduce((acc, p) => acc + p.open.reduce((sum, t) => sum + (t.margin || 0), 0), 0)
                      .toFixed(1)}
                  </span>
                </td>
                {/* Total Exposure */}
                <td className="py-3 px-3 font-num">
                  <span className="font-black text-amber-400 text-xs block">
                    ${portfolioStats.list.reduce((acc, p) => acc + p.openCount, 0) * 1000}
                  </span>
                </td>
                {/* Total Trades Count */}
                <td className="py-3 px-3 text-center font-num">
                  <span className="px-2 py-0.5 rounded-md bg-sky-500 text-white font-black text-xs">
                    {portfolioStats.list.reduce((acc, p) => acc + p.openCount, 0)} مفتوحة
                  </span>
                </td>
                <td className="py-3 px-3 font-num">
                  {(() => {
                    const totalPnl = Number(
                      portfolioStats.list.reduce((acc, p) => acc + p.netPnl, 0).toFixed(2)
                    );
                    const isPos = totalPnl >= 0;
                    return (
                      <span className={`font-black text-xs ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPos ? '+' : ''}${totalPnl} USDT
                      </span>
                    );
                  })()}
                </td>
                <td className="py-3 px-3 font-num text-xs text-slate-300">
                  {(() => {
                    const totalWins = portfolioStats.list.reduce((acc, p) => acc + p.winsCount, 0);
                    const totalClosed = portfolioStats.list.reduce((acc, p) => acc + p.closedCount, 0);
                    return totalClosed > 0 ? `${((totalWins / totalClosed) * 100).toFixed(1)}%` : '0%';
                  })()}
                </td>
                <td className="py-3 px-3 text-center text-[10px] text-sky-400 font-bold">Cross Margin</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Capital Efficiency Section (كفاءة رأس المال) */}
      <div className="bg-[#121824] border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs md:text-sm font-black text-white">
              كفاءة رأس المال والقدرة الاستيعابية (Capital Efficiency)
            </h3>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 font-bold">
            حجم ثابت $1,000
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {/* Portfolio A */}
          <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-black text-rose-300">المحفظة A (100x)</span>
              <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold">
                هامش $10
              </span>
            </div>
            <div className="space-y-1 font-num text-[11px] text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">الحد الأقصى المسموح:</span>
                <span className="font-black text-white">20 صفقة متزامنة</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">القدرة النظرية بالرصيد:</span>
                <span className="font-bold text-slate-400">حتى 99 صفقة ($990 هامش)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">أقصى تعرض عند 20 صفقة:</span>
                <span className="font-black text-amber-400">$20,000 (تصفية عند 5%)</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
              أعلى كفاءة في استغلال رأس المال، لكنها تتطلب انضباطاً صارماً لعدم تجاوز 20 صفقة لتفادي اقتراب التصفية.
            </p>
          </div>

          {/* Portfolio B */}
          <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-black text-amber-300">المحفظة B (50x)</span>
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                هامش $20
              </span>
            </div>
            <div className="space-y-1 font-num text-[11px] text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">الحد الأقصى المسموح:</span>
                <span className="font-black text-white">15 صفقة متزامنة</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">القدرة النظرية بالرصيد:</span>
                <span className="font-bold text-slate-400">حتى 49 صفقة ($980 هامش)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">أقصى تعرض عند 15 صفقة:</span>
                <span className="font-black text-amber-400">$15,000 (تصفية عند 6.6%)</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
              توازن ممتاز بين استغلال الهامش وأمان مسافة التصفية المريحة.
            </p>
          </div>

          {/* Portfolio C */}
          <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-black text-emerald-300">المحفظة C (25x)</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                هامش $40
              </span>
            </div>
            <div className="space-y-1 font-num text-[11px] text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">الحد الأقصى المسموح:</span>
                <span className="font-black text-white">10 صفقات متزامنة</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">القدرة النظرية بالرصيد:</span>
                <span className="font-bold text-slate-400">حتى 24 صفقة ($960 هامش)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">أقصى تعرض عند 10 صفقات:</span>
                <span className="font-black text-emerald-400">$10,000 (تصفية عند 10%)</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
              الأعلى أماناً وتحملاً للتذبذبات الكبيرة، مسافة تصفية واسعة تحمي الصفقات حتى في أشد الهبوطات.
            </p>
          </div>
        </div>
      </div>

      {/* Cross Margin Liquidation Analysis Section (تحليل Cross Margin) */}
      <div className="bg-[#121824] border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-sky-400" />
            <h3 className="text-xs md:text-sm font-black text-white">
              تحليل Cross Margin الحقيقي: كيف تقترب التصفية مع زيادة الصفقات
            </h3>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-300 font-bold">
            قاعدة: التصفية عند Equity = 0
          </span>
        </div>

        {/* Dynamic Multi-Trade Exposure Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs font-num">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[10px]">
                <th className="py-2 px-2.5 font-bold">عدد الصفقات</th>
                <th className="py-2 px-2.5 font-bold">إجمالي التعرض</th>
                <th className="py-2 px-2.5 font-bold">الخسارة المطلوبة للتصفية</th>
                <th className="py-2 px-2.5 font-bold">مسافة التصفية المتبقية %</th>
                <th className="py-2 px-2.5 font-bold">مستوى الخطورة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-[11px]">
              <tr className="hover:bg-slate-800/30">
                <td className="py-2 px-2.5 font-black text-white">صفقة واحدة (1)</td>
                <td className="py-2 px-2.5 text-slate-300">$1,000</td>
                <td className="py-2 px-2.5 text-emerald-400">$1,000 (كامل الرصيد)</td>
                <td className="py-2 px-2.5 font-black text-emerald-400">100.0% (مستحيل عملياً)</td>
                <td className="py-2 px-2.5 text-emerald-400 font-bold">آمن جداً 🟢</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="py-2 px-2.5 font-black text-white">5 صفقات</td>
                <td className="py-2 px-2.5 text-slate-300">$5,000</td>
                <td className="py-2 px-2.5 text-slate-300">$1,000</td>
                <td className="py-2 px-2.5 font-black text-emerald-300">20.0% حركة جماعية</td>
                <td className="py-2 px-2.5 text-emerald-300 font-bold">منخفض الخطورة 🟢</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="py-2 px-2.5 font-black text-white">10 صفقات (حد C)</td>
                <td className="py-2 px-2.5 text-slate-300">$10,000</td>
                <td className="py-2 px-2.5 text-slate-300">$1,000</td>
                <td className="py-2 px-2.5 font-black text-amber-400">10.0% حركة جماعية</td>
                <td className="py-2 px-2.5 text-amber-400 font-bold">متوسط الخطورة 🟡</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="py-2 px-2.5 font-black text-white">15 صفقة (حد B)</td>
                <td className="py-2 px-2.5 text-slate-300">$15,000</td>
                <td className="py-2 px-2.5 text-slate-300">$1,000</td>
                <td className="py-2 px-2.5 font-black text-amber-300">6.6% حركة جماعية</td>
                <td className="py-2 px-2.5 text-amber-300 font-bold">حذر مطلوب 🟠</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="py-2 px-2.5 font-black text-white">20 صفقة (حد A)</td>
                <td className="py-2 px-2.5 text-slate-300">$20,000</td>
                <td className="py-2 px-2.5 text-slate-300">$1,000</td>
                <td className="py-2 px-2.5 font-black text-rose-400">5.0% حركة جماعية</td>
                <td className="py-2 px-2.5 text-rose-400 font-bold">عالي الخطورة 🔴</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Real-time Status Card */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-base">🛡️</span>
            <div>
              <span className="font-bold text-white block">حماية الرصيد الحر في Cross Margin</span>
              <span className="text-[11px] text-slate-400">
                الرصيد الحر يحمي جميع الصفقات معاً. إذا كانت هناك صفقات رابحة، أرباحها العائمة تعزز مسافة التصفية لبقية الصفقات تلقائياً.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 font-num">
            {portfolioStats.list.map((p) => {
              const mUsed = p.open.reduce((sum, t) => sum + (t.margin || 0), 0);
              const freeBal = Math.max(0, p.account.balance - mUsed);
              return (
                <div key={p.id} className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-center">
                  <span className="text-[9px] text-slate-500 block">{p.config.shortName}</span>
                  <span className="text-xs font-black text-emerald-400">${freeBal.toFixed(0)} حر</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Liquidation Analysis Section (Requirement 2) */}
      <div className="bg-[#121824] border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <h3 className="text-xs md:text-sm font-black text-white">
              تحليل التصفيات وحساسية الرافعة المالية (Liquidation Analysis)
            </h3>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 font-bold">
            مقارنة واقعية
          </span>
        </div>

        {/* 3 Portfolio Liquidation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {portfolioStats.list.map((p) => {
            const isHighRisk = p.id === 'STRATEGY_SCALP';
            const isMediumRisk = p.id === 'STRATEGY_TREND';
            return (
              <div
                key={p.id}
                className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-white">{p.config.name}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      isHighRisk
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : isMediumRisk
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    تصفية عند {p.config.liquidationDistancePercent}%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-num">
                  <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">عدد التصفيات:</span>
                    <span className={`text-sm font-black ${p.liquidationsCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {p.liquidationsCount}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">نسبة التصفيات:</span>
                    <span className={`text-sm font-black ${p.liquidationsCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {p.liquidationRatePercent}%
                    </span>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                  {isHighRisk && (
                    <span className="text-rose-300/90 font-medium">
                      ⚠️ أي تصحيح 1% يؤدي لتصفية فورية قبل ملامسة SL (1.5-2%)
                    </span>
                  )}
                  {isMediumRisk && (
                    <span className="text-amber-300/90 font-medium">
                      🛡️ تتحمل تصحيح حتى 2%، تصفية نادرة ما لم تكن هناك ذيول حادة
                    </span>
                  )}
                  {!isHighRisk && !isMediumRisk && (
                    <span className="text-emerald-300/90 font-medium">
                      💎 أمان عالٍ بمسافة 4%، تسمح للصفقة بالارتداد والتنفس بحرية
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Lesson Learned Banner */}
        <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-amber-500/10 border border-amber-500/30 text-xs">
          <div className="flex items-start gap-2">
            <span className="text-base shrink-0">💡</span>
            <div>
              <span className="font-black text-amber-300 block mb-0.5">
                درس مستفاد: الرافعة 100x لا تسمح بهامش خطأ
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                في الرافعة 100x مسافة التصفية هي 1.0% فقط، بينما إشارات التحليل الفني تضع وقف الخسارة (SL) عند 1.5% إلى 2.0% من سعر الدخول. النتيجة الحتمية هي أن التصفية تحدث قبل الوصول لوقف الخسارة حتى وإن عادت الصفقة للأرباح لاحقاً. بينما الرافعتان 50x و 25x تمنحان مرونة كافية لامتصاص التذبذبات اليومية.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Portfolio Selector Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto text-xs">
        <button
          onClick={() => setActivePortfolioId('ALL')}
          className={`flex-1 py-2 px-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
            activePortfolioId === 'ALL'
              ? 'bg-sky-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>مقارنة الاستراتيجيات الثلاث (شامل)</span>
        </button>

        <button
          onClick={() => setActivePortfolioId('STRATEGY_TREND')}
          className={`flex-1 py-2 px-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
            activePortfolioId === 'STRATEGY_TREND'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Flame className="w-3.5 h-3.5 text-indigo-400" />
          <span>تتبع الترند (Trend 25x)</span>
        </button>

        <button
          onClick={() => setActivePortfolioId('STRATEGY_REVERSION')}
          className={`flex-1 py-2 px-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
            activePortfolioId === 'STRATEGY_REVERSION'
              ? 'bg-cyan-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span>الارتداد (Reversion 25x)</span>
        </button>

        <button
          onClick={() => setActivePortfolioId('STRATEGY_SCALP')}
          className={`flex-1 py-2 px-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
            activePortfolioId === 'STRATEGY_SCALP'
              ? 'bg-amber-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          <span>المضاربة السريعة (Scalp 25x)</span>
        </button>
      </div>

      {/* Selected Portfolio Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {/* Equity / Balance */}
        <div className="bg-[#121824] border border-slate-800 rounded-xl p-3">
          <span className="text-[11px] text-slate-400 block mb-1">الرصيد والسيولة</span>
          <div className="text-lg font-black text-white font-num">
            ${(activePortfolioId === 'ALL' || !portfolios[activePortfolioId] ? portfolioStats.map.STRATEGY_TREND.account.equity : portfolios[activePortfolioId].account.equity).toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-500 font-num">
            الهامش المستخدم: ${(activePortfolioId === 'ALL' || !portfolios[activePortfolioId] ? portfolioStats.map.STRATEGY_TREND.account.marginUsed : portfolios[activePortfolioId].account.marginUsed).toFixed(2)}
          </span>
        </div>

        {/* Net PnL */}
        <div className="bg-[#121824] border border-slate-800 rounded-xl p-3">
          <span className="text-[11px] text-slate-400 block mb-1">صافي الأرباح الصافية</span>
          {(() => {
            const currentStat = activePortfolioId === 'ALL' || !portfolioStats.map[activePortfolioId] ? portfolioStats.map.STRATEGY_TREND : portfolioStats.map[activePortfolioId];
            return (
              <>
                <div className={`text-lg font-black font-num ${
                  currentStat.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {currentStat.netPnl >= 0 ? '+' : ''}
                  {currentStat.netPnl} USDT
                </div>
                <span className="text-[10px] text-slate-500 font-num">
                  {currentStat.netPnlPercent}% من رأس المال
                </span>
              </>
            );
          })()}
        </div>

        {/* Win Rate */}
        <div className="bg-[#121824] border border-slate-800 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-slate-400 block">Win Rate الكلي</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 font-bold">شامل العائم</span>
          </div>
          {(() => {
            const currentStat = activePortfolioId === 'ALL' || !portfolioStats.map[activePortfolioId] ? portfolioStats.map.STRATEGY_TREND : portfolioStats.map[activePortfolioId];
            return (
              <>
                <div className="text-lg font-black text-white font-num">
                  {currentStat.totalWinRate}%
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-num mt-1">
                  <span>على المغلقة: {currentStat.closedWinRate}%</span>
                  <span>الربح: {currentStat.profitFactor}</span>
                </div>
              </>
            );
          })()}
        </div>

        {/* Liquidations */}
        <div className="bg-[#121824] border border-slate-800 rounded-xl p-3">
          <span className="text-[11px] text-slate-400 block mb-1">عدد التصفيات (Liquidated)</span>
          {(() => {
            const currentStat = activePortfolioId === 'ALL' || !portfolioStats.map[activePortfolioId] ? portfolioStats.map.STRATEGY_TREND : portfolioStats.map[activePortfolioId];
            return (
              <>
                <div className={`text-lg font-black font-num ${
                  currentStat.liquidationsCount > 0 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'
                }`}>
                  {currentStat.liquidationsCount}
                </div>
                <span className="text-[10px] text-slate-500 font-num">
                  خسارة 100% من الهامش
                </span>
              </>
            );
          })()}
        </div>
      </div>

      {/* Live Active Open Positions */}
      <div className="bg-[#121824] border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs md:text-sm font-black text-white">
              الصفقات المفتوحة لحظياً في السوق ({currentOpenTrades.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">تحديث فوري عبر WebSocket</span>
        </div>

        {currentOpenTrades.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-slate-900/40 border border-slate-800/80">
            <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400 font-bold">لا توجد صفقات مفتوحة حالياً في هذه الاستراتيجية</p>
            <p className="text-[11px] text-slate-500 mt-1">
              عند ظهور إشارة معتمدة ستفتح الصفقة تلقائياً بأسعار البث الحي لـ Binance Futures
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {currentOpenTrades.map((t) => {
              const isProfit = t.netPnl >= 0;
              const portConfig = t.portfolioId ? STRATEGY_CONFIGS[t.portfolioId as StrategyId] : STRATEGY_CONFIGS.STRATEGY_TREND;

              // Distance to liquidation price
              const distToLiqPct = t.currentPrice > 0
                ? Math.abs(((t.currentPrice - t.liquidationPrice) / t.currentPrice) * 100)
                : t.liquidationDistancePercent;

              return (
                <div
                  key={t.id}
                  className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedSymbol(t.symbol)}
                        className="text-xs font-black text-white hover:text-sky-400 font-num transition"
                      >
                        {t.symbol}
                      </button>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          t.side === 'LONG'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {t.side} {t.leverage}x
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-bold">
                        {portConfig.shortName}
                      </span>
                    </div>

                    <div className="text-left font-num">
                      <span className={`text-xs font-black ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfit ? `+${t.netPnl}` : `${t.netPnl}`} USDT
                      </span>
                      <span className={`text-[10px] block ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                        ({t.pnlPercent >= 0 ? `+${t.pnlPercent}%` : `${t.pnlPercent}%`})
                      </span>
                    </div>
                  </div>

                  {/* Price Info & Targets */}
                  <div className="p-2 rounded-lg bg-black/30 text-[10px] font-num space-y-1.5">
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-1 text-slate-300">
                      <span>سعر الإشارة: <strong className="text-white font-bold">{formatPrice(t.signalPrice || t.entryPrice)}</strong></span>
                      <span className="text-slate-500">|</span>
                      <span>سعر الدخول الفعلي: <strong className="text-emerald-400 font-bold">{formatPrice(t.actualEntryPrice || t.entryPrice)}</strong></span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <div>
                        <span className="text-slate-500 block">السعر اللحظي</span>
                        <span className="text-white font-bold">{formatPrice(t.currentPrice)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">وقف الخسارة</span>
                        <span className="text-rose-400 font-bold">{formatPrice(t.stopLoss)}</span>
                        <span className="text-[9px] text-amber-400 font-sans block">{t.slCalculationReason || 'SL: ATR × 1.5'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">سعر التصفية</span>
                        <span className="text-rose-400 font-bold">{formatPrice(t.liquidationPrice)}</span>
                      </div>
                    </div>
                  </div>

                  {/* SL to TP1 Progress Bar (Prompt Requirement 6) */}
                  {(() => {
                    const range = Math.abs(t.tp1 - t.stopLoss);
                    let progressPct = 50;
                    if (range > 0) {
                      if (t.side === 'LONG') {
                        progressPct = Math.max(0, Math.min(100, ((t.currentPrice - t.stopLoss) / (t.tp1 - t.stopLoss)) * 100));
                      } else {
                        progressPct = Math.max(0, Math.min(100, ((t.stopLoss - t.currentPrice) / (t.stopLoss - t.tp1)) * 100));
                      }
                    }
                    return (
                      <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/60 text-[10px] space-y-1">
                        <div className="flex items-center justify-between font-num">
                          <span className="text-rose-400">وقف (SL): {formatPrice(t.stopLoss)}</span>
                          <span className="font-bold text-sky-300">التقدم نحو الهدف ({progressPct.toFixed(0)}%)</span>
                          <span className="text-emerald-400">هدف (TP1): {formatPrice(t.tp1)}</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden relative">
                          <div
                            className={`h-full transition-all duration-300 ${
                              progressPct >= 75
                                ? 'bg-emerald-400'
                                : progressPct >= 40
                                ? 'bg-sky-400'
                                : 'bg-amber-400'
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Liquidation Danger Bar */}
                  <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[10px] space-y-1">
                    <div className="flex items-center justify-between text-rose-300">
                      <span>المسافة المتبقية حتى التصفية:</span>
                      <span className="font-black font-num">{distToLiqPct.toFixed(2)}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          distToLiqPct < 0.5 ? 'bg-red-500 animate-pulse' : distToLiqPct < 1.0 ? 'bg-amber-400' : 'bg-emerald-400'
                        }`}
                        style={{ width: `${Math.min(100, (distToLiqPct / (t.liquidationDistancePercent || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Trade Details: Size in Dollar, Reserved Margin, Remaining Balance (Prompt Requirements) */}
                  {(() => {
                    const portState = t.portfolioId ? portfolios[t.portfolioId as StrategyId] : null;
                    const bal = portState?.account?.balance ?? 100;
                    const used = portState?.account?.marginUsed ?? t.margin;
                    const remainingBal = Math.max(0, bal - used);

                    return (
                      <div className="grid grid-cols-3 gap-1.5 text-[10px] font-num bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                        <div>
                          <span className="text-slate-500 block text-[9px]">حجم الصفقة بالدولار:</span>
                          <span className="text-white font-extrabold">${t.positionSize.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[9px]">الهامش المحجوز:</span>
                          <span className="text-sky-400 font-extrabold">${t.margin}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[9px]">الرصيد المتبقي:</span>
                          <span className="text-emerald-400 font-extrabold">${remainingBal.toFixed(1)}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Action Button */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-400">
                      الرافعة: {t.leverage}x • تصفية عند {t.liquidationDistancePercent}%
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] font-bold flex items-center gap-1 font-sans">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>إغلاق آلي 100% (TP/SL)</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending Orders (Limit) */}
      {currentPendingTrades.length > 0 && (
        <div className="bg-[#121824] border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs md:text-sm font-black text-white">
                الأوامر المعلقة في انتظار وصول السعر ({currentPendingTrades.length})
              </h3>
            </div>
            <span className="text-[10px] text-amber-400/80">تُلغى تلقائياً بعد 3 شمعات إذا لم يصل السعر</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {currentPendingTrades.map((t) => {
              const diffPct = t.currentPrice > 0
                ? Math.abs(((t.entryPrice - t.currentPrice) / t.currentPrice) * 100)
                : 0;

              return (
                <div
                  key={t.id}
                  className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="font-black text-white font-num">{t.symbol}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-bold">
                        {t.patternNameArabic}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 block font-num">
                      الدخول المطلوب: {formatPrice(t.entryPrice)} (يبعد {diffPct.toFixed(2)}%)
                    </span>
                  </div>

                  <button
                    onClick={() => closePaperTradeManually(t.id)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-400 text-[10px] font-bold transition"
                  >
                    إلغاء الأمر
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Closed Trades History Table */}
      <div className="bg-[#121824] border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-sky-400" />
            <h3 className="text-xs md:text-sm font-black text-white">
              سجل الصفقات المنتهية ({filteredClosedTrades.length})
            </h3>
          </div>

          {/* Prompt Requirement: Horizontal Scrollable Chips (السجل: رابحة/خاسرة/السبب) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs max-w-full">
            <span className="text-[11px] text-slate-400 font-bold shrink-0 ml-1">تصفية:</span>
            {[
              { id: 'ALL', label: 'الكل' },
              { id: 'WIN', label: 'الرابحة 🟢' },
              { id: 'LOSS', label: 'الخاسرة 🔴' },
              { id: 'TP1', label: 'السبب: هدف 1 (TP1)' },
              { id: 'TP2', label: 'السبب: هدف 2 (TP2)' },
              { id: 'TP3', label: 'السبب: هدف 3 (TP3)' },
              { id: 'SL', label: 'السبب: وقف خسارة (SL)' },
              { id: 'LIQUIDATED', label: 'السبب: تصفية 🚨' },
            ].map((chip) => (
              <button
                key={chip.id}
                onClick={() => setOutcomeFilter(chip.id as any)}
                className={`px-2.5 py-1 text-xs rounded-xl font-bold whitespace-nowrap transition border ${
                  outcomeFilter === chip.id
                    ? chip.id === 'WIN' || chip.id === 'TP1' || chip.id === 'TP2' || chip.id === 'TP3'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                      : chip.id === 'LOSS' || chip.id === 'SL'
                      ? 'bg-slate-700 text-white border-slate-600 shadow-sm'
                      : chip.id === 'LIQUIDATED'
                      ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                      : 'bg-sky-600 text-white border-sky-500 shadow-sm'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {filteredClosedTrades.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-slate-900/40 border border-slate-800/80">
            <CheckCircle2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400 font-bold">الحساب فارغ وجاهز تماماً!</p>
            <p className="text-[11px] text-slate-500 mt-1">
              لا توجد صفقات منتهية بعد. الصفقات الجديدة ستُسجل وتُغلق وفق حركة السوق الحقيقية لحظياً.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                  <th className="py-2 px-2.5 font-bold">الرمز والاتجاه</th>
                  <th className="py-2 px-2.5 font-bold">المحفظة والرافعة</th>
                  <th className="py-2 px-2.5 font-bold">الدخول / الخروج</th>
                  <th className="py-2 px-2.5 font-bold">سبب الإغلاق</th>
                  <th className="py-2 px-2.5 font-bold text-left">الربح الصافي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredClosedTrades.map((t) => {
                  const isProfit = t.netPnl > 0;
                  const isLiq = t.closeReason === 'LIQUIDATED';
                  const portConfig = t.portfolioId ? STRATEGY_CONFIGS[t.portfolioId as StrategyId] : STRATEGY_CONFIGS.STRATEGY_TREND;

                  return (
                    <tr key={t.id} className="hover:bg-slate-800/30 transition">
                      {/* Symbol & Direction */}
                      <td className="py-2.5 px-2.5">
                        <div className="flex items-center gap-1.5 font-num font-black text-white">
                          <span>{t.symbol}</span>
                          <span
                            className={`px-1 py-0.5 rounded text-[9px] font-bold ${
                              t.side === 'LONG' ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
                            }`}
                          >
                            {t.side}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 block">{t.patternNameArabic}</span>
                      </td>

                      {/* Portfolio & Leverage */}
                      <td className="py-2.5 px-2.5">
                        <span className="text-white font-bold block text-xs">{portConfig.shortName}</span>
                        <span className="text-[10px] text-slate-500 font-num">هامش {t.margin}$</span>
                      </td>

                      {/* Entry & Exit */}
                      <td className="py-2.5 px-2.5 font-num text-[11px]">
                        <span className="text-slate-300 block">دخول: {formatPrice(t.actualEntryPrice || t.entryPrice)}</span>
                        <span className="text-white font-bold block">
                          خروج: {t.exitPrice ? formatPrice(t.exitPrice) : '—'}
                        </span>
                      </td>

                      {/* Close Reason */}
                      <td className="py-2.5 px-2.5">
                        {isLiq ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-black animate-pulse">
                            <Flame className="w-3 h-3 text-rose-400" />
                            تصفية (SL كان أبعد من مسافة التصفية) 🚨
                          </span>
                        ) : t.closeReason === 'TP1' ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                            هدف 1 (TP1) 🎯
                          </span>
                        ) : t.closeReason === 'TP2' ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                            هدف 2 (TP2) 🚀
                          </span>
                        ) : t.closeReason === 'TP3' ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-black">
                            هدف كامل (TP3) 🏆
                          </span>
                        ) : t.closeReason === 'TRAILING_STOP' ? (
                          <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-bold">
                            Trailing Stop 📈
                          </span>
                        ) : t.closeReason === 'SL' ? (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold">
                            وقف خسارة (SL) 🛑
                          </span>
                        ) : t.closeReason === 'EXPIRED' ? (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                            انتهت الصلاحية (3 شمعات) ⏱️
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                            إغلاق يدوي
                          </span>
                        )}
                      </td>

                      {/* Net PnL */}
                      <td className="py-2.5 px-2.5 text-left font-num font-black">
                        <span className={`text-xs block ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isProfit ? `+${t.netPnl}` : `${t.netPnl}`} USDT
                        </span>
                        <span className={`text-[10px] block ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                          ({t.pnlPercent >= 0 ? `+${t.pnlPercent}%` : `${t.pnlPercent}%`})
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pattern Breakdown */}
      <div className="bg-[#121824] border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <h3 className="text-xs md:text-sm font-black text-white flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-sky-400" />
          <span>أداء الأنماط الفنية المعتمدة الثلاثة (Pattern Performance)</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {patternBreakdown.map((pb) => (
            <div key={pb.pattern} className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
              <span className="text-[11px] font-black text-slate-200 block mb-1">{pb.title}</span>
              <div className="flex items-center justify-between font-num text-[11px] mb-0.5">
                <span className="text-slate-400">الصفقات:</span>
                <span className="font-bold text-white">{pb.count}</span>
              </div>
              <div className="flex items-center justify-between font-num text-[11px] mb-0.5">
                <span className="text-slate-400">نسبة الفوز:</span>
                <span className="font-bold text-emerald-400">{pb.winRate}%</span>
              </div>
              <div className="flex items-center justify-between font-num text-[11px]">
                <span className="text-slate-400">صافي الربح:</span>
                <span className={`font-black ${pb.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {pb.netPnl >= 0 ? `+${pb.netPnl}` : `${pb.netPnl}`} $
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
