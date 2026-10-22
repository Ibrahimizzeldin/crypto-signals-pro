import React from 'react';
import { useCryptoStore } from '../../store/useCryptoStore';
import { StrategyId } from '../../types/crypto';
import { STRATEGY_CONFIGS } from '../../services/paperTradingEngine';
import { TrendingUp, TrendingDown, Zap, Activity } from 'lucide-react';

interface TriplePortfolioTopBarProps {
  onNavigateToPortfolio?: (id: StrategyId) => void;
  className?: string;
}

export const TriplePortfolioTopBar: React.FC<TriplePortfolioTopBarProps> = ({
  onNavigateToPortfolio,
  className = '',
}) => {
  const {
    portfolios,
    wsConnected,
    setActivePortfolioId,
    setActiveTab,
    setDetailModalOpen,
  } = useCryptoStore();

  const handleCardClick = (strategyId: StrategyId) => {
    setActivePortfolioId(strategyId);
    setActiveTab('active');
    setDetailModalOpen(false);
    if (onNavigateToPortfolio) {
      onNavigateToPortfolio(strategyId);
    }
  };

  const pTrend = portfolios.STRATEGY_TREND;
  const pRev = portfolios.STRATEGY_REVERSION;
  const pScalp = portfolios.STRATEGY_SCALP;

  const cardConfigs: Array<{
    id: StrategyId;
    label: string;
    sublabel: string;
    leverage: number;
    badgeColor: string;
    glowColor: string;
    portfolio: typeof pTrend;
  }> = [
    {
      id: 'STRATEGY_TREND',
      label: 'Trend',
      sublabel: 'تتبع الترند',
      leverage: 25,
      badgeColor: 'border-indigo-500/40 text-indigo-400 bg-indigo-500/10',
      glowColor: 'hover:border-indigo-500/50 hover:shadow-indigo-950/20',
      portfolio: pTrend,
    },
    {
      id: 'STRATEGY_REVERSION',
      label: 'Reversion',
      sublabel: 'الارتداد',
      leverage: 25,
      badgeColor: 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10',
      glowColor: 'hover:border-cyan-500/50 hover:shadow-cyan-950/20',
      portfolio: pRev,
    },
    {
      id: 'STRATEGY_SCALP',
      label: 'Scalp',
      sublabel: 'المضاربة (5m)',
      leverage: 25,
      badgeColor: 'border-amber-500/40 text-amber-400 bg-amber-500/10',
      glowColor: 'hover:border-amber-500/50 hover:shadow-amber-950/20',
      portfolio: pScalp,
    },
  ];

  // Calculate stats for each portfolio
  const cardsData = cardConfigs.map((cfg) => {
    const p = cfg.portfolio;
    const initialBal = p?.account?.initialBalance ?? 1000;
    const trades = p?.trades || [];
    const openTrades = trades.filter((t) => t.status === 'OPEN');
    const closedTrades = trades.filter((t) => t.status === 'CLOSED');

    const realizedPnl = closedTrades.reduce(
      (acc, t) => acc + (t.closeReason === 'LIQUIDATED' ? -t.margin : (t.netPnl || 0)),
      0
    );
    const floatingPnl = openTrades.reduce((acc, t) => acc + (t.netPnl || 0), 0);
    const equity = Math.max(0, Number((initialBal + realizedPnl + floatingPnl).toFixed(2)));

    // Margin used ($10 per trade in A, $20 in B, $40 in C)
    const usedMargin = openTrades.reduce((acc, t) => acc + (t.margin || 0), 0);
    const currentBalance = p?.account?.balance ?? 1000;
    const availableBal = Math.max(0, Number((currentBalance - usedMargin).toFixed(1)));
    const usagePercent = currentBalance > 0 ? Number(((usedMargin / currentBalance) * 100).toFixed(0)) : 0;

    const changePercent = ((equity - initialBal) / initialBal) * 100;
    const isPositive = equity >= initialBal;

    return {
      ...cfg,
      initialBal,
      currentBalance,
      availableBal,
      realizedPnl,
      floatingPnl,
      equity,
      usedMargin,
      usagePercent,
      changePercent,
      isPositive,
      openTradesCount: openTrades.length,
    };
  });

  // Aggregates across all 3 portfolios
  const totalEquity = cardsData.reduce((acc, c) => acc + c.equity, 0);
  const totalFloatingPnl = cardsData.reduce((acc, c) => acc + c.floatingPnl, 0);
  const totalOpenTradesCount = cardsData.reduce((acc, c) => acc + c.openTradesCount, 0);

  return (
    <div
      className={`w-full bg-[#0a0e17]/95 backdrop-blur-md border-b border-slate-800/80 p-2.5 transition-all shadow-md ${className}`}
    >
      {/* 3 Parallel Portfolio Mini-Cards (Full Cross Margin Realtime) */}
      <div className="grid grid-cols-3 gap-2">
        {cardsData.map((card) => {
          return (
            <button
              key={card.id}
              onClick={() => handleCardClick(card.id)}
              className={`flex flex-col items-center justify-between p-2 rounded-xl bg-slate-900/90 border border-slate-800/90 ${card.glowColor} hover:bg-slate-800/90 transition-all text-center group cursor-pointer shadow-sm relative overflow-hidden`}
              title={`عرض تفاصيل ${STRATEGY_CONFIGS[card.id].name} (25x Leverage)`}
            >
              {/* Header Badge */}
              <div className="flex items-center justify-between w-full mb-1">
                <span
                  className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border font-num ${card.badgeColor}`}
                >
                  [{card.label}]
                </span>
                <span className="text-[9px] text-slate-400 font-num font-medium">25x</span>
              </div>

              {/* Equity الحالي (Big number in Red/Green) */}
              <div className="my-0.5 text-center w-full">
                <div className="text-[9px] text-slate-400">Equity الحالي:</div>
                <div
                  className={`text-sm md:text-base font-black font-num tracking-tight transition-colors ${
                    card.equity >= card.initialBal ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  ${card.equity.toFixed(2)}
                </div>
                <div
                  className={`flex items-center justify-center gap-0.5 text-[9px] font-extrabold font-num ${
                    card.isPositive ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {card.isPositive ? (
                    <TrendingUp className="w-2.5 h-2.5 shrink-0" />
                  ) : (
                    <TrendingDown className="w-2.5 h-2.5 shrink-0" />
                  )}
                  <span>
                    {card.isPositive ? '+' : ''}
                    {card.changePercent.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Breakdown Details Grid (الرصيد الأولي، محقق، عائم، هامش مستخدم) */}
              <div className="mt-1 pt-1 border-t border-slate-800/70 w-full space-y-0.5 text-[9px] font-num text-slate-400">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">الرصيد الحر:</span>
                  <span className="text-emerald-400 font-bold">${card.availableBal}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">الهامش المستخدم:</span>
                  <span className="text-sky-400 font-bold">${card.usedMargin}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">التعرض الكلي:</span>
                  <span className="text-amber-400 font-bold">${card.openTradesCount * 250}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">عائم:</span>
                  <span
                    className={`font-black ${
                      card.floatingPnl > 0
                        ? 'text-emerald-400'
                        : card.floatingPnl < 0
                        ? 'text-rose-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {card.floatingPnl >= 0 ? '+' : ''}${card.floatingPnl.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-0.5 border-t border-slate-800/40">
                  <span className="text-slate-500">الصفقات:</span>
                  {(() => {
                    const portMax = STRATEGY_CONFIGS[card.id].maxConcurrentTrades;
                    return (
                      <span
                        className={`font-black text-[9px] ${
                          card.openTradesCount >= portMax
                            ? 'text-amber-400 font-extrabold'
                            : 'text-slate-200'
                        }`}
                      >
                        الحد ({card.openTradesCount}/{portMax})
                      </span>
                    );
                  })()}
                </div>
                {/* Warning if Equity < 50% */}
                {card.equity < card.initialBal * 0.5 && (
                  <div className="text-[8px] font-black text-rose-400 bg-rose-500/15 border border-rose-500/30 rounded px-1 py-0.5 animate-pulse mt-0.5">
                    ⚠️ انخفاض السيولة عن 50%
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Aggregate Balance (Equity) & Live Status Row */}
      <div className="mt-2 pt-2 border-t border-slate-800/70 flex flex-wrap items-center justify-between text-xs px-1 text-slate-300 font-num">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-[11px]">الرصيد المجمّع (Equity):</span>
          <span
            className={`font-black text-sm ${
              totalEquity >= 3000 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            ${totalEquity.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-500 font-normal">
            (من أصل $3,000)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {totalOpenTradesCount > 0 ? (
            <div className="flex items-center gap-1.5 bg-sky-500/10 px-2 py-0.5 rounded-lg border border-sky-500/20 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
              <span className="font-bold text-slate-200">
                {totalOpenTradesCount} صفقات مفتوحة
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">عائم:</span>
              <span
                className={`font-extrabold ${
                  totalFloatingPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {totalFloatingPnl >= 0 ? '+' : ''}${totalFloatingPnl.toFixed(2)}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-600 inline-block" />
              <span>لا توجد صفقات مفتوحة</span>
            </div>
          )}

          {/* Live WebSocket Indicator Badge */}
          <div
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${
              wsConnected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span>{wsConnected ? 'بث حي (Live)' : 'إعادة اتصال'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
