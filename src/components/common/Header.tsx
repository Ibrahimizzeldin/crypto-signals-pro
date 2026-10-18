import React from 'react';
import { useCryptoStore } from '../../store/useCryptoStore';
import { Activity, Volume2, VolumeX, Wifi, WifiOff } from 'lucide-react';

export const Header: React.FC = () => {
  const { wsConnected, fearAndGreed, soundEnabled, setSoundEnabled } = useCryptoStore();

  const getFngColor = (val: number) => {
    if (val >= 60) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (val <= 40) return 'text-red-400 bg-red-500/10 border-red-500/20';
    return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  };

  return (
    <header className="sticky top-0 z-30 bg-[#0b0e14]/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-2.5">
      <div className="flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-600 to-emerald-500 p-0.5 shadow-md shadow-sky-950/40">
            <div className="w-full h-full bg-[#0b0e14] rounded-[10px] flex items-center justify-center">
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            {/* Live pulsing dot */}
            <span
              className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-[#0b0e14] ${
                wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-black text-white tracking-wide">
                Crypto Signals <span className="text-emerald-400">Pro</span>
              </h1>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span className="flex items-center gap-1.5">
                {wsConnected ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span className="text-emerald-400 font-bold">Live (بث مباشر 500ms)</span>
                  </>
                ) : (
                  <>
                    <span className="inline-flex rounded-full h-2 w-2 bg-slate-500" />
                    <span className="text-slate-400 font-medium">غير متصل</span>
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Right Action Widgets */}
        <div className="flex items-center gap-2">
          {/* Fear and Greed Pill */}
          {fearAndGreed && (
            <div
              className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-bold ${getFngColor(
                fearAndGreed.value
              )}`}
              title="مؤشر الخوف والطمع"
            >
              <span>F&G:</span>
              <span className="font-num">{fearAndGreed.value}</span>
              <span className="text-[10px] font-normal">({fearAndGreed.classification})</span>
            </div>
          )}

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-1.5 rounded-lg border transition ${
              soundEnabled
                ? 'bg-slate-800/80 border-slate-700 text-sky-400'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
            title={soundEnabled ? 'كتم التنبيهات الصوتية' : 'تفعيل التنبيهات الصوتية'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </header>
  );
};
