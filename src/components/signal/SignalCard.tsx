import React from 'react';
import { MultiTimeframeAnalysis, Timeframe, SetupPattern, TradeExecutionStatus } from '../../types/crypto';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Target,
  Sparkles,
  Zap,
  Clock,
  Ban,
  Layers,
  ArrowRightLeft,
  Flame,
  Check,
  ShieldCheck,
  Award,
} from 'lucide-react';
import { formatPrice } from '../../utils/formatters';

interface SignalCardProps {
  analysis: MultiTimeframeAnalysis;
  onOpenRiskCalc?: () => void;
  onAddToJournal?: () => void;
}

export const SignalCard: React.FC<SignalCardProps> = ({
  analysis,
  onOpenRiskCalc,
  onAddToJournal,
}) => {
  const {
    overallSignal,
    overallDirection,
    confidence,
    agreedTimeframesCount,
    totalTimeframesCount,
    timeframeResults,
    setupPattern,
    patternNameArabic,
    executionStatus,
    executionStatusArabic,
    recommendation,
    conditionsMet,
    warnings,
    targets,
    currentPrice,
    explanation,
    bullishScenario,
    bearishScenario,
    momentumStatus,
    volatilityStatus,
  } = analysis;

  // Signal Badge config
  const getSignalBadge = () => {
    switch (overallSignal) {
      case 'STRONG_BUY':
        return {
          title: 'شراء قوي (Strong Long)',
          bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-emerald-950/40 shadow-lg',
          icon: <TrendingUp className="w-5 h-5 text-emerald-400" />,
        };
      case 'BUY':
        return {
          title: 'شراء (Long)',
          bg: 'bg-emerald-600/20 text-emerald-300 border-emerald-600/40',
          icon: <TrendingUp className="w-5 h-5 text-emerald-400" />,
        };
      case 'STRONG_SELL':
        return {
          title: 'بيع قوي (Strong Short)',
          bg: 'bg-red-500/20 text-red-400 border-red-500/50 shadow-red-950/40 shadow-lg',
          icon: <TrendingDown className="w-5 h-5 text-red-400" />,
        };
      case 'SELL':
        return {
          title: 'بيع (Short)',
          bg: 'bg-red-600/20 text-red-300 border-red-600/40',
          icon: <TrendingDown className="w-5 h-5 text-red-400" />,
        };
      default:
        return {
          title: 'محايد (انتظار)',
          bg: 'bg-slate-700/30 text-slate-300 border-slate-600/40',
          icon: <Minus className="w-5 h-5 text-slate-400" />,
        };
    }
  };

  // Pattern Badge style & icon
  const getPatternBadge = (pattern: SetupPattern) => {
    switch (pattern) {
      case 'BREAKOUT':
        return {
          label: 'Breakout (اختراق هيكلي)',
          badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
          icon: <Flame className="w-3.5 h-3.5 text-indigo-400" />,
        };
      case 'RETEST':
        return {
          label: 'Retest (إعادة اختبار مستوى)',
          badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
          icon: <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-400" />,
        };
      case 'PULLBACK':
      default:
        return {
          label: 'Pullback (تصحيح داخل الترند)',
          badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          icon: <Layers className="w-3.5 h-3.5 text-amber-400" />,
        };
    }
  };

  // Execution Status Badge
  const getExecutionBadge = (status: TradeExecutionStatus) => {
    switch (status) {
      case 'READY_NOW':
        return {
          label: 'جاهزة للتنفيذ الآن',
          desc: 'السعر عند منطقة الدخول المثالية - تنفيذ مباشر',
          containerClass: 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 shadow-emerald-950/50 shadow-md',
          dot: (
            <span className="relative flex h-2.5 w-2.5 mr-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
            </span>
          ),
        };
      case 'WAITING_PRICE':
        return {
          label: `في انتظار السعر (يبعد ${Math.abs(targets.entryDistancePercent)}%)`,
          desc: 'أمر معلق Limit - لا تتسرع بالدخول قبل وصول السعر للمستوى',
          containerClass: 'bg-sky-950/40 border-sky-500/40 text-sky-300',
          dot: <Clock className="w-4 h-4 text-sky-400 shrink-0" />,
        };
      case 'IGNORE':
      default:
        return {
          label: 'تجاهل (شروط غير مكتملة)',
          desc: targets.weakTradeReason || 'نسبة العائد للمخاطرة غير مجدية أو غياب شروط التأكيد',
          containerClass: 'bg-slate-900 border-slate-700 text-slate-400',
          dot: <Ban className="w-4 h-4 text-slate-400 shrink-0" />,
        };
    }
  };

  const badge = getSignalBadge();
  const patternInfo = getPatternBadge(setupPattern);
  const executionInfo = getExecutionBadge(executionStatus);
  const displayTfs: Timeframe[] = ['15m', '1h', '4h', '1d', '3d', '1w'];

  // Bitcoin Relationship category
  const btcRel = analysis.btcCorrelation;

  return (
    <div className="flex flex-col gap-4 text-right">
      {/* 1. Main Signal Header with Pattern, Execution Status & BTC Correlation */}
      <div className="bg-[#121824] border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        {/* Top Badges Row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Signal classification */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-bold ${badge.bg}`}
            >
              {badge.icon}
              {badge.title}
            </span>

            {/* Pattern Badge */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${patternInfo.badgeClass}`}
            >
              {patternInfo.icon}
              {patternInfo.label}
            </span>

            {/* BTC Correlation Badge */}
            {btcRel && (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold font-num ${
                  btcRel.category === 'FOLLOWER'
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                    : btcRel.category === 'COUNTER'
                    ? 'bg-purple-500/15 text-purple-300 border-purple-500/40'
                    : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                }`}
                title={btcRel.descriptionArabic}
              >
                <span>⚡ {btcRel.categoryArabic}</span>
                <span className="text-[10px] opacity-80">({btcRel.coefficient >= 0 ? '+' : ''}{btcRel.coefficient})</span>
              </span>
            )}
          </div>

          {/* Confidence Indicator */}
          <div className="text-left shrink-0">
            <div className="text-[11px] text-slate-400">نسبة الثقة</div>
            <div className="text-lg font-extrabold text-white font-num">
              {confidence}%
            </div>
          </div>
        </div>

        {/* Execution Status Banner */}
        <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${executionInfo.containerClass}`}>
          <div className="flex items-center gap-2.5">
            {executionInfo.dot}
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>{executionInfo.label}</span>
                {executionStatus === 'READY_NOW' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                    سعر السوق
                  </span>
                )}
                {executionStatus === 'WAITING_PRICE' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold">
                    أمر Limit معلق
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5">
                {executionInfo.desc}
              </div>
            </div>
          </div>

          <div className="text-left shrink-0 font-num">
            <span className="text-[10px] text-slate-400 block">السعر الحالي</span>
            <span className="text-xs font-bold text-white">${formatPrice(currentPrice)}</span>
          </div>
        </div>

        {/* Confidence Progress Bar */}
        <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              overallDirection === 'BULLISH'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                : overallDirection === 'BEARISH'
                ? 'bg-gradient-to-r from-red-600 to-rose-400'
                : 'bg-gradient-to-r from-slate-500 to-slate-400'
            }`}
            style={{ width: `${confidence}%` }}
          />
        </div>

        {/* Alignment Summary Sentence */}
        <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          توافق {agreedTimeframesCount} من {totalTimeframesCount} فريمات رئيسية → إشارة [{badge.title}] (ثقة {confidence}%)
        </p>

        {/* Technical Analysis Explanation */}
        <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800/80 text-xs leading-relaxed text-slate-300">
          <span className="font-bold text-sky-400">التحليل الفني للنمط: </span>
          {explanation}
        </div>

        {/* 100-Point Smart Score Matrix */}
        {analysis.scoreBreakdown && (
          <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 text-xs space-y-2">
            <div className="flex items-center justify-between font-bold text-white">
              <span className="flex items-center gap-1.5 text-amber-400">
                <Award className="w-4 h-4" />
                <span>نظام النقاط الذكي (Score-Based)</span>
              </span>
              <span className={`px-2 py-0.5 rounded-lg border font-num font-extrabold ${
                analysis.scoreBreakdown.totalScore >= 70
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : analysis.scoreBreakdown.totalScore >= 55
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {analysis.scoreBreakdown.totalScore} / 100
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800/80 text-center">
                <span className="text-[10px] text-slate-400 block">توافق الفريمات</span>
                <span className="font-num font-bold text-sky-400">{analysis.scoreBreakdown.timeframeAlignment} / 25</span>
              </div>
              <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800/80 text-center">
                <span className="text-[10px] text-slate-400 block">ترتيب EMA</span>
                <span className="font-num font-bold text-sky-400">{analysis.scoreBreakdown.emaTrendStrength} / 15</span>
              </div>
              <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800/80 text-center">
                <span className="text-[10px] text-slate-400 block">نسبة R:R</span>
                <span className="font-num font-bold text-sky-400">{analysis.scoreBreakdown.riskReward} / 10</span>
              </div>
              <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800/80 text-center">
                <span className="text-[10px] text-slate-400 block">حجم التداول</span>
                <span className="font-num font-bold text-sky-400">{analysis.scoreBreakdown.volume} / 10</span>
              </div>
              <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800/80 text-center">
                <span className="text-[10px] text-slate-400 block">حالة السوق والنمط</span>
                <span className="font-num font-bold text-sky-400">{analysis.scoreBreakdown.marketRegimeMatch} / 15</span>
              </div>
              <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800/80 text-center">
                <span className="text-[10px] text-slate-400 block">مؤشر RSI</span>
                <span className="font-num font-bold text-sky-400">{analysis.scoreBreakdown.rsiQuality} / 10</span>
              </div>
              <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800/80 text-center">
                <span className="text-[10px] text-slate-400 block">زخم MACD</span>
                <span className="font-num font-bold text-sky-400">{analysis.scoreBreakdown.macdConfirmation} / 10</span>
              </div>
              <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800/80 text-center">
                <span className="text-[10px] text-slate-400 block">خلو المقاومات</span>
                <span className="font-num font-bold text-sky-400">{analysis.scoreBreakdown.supportResistanceClear} / 5</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] pt-1 text-slate-400 border-t border-slate-800/60">
              <span>حالة القرار: <strong className="text-white">{analysis.scoreBreakdown.executionCategoryArabic}</strong></span>
              <span>
                {analysis.scoreBreakdown.totalScore >= 70
                  ? '⚡ تنفيذ فوري متزامن في المحافظ الثلاث (100x, 50x, 25x)'
                  : analysis.scoreBreakdown.totalScore >= 55
                  ? '⏳ أمر معلق Limit - في انتظار السعر (صلاحية 3 شمعات)'
                  : '❌ استبعاد الإشارة لعدم بلوغ 55 نقطة'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Strict Conditions Met & Warnings Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Conditions Met Card */}
        <div className="bg-[#121824] border border-slate-800 rounded-2xl p-4 shadow-lg">
          <h4 className="text-xs font-bold text-emerald-400 mb-2.5 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            الشروط الفنية المحققة لإصدار الإشارة ({conditionsMet.length})
          </h4>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {conditionsMet.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Technical Warnings Card */}
        <div className="bg-[#121824] border border-slate-800 rounded-2xl p-4 shadow-lg">
          <h4 className="text-xs font-bold text-amber-400 mb-2.5 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            التحذيرات والملاحظات الفنية ({warnings.length})
          </h4>
          {warnings.length > 0 ? (
            <ul className="space-y-1.5 text-xs text-slate-300">
              {warnings.map((w, i) => (
                <li key={i} className="flex items-start gap-2 text-amber-200/90">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>لا توجد تحذيرات فنية - الإشارة مستوفية للمعايير الصارمة بدون عوائق.</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Targets and Move Percentages Table (With ATR Distances & R:R) */}
      <div className="bg-[#121824] border border-slate-800 rounded-2xl p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Target className="w-4 h-4 text-emerald-400" />
            جدول الأهداف ومسافات ATR المحسوبة
          </h4>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2.5 py-1 rounded-lg font-bold font-num border ${
                targets.riskRewardRatio >= 2.5
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : targets.riskRewardRatio >= 2.0
                  ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                  : 'bg-red-500/20 text-red-400 border-red-500/40'
              }`}
            >
              R:R 1:{targets.riskRewardRatio}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 px-2 font-medium">المستوى</th>
                <th className="py-2.5 px-2 font-medium">السعر (USDT)</th>
                <th className="py-2.5 px-2 font-medium text-center">نسبة التحرك</th>
                <th className="py-2.5 px-2 font-medium text-left">مسافة ATR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-num">
              {/* Entry Level */}
              <tr className="hover:bg-slate-800/30 transition">
                <td className="py-2.5 px-2 font-semibold text-sky-400">
                  نقطة الدخول
                  <span className="block text-[10px] text-slate-400 font-normal">
                    {executionStatus === 'READY_NOW' ? 'دخول فوري' : 'أمر معلق Limit'}
                  </span>
                </td>
                <td className="py-2.5 px-2 font-bold text-white">${formatPrice(targets.entry)}</td>
                <td className="py-2.5 px-2 text-center text-slate-400">
                  {targets.entryDistancePercent === 0
                    ? 'عند السعر'
                    : `${targets.entryDistancePercent > 0 ? '+' : ''}${targets.entryDistancePercent}%`}
                </td>
                <td className="py-2.5 px-2 text-left text-slate-500">—</td>
              </tr>

              {/* TP1 Level */}
              <tr className="bg-emerald-500/5 hover:bg-emerald-500/10 transition">
                <td className="py-2.5 px-2 font-semibold text-emerald-400">
                  الهدف الأول (TP1)
                  <span className="block text-[10px] text-emerald-500 font-normal">
                    احتمالية وصول عالية
                  </span>
                </td>
                <td className="py-2.5 px-2 font-bold text-emerald-300">${formatPrice(targets.tp1)}</td>
                <td className="py-2.5 px-2 text-center font-bold text-emerald-400">
                  {targets.tp1Percent > 0 ? `+${targets.tp1Percent}%` : `${targets.tp1Percent}%`}
                </td>
                <td className="py-2.5 px-2 text-left font-semibold text-emerald-300">
                  {targets.tp1AtrDistance}× ATR
                </td>
              </tr>

              {/* TP2 Level */}
              <tr className="bg-emerald-500/5 hover:bg-emerald-500/10 transition">
                <td className="py-2.5 px-2 font-semibold text-emerald-300">
                  الهدف الثاني (TP2)
                  <span className="block text-[10px] text-emerald-500 font-normal">
                    فيبوناتشي 1.272
                  </span>
                </td>
                <td className="py-2.5 px-2 font-bold text-emerald-200">${formatPrice(targets.tp2)}</td>
                <td className="py-2.5 px-2 text-center font-bold text-emerald-400">
                  {targets.tp2Percent > 0 ? `+${targets.tp2Percent}%` : `${targets.tp2Percent}%`}
                </td>
                <td className="py-2.5 px-2 text-left font-semibold text-emerald-300">
                  {targets.tp2AtrDistance}× ATR
                </td>
              </tr>

              {/* TP3 Level (if exists) */}
              {targets.tp3 && (
                <tr className="bg-emerald-500/5 hover:bg-emerald-500/10 transition">
                  <td className="py-2.5 px-2 font-semibold text-teal-300">
                    الهدف الثالث (TP3)
                    <span className="block text-[10px] text-teal-500 font-normal">
                      امتداد 1.618 أقصى
                    </span>
                  </td>
                  <td className="py-2.5 px-2 font-bold text-teal-200">${formatPrice(targets.tp3)}</td>
                  <td className="py-2.5 px-2 text-center font-bold text-teal-400">
                    {(targets.tp3Percent || 0) > 0 ? `+${targets.tp3Percent}%` : `${targets.tp3Percent}%`}
                  </td>
                  <td className="py-2.5 px-2 text-left font-semibold text-teal-300">
                    {targets.tp3AtrDistance ? `${targets.tp3AtrDistance}× ATR` : '—'}
                  </td>
                </tr>
              )}

              {/* Stop Loss Level */}
              <tr className="bg-red-500/5 hover:bg-red-500/10 transition">
                <td className="py-2.5 px-2 font-semibold text-red-400">
                  وقف الخسارة (SL)
                  <span className="block text-[10px] text-amber-400 font-bold">
                    {targets.slCalculationReason || 'SL محسوب من: ATR × 1.5'}
                  </span>
                </td>
                <td className="py-2.5 px-2 font-bold text-red-300">${formatPrice(targets.sl)}</td>
                <td className="py-2.5 px-2 text-center font-bold text-red-400">
                  {targets.slPercent < 0 ? `${targets.slPercent}%` : `-${targets.slPercent}%`}
                </td>
                <td className="py-2.5 px-2 text-left font-semibold text-red-300">
                  {targets.slAtrDistance}× ATR
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-800">
          {onOpenRiskCalc && (
            <button
              onClick={onOpenRiskCalc}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
            >
              حاسبة المخاطر والرافعة
            </button>
          )}
          {onAddToJournal && (
            <button
              onClick={onAddToJournal}
              className="py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white transition shadow-sm"
            >
              إضافة لدفتر الصفقات
            </button>
          )}
        </div>
      </div>

      {/* 4. Multi-Timeframe Matrix Table */}
      <div className="bg-[#121824] border border-slate-800 rounded-2xl p-4 shadow-lg">
        <h4 className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-sky-400" />
          جدول التحليل متعدد الفريمات (Multi-Timeframe Matrix)
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 pb-2">
                <th className="py-2 px-2 font-medium">الفريم</th>
                <th className="py-2 px-2 font-medium">الاتجاه</th>
                <th className="py-2 px-2 font-medium">الإشارة</th>
                <th className="py-2 px-2 font-medium">القوة</th>
                <th className="py-2 px-2 font-medium">الاتجاه العام</th>
                <th className="py-2 px-2 font-medium font-num text-left">RSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {displayTfs.map((tf) => {
                const item = timeframeResults[tf];
                if (!item) return null;
                const isBull = item.direction === 'صاعد';
                const isBear = item.direction === 'هابط';

                // Macro role & alignment logic
                const isMacro = tf === '1d' || tf === '3d' || tf === '1w';
                const isEntry = tf === '15m' || tf === '1h';
                const macroRole = isMacro
                  ? isBull === (analysis.overallDirection === 'BULLISH')
                    ? 'متوافق مع الترند العام'
                    : 'معاكس للترند الأكبر'
                  : isEntry
                  ? 'فريم نقطة الدخول'
                  : 'فريم تأكيد الزخم (4h)';

                return (
                  <tr key={tf} className="hover:bg-slate-800/30 transition">
                    <td className="py-2.5 px-2 font-bold font-num text-white">{tf}</td>
                    <td className="py-2.5 px-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] ${
                          isBull
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : isBear
                            ? 'bg-red-500/15 text-red-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {isBull ? '▲' : isBear ? '▼' : '—'} {item.direction}
                      </span>
                    </td>
                    <td className="py-2.5 px-2">
                      <span
                        className={`font-semibold ${
                          item.signal === 'شراء'
                            ? 'text-emerald-400'
                            : item.signal === 'بيع'
                            ? 'text-red-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {item.signal}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-slate-300">{item.strength}</td>
                    <td className="py-2.5 px-2">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-md font-semibold ${
                          isMacro
                            ? isBull === (analysis.overallDirection === 'BULLISH')
                              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                            : 'text-slate-400'
                        }`}
                      >
                        {macroRole}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 font-num text-left text-slate-400">
                      {item.rsi}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Scenarios & Momentum Breakdown */}
      <div className="bg-[#121824] border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
        <h4 className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          السيناريوهات الفنية وحالة السوق
        </h4>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-slate-400 block text-[11px]">الزخم الحالي</span>
            <span className="font-semibold text-white">{momentumStatus}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-slate-400 block text-[11px]">حالة التقلب</span>
            <span className="font-semibold text-white">{volatilityStatus}</span>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-200">
            <span className="font-bold text-emerald-400 block mb-0.5">السيناريو الصعودي:</span>
            {bullishScenario}
          </div>
          <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200">
            <span className="font-bold text-red-400 block mb-0.5">السيناريو الهبوطي:</span>
            {bearishScenario}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/50 border border-slate-800 text-[11px] text-slate-400">
          <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
          <span>تنبيه: هذا تحليل تعليمي واستسترشادي مبني على خوارزميات فنية، وليس نصيحة مالية أو دعوة للاستثمار.</span>
        </div>
      </div>
    </div>
  );
};
