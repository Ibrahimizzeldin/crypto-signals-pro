import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useCryptoStore } from '../../store/useCryptoStore';
import { Candle, Timeframe, MultiTimeframeAnalysis } from '../../types/crypto';
import { fetchKlines, fetchOpenInterest } from '../../services/binanceApi';
import { buildMultiTimeframeAnalysis } from '../../utils/signalEngine';
import { formatPrice } from '../../utils/formatters';
import { TradingViewChart } from '../chart/TradingViewChart';
import { SignalCard } from '../signal/SignalCard';
import { TriplePortfolioTopBar } from '../common/TriplePortfolioTopBar';
import {
  X,
  Star,
  Bell,
  Calculator,
  PlusCircle,
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  CheckCircle,
} from 'lucide-react';

interface CoinDetailModalProps {
  onClose: () => void;
  onOpenRiskCalcWithData: (symbol: string, entry: number, sl: number) => void;
  onOpenAlertModal: (symbol: string, price: number) => void;
}

export const CoinDetailModal: React.FC<CoinDetailModalProps> = ({
  onClose,
  onOpenRiskCalcWithData,
  onOpenAlertModal,
}) => {
  const {
    selectedSymbol,
    selectedTimeframe,
    setSelectedTimeframe,
    tickers,
    fundingRates,
    openInterests,
    setOpenInterest,
    watchlist,
    toggleWatchlist,
    addTrade,
    setSignalForSymbol,
  } = useCryptoStore();

  const [activeTfCandles, setActiveTfCandles] = useState<Candle[]>([]);
  const [allTfCandles, setAllTfCandles] = useState<Record<Timeframe, Candle[]>>({
    '1m': [],
    '5m': [],
    '15m': [],
    '1h': [],
    '4h': [],
    '1d': [],
    '3d': [],
    '1w': [],
  });
  const [isLoading, setIsLoading] = useState(true);

  const currentTicker = tickers[selectedSymbol];
  const currentPrice = currentTicker?.lastPrice || 0;
  const isFavorite = watchlist.includes(selectedSymbol);
  const fundingRate = fundingRates[selectedSymbol] ?? 0.0001;
  const openInterest = openInterests[selectedSymbol];

  // Fetch Klines across multi-timeframes on symbol change
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    async function loadData() {
      try {
        // Fetch open interest
        fetchOpenInterest(selectedSymbol).then((oi) => {
          if (oi && isMounted) setOpenInterest(selectedSymbol, oi);
        });

        // Parallel fetch essential timeframes: 1d, 4h, 1h, 15m, 5m (250 limit for EMA 200 continuity)
        const [k15m, k1h, k4h, k1d, k5m] = await Promise.all([
          fetchKlines(selectedSymbol, '15m', 250),
          fetchKlines(selectedSymbol, '1h', 250),
          fetchKlines(selectedSymbol, '4h', 150),
          fetchKlines(selectedSymbol, '1d', 100),
          fetchKlines(selectedSymbol, '5m', 250),
        ]);

        if (!isMounted) return;

        const candleMap: Record<Timeframe, Candle[]> = {
          '1m': [],
          '5m': k5m,
          '15m': k15m,
          '1h': k1h,
          '4h': k4h,
          '1d': k1d,
          '3d': [],
          '1w': [],
        };

        setAllTfCandles(candleMap);
        setActiveTfCandles(candleMap[selectedTimeframe] || k15m);
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading detail klines:', err);
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [selectedSymbol]);

  // When selected timeframe changes, update chart candles or fetch if missing
  const handleTimeframeChange = async (tf: Timeframe) => {
    setSelectedTimeframe(tf);
    if (allTfCandles[tf] && allTfCandles[tf].length > 0) {
      setActiveTfCandles(allTfCandles[tf]);
    } else {
      const newCandles = await fetchKlines(selectedSymbol, tf, 250);
      setAllTfCandles((prev) => ({ ...prev, [tf]: newCandles }));
      setActiveTfCandles(newCandles);
    }
  };

  // Real-time calculation of Multi-Timeframe Analysis based on currently selected timeframe
  const analysis: MultiTimeframeAnalysis = useMemo(() => {
    return buildMultiTimeframeAnalysis(
      selectedSymbol,
      allTfCandles,
      currentPrice || 100,
      fundingRate,
      selectedTimeframe
    );
  }, [selectedSymbol, allTfCandles, currentPrice, fundingRate, selectedTimeframe]);

  // Sync analysis to store safely only when core signal metrics change
  const lastSavedSignalKey = useRef('');
  useEffect(() => {
    if (analysis) {
      const key = `${selectedSymbol}_${analysis.overallSignal}_${analysis.confidence}_${analysis.agreedTimeframesCount}`;
      if (lastSavedSignalKey.current !== key) {
        lastSavedSignalKey.current = key;
        setSignalForSymbol(selectedSymbol, analysis);
      }
    }
  }, [analysis, selectedSymbol, setSignalForSymbol]);


  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleQuickAddJournal = () => {
    if (!analysis) return;
    addTrade({
      symbol: selectedSymbol,
      side: analysis.overallDirection === 'BEARISH' ? 'SHORT' : 'LONG',
      leverage: 10,
      entryPrice: analysis.targets.entry,
      stopLoss: analysis.targets.sl,
      takeProfit: analysis.targets.tp1,
      margin: 100,
      status: 'OPEN',
      reason: analysis.explanation,
    });
    setToastMessage(`تمت إضافة صفقة ${selectedSymbol} إلى دفتر الصفقات بنجاح.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/90 backdrop-blur-md flex flex-col justify-start">
      {/* Sticky Top Header */}
      <div className="sticky top-0 z-20 bg-[#0b0e14]/95 border-b border-slate-800 backdrop-blur-sm px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-white font-num tracking-wide">
                {selectedSymbol}
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-semibold">
                عقود دائمة (Perp)
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-num">
              <span className="text-white font-bold">${formatPrice(currentPrice)}</span>
              <span
                className={`font-semibold ${
                  (currentTicker?.priceChangePercent || 0) >= 0
                    ? 'text-emerald-400'
                    : 'text-red-400'
                }`}
              >
                {(currentTicker?.priceChangePercent || 0) >= 0 ? '+' : ''}
                {currentTicker?.priceChangePercent?.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleWatchlist(selectedSymbol)}
            className={`p-2 rounded-xl border transition ${
              isFavorite
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
            }`}
            title="المفضلة"
          >
            <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-400' : ''}`} />
          </button>

          <button
            onClick={() => onOpenAlertModal(selectedSymbol, currentPrice)}
            className="p-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-sky-400 transition"
            title="إنشاء تنبيه سعري"
          >
            <Bell className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sticky Triple Portfolio Cards at Top */}
      <div className="sticky top-[57px] z-10 w-full max-w-2xl mx-auto shadow-md">
        <TriplePortfolioTopBar onNavigateToPortfolio={() => onClose()} />
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="max-w-2xl mx-auto w-full px-4 pt-2">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Content Container */}
      <div className="p-4 space-y-4 max-w-2xl mx-auto w-full pb-20">
        {/* Market Stats Grid */}
        <div className="grid grid-cols-3 gap-2 bg-[#121824] p-3 rounded-2xl border border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">معدل التمويل (Funding)</span>
            <span
              className={`font-num font-bold ${
                fundingRate >= 0 ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {(fundingRate * 100).toFixed(4)}%
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">أعلى 24 ساعة</span>
            <span className="font-num font-bold text-slate-200">
              ${formatPrice(currentTicker?.highPrice)}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">الفائدة المفتوحة (OI)</span>
            <span className="font-num font-bold text-sky-400">
              {openInterest ? `${(openInterest / 1000).toFixed(1)}k` : 'نشط'}
            </span>
          </div>
        </div>

        {/* Live Candlestick Chart */}
        <TradingViewChart
          symbol={selectedSymbol}
          candles={activeTfCandles}
          timeframe={selectedTimeframe}
          onTimeframeChange={handleTimeframeChange}
          targets={analysis?.targets}
          supportResistance={analysis?.supportResistance}
        />

        {/* Multi-Timeframe Signal Card & Tables */}
        {analysis && (
          <SignalCard
            analysis={analysis}
            onOpenRiskCalc={() =>
              onOpenRiskCalcWithData(selectedSymbol, analysis.targets.entry, analysis.targets.sl)
            }
            onAddToJournal={handleQuickAddJournal}
          />
        )}
      </div>
    </div>
  );
};
