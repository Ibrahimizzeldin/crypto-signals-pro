import React, { useEffect, useState } from 'react';
import { useCryptoStore } from '../../store/useCryptoStore';
import { fetchCryptoNews } from '../../services/sentimentApi';
import { MarketNewsItem } from '../../types/crypto';
import {
  Newspaper,
  X,
  ExternalLink,
  Clock,
  AlertTriangle,
  Compass,
  TrendingUp,
  TrendingDown,
  RefreshCw,
} from 'lucide-react';

interface MarketNewsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MarketNewsModal: React.FC<MarketNewsModalProps> = ({ isOpen, onClose }) => {
  const { isNewsPaused, newsPausedHeadline, newsPausedUntil, fearAndGreed, marketRegime } = useCryptoStore();
  const [news, setNews] = useState<MarketNewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadNews = async () => {
    setIsLoading(true);
    try {
      const items = await fetchCryptoNews();
      setNews(items);
    } catch (e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadNews();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const minutesRemaining = newsPausedUntil && newsPausedUntil > Date.now()
    ? Math.ceil((newsPausedUntil - Date.now()) / 60000)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" dir="rtl">
      <div className="bg-[#121824] border border-slate-800 rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-[#0d121c]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Newspaper className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-black text-white">
                أخبار السوق والعملات المشفرة
              </h2>
              <span className="text-[10px] text-slate-400">
                متابعة التأثيرات الاقتصادية وأخبار أسواق المشتقات
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadNews}
              disabled={isLoading}
              className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition disabled:opacity-50"
              title="تحديث الأخبار"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content body */}
        <div className="p-4 overflow-y-auto space-y-3.5 flex-1 text-right">
          {/* News Pause Warning banner if active */}
          {isNewsPaused && (
            <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-500/50 text-amber-200 text-xs shadow-md">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold flex items-center gap-1.5 text-amber-300">
                  <AlertTriangle className="w-4 h-4" />
                  <span>توقف مؤقت للإشارات الآلية بسبب خبر مهم!</span>
                </span>
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-num text-[10px] font-bold">
                  متبقي {minutesRemaining} دقيقة (حد أقصى 15 دقيقة)
                </span>
              </div>
              <p className="text-[11px] text-amber-200/90 leading-relaxed font-sans">
                {newsPausedHeadline || 'صدور بيانات أو أخبار عالية التأثير في السوق. سيعود النظام للعمل تلقائياً فور انتهاء الـ 15 دقيقة.'}
              </p>
            </div>
          )}

          {/* Quick Stats: Fear & Greed + Market Regime */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {fearAndGreed && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5">
                <span className="text-[10px] text-slate-400 block mb-0.5">مؤشر الخوف والطمع</span>
                <div className="flex items-baseline gap-1 font-num">
                  <span className="text-sm font-black text-amber-400">{fearAndGreed.value}/100</span>
                  <span className="text-[10px] text-slate-300 font-sans">({fearAndGreed.classification})</span>
                </div>
              </div>
            )}

            {marketRegime && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5">
                <span className="text-[10px] text-slate-400 block mb-0.5">حالة السوق (BTC 1h)</span>
                <span className="text-xs font-bold text-sky-300 block">
                  {marketRegime.titleArabic}
                </span>
              </div>
            )}
          </div>

          {/* News List */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-slate-300">آخر المستجدات والأخبار المباشرة</h3>

            {isLoading && news.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-sky-400" />
                <span>جارٍ جلب أحدث الأخبار...</span>
              </div>
            ) : (
              news.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-900/70 border border-slate-800 hover:border-slate-700 rounded-xl p-3 transition space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-num">
                    <span className="text-slate-500">{item.source}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{item.publishedAt}</span>
                    </span>
                  </div>

                  <p className="text-xs font-bold text-slate-100 leading-snug">
                    {item.title}
                  </p>

                  <div className="flex items-center justify-between pt-1 text-[10px]">
                    <span
                      className={`px-2 py-0.5 rounded font-bold ${
                        item.sentiment === 'POSITIVE'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : item.sentiment === 'NEGATIVE'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {item.sentiment === 'POSITIVE'
                        ? '🟢 تأثير إيجابي'
                        : item.sentiment === 'NEGATIVE'
                        ? '🔴 تأثير سلبي'
                        : '⚪ محايد'}
                    </span>

                    {item.url && item.url !== '#' && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-400 hover:underline flex items-center gap-1"
                      >
                        <span>المصدر</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
