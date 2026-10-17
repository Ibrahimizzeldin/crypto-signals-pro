import React, { useState } from 'react';
import { X, AlertTriangle, ShieldCheck, Calculator } from 'lucide-react';

interface RiskCalculatorModalProps {
  initialSymbol?: string;
  initialEntry?: number;
  initialSl?: number;
  onClose: () => void;
}

export const RiskCalculatorModal: React.FC<RiskCalculatorModalProps> = ({
  initialSymbol = 'BTCUSDT',
  initialEntry = 88000,
  initialSl = 86500,
  onClose,
}) => {
  const [capital, setCapital] = useState<number>(1000);
  const [riskPercent, setRiskPercent] = useState<number>(1.5);
  const [entryPrice, setEntryPrice] = useState<number>(initialEntry);
  const [stopLoss, setStopLoss] = useState<number>(initialSl);

  // Calculations
  const riskAmount = (capital * riskPercent) / 100;
  const priceDistance = Math.abs(entryPrice - stopLoss);
  const priceDistancePercent = entryPrice > 0 ? (priceDistance / entryPrice) * 100 : 1;

  // Position size in USD such that loss = riskAmount
  // Loss = posSizeUSD * (priceDistancePercent / 100) = riskAmount
  // => posSizeUSD = riskAmount / (priceDistancePercent / 100)
  const positionSizeUSD =
    priceDistancePercent > 0 ? (riskAmount / (priceDistancePercent / 100)) : 0;
  const coinQuantity = entryPrice > 0 ? positionSizeUSD / entryPrice : 0;

  // Recommended leverage: leverage should not exceed 100 / (priceDistancePercent * 1.5) to avoid liquidation before SL
  const maxSafeLeverage = Math.max(
    1,
    Math.min(50, Math.floor(100 / (priceDistancePercent * 1.3 || 1)))
  );

  const marginRequired = maxSafeLeverage > 0 ? positionSizeUSD / maxSafeLeverage : positionSizeUSD;

  const isRiskHigh = riskPercent > 2.0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-right">
      <div className="w-full max-w-md bg-[#121824] border border-slate-700/80 rounded-2xl p-5 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">حاسبة المخاطر والرافعة (Futures)</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Inputs */}
        <div className="space-y-3 text-xs">
          <div>
            <label className="text-slate-400 block mb-1">رأس المال الكلي (USDT)</label>
            <input
              type="number"
              value={capital}
              onChange={(e) => setCapital(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-num focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-slate-400">نسبة المخاطرة من رأس المال (%)</label>
              <span className={`font-num font-bold ${isRiskHigh ? 'text-red-400' : 'text-emerald-400'}`}>
                {riskPercent}%
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="5.0"
              step="0.25"
              value={riskPercent}
              onChange={(e) => setRiskPercent(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-slate-400 block mb-1">سعر الدخول (Entry)</label>
              <input
                type="number"
                value={entryPrice}
                onChange={(e) => setEntryPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-num focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">وقف الخسارة (Stop Loss)</label>
              <input
                type="number"
                value={stopLoss}
                onChange={(e) => setStopLoss(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-num focus:outline-none focus:border-red-500"
              />
            </div>
          </div>
        </div>

        {/* Warning if risk > 2% */}
        {isRiskHigh && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs leading-relaxed">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">تحذير: المخاطرة تتجاوز 2%!</span>
              توصي قواعد إدارة رأس المال الاحترافية في أسواق Futures بألا تتجاوز نسبة المخاطرة 1% إلى 2% كحد أقصى لحماية المحفظة من التراجعات الحادة.
            </div>
          </div>
        )}

        {/* Results Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
          <div className="flex justify-between items-center text-slate-300">
            <span>قيمة المخاطرة بالدولار (Max Loss):</span>
            <span className="font-num font-bold text-red-400">${riskAmount.toFixed(2)} USDT</span>
          </div>

          <div className="flex justify-between items-center text-slate-300">
            <span>مسافة الوقف (SL Distance):</span>
            <span className="font-num font-bold text-slate-200">{priceDistancePercent.toFixed(2)}%</span>
          </div>

          <div className="flex justify-between items-center text-slate-300 border-t border-slate-800 pt-2">
            <span>حجم المركز الكلي (Position Value):</span>
            <span className="font-num font-bold text-sky-400">${positionSizeUSD.toFixed(2)} USDT</span>
          </div>

          <div className="flex justify-between items-center text-slate-300">
            <span>الكمية من العملة:</span>
            <span className="font-num font-bold text-slate-200">{coinQuantity.toFixed(4)}</span>
          </div>

          <div className="flex justify-between items-center text-slate-300 border-t border-slate-800 pt-2">
            <span>الرافعة المالية المقترحة الآمنة:</span>
            <span className="font-num font-extrabold text-emerald-400">{maxSafeLeverage}x</span>
          </div>

          <div className="flex justify-between items-center text-slate-300">
            <span>الهامش المطلوب (Margin Required):</span>
            <span className="font-num font-bold text-white">${marginRequired.toFixed(2)} USDT</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition"
        >
          إغلاق الحاسبة
        </button>
      </div>
    </div>
  );
};
