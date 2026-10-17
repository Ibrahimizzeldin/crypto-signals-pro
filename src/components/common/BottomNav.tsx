import React from 'react';
import { useCryptoStore, NavTab } from '../../store/useCryptoStore';
import {
  TrendingUp,
  ScanLine,
  Activity,
  Sparkles,
  BrainCircuit,
} from 'lucide-react';

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab, signalCache, portfolios } = useCryptoStore();

  // Active open trades count across all 3 portfolios
  let openTradesCount = 0;
  if (portfolios) {
    Object.values(portfolios).forEach((p) => {
      if (p?.trades) {
        openTradesCount += p.trades.filter((t) => t.status === 'OPEN').length;
      }
    });
  }

  // Active recommendations count (confidence >= 70, not ignored)
  const activeRecommendationsCount = Object.values(signalCache).filter(
    (s) => (s.scoreBreakdown?.totalScore ?? s.confidence) >= 70 && s.executionStatus !== 'IGNORE'
  ).length;

  // The 5 canonical navigation tabs in strict requested order
  const navItems: { id: NavTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'home',
      label: 'الرئيسية',
      icon: <TrendingUp className="w-5 h-5" />,
    },
    {
      id: 'scanner',
      label: 'الماسح',
      icon: <ScanLine className="w-5 h-5" />,
    },
    {
      id: 'active',
      label: 'نشطة',
      icon: <Activity className="w-5 h-5" />,
      badge: openTradesCount > 0 ? openTradesCount : undefined,
    },
    {
      id: 'recommendations',
      label: 'التوصيات',
      icon: <Sparkles className="w-5 h-5" />,
      badge: activeRecommendationsCount > 0 ? activeRecommendationsCount : undefined,
    },
    {
      id: 'expert',
      label: 'الخبير',
      icon: <BrainCircuit className="w-5 h-5" />,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-[#0b0e14]/95 backdrop-blur-lg border-t border-slate-800/80 px-2 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive =
            activeTab === item.id ||
            (item.id === 'recommendations' && activeTab === 'alerts') ||
            (item.id === 'active' && activeTab === 'performance') ||
            (item.id === 'expert' && activeTab === 'journal');

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-xl transition duration-200 active:scale-90 ${
                isActive
                  ? 'text-emerald-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200 font-normal'
              }`}
            >
              <div className="relative">
                {item.icon}
                {item.badge !== undefined && (
                  <span className="absolute -top-1 -right-2 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-black text-[9px] font-black flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-0.5">{item.label}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
