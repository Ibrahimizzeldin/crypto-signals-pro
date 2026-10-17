import React, { useState } from 'react';
import { Download, Share2, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Hide if already running in standalone PWA mode
  if (isInstalled) {
    return null;
  }

  // Android / Chromium / Desktop Install
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 transition active:scale-95"
      >
        <Download className="w-3.5 h-3.5 animate-bounce" />
        <span>تثبيت التطبيق</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/40 hover:bg-sky-500/30 transition active:scale-95"
        >
          <Download className="w-3.5 h-3.5" />
          <span>تثبيت على الآيفون</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-[#121824] border border-slate-700/80 p-5 shadow-2xl text-right">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Download className="w-5 h-5 text-emerald-400" />
                  تثبيت على شاشة الآيفون
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-sm text-slate-300">
                <div className="flex items-start gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                  <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 mt-0.5">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">الخطوة 1: اضغط زر المشاركة</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      اضغط على أيقونة المشاركة (Share) في شريط متصفح Safari بالأسفل.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 mt-0.5">
                    <PlusSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">الخطوة 2: إضافة إلى الشاشة الرئيسية</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      مرر للأسفل واختر &quot;إضافة إلى الشاشة الرئيسية&quot; (Add to Home Screen).
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-white transition"
              >
                فهمت ذلك
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback direct button for other browsers
  return (
    <button
      onClick={() => alert('لتثبيت التطبيق على الشاشة الرئيسية، اختر "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية" من قائمة المتصفح.')}
      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition"
    >
      <Download className="w-3.5 h-3.5" />
      <span>تثبيت PWA</span>
    </button>
  );
};
