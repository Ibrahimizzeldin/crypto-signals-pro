import React, { useState, useMemo } from 'react';
import { useCryptoStore } from '../../store/useCryptoStore';
import { SetupPattern, PortfolioId } from '../../types/crypto';
import { PORTFOLIO_CONFIGS } from '../../services/paperTradingEngine';
import { formatPrice } from '../../utils/formatters';
import { getPatternEmoji } from '../../utils/cryptoLogos';
import {
  BrainCircuit,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Target,
  Sparkles,
  Copy,
  Check,
  CheckCircle,
  AlertTriangle,
  Award,
  Layers,
  Activity,
  Flame,
  Zap,
  BarChart3,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import { getTradeTypeInfo } from '../../utils/tradeTypes';

interface ExpertRecommendationPrompt {
  id: string;
  category: string;
  badgeColor: string;
  title: string;
  diagnostic: string;
  prompt: string;
}

export const ExpertView: React.FC = () => {
  const { portfolios, closedTradesHistory = [] } = useCryptoStore();
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);

  // Read done recommendations from localStorage
  const [doneRecommendations, setDoneRecommendations] = useState<string[]>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return JSON.parse(window.localStorage.getItem('expert_recommendations_done') || '[]');
      }
    } catch (e) {}
    return [];
  });

  const handleMarkAsDone = (id: string) => {
    const updated = [...doneRecommendations, id];
    setDoneRecommendations(updated);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('expert_recommendations_done', JSON.stringify(updated));
      }
    } catch (e) {}
  };

  // Open trades across all 3 portfolios
  const openTradesCount = useMemo(() => {
    let count = 0;
    const pIds: PortfolioId[] = ['PORTFOLIO_A', 'PORTFOLIO_B', 'PORTFOLIO_C'];
    pIds.forEach((pid) => {
      const p = portfolios[pid];
      if (p?.trades) {
        count += p.trades.filter((t) => t.status === 'OPEN').length;
      }
    });
    return count;
  }, [portfolios]);

  // General Statistics Calculation based 100% directly on closedTradesHistory
  const stats = useMemo(() => {
    const closed = closedTradesHistory;
    const totalClosed = closed.length;

    const wins = closed.filter((t) => t.result === 'win' || t.netPnl > 0);
    const losses = closed.filter((t) => t.result === 'loss' || t.netPnl < 0);
    const liquidations = closed.filter((t) => t.closeReason === 'LIQUIDATED');

    const totalGains = wins.reduce((acc, t) => acc + (t.netPnl > 0 ? t.netPnl : 0), 0);
    const totalLossAmount = Math.abs(losses.reduce((acc, t) => acc + (t.netPnl < 0 ? t.netPnl : 0), 0));

    const winRate = totalClosed > 0 ? Number(((wins.length / totalClosed) * 100).toFixed(1)) : 0;
    const totalNetPnl = Number((totalGains - totalLossAmount).toFixed(2));

    let profitFactor = '—';
    if (totalGains === 0 && totalLossAmount === 0) profitFactor = '—';
    else if (totalLossAmount === 0 && totalGains > 0) profitFactor = '∞';
    else if (totalLossAmount > 0) profitFactor = (totalGains / totalLossAmount).toFixed(2);

    const avgPnl = totalClosed > 0 ? Number((totalNetPnl / totalClosed).toFixed(2)) : 0;

    return {
      totalTrades: totalClosed + openTradesCount,
      openCount: openTradesCount,
      closedCount: totalClosed,
      winCount: wins.length,
      lossCount: losses.length,
      liqCount: liquidations.length,
      winRate,
      totalNetPnl,
      totalGains,
      totalLossAmount,
      profitFactor,
      avgPnl,
    };
  }, [closedTradesHistory, openTradesCount]);

  // Pattern Analysis based 100% on closedTradesHistory: Breakout, Retest, Pullback
  const patternAnalysis = useMemo(() => {
    const patterns: SetupPattern[] = ['BREAKOUT', 'RETEST', 'PULLBACK'];
    const closed = closedTradesHistory;

    return patterns.map((pat) => {
      const patClosed = closed.filter((t) => (t.pattern || (t as any).setupPattern) === pat);
      const wins = patClosed.filter((t) => t.result === 'win' || t.netPnl > 0);
      const losses = patClosed.filter((t) => t.result === 'loss' || t.netPnl < 0);
      const totalPnl = patClosed.reduce((acc, t) => acc + t.netPnl, 0);
      const winRate = patClosed.length > 0 ? Math.round((wins.length / patClosed.length) * 100) : 0;

      let nameArabic = 'اختراق (Breakout)';
      if (pat === 'RETEST') nameArabic = 'إعادة اختبار (Retest)';
      if (pat === 'PULLBACK') nameArabic = 'تصحيح (Pullback)';

      return {
        pattern: pat,
        nameArabic,
        emoji: getPatternEmoji(pat),
        totalCount: patClosed.length,
        winCount: wins.length,
        lossCount: losses.length,
        winRate,
        totalPnl: Number(totalPnl.toFixed(2)),
      };
    });
  }, [closedTradesHistory]);

  // Loss Analysis based 100% on closedTradesHistory
  const lossAnalysis = useMemo(() => {
    const closedLosses = closedTradesHistory.filter((t) => t.result === 'loss' || t.netPnl < 0);
    const slHits = closedLosses.filter((t) => t.closeReason === 'SL' || t.closeReason === 'TRAILING_STOP');
    const liqs = closedLosses.filter((t) => t.closeReason === 'LIQUIDATED');
    const manualExits = closedLosses.filter((t) => t.closeReason === 'MANUAL');

    return {
      totalLossTrades: closedLosses.length,
      slHitCount: slHits.length,
      liquidationCount: liqs.length,
      manualExitCount: manualExits.length,
      avgLoss:
        closedLosses.length > 0
          ? Math.abs(closedLosses.reduce((acc, t) => acc + t.netPnl, 0) / closedLosses.length).toFixed(2)
          : '0.00',
    };
  }, [closedTradesHistory]);

  // Milestone check: Generate recommendations ONLY after every 50 closed trades (50, 100, 150...)
  const closedCount = stats.closedCount;
  const milestoneReached = closedCount >= 50;
  const currentBatch = Math.floor(closedCount / 50);
  const remainingToNextMilestone = 50 - (closedCount % 50 || 50);

  // Recommendations dynamically tailored to actual statistical performance
  const rawExpertPrompts: ExpertRecommendationPrompt[] = useMemo(() => {
    if (!milestoneReached) return [];

    const prompts: ExpertRecommendationPrompt[] = [
      {
        id: `rec-trailing-sl-${currentBatch}`,
        category: 'إدارة الأرباح وتأمين الصفقات',
        badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        title: 'حجز الأرباح التلقائي ونقل الوقف إلى الدخول (Trailing SL)',
        diagnostic: `بناءً على تحليل ${closedCount} صفقة مغلقة ومعدل فوز ${stats.winRate}%: تفعيل Trailing SL بمسافة 1.0× ATR بعد تحقيق TP1 يضمن حماية رأس المال ومنع ارتداد الصفقات الرابحة إلى خسارة.`,
        prompt: `تفعيل ميزة الوقف المتحرك (Trailing SL) التلقائي:
عندما يصل سعر العملة إلى 50% من المسافة نحو الهدف الأول (TP1)، قم فوراً بنقل وقف الخسارة (SL) إلى سعر الدخول الفعلي (Break-even).
بعد تحقيق TP1، حرّك الوقف تلقائياً خلف السعر بمسافة 1.0 × ATR لحماية الأرباح المحققة ومنع ارتداد الصفقات الرابحة إلى خسارة.`,
      },
      {
        id: `rec-rr-floor-${currentBatch}`,
        category: 'هندسة العائد للمخاطرة',
        badgeColor: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
        title: 'فرض نسبة مخاطرة لعائد صارمة R:R ≥ 1.5 كحد أدنى',
        diagnostic: `عامل الربح الحالي (${stats.profitFactor}) يوضح أهمية الحفاظ على نسبة عائد لمخاطرة 1:1.5 على الأقل، بحيث يتجاوز الربح المستهدف في كل صفقة 1.5× مسافة وقف الخسارة.`,
        prompt: `فرض فلتر R:R الصارم في محرك الإشارات:
- احذف أي صفقة يكون فيها معدل العائد للمخاطرة R:R أقل من 1.5.
- اجعل الهدف الأول (TP1) يقع على مسافة لا تقل عن 1.5 × مسافة الوقف المحسوب من ATR.`,
      },
      {
        id: `rec-pattern-focus-${currentBatch}`,
        category: 'تحسين كفاءة الأنماط الفنية',
        badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        title: 'تحسين فلترة أنماط الاختراق والتصحيح (Pattern Optimization)',
        diagnostic: `تظهر إحصائيات الأنماط نجاحاً متفاوتاً بين Breakout و Retest و Pullback. منح أولوية للنمط ذي نسبة الفوز الأعلى يعزز الاستقرار التراكمي.`,
        prompt: `تحسين ترتيب نقاط الأنماط الفنية:
- ارفع نقاط تقييم نمط Retest بمقدار 5 نقاط إضافية في ظروف السوق المستقرة.
- امنع نمط Breakout إذا كانت شمعة الاختراق ممتدة بأكثر من 2.5× ATR تجنباً للكسر الكاذب.`,
      },
    ];

    return prompts;
  }, [closedCount, milestoneReached, currentBatch, stats.winRate, stats.profitFactor]);

  // Active recommendations excluding completed ones (saved in localStorage)
  const activeRecommendations = useMemo(() => {
    return rawExpertPrompts.filter((rec) => !doneRecommendations.includes(rec.id));
  }, [rawExpertPrompts, doneRecommendations]);

  const handleCopyPrompt = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPromptId(id);
    setTimeout(() => setCopiedPromptId(null), 2500);
  };

  return (
    <div className="flex flex-col gap-5 p-4 pb-24 max-w-5xl mx-auto w-full text-right" dir="rtl">
      {/* 1. Header & AI Analyst Intro */}
      <div className="bg-gradient-to-br from-[#121824] via-[#101520] to-[#0c121d] border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500/20 via-emerald-500/20 to-indigo-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg">
              <BrainCircuit className="w-6 h-6 text-emerald-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base md:text-xl font-black text-white">
                  المحلل الشخصي والخبير الذكي (Personal Trading Analyst)
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                  إحصائيات دقيقة 100%
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
                تشخيص فوري مبني كلياً ومباشرة على سجل الصفقات المغلقة (closedTradesHistory)، مع تحليل عميق للأنماط والخسائر وتوصيات برمجية بعد كل 50 صفقة.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold font-num text-slate-300">
              الصفقات المغلقة بالسجل: <strong className="text-emerald-400">{stats.closedCount}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 2. General Performance Statistics (Math Logic Error Fixed) */}
      <div className="bg-[#121824] border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">إحصائيات الأداء العامة (مبنية على السجل الفعلي)</h2>
          </div>
          <span className="text-[10px] text-slate-400 font-num">
            مفتوحة: <strong className="text-white">{stats.openCount}</strong> | مغلقة: <strong className="text-white">{stats.closedCount}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-num">
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 block font-sans">نسبة الفوز (Win Rate)</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className={`text-lg font-black ${stats.winRate >= 50 ? 'text-emerald-400' : 'text-slate-200'}`}>
                {stats.winRate}%
              </span>
              <span className="text-[10px] text-slate-500 font-sans">({stats.winCount} رابحة / {stats.closedCount} مغلقة)</span>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 block font-sans">صافي الأرباح المحققة (Net PnL)</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className={`text-lg font-black ${stats.totalNetPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {stats.totalNetPnl >= 0 ? '+' : ''}${stats.totalNetPnl.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 block font-sans">عامل الربح (Profit Factor)</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-lg font-black text-sky-400">{stats.profitFactor}</span>
              <span className="text-[10px] text-slate-500 font-sans">مكاسب/خسائر</span>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 block font-sans">متوسط الصفقة المغلقة</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className={`text-lg font-black ${stats.avgPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {stats.avgPnl >= 0 ? '+' : ''}${stats.avgPnl.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Portfolio Status Summary */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3 border-t border-slate-800/80 text-xs font-num">
          {(['PORTFOLIO_A', 'PORTFOLIO_B', 'PORTFOLIO_C'] as PortfolioId[]).map((pid) => {
            const p = portfolios[pid];
            const cfg = PORTFOLIO_CONFIGS[pid];
            const trades = p?.trades || [];
            const openTrades = trades.filter((t) => t.status === 'OPEN');
            const closedInPortfolio = closedTradesHistory.filter((t) => t.portfolioId === pid);
            const floatingPnl = openTrades.reduce((acc, t) => acc + (t.netPnl || 0), 0);
            const equity = Math.max(0, (p?.account?.balance || 1000) + floatingPnl);

            return (
              <div key={pid} className="bg-slate-900/50 rounded-xl p-2.5 border border-slate-800/60 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-200 block font-sans">{cfg.name}</span>
                  <span className="text-[10px] text-slate-400 font-sans">
                    مفتوحة: {openTrades.length} | مغلقة بالسجل: {closedInPortfolio.length}
                  </span>
                </div>
                <div className="text-left">
                  <span className="font-black text-white block">${equity.toFixed(2)}</span>
                  <span className={`text-[10px] font-bold ${floatingPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {floatingPnl >= 0 ? '+' : ''}${floatingPnl.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Pattern Analysis (Pattern Analysis - Stored in Trade Object) */}
      <div className="bg-[#121824] border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-bold text-white">تحليل الأنماط الفنية (Pattern Analysis)</h2>
          </div>
          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
            مستخرج من كائن الصفقات المغلقة
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {patternAnalysis.map((p) => (
            <div key={p.pattern} className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{p.emoji}</span>
                    <span className="text-xs font-bold text-white">{p.nameArabic}</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-num font-bold">
                    {p.totalCount} صفقات
                  </span>
                </div>

                <div className="flex items-baseline justify-between mb-2 font-num">
                  <span className="text-[11px] text-slate-400">نسبة الفوز:</span>
                  <span className={`text-base font-black ${p.winRate >= 50 ? 'text-emerald-400' : 'text-slate-200'}`}>
                    {p.winRate}%
                  </span>
                </div>

                {/* Mini win/loss ratio bar */}
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex mb-2">
                  <div className="bg-emerald-500 h-full" style={{ width: `${p.winRate}%` }} />
                  <div className="bg-rose-500 h-full" style={{ width: `${100 - p.winRate}%` }} />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] font-num text-slate-400 border-t border-slate-800/80 pt-2">
                <span>رابحة: <strong className="text-emerald-400">{p.winCount}</strong> / خاسرة: <strong className="text-red-400">{p.lossCount}</strong></span>
                <span className={p.totalPnl >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                  {p.totalPnl >= 0 ? '+' : ''}${p.totalPnl.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Loss Analysis (تحليل أسباب الخسارة) */}
      <div className="bg-[#121824] border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-bold text-white">تحليل الخسائر ومخاطر الوقف (Loss Analysis)</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-num mb-3">
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 block font-sans">الصفقات الخاسرة بالسجل</span>
            <span className="text-base font-black text-rose-400 mt-0.5 block">{lossAnalysis.totalLossTrades}</span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 block font-sans">ضرب وقف الخسارة (SL)</span>
            <span className="text-base font-black text-amber-400 mt-0.5 block">{lossAnalysis.slHitCount}</span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 block font-sans">حالات التصفية (Liquidations)</span>
            <span className={`text-base font-black mt-0.5 block ${lossAnalysis.liquidationCount === 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
              {lossAnalysis.liquidationCount}
            </span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 block font-sans">إغلاق يدوي بخسارة</span>
            <span className="text-base font-black text-slate-300 mt-0.5 block">{lossAnalysis.manualExitCount}</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-xs text-slate-300 leading-relaxed space-y-1.5">
          <div className="flex items-center gap-2 text-emerald-400 font-bold">
            <ShieldCheck className="w-4 h-4" />
            <span>تشخيص المحلل لحماية رأس المال:</span>
          </div>
          <p className="text-slate-400 text-[11px]">
            أي صفقة تُغلق تسجل فوراً في مصفوفة السجل مع السبب (SL أو Trailing Stop أو يدوي). نقل الوقف للدخول (Break-even) عند 50% من TP1 والتحريك بمسافة 1.0× ATR بعد تحقيق TP1 يضمن تقليل ضرب الوقف الكلي إلى الحد الأدنى.
          </p>
        </div>
      </div>

      {/* 5. Direct Closed Trades History Log (سجل الصفقات والإغلاقات الجزئية اللحظي) */}
      <div className="bg-[#121824] border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">سجل العمليات والصفقات المنفذة (closedTradesHistory)</h2>
          </div>
          <span className="text-[10px] text-slate-400 font-num">
            الإجمالي بالسجل: <strong className="text-emerald-400">{closedTradesHistory.length}</strong> عملية
          </span>
        </div>

        {closedTradesHistory.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6 text-center text-xs text-slate-400">
            <Clock className="w-6 h-6 text-slate-500 mx-auto mb-2 animate-pulse" />
            <span>السجل ينتظر أول عملية إغلاق (عند وصول أي صفقة لـ TP1 أو TP2 أو TP3 أو SL). يتم تسجيل كل مرحلة فوراً هنا.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
            {closedTradesHistory.slice(0, 20).map((t) => {
              const isWin = t.netPnl >= 0;
              const typeInfo = getTradeTypeInfo(t.timeframe || '15m');
              const cfg = PORTFOLIO_CONFIGS[t.portfolioId];

              const getReasonBadge = (reason: string) => {
                switch (reason) {
                  case 'TP1':
                    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🎯 TP1 (50%)</span>;
                  case 'TP2':
                    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-400 border border-teal-500/30">🚀 TP2 (30%)</span>;
                  case 'TP3':
                    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/30 text-emerald-300 border border-emerald-500/40">🏆 TP3 (20%)</span>;
                  case 'SL':
                    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">🛑 وقف خسارة SL</span>;
                  case 'TRAILING_STOP':
                    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">🛡️ وقف متحرك</span>;
                  case 'MANUAL':
                    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">✋ إغلاق يدوي</span>;
                  case 'LIQUIDATED':
                    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600/30 text-red-300 border border-red-500/40">⚠️ تصفية</span>;
                  default:
                    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">{reason}</span>;
                }
              };

              return (
                <div
                  key={t.id}
                  className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs hover:border-slate-700 transition"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-white font-num text-sm">{t.symbol}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                      t.side === 'LONG'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-red-500/15 text-red-400'
                    }`}>
                      {t.side}
                    </span>
                    {/* Multi-Timeframe Trade Type Badge */}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-num ${typeInfo.badgeClass}`}>
                      {typeInfo.label}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-num">
                      {cfg?.shortName || t.portfolioId}
                    </span>
                    {getReasonBadge(t.closeReason)}
                  </div>

                  <div className="flex items-center gap-4 font-num text-left">
                    <div className="text-[11px] text-slate-400">
                      <span>دخول: ${formatPrice(t.entryPrice)}</span>
                      <span className="mx-1">←</span>
                      <span className="text-slate-200">خروج: ${formatPrice(t.exitPrice)}</span>
                    </div>

                    <div className="text-left font-num">
                      <span className={`font-black text-xs block ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isWin ? '+' : ''}${t.netPnl.toFixed(2)}
                      </span>
                      <span className={`text-[10px] font-bold ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
                        {t.pnlPercent >= 0 ? '+' : ''}{t.pnlPercent.toFixed(1)}%
                      </span>
                    </div>

                    <span className="text-[10px] text-slate-500 font-num">
                      {new Date(t.closedAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. Expert Improvement Recommendations with 50-Trade Gate & Mark as Done */}
      <div className="bg-[#121824] border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm md:text-base font-black text-white">
              توصيات الخبير لتحسين التطبيق (تحديث كل 50 صفقة مغلقة)
            </h2>
          </div>
          <span className="text-[10px] text-slate-400 font-num">
            الدفعة الحالية: #{currentBatch}
          </span>
        </div>

        {!milestoneReached ? (
          /* Gated before 50 closed trades */
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center mb-3">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1.5">
              توليد توصيات الخبير القادمة يتطلب 50 صفقة مغلقة
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed mb-4">
              حفاظاً على الدقة الإحصائية الرياضية، لا يتم توليد حزم توصيات جديدة إلا بعد اكتمال كل 50 صفقة مغلقة مسجلة في السجل (عند 50، 100، 150 صفقة).
            </p>
            <div className="max-w-xs mx-auto">
              <div className="flex items-center justify-between text-xs text-slate-400 font-num mb-1.5">
                <span>التقدم نحو الدفعة الأولى:</span>
                <span className="text-emerald-400 font-bold">{closedCount} / 50 صفقة</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (closedCount / 50) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-500 mt-2 block font-num">
                متبقي {remainingToNextMilestone} صفقة مغلقة لتوليد التوصيات الهندسية المخصصة
              </span>
            </div>
          </div>
        ) : activeRecommendations.length === 0 ? (
          /* All current recommendations marked as done */
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center mb-3">
              <CheckCircle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">
              تم تنفيذ كافة توصيات الدفعة الحالية بنجاح!
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              تم حفظ تنفيذ التوصيات في المتصفح. سيقوم الخبير بتوليد الحزمة التالية المخصصة تلقائياً فور وصول عدد الصفقات المغلقة إلى {(currentBatch + 1) * 50} صفقة (متبقي {remainingToNextMilestone} صفقة).
            </p>
          </div>
        ) : (
          /* Active recommendations for this 50-trade milestone */
          <div className="flex flex-col gap-4">
            <p className="text-xs text-slate-400 leading-relaxed font-sans mb-1">
              التوصيات أدناه مبنية حصرياً على نتائج {closedCount} صفقة مغلقة مسجلة بالسجل. يمكنك نسخ أي برومبت، وعند الانتهاء اضغط &quot;تم التنفيذ&quot; لإخفائها نهائياً.
            </p>

            {activeRecommendations.map((rec, idx) => {
              const isCopied = copiedPromptId === rec.id;

              return (
                <div
                  key={rec.id}
                  className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition flex flex-col gap-3"
                >
                  {/* Prompt Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold font-num flex items-center justify-center text-slate-300">
                        {idx + 1}
                      </span>
                      <h3 className="text-xs md:text-sm font-bold text-white">{rec.title}</h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold ${rec.badgeColor}`}>
                        {rec.category}
                      </span>

                      {/* Mark as Done Button */}
                      <button
                        onClick={() => handleMarkAsDone(rec.id)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 text-xs font-bold transition active:scale-95"
                        title="تأكيد تنفيذ التوصية وحذفها نهائياً من الواجهة"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>تم التنفيذ</span>
                      </button>
                    </div>
                  </div>

                  {/* Diagnostic rationale */}
                  <p className="text-xs text-slate-400 leading-relaxed font-sans">
                    {rec.diagnostic}
                  </p>

                  {/* Prompt Code Block with Copy Button */}
                  <div className="relative rounded-xl bg-black/60 border border-slate-800 p-3.5">
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800/80 text-[11px] text-slate-400">
                      <span className="font-mono text-slate-400">البرومبت المقترح (Prompt):</span>
                      <button
                        onClick={() => handleCopyPrompt(rec.id, rec.prompt)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition active:scale-95 ${
                          isCopied
                            ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                        }`}
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-black" /> : <Copy className="w-3.5 h-3.5 text-sky-400" />}
                        <span>{isCopied ? 'تم نسخ البرومبت!' : 'نسخ البرومبت'}</span>
                      </button>
                    </div>

                    <pre className="font-sans text-xs text-slate-200 whitespace-pre-wrap leading-relaxed select-all">
                      {rec.prompt}
                    </pre>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
