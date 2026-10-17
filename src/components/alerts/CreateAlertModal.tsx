import React, { useState } from 'react';
import { useCryptoStore } from '../../store/useCryptoStore';
import { X, Bell, TrendingUp, TrendingDown } from 'lucide-react';
import { formatPrice, getPricePrecision } from '../../utils/formatters';

interface CreateAlertModalProps {
  initialSymbol?: string;
  initialPrice?: number;
  onClose: () => void;
}

export const CreateAlertModal: React.FC<CreateAlertModalProps> = ({
  initialSymbol = 'BTCUSDT',
  initialPrice = 88000,
  onClose,
}) => {
  const { addAlert, setNotificationPermission } = useCryptoStore();
  const [symbol, setSymbol] = useState(initialSymbol);
  const [condition, setCondition] = useState<'ABOVE' | 'BELOW'>('ABOVE');
  const prec = getPricePrecision(initialPrice);
  const [targetPrice, setTargetPrice] = useState<number>(
    condition === 'ABOVE' ? Number((initialPrice * 1.02).toFixed(prec)) : Number((initialPrice * 0.98).toFixed(prec))
  );
  const [note, setNote] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPrice || targetPrice <= 0) return;

    // Request notification permission if not yet decided
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((perm) => {
        setNotificationPermission(perm === 'granted');
      });
    }

    addAlert({
      symbol,
      condition,
      targetPrice,
      createdPrice: initialPrice,
      note: note || (condition === 'ABOVE' ? `اختراق السعر لمستوى ${targetPrice}` : `كسر السعر لمستوى ${targetPrice}`),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-right">
      <div className="w-full max-w-sm bg-[#121824] border border-slate-700/80 rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">إضافة تنبيه سعري لحظي</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="text-slate-400 block mb-1">الرمز (Symbol)</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-num font-bold uppercase focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">شرط التنبيه</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setCondition('ABOVE');
                  setTargetPrice(Number((initialPrice * 1.02).toFixed(prec)));
                }}
                className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 font-bold transition ${
                  condition === 'ABOVE'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                تجاوز للأعلى (≥)
              </button>
              <button
                type="button"
                onClick={() => {
                  setCondition('BELOW');
                  setTargetPrice(Number((initialPrice * 0.98).toFixed(prec)));
                }}
                className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 font-bold transition ${
                  condition === 'BELOW'
                    ? 'bg-red-500/20 border-red-500 text-red-400'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                <TrendingDown className="w-4 h-4" />
                كسر للأسفل (≤)
              </button>
            </div>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">السعر المستهدف (Target Price USDT)</label>
            <input
              type="number"
              step="any"
              value={targetPrice}
              onChange={(e) => setTargetPrice(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-num font-bold text-sm focus:outline-none focus:border-sky-500"
              required
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              السعر الحالي: ${formatPrice(initialPrice)}
            </span>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">ملاحظة (اختياري)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="مثال: اختراق قمة الأسبوع"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white transition mt-2 shadow-lg shadow-sky-950/40"
          >
            تفعيل التنبيه
          </button>
        </form>
      </div>
    </div>
  );
};
