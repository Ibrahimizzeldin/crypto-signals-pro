import React, { useState } from 'react';
import { useCryptoStore } from '../../store/useCryptoStore';
import {
  Bell,
  Plus,
  Trash2,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { arSA } from 'date-fns/locale';
import { formatPrice } from '../../utils/formatters';

interface AlertsViewProps {
  onOpenCreateAlert: () => void;
}

export const AlertsView: React.FC<AlertsViewProps> = ({ onOpenCreateAlert }) => {
  const { alerts, deleteAlert, tickers } = useCryptoStore();
  const [filter, setFilter] = useState<'ACTIVE' | 'TRIGGERED'>('ACTIVE');

  const filteredAlerts = alerts.filter((a) => (filter === 'ACTIVE' ? !a.triggered : a.triggered));

  return (
    <div className="flex flex-col gap-4 p-4 pb-24 max-w-lg mx-auto w-full text-right">
      {/* Header Card */}
      <div className="bg-[#121824] border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-black text-white">
              التنبيهات السعرية الذكية (Price Alerts)
            </h2>
          </div>
          <button
            onClick={onOpenCreateAlert}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition shadow-md shadow-sky-950/40"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة تنبيه</span>
          </button>
        </div>
        <p className="text-xs text-slate-300">
          تتبع لحظي للأسعار عبر WebSocket مع إشعارات فورية عند اختراق المستهدفات أو كسر مناطق الوقف.
        </p>

        {/* Tab Switcher */}
        <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 mt-3">
          <button
            onClick={() => setFilter('ACTIVE')}
            className={`flex-1 py-1.5 text-xs rounded-lg font-bold transition ${
              filter === 'ACTIVE'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            النشطة ({alerts.filter((a) => !a.triggered).length})
          </button>
          <button
            onClick={() => setFilter('TRIGGERED')}
            className={`flex-1 py-1.5 text-xs rounded-lg font-bold transition ${
              filter === 'TRIGGERED'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            المنفذة ({alerts.filter((a) => a.triggered).length})
          </button>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-2">
        {filteredAlerts.map((alert) => {
          const t = tickers[alert.symbol];
          const curPrice = t?.lastPrice || alert.createdPrice;
          const isAbove = alert.condition === 'ABOVE';

          return (
            <div
              key={alert.id}
              className={`p-3.5 rounded-2xl bg-[#121824] border transition shadow-md flex items-center justify-between ${
                alert.triggered
                  ? 'border-emerald-500/30 bg-emerald-950/10'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-xl ${
                    alert.triggered
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : isAbove
                      ? 'bg-sky-500/10 text-sky-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}
                >
                  {alert.triggered ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : isAbove ? (
                    <TrendingUp className="w-5 h-5" />
                  ) : (
                    <TrendingDown className="w-5 h-5" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-white text-sm font-num">
                      {alert.symbol}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        isAbove
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-red-500/15 text-red-400'
                      }`}
                    >
                      {isAbove ? 'تجاوز للأعلى ≥' : 'كسر للأسفل ≤'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-num text-slate-300 mt-0.5">
                    <span className="font-bold text-white">${formatPrice(alert.targetPrice)}</span>
                    <span className="text-[11px] text-slate-500">
                      (الحالي: ${formatPrice(curPrice)})
                    </span>
                  </div>

                  {alert.note && (
                    <p className="text-[11px] text-slate-400 mt-0.5">{alert.note}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => deleteAlert(alert.id)}
                  className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
                  title="حذف التنبيه"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {filteredAlerts.length === 0 && (
          <div className="text-center py-16 text-slate-500 text-xs">
            {filter === 'ACTIVE'
              ? 'لا توجد تنبيهات نشطة حالياً. اضغط على "إضافة تنبيه" لإضافة مراقبة سعرية.'
              : 'سجل التنبيهات المنفذة فارغ.'}
          </div>
        )}
      </div>
    </div>
  );
};
