import React, { useState, useMemo } from 'react';
import { useCryptoStore } from '../../store/useCryptoStore';
import { PortfolioId, PaperTrade } from '../../types/crypto';
import { PORTFOLIO_CONFIGS } from '../../services/paperTradingEngine';
import { CoinIcon } from '../common/CoinIcon';
import { getPatternEmoji } from '../../utils/cryptoLogos';
import {
  BookOpen,
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  ShieldAlert,
  Target,
  XCircle,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import { formatPrice } from '../../utils/formatters';

interface JournalViewProps {
  onOpenRiskCalc?: () => void;
}

export const JournalView: React.FC<JournalViewProps> = () => {
  const {
    portfolios,
    tickers,
    wsConnected,
    closePaperTradeManually,
  } = useCryptoStore();

  const [selectedPortfolio, setSelectedPortfolio] = useState<PortfolioId | 'ALL'>('ALL');
  const [closingTradeId, setClosingTradeId] = useState<string | null>(null);

  // Extract all open paper trades across portfolios
  const allOpenTrades = useMemo(() => {
    const tradesWithLivePrice: (PaperTrade & { livePrice: number; portfolioLabel: string; badgeColor: string })[] = [];

    const pids: PortfolioId[] = ['PORTFOLIO_A', 'PORTFOLIO_B', 'PORTFOLIO_C'];

    pids.forEach((pid) => {
      const p = portfolios[pid];
      if (!p) return;
      const cfg = PORTFOLIO_CONFIGS[pid];

      p.trades.forEach((trade) => {
        if (trade.status === 'OPEN') {
          const ticker = tickers[trade.symbol];
          const livePrice = ticker ? ticker.lastPrice : trade.currentPrice;

          tradesWithLivePrice.push({
            ...trade,
            livePrice,
            portfolioLabel: cfg.shortName,
            badgeColor: cfg.badgeColor,
          });
        }
      });
    });

    return tradesWithLivePrice;
  }, [portfolios, tickers]);

  // Filter based on active tab
  const filteredTrades = useMemo(() => {
    if (selectedPortfolio === 'ALL') return allOpenTrades;
    return allOpenTrades.filter((t) => t.portfolioId === selectedPortfolio);
  }, [allOpenTrades, selectedPortfolio]);

  // Aggregate stats
  const totalOpen = allOpenTrades.length;
  const totalFloatingPnl = Number(
    allOpenTrades.reduce((acc, t) => acc + (t.netPnl || 0), 0).toFixed(2)
  );
  const totalMarginUsed = Number(
    allOpenTrades.reduce((acc, t) => acc + t.margin, 0).toFixed(2)
  );

  const handleCloseTrade = (tradeId: string, currentPrice: number) => {
    setClosingTradeId(tradeId);
    setTimeout(() => {
      closePaperTradeManually(tradeId, currentPrice);
      setClosingTradeId(null);
    }, 150);
  };

  return (
    <div className="flex flex-col gap-4 p-4 pb-24 max-w-6xl mx-auto w-full text-right" dir="rtl">
      {/* Top Header Card */}
      <div className="bg-[#121824] border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white">دفتر الصفقات الحية المفتوحة (Active Journal)</h2>
                {/* Live pulsing dot indicator */}
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                  <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 -mr-2.5" />
                  <span>Live 500ms</span>
                </span>
              </div>
              <p className="text-xs text-slate-400">
                متابعة وإدارة الصفقات المفتوحة آلياً عبر المحافظ الثلاث مع تحديث فوري للأرباح والخسائر
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-center font-num">
              <span className="text-[10px] text-slate-400 block">الصفقات المفتوحة</span>
              <span className="text-sm font-black text-sky-400">{totalOpen}</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-center font-num">
              <span className="text-[10px] text-slate-400 block">الهامش المحجوز</span>
              <span className="text-sm font-black text-amber-400">${totalMarginUsed}</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-center font-num">
              <span className="text-[10px] text-slate-400 block">PnL عائم إجمالي</span>
              <span
                className={`text-sm font-black ${
                  totalFloatingPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {totalFloatingPnl >= 0 ? `+${totalFloatingPnl}` : totalFloatingPnl} USDT
              </span>
            </div>
          </div>
        </div>

        {/* Portfolio Filter Pills */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
          <span className="text-xs text-slate-400 font-bold ml-1">تصفية حسب المحفظة:</span>
          {(['ALL', 'PORTFOLIO_A', 'PORTFOLIO_B', 'PORTFOLIO_C'] as const).map((pid) => {
            const isSelected = selectedPortfolio === pid;
            const label =
              pid === 'ALL'
                ? `جميع المحافظ (${totalOpen})`
                : `${PORTFOLIO_CONFIGS[pid].shortName} (${
                    allOpenTrades.filter((t) => t.portfolioId === pid).length
                  })`;

            return (
              <button
                key={pid}
                onClick={() => setSelectedPortfolio(pid)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                  isSelected
                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                    : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      {filteredTrades.length === 0 ? (
        <div className="bg-[#121824] border border-slate-800 rounded-2xl p-12 text-center shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-400 mx-auto mb-4">
            <Activity className="w-8 h-8 text-sky-400/60 animate-pulse" />
          </div>
          <h3 className="text-base font-black text-white mb-2">لا توجد صفقات مفتوحة حالياً</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            محرك التداول الآلي يعمل في الخلفية ويبحث عن إشارات عالية الدقة (Score ≥ 70) لفتح صفقات فورية ومتزامنة في المحافظ الثلاث.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredTrades.map((trade) => {
            const isLong = trade.side === 'LONG';
            const isProfit = (trade.netPnl || 0) >= 0;
            const progressMin = Math.min(trade.actualEntryPrice, trade.stopLoss);
            const progressMax = Math.max(trade.tp1, trade.actualEntryPrice);
            const progressRange = progressMax - progressMin || 1;
            const currentOffset = Math.max(0, Math.min(progressRange, trade.livePrice - progressMin));
            const progressPercent = Math.min(100, Math.max(0, (currentOffset / progressRange) * 100));

            // SL distance % vs Liquidation distance % (Requirement 2)
            const slDistancePct = Number(
              Math.abs(((trade.actualEntryPrice - trade.stopLoss) / trade.actualEntryPrice) * 100).toFixed(2)
            );
            const liqDistancePct = trade.liquidationDistancePercent || Number((100 / trade.leverage).toFixed(2));
            const isLiquidationBeforeSL = slDistancePct > liqDistancePct;

            return (
              <div
                key={trade.id}
                className="bg-[#121824] border border-slate-800 hover:border-slate-700 rounded-2xl p-4 shadow-xl transition-all space-y-3"
              >
                {/* Top Row: Coin Logo, Symbol, Portfolio, Leverage, Side, Close Button */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <CoinIcon symbol={trade.symbol} size="sm" />
                    <span className="text-sm font-black text-white font-num">{trade.symbol}</span>

                    {/* Portfolio & Leverage Badge */}
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-black border ${
                        trade.badgeColor === 'rose'
                          ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                          : trade.badgeColor === 'amber'
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                          : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      }`}
                    >
                      {trade.portfolioLabel} • {trade.leverage}x
                    </span>

                    {/* Side Badge */}
                    <span
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-black ${
                        isLong
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {isLong ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      <span>{isLong ? 'شراء LONG' : 'بيع SHORT'}</span>
                    </span>

                    {/* Pattern Badge with Emoji */}
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold">
                      <span>{getPatternEmoji(trade.pattern)}</span>
                      <span>{trade.patternNameArabic || trade.pattern}</span>
                    </span>
                  </div>

                  {/* Manual Close Button */}
                  <button
                    onClick={() => handleCloseTrade(trade.id, trade.livePrice)}
                    disabled={closingTradeId === trade.id}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 hover:border-rose-600 text-xs font-bold transition disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{closingTradeId === trade.id ? 'جاري الإغلاق...' : 'إغلاق يدوي'}</span>
                  </button>
                </div>

                {/* Liquidation vs SL Distance & Cross Exposure */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between text-xs p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 font-num gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 text-[11px]">سعر تصفية Cross:</span>
                      <span className="font-black text-amber-400">{formatPrice(trade.liquidationPrice)}</span>
                      <span className="text-[10px] text-slate-500 font-sans">({liqDistancePct}%)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 text-[11px]">المسافة حتى SL:</span>
                      <span className={`font-black ${isLiquidationBeforeSL ? 'text-rose-400 font-extrabold' : 'text-slate-300'}`}>
                        {slDistancePct}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 text-[11px]">إجمالي التعرض:</span>
                      <span className="font-black text-sky-400">
                        ${trade.totalExposure || (allOpenTrades.filter((t) => t.portfolioId === trade.portfolioId).length * 1000)}
                      </span>
                    </div>
                  </div>

                  {/* Red Warning Banner if SL is further than liquidation */}
                  {isLiquidationBeforeSL && (
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold animate-pulse">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>⚠️ التصفية ستحدث قبل SL بسبب ارتفاع التعرض الإجمالي والرافعة ({trade.leverage}x)</span>
                    </div>
                  )}
                </div>

                {/* Details Grid: Position Size, Margin Used, Free Balance, Entry, Live, SL, TP1, Liq, PnL */}
                {(() => {
                  const port = trade.portfolioId ? portfolios[trade.portfolioId] : null;
                  const portOpen = port ? port.trades.filter((t) => t.status === 'OPEN') : [];
                  const portMarginUsed = portOpen.reduce((sum, t) => sum + (t.margin || 0), 0);
                  const freeBalance = port ? Math.max(0, port.account.balance - portMarginUsed) : 0;
                  const totalExp = portOpen.length * 1000;

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 bg-slate-900/80 p-3 rounded-xl border border-slate-800/80 text-xs font-num mb-2">
                      <div className="p-1.5 rounded-lg bg-slate-950/40 border border-slate-800/60">
                        <span className="text-[10px] text-slate-400 block font-sans">حجم الصفقة الثابت</span>
                        <span className="font-black text-sky-400">${trade.positionSize || 1000}</span>
                      </div>

                      <div className="p-1.5 rounded-lg bg-slate-950/40 border border-slate-800/60">
                        <span className="text-[10px] text-slate-400 block font-sans">الهامش المستخدم</span>
                        <span className="font-black text-amber-400">${trade.margin}</span>
                      </div>

                      <div className="p-1.5 rounded-lg bg-slate-950/40 border border-slate-800/60">
                        <span className="text-[10px] text-slate-400 block font-sans">الرصيد الحر</span>
                        <span className="font-black text-emerald-400">${freeBalance.toFixed(2)}</span>
                      </div>

                      <div className="p-1.5 rounded-lg bg-slate-950/40 border border-slate-800/60">
                        <span className="text-[10px] text-slate-400 block font-sans">إجمالي التعرض</span>
                        <span className="font-black text-purple-400">${totalExp}</span>
                      </div>

                      <div className="p-1.5 rounded-lg bg-slate-950/40 border border-slate-800/60 col-span-2">
                        <span className="text-[10px] text-slate-400 block font-sans">الدخول وأصل الإشارة</span>
                        <div className="font-bold text-white text-[11px] flex items-center justify-between">
                          <span>الإشارة: <strong className="text-slate-300 font-num">{formatPrice(trade.signalPrice || trade.entryPrice)}</strong></span>
                          <span className="text-slate-600">|</span>
                          <span>الفعلي: <strong className="text-emerald-400 font-num">{formatPrice(trade.actualEntryPrice || trade.entryPrice)}</strong></span>
                        </div>
                        {trade.priceDiffPercent !== undefined && trade.priceDiffPercent > 0 && (
                          <span className="text-[9px] text-slate-500 font-num block">فارق السعر: {trade.priceDiffPercent}%</span>
                        )}
                      </div>

                      <div className="p-1.5 rounded-lg bg-slate-950/40 border border-slate-800/60">
                        <span className="text-[10px] text-slate-400 block font-sans">السعر الحالي</span>
                        <span className="font-bold text-sky-300">{formatPrice(trade.livePrice)}</span>
                      </div>

                      <div className="p-1.5 rounded-lg bg-slate-950/40 border border-slate-800/60">
                        <span className="text-[10px] text-slate-400 block font-sans">وقف الخسارة (SL)</span>
                        <span className="font-bold text-rose-400 block">{formatPrice(trade.stopLoss)}</span>
                        <span className="text-[9px] text-amber-400 font-sans block">{trade.slCalculationReason || 'SL: ATR × 1.5'}</span>
                      </div>

                      <div className="p-1.5 rounded-lg bg-slate-950/40 border border-slate-800/60">
                        <span className="text-[10px] text-slate-400 block font-sans">الهدف الأول (TP1)</span>
                        <span className="font-bold text-emerald-400">{formatPrice(trade.tp1)}</span>
                      </div>

                      <div className="p-1.5 rounded-lg bg-slate-950/40 border border-slate-800/60">
                        <span className="text-[10px] text-slate-400 block font-sans">سعر التصفية Cross</span>
                        <span className="font-bold text-amber-400">{formatPrice(trade.liquidationPrice)}</span>
                        <span className="text-[9px] text-slate-500 block">باقي {trade.liquidationDistancePercent}%</span>
                      </div>

                      <div className="p-1.5 rounded-lg bg-slate-950/40 border border-slate-800/60 col-span-2 sm:col-span-1 lg:col-span-3">
                        <span className="text-[10px] text-slate-400 block font-sans">PnL لحظي (متطابق)</span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-black text-sm ${
                              isProfit ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {isProfit ? `+${trade.netPnl}` : trade.netPnl} USDT
                          </span>
                          <span
                            className={`text-[10px] font-bold ${
                              isProfit ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            ({isProfit ? '+' : ''}{trade.pnlPercent}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Live Progress Bar towards Targets */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="text-rose-400">SL: {formatPrice(trade.stopLoss)}</span>
                    <span className="text-slate-300 font-bold">مسار الصفقة نحو TP1</span>
                    <span className="text-emerald-400">TP1: {formatPrice(trade.tp1)}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden relative">
                    <div
                      className={`h-full transition-all duration-500 ${
                        isProfit ? 'bg-gradient-to-r from-emerald-500 to-sky-400' : 'bg-rose-500'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
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
