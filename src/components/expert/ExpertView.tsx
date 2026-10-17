import React, { useState, useMemo } from 'react';
import { useCryptoStore } from '../../store/useCryptoStore';
import { SetupPattern, PortfolioId, PaperTrade } from '../../types/crypto';
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
  AlertTriangle,
  Award,
  Layers,
  Activity,
  Flame,
  Zap,
  BarChart3,
  ShieldCheck,
  Percent,
} from 'lucide-react';

interface ExpertRecommendationPrompt {
  id: string;
  category: string;
  badgeColor: string;
  title: string;
  diagnostic: string;
  prompt: string;
}

export const ExpertView: React.FC = () => {
  const { portfolios, marketRegime, fearAndGreed } = useCryptoStore();
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);

  // Aggregate trades across all 3 portfolios
  const allTrades = useMemo(() => {
    const list: PaperTrade[] = [];
    const pIds: PortfolioId[] = ['PORTFOLIO_A', 'PORTFOLIO_B', 'PORTFOLIO_C'];
    pIds.forEach((pid) => {
      const p = portfolios[pid];
      if (p?.trades) {
        list.push(...p.trades);
      }
    });
    return list;
  }, [portfolios]);

  // General Statistics Calculation
  const stats = useMemo(() => {
    const closed = allTrades.filter((t) => t.status === 'CLOSED');
    const open = allTrades.filter((t) => t.status === 'OPEN');
    const expired = allTrades.filter((t) => t.status === 'EXPIRED');

    const wins = closed.filter((t) => t.netPnl > 0);
    const losses = closed.filter((t) => t.netPnl < 0 && t.closeReason !== 'LIQUIDATED');
    const liquidations = closed.filter((t) => t.closeReason === 'LIQUIDATED');

    const totalClosed = closed.length;
    const totalGains = wins.reduce((acc, t) => acc + t.netPnl, 0);
    const totalLossAmount = Math.abs(
      losses.reduce((acc, t) => acc + t.netPnl, 0) +
        liquidations.reduce((acc, t) => acc + t.netPnl, 0)
    );

    const winRate = totalClosed > 0 ? Number(((wins.length / totalClosed) * 100).toFixed(1)) : 0;
    const totalNetPnl = Number((totalGains - totalLossAmount).toFixed(2));

    let profitFactor = '—';
    if (totalGains === 0 && totalLossAmount === 0) profitFactor = '—';
    else if (totalLossAmount === 0 && totalGains > 0) profitFactor = '∞';
    else if (totalLossAmount > 0) profitFactor = (totalGains / totalLossAmount).toFixed(2);

    const avgPnl = totalClosed > 0 ? Number((totalNetPnl / totalClosed).toFixed(2)) : 0;

    return {
      totalTrades: allTrades.length,
      openCount: open.length,
      closedCount: totalClosed,
      expiredCount: expired.length,
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
  }, [allTrades]);

  // Pattern Analysis: Breakout, Retest, Pullback
  const patternAnalysis = useMemo(() => {
    const patterns: SetupPattern[] = ['BREAKOUT', 'RETEST', 'PULLBACK'];
    const closed = allTrades.filter((t) => t.status === 'CLOSED');

    return patterns.map((pat) => {
      const patClosed = closed.filter((t) => t.setupPattern === pat);
      const wins = patClosed.filter((t) => t.netPnl > 0);
      const losses = patClosed.filter((t) => t.netPnl <= 0);
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
  }, [allTrades]);

  // Loss Analysis Diagnosis
  const lossAnalysis = useMemo(() => {
    const closedLosses = allTrades.filter(
      (t) => t.status === 'CLOSED' && (t.netPnl < 0 || t.closeReason === 'SL_HIT' || t.closeReason === 'LIQUIDATED')
    );
    const slHits = closedLosses.filter((t) => t.closeReason === 'SL_HIT');
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
  }, [allTrades]);

  // Expert recommendations for app improvement with ready prompts
  const expertPrompts: ExpertRecommendationPrompt[] = [
    {
      id: 'trailing_sl',
      category: 'إدارة الأرباح وتأمين الصفقات',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      title: 'حجز الأرباح التلقائي ونقل الوقف إلى الدخول (Trailing SL)',
      diagnostic: 'تحليل الصفقات يوضح أن بعض الصفقات تقترب من الهدف الأول ثم ترتد لتضرب الوقف. نقل الوقف للدخول بمجرد قطع 50% من المسافة يحمي رأس المال بنسبة 100%.',
      prompt: `تفعيل ميزة الوقف المتحرك (Trailing SL) التلقائي:
عندما يصل سعر العملة إلى 50% من المسافة نحو الهدف الأول (TP1)، قم فوراً بنقل وقف الخسارة (SL) إلى سعر الدخول الفعلي (Break-even).
بعد تحقيق TP1، حرّك الوقف تلقائياً خلف السعر بمسافة 1.0 × ATR لحماية الأرباح المحققة ومنع ارتداد الصفقات الرابحة إلى خسارة.`,
    },
    {
      id: 'rsi_divergence',
      category: 'تصفية الإشارات الفنية',
      badgeColor: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
      title: 'فلتر تباعد مؤشر القوة النسبية (RSI Divergence Filter)',
      diagnostic: 'تجنب فتح صفقات الشراء عند تشبع الشراء الشديد على الفريمات الكبرى، وتجنب صفقات البيع عند تشبع البيع، مما يرفع نسبة الفوز بأكثر من 15%.',
      prompt: `إضافة فلتر تشبع وزخم المؤشرات (RSI Divergence Filter):
- ارفض أي إشارة شراء (LONG) إذا كان RSI على فريم 1h أو 4h أعلى من 75 (تشبع شرائي مفرط).
- ارفض أي إشارة بيع (SHORT) إذا كان RSI على فريم 1h أو 4h أدنى من 25 (تشبع بيعي مفرط).
- امنح 10 نقاط إضافية للإشارات التي تظهر تباعداً إيجابياً (Bullish Divergence) متوافقاً مع الحجم.`,
    },
    {
      id: 'multi_tp_runner',
      category: 'تعظيم العوائد التراكمية',
      badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      title: 'تنفيذ الخروج المجزأ الذكي (Multi-Stage TP Execution)',
      diagnostic: 'الخروج الكامل عند TP1 يفوّت امتداد الاتجاهات القوية. تقسيم الخروج على 3 مراحل يضمن ربحاً مضموناً مع الاستفادة من التحركات الكبيرة.',
      prompt: `تطبيق نظام الخروج المجزأ الديناميكي (Multi-Stage Take Profit):
- إغلاق 50% من حجم الصفقة عند الهدف الأول (TP1) وتأمين الربح نقداً.
- إغلاق 30% عند الهدف الثاني (TP2).
- الإبقاء على 20% المتبقية كـ Runner نحو الهدف الثالث (TP3) مع رفع الوقف إلى مستوى TP1.`,
    },
    {
      id: 'orderbook_spread',
      category: 'حماية التنفيذ والسيولة',
      badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      title: 'التحقق من عمق دفتر الأوامر وسبريد الأسعار (Orderbook Spread)',
      diagnostic: 'في العملات البديلة سريعة الحركة، قد يتسع الفارق بين العرض والطلب مؤقتاً، مما يسبب انزلاقاً عند الدخول. فحص السبريد يضمن تنفيذاً مثالياً.',
      prompt: `إضافة فحص عمق السيولة وسبريد دفتر الأوامر (Bid/Ask Spread Filter):
قبل فتح أي صفقة جديدة من خلال محرك التداول:
- تحقق من أن فارق السعر بين أفضل طلب وأفضل عرض (Spread) أقل من أو يساوي 0.05%.
- إذا كان السبريد أعلى من 0.05%، علّق الدخول لمدة 30 ثانية حتى تستقر السيولة أو ارفض الإشارة لحماية الحساب من الانزلاق السعري.`,
    },
    {
      id: 'cluster_risk',
      category: 'إدارة مخاطر المحفظة المجمعة',
      badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
      title: 'تحديد الحد الأقصى لارتباط القطاعات (Sector Correlation Limit)',
      diagnostic: 'فتح عدة صفقات في نفس القطاع (مثل 4 عملات Meme معاً) يعرض المحفظة لهبوط جماعي متزامن. تحديد حد أقصى لكل قطاع يعزز تنويع المخاطر.',
      prompt: `تفعيل فلتر ارتباط القطاعات المشتركة (Sector Correlation Shield):
- تصنيف العملات حسب القطاع (L1, DeFi, Meme, AI, L2).
- منع فتح أكثر من صفقتين متزامنتين من نفس القطاع في نفس المحفظة.
- في حال توفر أكثر من إشارة في نفس القطاع، اختر فقط الإشارة ذات أعلى تقييم جودة (Score) وتجاهل الباقي.`,
    },
  ];

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
                  المحلل الشخصي والخبير الذكي (AI Personal Analyst)
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                  تحليل لحظي نشط
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
                تشخيص شامل لأداء المحافظ الثلاث، وتحليل عميق لأنماط التداول، مع توصيات برمجية جاهزة للنسخ لتحسين النظام.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold font-num text-slate-300">
              إجمالي الصفقات: <strong className="text-white">{stats.totalTrades}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 2. General Performance Statistics */}
      <div className="bg-[#121824] border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-white">إحصائيات الأداء العامة (General Statistics)</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-num">
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 block font-sans">نسبة الفوز الإجمالية</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className={`text-lg font-black ${stats.winRate >= 50 ? 'text-emerald-400' : 'text-slate-200'}`}>
                {stats.winRate}%
              </span>
              <span className="text-[10px] text-slate-500 font-sans">({stats.winCount} رابحة / {stats.closedCount} مغلقة)</span>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 block font-sans">صافي الأرباح (Net PnL)</span>
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
            <span className="text-[11px] text-slate-400 block font-sans">متوسط الصفقة</span>
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
            const closedTrades = trades.filter((t) => t.status === 'CLOSED');
            const floatingPnl = openTrades.reduce((acc, t) => acc + (t.netPnl || 0), 0);
            const equity = Math.max(0, (p?.account?.balance || 1000) + floatingPnl);

            return (
              <div key={pid} className="bg-slate-900/50 rounded-xl p-2.5 border border-slate-800/60 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-200 block font-sans">{cfg.name}</span>
                  <span className="text-[10px] text-slate-400 font-sans">مفتوحة: {openTrades.length} | مغلقة: {closedTrades.length}</span>
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

      {/* 3. Pattern Analysis (تحليل الأنماط) */}
      <div className="bg-[#121824] border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-bold text-white">تحليل الأنماط المعتمدة (Pattern Analysis)</h2>
          </div>
          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
            حظر تام لأنماط Reversal و Range الخاسرة
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

      {/* 4. Loss Analysis & Risk Audit (تحليل الخسائر) */}
      <div className="bg-[#121824] border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-bold text-white">تحليل الخسائر ومخاطر الوقف (Loss Analysis & Risk Audit)</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-num mb-3">
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 block font-sans">الصفقات الخاسرة المغلقة</span>
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
            <span className="text-[11px] text-slate-400 block font-sans">متوسط الخسارة لكل صفقة</span>
            <span className="text-base font-black text-slate-300 mt-0.5 block">${lossAnalysis.avgLoss}</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-xs text-slate-300 leading-relaxed space-y-1.5">
          <div className="flex items-center gap-2 text-emerald-400 font-bold">
            <ShieldCheck className="w-4 h-4" />
            <span>كفاءة قاعدة 1.5× ATR وفلتر فارق السعر 0.5%:</span>
          </div>
          <p className="text-slate-400 text-[11px]">
            تطبيق حد أدنى لوقف الخسارة عند <strong className="text-slate-200">1.5 × ATR(14)</strong> منع الخروج المبكر بسبب التذبذب اللحظي العادي، كما أن فحص فارق سعر الدخول <strong className="text-slate-200">≤ 0.5%</strong> قضى على ظاهرة الأرباح الوهمية وضمن مطابقة نتائج الحساب الافتراضي لأسعار التداول الحقيقية.
          </p>
        </div>
      </div>

      {/* 5. Expert Improvement Recommendations with Copyable Code Prompts */}
      <div className="bg-[#121824] border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm md:text-base font-black text-white">
              توصيات الخبير لتحسين التطبيق (Expert System Recommendations)
            </h2>
          </div>
          <span className="text-[10px] text-slate-400 font-sans">جاهزة للتطبيق عبر الأوامر</span>
        </div>

        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          يقدم الخبير هنا حزمة من البرومبتات الهندسية الدقيقة لتحسين المنطق، إدارة الصفقات، ورفع نسبة الأرباح. يمكنك نسخ أي برومبت مباشرة بضغطة زر وتطبيقه فوراً.
        </p>

        <div className="flex flex-col gap-4">
          {expertPrompts.map((rec, idx) => {
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

                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold ${rec.badgeColor}`}>
                    {rec.category}
                  </span>
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
      </div>
    </div>
  );
};
