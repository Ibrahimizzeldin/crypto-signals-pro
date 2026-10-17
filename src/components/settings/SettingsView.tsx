import React, { useState, useRef } from 'react';
import { useCryptoStore } from '../../store/useCryptoStore';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import {
  Settings,
  Download,
  Upload,
  Trash2,
  Moon,
  DollarSign,
  ShieldAlert,
  Smartphone,
  CheckCircle,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const {
    exportBackup,
    importBackup,
    clearAllUserData,
    watchlist,
    tradeJournal,
    alerts,
    showChartLines,
    setShowChartLines,
    maxConcurrentTradesPerPortfolio,
    setMaxConcurrentTradesPerPortfolio,
  } = useCryptoStore();

  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const jsonStr = exportBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crypto-signals-pro-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setMessage('تم تصدير ملف النسخة الاحتياطية بنجاح!');
    setTimeout(() => setMessage(null), 3000);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = importBackup(content);
      if (success) {
        setMessage('تم استيراد البيانات واستعادتها بنجاح!');
      } else {
        setMessage('خطأ: الملف غير صالح أو تالف.');
      }
      setTimeout(() => setMessage(null), 4000);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const [confirmClear, setConfirmClear] = useState(false);

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearAllUserData();
    setConfirmClear(false);
    setMessage('تم مسح جميع البيانات المحلية وإعادة ضبط المصنع بالكامل.');
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="flex flex-col gap-4 p-4 pb-24 max-w-lg mx-auto w-full text-right">
      {/* Header */}
      <div className="bg-[#121824] border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center gap-2 mb-2">
          <Settings className="w-5 h-5 text-sky-400" />
          <h2 className="text-sm font-black text-white">إعدادات التطبيق (Settings)</h2>
        </div>
        <p className="text-xs text-slate-300">
          إدارة النسخ الاحتياطي، خيارات العرض، وتثبيت التطبيق على الشاشة الرئيسية.
        </p>

        {message && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}
      </div>

      {/* PWA & Display Options */}
      <div className="bg-[#121824] border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
        <h3 className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
          <Smartphone className="w-4 h-4 text-emerald-400" />
          تطبيق الهاتف وتجربة العرض
        </h3>

        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-4 h-4 text-sky-400" />
            <div>
              <span className="text-xs font-bold text-white block">تثبيت PWA المستقل</span>
              <span className="text-[11px] text-slate-400">تشغيل التطبيق بدون متصفح بكامل الشاشة</span>
            </div>
          </div>
          <PWAInstallButton />
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center gap-2.5">
            <Moon className="w-4 h-4 text-indigo-400" />
            <div>
              <span className="text-xs font-bold text-white block">الوضع الليلي (Dark Mode)</span>
              <span className="text-[11px] text-slate-400">مُفعّل دائماً لبيئة تداول احترافية</span>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-400 font-num">نشط</span>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center gap-2.5">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <div>
              <span className="text-xs font-bold text-white block">عملة التسعير والعقود</span>
              <span className="text-[11px] text-slate-400">عقود Binance Futures المقومة بـ USDT</span>
            </div>
          </div>
          <span className="text-xs font-bold text-white font-num">USDT (Perpetual)</span>
        </div>

        {/* Chart Lines Option */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="text-base">📊</span>
            <div>
              <span className="text-xs font-bold text-white block">إظهار الخطوط على الشارت</span>
              <span className="text-[11px] text-slate-400">عرض مستويات SL و TP والدعم والمقاومة فوق الشموع</span>
            </div>
          </div>
          <div className="flex items-center bg-slate-800 rounded-xl p-1 border border-slate-700 font-num">
            <button
              onClick={() => {
                setShowChartLines(true);
                setMessage('تم تفعيل إظهار جميع الخطوط على الشارت.');
                setTimeout(() => setMessage(null), 2500);
              }}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                showChartLines
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              نعم
            </button>
            <button
              onClick={() => {
                setShowChartLines(false);
                setMessage('تم ضبط الشارت على الوضع النظيف (الافتراضي).');
                setTimeout(() => setMessage(null), 2500);
              }}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                !showChartLines
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              لا (نظيف)
            </button>
          </div>
        </div>

        {/* Max Concurrent Trades Setting (Requirement 4) */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <div>
                <span className="text-xs font-black text-white block">
                  الحد الأقصى للصفقات المتزامنة لكل محفظة
                </span>
                <span className="text-[11px] text-slate-400">
                  حماية المحفظة من الإفراط في التداول وتوزيع الهامش (5 إلى 30 صفقة)
                </span>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black font-num">
              {maxConcurrentTradesPerPortfolio || 15} صفقة
            </span>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <span className="text-[10px] text-slate-500 font-num">5</span>
            <input
              type="range"
              min="5"
              max="30"
              step="1"
              value={maxConcurrentTradesPerPortfolio || 15}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setMaxConcurrentTradesPerPortfolio(val);
                setMessage(`تم تعديل الحد الأقصى للصفقات المتزامنة إلى ${val} لكل محفظة.`);
                setTimeout(() => setMessage(null), 2500);
              }}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <span className="text-[10px] text-slate-500 font-num">30</span>
          </div>
        </div>
      </div>

      {/* Data Backup & Restore */}
      <div className="bg-[#121824] border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
        <h3 className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
          <Download className="w-4 h-4 text-sky-400" />
          النسخ الاحتياطي وإدارة البيانات (JSON)
        </h3>

        <div className="text-xs text-slate-400 leading-relaxed">
          جميع البيانات (المفضلة: {watchlist.length}، الصفقات: {tradeJournal.length}، التنبيهات: {alerts.length}) محفوظة محلياً في متصفحك.
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={handleExport}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>تصدير نسخة JSON</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700"
          >
            <Upload className="w-4 h-4" />
            <span>استيراد نسخة</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImport}
            accept=".json"
            className="hidden"
          />
        </div>

        <div className="pt-2 border-t border-slate-800/80">
          <button
            onClick={handleClear}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition border ${
              confirmClear
                ? 'bg-red-600 hover:bg-red-500 text-white border-red-500 shadow-lg shadow-red-950/50'
                : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span>{confirmClear ? 'اضغط مرة أخرى للتأكيد النهائي على مسح كل شيء' : 'مسح جميع البيانات المحلية وإعادة التعيين'}</span>
          </button>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 space-y-1.5 leading-relaxed">
        <div className="flex items-center gap-2 text-amber-400 font-bold">
          <ShieldAlert className="w-4 h-4" />
          <span>إخلاء المسؤولية القانونية</span>
        </div>
        <p>
          تطبيق Crypto Signals Pro يقدم أدوات وخوارزميات تحليلية فنية استرشادية فقط. تداول عقود العملات الرقمية الآجلة (Futures) ينطوي على مخاطر مالية عالية بسبب الرافعة المالية. أنت المسؤول الوحيد عن قراراتك الاستثمارية وإدارة مخاطرك.
        </p>
      </div>
    </div>
  );
};
