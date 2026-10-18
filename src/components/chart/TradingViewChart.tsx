import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  ColorType,
  LineStyle,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  CandlestickData,
  WhitespaceData,
} from 'lightweight-charts';
import { Candle, Timeframe, TradeTarget, SupportResistance } from '../../types/crypto';
import { calculateEMA, calculateBollingerBands } from '../../utils/technicalAnalysis';
import { binanceWs } from '../../services/binanceWs';
import { formatPrice, getPricePrecision } from '../../utils/formatters';
import { useCryptoStore } from '../../store/useCryptoStore';
import {
  X,
  Layers,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Target,
  Sliders,
  BarChart3,
  Check,
} from 'lucide-react';

interface TradingViewChartProps {
  symbol: string;
  candles: Candle[];
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  targets?: TradeTarget;
  supportResistance?: SupportResistance;
}

export const TradingViewChart: React.FC<TradingViewChartProps> = ({
  symbol,
  candles,
  timeframe,
  onTimeframeChange,
  targets,
  supportResistance,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  // Read showChartLines from store (Default is false = Clean)
  const { showChartLines, setShowChartLines } = useCryptoStore();

  // Side Panel state
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);

  // Series refs
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ema20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema200SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  // Price lines ref
  const priceLinesRef = useRef<any[]>([]);

  // Throttle state refs for live WebSocket updates
  const pendingCandleRef = useRef<Candle | null>(null);
  const throttleTimerRef = useRef<any>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);

  // Indicator visibility toggles
  const [showEMA, setShowEMA] = useState(true);
  const [showBB, setShowBB] = useState(false);
  const [showVolume, setShowVolume] = useState(true);

  const showVolumeRef = useRef(showVolume);
  showVolumeRef.current = showVolume;

  const timeframes: Timeframe[] = ['15m', '1h', '4h', '1d', '3d', '1w', '5m', '1m'];

  // Current price approximation
  const latestPrice = candles && candles.length > 0 ? candles[candles.length - 1].close : targets?.entry || 0;
  const isLong = targets ? targets.tp1 >= targets.entry : true;

  // 1. Initialize Chart with thin EMA lines & volume at bottom
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 380,
      layout: {
        background: { type: ColorType.Solid, color: '#0b0e14' },
        textColor: '#94a3b8',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.35)' },
        horzLines: { color: 'rgba(30, 41, 59, 0.35)' },
      },
      crosshair: {
        vertLine: {
          color: '#38bdf8',
          width: 1,
          style: LineStyle.Dotted,
          labelBackgroundColor: '#0284c7',
        },
        horzLine: {
          color: '#38bdf8',
          width: 1,
          style: LineStyle.Dotted,
          labelBackgroundColor: '#0284c7',
        },
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        autoScale: true,
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false,
      },
      kineticScroll: {
        touch: false,
        mouse: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    chartRef.current = chart;

    // Candlestick series
    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    // Volume series at bottom
    volumeSeriesRef.current = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.82,
        bottom: 0,
      },
    });

    // EMA 20/50/200 as thin lines (lineWidth: 1)
    ema20SeriesRef.current = chart.addSeries(LineSeries, {
      color: '#38bdf8',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    ema50SeriesRef.current = chart.addSeries(LineSeries, {
      color: '#fbbf24',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    ema200SeriesRef.current = chart.addSeries(LineSeries, {
      color: '#a855f7',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    bbUpperSeriesRef.current = chart.addSeries(LineSeries, {
      color: 'rgba(148, 163, 184, 0.4)',
      lineStyle: LineStyle.Dashed,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    bbLowerSeriesRef.current = chart.addSeries(LineSeries, {
      color: 'rgba(148, 163, 184, 0.4)',
      lineStyle: LineStyle.Dashed,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      ema20SeriesRef.current = null;
      ema50SeriesRef.current = null;
      ema200SeriesRef.current = null;
      bbUpperSeriesRef.current = null;
      bbLowerSeriesRef.current = null;
    };
  }, []);

  // 2. Set full candle & indicator data ONCE on load or timeframe change
  useEffect(() => {
    if (!candleSeriesRef.current || !candles || candles.length === 0) return;

    // Sort & deduplicate candles
    const sorted = [...candles].sort((a, b) => a.time - b.time);
    const uniqueCandles: Candle[] = [];
    for (const c of sorted) {
      if (uniqueCandles.length === 0 || uniqueCandles[uniqueCandles.length - 1].time !== c.time) {
        uniqueCandles.push(c);
      }
    }

    const samplePrice = uniqueCandles[uniqueCandles.length - 1]?.close || 1;
    const precision = getPricePrecision(samplePrice);
    const minMove = Number(Math.pow(10, -precision).toFixed(precision));

    candleSeriesRef.current.applyOptions({
      priceFormat: { type: 'price', precision, minMove },
    });
    ema20SeriesRef.current?.applyOptions({
      priceFormat: { type: 'price', precision, minMove },
    });
    ema50SeriesRef.current?.applyOptions({
      priceFormat: { type: 'price', precision, minMove },
    });
    ema200SeriesRef.current?.applyOptions({
      priceFormat: { type: 'price', precision, minMove },
    });
    bbUpperSeriesRef.current?.applyOptions({
      priceFormat: { type: 'price', precision, minMove },
    });
    bbLowerSeriesRef.current?.applyOptions({
      priceFormat: { type: 'price', precision, minMove },
    });

    const chartData: (CandlestickData | WhitespaceData)[] = uniqueCandles.map((c) => ({
      time: c.time as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candleSeriesRef.current.setData(chartData as any);

    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.setData(
        uniqueCandles.map((c) => ({
          time: c.time as any,
          value: c.volume,
          color: c.close >= c.open ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)',
        }))
      );
    }

    const ema20Vals = calculateEMA(uniqueCandles, 20);
    const ema50Vals = calculateEMA(uniqueCandles, 50);
    const ema200Vals = calculateEMA(uniqueCandles, 200);

    const toLineData = (vals: (number | null)[]) => {
      return uniqueCandles
        .map((c, i) => {
          const val = vals[i];
          if (val !== null && typeof val === 'number' && !isNaN(val) && isFinite(val)) {
            return { time: c.time as any, value: val };
          }
          return null;
        })
        .filter((x): x is { time: any; value: number } => x !== null);
    };

    ema20SeriesRef.current?.setData(toLineData(ema20Vals));
    ema50SeriesRef.current?.setData(toLineData(ema50Vals));
    ema200SeriesRef.current?.setData(toLineData(ema200Vals));

    const { upper, lower } = calculateBollingerBands(uniqueCandles, 20, 2);
    bbUpperSeriesRef.current?.setData(toLineData(upper));
    bbLowerSeriesRef.current?.setData(toLineData(lower));

    chartRef.current?.timeScale().fitContent();
  }, [candles, symbol, timeframe]);

  // 3. Toggle indicator visibility
  useEffect(() => {
    ema20SeriesRef.current?.applyOptions({ visible: showEMA });
    ema50SeriesRef.current?.applyOptions({ visible: showEMA });
    ema200SeriesRef.current?.applyOptions({ visible: showEMA });
  }, [showEMA]);

  useEffect(() => {
    bbUpperSeriesRef.current?.applyOptions({ visible: showBB });
    bbLowerSeriesRef.current?.applyOptions({ visible: showBB });
  }, [showBB]);

  useEffect(() => {
    volumeSeriesRef.current?.applyOptions({ visible: showVolume });
  }, [showVolume]);

  // Zone coordinates state
  const [riskRewardZones, setRiskRewardZones] = useState<{
    slZone: { top: number; height: number } | null;
    tp1Zone: { top: number; height: number } | null;
    tp2Zone: { top: number; height: number } | null;
    tp3Zone: { top: number; height: number } | null;
  }>({
    slZone: null,
    tp1Zone: null,
    tp2Zone: null,
    tp3Zone: null,
  });

  const recomputeZones = () => {
    if (!candleSeriesRef.current || !targets || targets.entry <= 0) {
      setRiskRewardZones({ slZone: null, tp1Zone: null, tp2Zone: null, tp3Zone: null });
      return;
    }
    const series = candleSeriesRef.current;
    const yEntry = series.priceToCoordinate(targets.entry);
    const ySL = series.priceToCoordinate(targets.sl);
    const yTP1 = series.priceToCoordinate(targets.tp1);
    const yTP2 = targets.tp2 ? series.priceToCoordinate(targets.tp2) : null;
    const yTP3 = targets.tp3 ? series.priceToCoordinate(targets.tp3) : null;

    const toBox = (c1: number | null, c2: number | null) => {
      if (c1 === null || c2 === null || isNaN(c1) || isNaN(c2)) return null;
      const top = Math.min(c1, c2);
      const height = Math.abs(c1 - c2);
      return height > 1 ? { top, height } : null;
    };

    setRiskRewardZones({
      slZone: toBox(yEntry, ySL),
      tp1Zone: toBox(yEntry, yTP1),
      tp2Zone: toBox(yTP1, yTP2),
      tp3Zone: toBox(yTP2, yTP3),
    });
  };

  // Recompute zones on chart scroll, zoom, or targets change
  useEffect(() => {
    if (!chartRef.current) return;
    const chart = chartRef.current;

    const handler = () => {
      recomputeZones();
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(handler);
    chart.timeScale().subscribeVisibleTimeRangeChange(handler);

    const timer = setTimeout(recomputeZones, 80);

    return () => {
      clearTimeout(timer);
      try {
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(handler);
        chart.timeScale().unsubscribeVisibleTimeRangeChange(handler);
      } catch (e) {}
    };
  }, [targets, candles]);

  // 4. Update Price Lines according to clean rules:
  // - On chart: Japanese candles, thin EMAs, volume, thin gray horizontal line at entry (no text).
  // - Small marks on price axis (right): SL (red), Entry (blue/gray), TP1/2/3 (green) with price + percentage.
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    // Clean old lines
    priceLinesRef.current.forEach((pl) => {
      try {
        candleSeriesRef.current?.removePriceLine(pl);
      } catch (e) {}
    });
    priceLinesRef.current = [];

    if (targets && targets.entry > 0) {
      // 1. Entry line: thin gray line without text on chart
      const entryLine = candleSeriesRef.current.createPriceLine({
        price: targets.entry,
        color: '#64748b', // Thin calm gray
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: '', // No flying text on the chart
      });
      priceLinesRef.current.push(entryLine);

      // 2. SL line: red, dashed, small axis badge with percentage
      const slLine = candleSeriesRef.current.createPriceLine({
        price: targets.sl,
        color: '#ef4444', // Red
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `-${Math.abs(targets.slPercent).toFixed(1)}%`,
      });
      priceLinesRef.current.push(slLine);

      // 3. TP1 line: green, dashed, small axis badge with percentage
      const tp1Line = candleSeriesRef.current.createPriceLine({
        price: targets.tp1,
        color: '#10b981', // Green
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `+${Math.abs(targets.tp1Percent).toFixed(1)}%`,
      });
      priceLinesRef.current.push(tp1Line);

      // 4. TP2 line: lighter green, dashed, small axis badge with percentage
      const tp2Line = candleSeriesRef.current.createPriceLine({
        price: targets.tp2,
        color: '#34d399', // Light green
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `+${Math.abs(targets.tp2Percent).toFixed(1)}%`,
      });
      priceLinesRef.current.push(tp2Line);

      // 5. TP3 line: even lighter green, dotted, small axis badge with percentage
      if (targets.tp3) {
        const tp3Line = candleSeriesRef.current.createPriceLine({
          price: targets.tp3,
          color: '#6ee7b7', // Even lighter green
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `+${Math.abs(targets.tp3Percent || 0).toFixed(1)}%`,
        });
        priceLinesRef.current.push(tp3Line);
      }

      // If user enabled optional support/resistance lines in settings
      if (showChartLines && supportResistance) {
        supportResistance.resistances.slice(0, 1).forEach((res) => {
          const line = candleSeriesRef.current?.createPriceLine({
            price: res,
            color: '#f43f5e',
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: 'مقاومة',
          });
          if (line) priceLinesRef.current.push(line);
        });

        supportResistance.supports.slice(0, 1).forEach((sup) => {
          const line = candleSeriesRef.current?.createPriceLine({
            price: sup,
            color: '#06b6d4',
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: 'دعم',
          });
          if (line) priceLinesRef.current.push(line);
        });
      }
    }

    setTimeout(recomputeZones, 60);
  }, [targets, supportResistance, showChartLines]);

  // 5. Throttled WebSocket Updates (250ms)
  useEffect(() => {
    const THROTTLE_MS = 250;

    const flushLiveCandle = () => {
      const candle = pendingCandleRef.current;
      if (!candle || !candleSeriesRef.current) return;

      candleSeriesRef.current.update({
        time: candle.time as any,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      });

      if (volumeSeriesRef.current && showVolumeRef.current) {
        volumeSeriesRef.current.update({
          time: candle.time as any,
          value: candle.volume,
          color: candle.close >= candle.open ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)',
        });
      }

      // Single source of truth: synchronize live candle close with store tickers and active trade calculations
      useCryptoStore.getState().updateMarkPrices({ [symbol]: candle.close });

      lastUpdateTimeRef.current = Date.now();
    };

    const unsubscribe = binanceWs.subscribeKlines(symbol, timeframe, (candle, isClosed) => {
      pendingCandleRef.current = candle;
      const now = Date.now();
      const elapsed = now - lastUpdateTimeRef.current;

      if (isClosed || elapsed >= THROTTLE_MS) {
        if (throttleTimerRef.current) {
          clearTimeout(throttleTimerRef.current);
          throttleTimerRef.current = null;
        }
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
        }
        rafIdRef.current = requestAnimationFrame(flushLiveCandle);
      } else if (!throttleTimerRef.current) {
        throttleTimerRef.current = setTimeout(() => {
          throttleTimerRef.current = null;
          if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
          }
          rafIdRef.current = requestAnimationFrame(flushLiveCandle);
        }, THROTTLE_MS - elapsed);
      }
    });

    return () => {
      unsubscribe();
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [symbol, timeframe]);

  // Key Levels for Side Panel
  const entryPrice = targets?.entry || latestPrice;
  const slPrice = targets?.sl || 0;
  const slPercent = targets?.slPercent || 0;
  const tp1Price = targets?.tp1 || 0;
  const tp1Percent = targets?.tp1Percent || 0;
  const tp2Price = targets?.tp2 || 0;
  const tp2Percent = targets?.tp2Percent || 0;
  const tp3Price = targets?.tp3 || 0;
  const tp3Percent = targets?.tp3Percent || 0;
  const rrRatio = targets?.riskRewardRatio || 2.5;

  // Supports & Resistances
  const nearSupport = supportResistance?.supports?.[0] || (isLong ? slPrice : entryPrice * 0.985);
  const farSupport = supportResistance?.supports?.[1] || nearSupport * 0.975;
  const nearResistance = supportResistance?.resistances?.[0] || (!isLong ? slPrice : entryPrice * 1.015);
  const farResistance = supportResistance?.resistances?.[1] || nearResistance * 1.025;

  // Expected liquidation prices for 100x (~1%), 50x (~2%), 25x (~4%)
  const liq100x = isLong ? entryPrice * (1 - 0.009) : entryPrice * (1 + 0.009);
  const liq50x = isLong ? entryPrice * (1 - 0.018) : entryPrice * (1 + 0.018);
  const liq25x = isLong ? entryPrice * (1 - 0.038) : entryPrice * (1 + 0.038);

  return (
    <div className="flex flex-col w-full bg-[#0b0e14] rounded-2xl overflow-hidden border border-slate-800 relative">
      {/* Timeframe Selector, Indicators, and Side Panel Trigger */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/60 border-b border-slate-800/80 gap-2 overflow-x-auto">
        {/* Timeframe Pills */}
        <div className="flex items-center gap-1 shrink-0">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => onTimeframeChange(tf)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                timeframe === tf
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Indicators Controls & Side Panel Button */}
        <div className="flex items-center gap-1.5 shrink-0 text-xs">
          <button
            onClick={() => setShowEMA(!showEMA)}
            className={`px-2 py-0.5 rounded-md font-mono text-[11px] transition ${
              showEMA ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            EMA
          </button>
          <button
            onClick={() => setShowVolume(!showVolume)}
            className={`px-2 py-0.5 rounded-md font-mono text-[11px] transition ${
              showVolume ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            VOL
          </button>

          {/* Side Panel Trigger Button (☰ or 📊) */}
          <button
            onClick={() => setIsSidePanelOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-xs font-bold transition shadow-sm"
            title="فتح قائمة المستويات الفنية وتفاصيل الصفقة"
          >
            <BarChart3 className="w-3.5 h-3.5 text-sky-400" />
            <span>مستويات الصفقة</span>
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="relative w-full h-[380px] overflow-hidden">
        {/* Risk/Reward Background Zones (شفافية 15% أحمر، 15% أخضر، 12% أخضر فاتح، 10% أخضر أفتح) */}
        {targets && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 pr-[65px]">
            {/* Entry to SL (15% Red) */}
            {riskRewardZones.slZone && (
              <div
                className="absolute left-0 right-0 pointer-events-none transition-all duration-75"
                style={{
                  top: `${riskRewardZones.slZone.top}px`,
                  height: `${riskRewardZones.slZone.height}px`,
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  borderBottom: '1px dashed rgba(239, 68, 68, 0.35)',
                }}
              />
            )}

            {/* Entry to TP1 (15% Green) */}
            {riskRewardZones.tp1Zone && (
              <div
                className="absolute left-0 right-0 pointer-events-none transition-all duration-75"
                style={{
                  top: `${riskRewardZones.tp1Zone.top}px`,
                  height: `${riskRewardZones.tp1Zone.height}px`,
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  borderTop: '1px dashed rgba(16, 185, 129, 0.35)',
                }}
              />
            )}

            {/* TP1 to TP2 (12% Light Green) */}
            {riskRewardZones.tp2Zone && (
              <div
                className="absolute left-0 right-0 pointer-events-none transition-all duration-75"
                style={{
                  top: `${riskRewardZones.tp2Zone.top}px`,
                  height: `${riskRewardZones.tp2Zone.height}px`,
                  backgroundColor: 'rgba(52, 211, 153, 0.12)',
                  borderTop: '1px dashed rgba(52, 211, 153, 0.3)',
                }}
              />
            )}

            {/* TP2 to TP3 (10% Lighter Green) */}
            {riskRewardZones.tp3Zone && (
              <div
                className="absolute left-0 right-0 pointer-events-none transition-all duration-75"
                style={{
                  top: `${riskRewardZones.tp3Zone.top}px`,
                  height: `${riskRewardZones.tp3Zone.height}px`,
                  backgroundColor: 'rgba(110, 231, 183, 0.10)',
                  borderTop: '1px dotted rgba(110, 231, 183, 0.25)',
                }}
              />
            )}
          </div>
        )}

        <div ref={containerRef} className="w-full h-full relative z-10" />
        {(!candles || candles.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm pointer-events-none bg-[#0b0e14]/70 z-20">
            جارٍ تحميل بيانات الشموع...
          </div>
        )}
      </div>

      {/* Indicator Legend Strip (Clean & Minimal) */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0e131d] border-t border-slate-800/60 text-[10px] text-slate-400 font-num">
        <div className="flex items-center gap-3">
          {showEMA && (
            <>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block" /> EMA20
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" /> EMA50
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" /> EMA200
              </span>
            </>
          )}
        </div>
        {targets && (
          <div className="flex items-center gap-2">
            <span className="text-slate-300 font-bold">دخول: ${formatPrice(targets.entry)}</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">R:R 1:{targets.riskRewardRatio}</span>
          </div>
        )}
      </div>

      {/* Side Panel Drawer (تنسدل من يمين الشاشة بنصف شفافية وخلفية داكنة) */}
      {isSidePanelOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fadeIn"
          onClick={() => setIsSidePanelOpen(false)}
        >
          <div
            className="w-full max-w-sm sm:max-w-md h-full bg-[#0d121d]/95 backdrop-blur-2xl border-r sm:border-r-0 sm:border-l border-slate-800 p-5 overflow-y-auto flex flex-col justify-between shadow-2xl text-right animate-slideInRight"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            {/* Drawer Header */}
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">تفاصيل الإشارة</h3>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-num">
                      <span className="font-bold text-white">{symbol}</span>
                      <span>•</span>
                      <span className={isLong ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                        {isLong ? 'صفقة شراء (LONG)' : 'صفقة بيع (SHORT)'}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setIsSidePanelOpen(false)}
                  className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                  title="إغلاق القائمة"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Quick Setting Switch for Chart Lines */}
              <div className="mt-3 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky-400" />
                  <div>
                    <span className="text-slate-200 font-bold block">إظهار الخطوط على الشارت</span>
                    <span className="text-[10px] text-slate-400">إظهار مستويات الدعم والمقاومة</span>
                  </div>
                </div>
                <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 font-num">
                  <button
                    onClick={() => setShowChartLines(true)}
                    className={`px-2 py-0.5 text-[11px] font-bold rounded transition ${
                      showChartLines ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    نعم
                  </button>
                  <button
                    onClick={() => setShowChartLines(false)}
                    className={`px-2 py-0.5 text-[11px] font-bold rounded transition ${
                      !showChartLines ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    لا (نظيف)
                  </button>
                </div>
              </div>

              {/* Required Exact Signal Breakdown Table */}
              <div className="mt-4">
                <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80 shadow-inner">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-800/60 text-slate-400 border-b border-slate-800 text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3 font-bold">البند</th>
                        <th className="py-2.5 px-3 font-bold text-center">السعر</th>
                        <th className="py-2.5 px-3 font-bold text-left">النسبة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 font-num text-xs">
                      {/* الدخول */}
                      <tr className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3 font-bold text-sky-400">الدخول</td>
                        <td className="py-2.5 px-3 text-center font-bold text-white">${formatPrice(entryPrice)}</td>
                        <td className="py-2.5 px-3 text-left text-slate-500 font-bold">—</td>
                      </tr>
                      {/* SL */}
                      <tr className="hover:bg-red-950/20 transition bg-red-950/10">
                        <td className="py-2.5 px-3 font-bold text-red-400">SL</td>
                        <td className="py-2.5 px-3 text-center font-bold text-red-300">${formatPrice(slPrice)}</td>
                        <td className="py-2.5 px-3 text-left font-bold text-red-400">-{Math.abs(slPercent).toFixed(2)}%</td>
                      </tr>
                      {/* TP1 */}
                      <tr className="hover:bg-emerald-950/20 transition bg-emerald-950/10">
                        <td className="py-2.5 px-3 font-bold text-emerald-400">TP1</td>
                        <td className="py-2.5 px-3 text-center font-bold text-emerald-300">${formatPrice(tp1Price)}</td>
                        <td className="py-2.5 px-3 text-left font-bold text-emerald-400">+{Math.abs(tp1Percent).toFixed(2)}%</td>
                      </tr>
                      {/* TP2 */}
                      <tr className="hover:bg-emerald-950/20 transition">
                        <td className="py-2.5 px-3 font-bold text-emerald-300">TP2</td>
                        <td className="py-2.5 px-3 text-center font-bold text-emerald-200">${formatPrice(tp2Price)}</td>
                        <td className="py-2.5 px-3 text-left font-bold text-emerald-300">+{Math.abs(tp2Percent).toFixed(2)}%</td>
                      </tr>
                      {/* TP3 */}
                      {tp3Price > 0 && (
                        <tr className="hover:bg-emerald-950/20 transition">
                          <td className="py-2.5 px-3 font-bold text-emerald-200">TP3</td>
                          <td className="py-2.5 px-3 text-center font-bold text-emerald-100">${formatPrice(tp3Price)}</td>
                          <td className="py-2.5 px-3 text-left font-bold text-emerald-200">+{Math.abs(tp3Percent).toFixed(2)}%</td>
                        </tr>
                      )}
                      {/* R:R */}
                      <tr className="hover:bg-amber-950/20 transition bg-slate-900/90">
                        <td className="py-2.5 px-3 font-bold text-amber-400">R:R</td>
                        <td className="py-2.5 px-3 text-center text-slate-500 font-bold">—</td>
                        <td className="py-2.5 px-3 text-left font-black text-amber-300">1 : {rrRatio}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Additional Sections */}
              <div className="mt-4 space-y-3">

                {/* 2. Stop Loss (SL) Section */}
                <div className="rounded-xl bg-red-950/20 border border-red-900/40 overflow-hidden">
                  <div className="px-3 py-2 bg-red-900/20 border-b border-red-900/40 text-xs font-bold text-red-300 flex items-center justify-between">
                    <span>وقف الخسارة (Stop Loss - SL)</span>
                    <span className="text-red-400 font-mono text-[11px]">
                      -{Math.abs(slPercent)}%
                    </span>
                  </div>
                  <div className="p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">سعر وقف الخسارة:</span>
                      <span className="font-num font-black text-red-400 text-sm">
                        ${formatPrice(slPrice)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">نسبة المخاطرة من الدخول:</span>
                      <span className="font-num font-bold text-red-400">
                        -{Math.abs(slPercent).toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">المسافة السعرية:</span>
                      <span className="font-num font-mono text-slate-300">
                        ${Math.abs(entryPrice - slPrice).toFixed(getPricePrecision(entryPrice))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Take Profit Targets (TP1, TP2, TP3) */}
                <div className="rounded-xl bg-emerald-950/20 border border-emerald-900/40 overflow-hidden">
                  <div className="px-3 py-2 bg-emerald-900/20 border-b border-emerald-900/40 text-xs font-bold text-emerald-300 flex items-center justify-between">
                    <span>أهداف جني الأرباح (Take Profit)</span>
                    <span className="text-emerald-400 text-[10px]">إغلاق تدريجي</span>
                  </div>
                  <div className="divide-y divide-emerald-900/20 text-xs">
                    {/* TP1 */}
                    <div className="p-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-emerald-400 block">الهدف الأول (TP1)</span>
                        <span className="text-[10px] text-slate-400">إغلاق 50% + نقل الوقف لنقطة الدخول</span>
                      </div>
                      <div className="text-left font-num">
                        <span className="font-black text-white block">${formatPrice(tp1Price)}</span>
                        <span className="text-emerald-400 font-bold text-[11px]">
                          +{Math.abs(tp1Percent)}%
                        </span>
                      </div>
                    </div>

                    {/* TP2 */}
                    <div className="p-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-emerald-300 block">الهدف الثاني (TP2)</span>
                        <span className="text-[10px] text-slate-400">إغلاق 30% + تفعيل Trailing Stop</span>
                      </div>
                      <div className="text-left font-num">
                        <span className="font-black text-white block">${formatPrice(tp2Price)}</span>
                        <span className="text-emerald-300 font-bold text-[11px]">
                          +{Math.abs(tp2Percent)}%
                        </span>
                      </div>
                    </div>

                    {/* TP3 */}
                    {tp3Price > 0 && (
                      <div className="p-2.5 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-emerald-200 block">الهدف الثالث (TP3)</span>
                          <span className="text-[10px] text-slate-400">إغلاق 20% المتبقية</span>
                        </div>
                        <div className="text-left font-num">
                          <span className="font-black text-white block">${formatPrice(tp3Price)}</span>
                          <span className="text-emerald-200 font-bold text-[11px]">
                            +{Math.abs(tp3Percent)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. Support & Resistance Section */}
                <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden">
                  <div className="px-3 py-2 bg-slate-800/40 border-b border-slate-800 text-xs font-bold text-slate-300">
                    مستويات الدعم والمقاومة الفنية
                  </div>
                  <div className="p-3 grid grid-cols-2 gap-3 text-xs">
                    {/* Supports */}
                    <div className="space-y-1.5 p-2 rounded-lg bg-cyan-950/20 border border-cyan-900/30">
                      <span className="text-[11px] font-bold text-cyan-400 block">مستويات الدعم:</span>
                      <div className="flex items-center justify-between text-[11px] font-num">
                        <span className="text-slate-400">القريب:</span>
                        <span className="text-white font-bold">${formatPrice(nearSupport)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-num">
                        <span className="text-slate-400">البعيد:</span>
                        <span className="text-slate-300">${formatPrice(farSupport)}</span>
                      </div>
                    </div>

                    {/* Resistances */}
                    <div className="space-y-1.5 p-2 rounded-lg bg-rose-950/20 border border-rose-900/30">
                      <span className="text-[11px] font-bold text-rose-400 block">مستويات المقاومة:</span>
                      <div className="flex items-center justify-between text-[11px] font-num">
                        <span className="text-slate-400">القريبة:</span>
                        <span className="text-white font-bold">${formatPrice(nearResistance)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-num">
                        <span className="text-slate-400">البعيدة:</span>
                        <span className="text-slate-300">${formatPrice(farResistance)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. Expected Liquidation Price per Leverage Tier */}
                <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden">
                  <div className="px-3 py-2 bg-slate-800/40 border-b border-slate-800 text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>أسعار التصفية المتوقعة حسب الرافعة</span>
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="p-3 space-y-2 text-xs">
                    {/* 100x */}
                    <div className="flex items-center justify-between p-1.5 rounded-lg bg-red-500/5 border border-red-500/20">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-red-500/20 text-red-400">
                          المحفظة A (100x)
                        </span>
                        <span className="text-[10px] text-slate-400">مسافة ~1%</span>
                      </div>
                      <span className="font-num font-black text-red-400">
                        ${formatPrice(liq100x)}
                      </span>
                    </div>

                    {/* 50x */}
                    <div className="flex items-center justify-between p-1.5 rounded-lg bg-sky-500/5 border border-sky-500/20">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-sky-500/20 text-sky-400">
                          المحفظة B (50x)
                        </span>
                        <span className="text-[10px] text-slate-400">مسافة ~2%</span>
                      </div>
                      <span className="font-num font-black text-sky-300">
                        ${formatPrice(liq50x)}
                      </span>
                    </div>

                    {/* 25x */}
                    <div className="flex items-center justify-between p-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400">
                          المحفظة C (25x)
                        </span>
                        <span className="text-[10px] text-slate-400">مسافة ~4%</span>
                      </div>
                      <span className="font-num font-black text-emerald-400">
                        ${formatPrice(liq25x)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="pt-4 border-t border-slate-800 mt-4">
              <button
                onClick={() => setIsSidePanelOpen(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                <span>إغلاق القائمة الجانبية</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
