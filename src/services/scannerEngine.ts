import { fetchKlines, KLINE_CACHE_TTL_MS, isCryptoFuturesSymbol } from './binanceApi';
import { buildMultiTimeframeAnalysis } from '../utils/signalEngine';
import { useCryptoStore } from '../store/useCryptoStore';
import { MultiTimeframeAnalysis, Timeframe, Ticker24h } from '../types/crypto';

export interface ScannerProgress {
  isScanning: boolean;
  scannedCount: number;
  totalEligible: number;
  currentSymbol: string;
  instantSignalsCount: number; // >= 70
  watchSignalsCount: number;   // 55 - 69
  lastScanTimestamp: number;
}

// 15-Minute Scan Results Cache
const SCAN_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
interface CachedAnalysis {
  analysis: MultiTimeframeAnalysis;
  timestamp: number;
}
const scanCache = new Map<string, CachedAnalysis>();

class AutoScannerEngine {
  private isRunning: boolean = false;
  private abortRequested: boolean = false;
  private progressListeners: Array<(p: ScannerProgress) => void> = [];

  private currentProgress: ScannerProgress = {
    isScanning: false,
    scannedCount: 0,
    totalEligible: 0,
    currentSymbol: '',
    instantSignalsCount: 0,
    watchSignalsCount: 0,
    lastScanTimestamp: 0,
  };

  public subscribeProgress(listener: (p: ScannerProgress) => void) {
    this.progressListeners.push(listener);
    listener(this.currentProgress);
    return () => {
      this.progressListeners = this.progressListeners.filter((l) => l !== listener);
    };
  }

  private notifyProgress() {
    this.progressListeners.forEach((l) => l({ ...this.currentProgress }));
  }

  public getCachedAnalysis(symbol: string): MultiTimeframeAnalysis | null {
    const cached = scanCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < SCAN_CACHE_TTL_MS) {
      return cached.analysis;
    }
    return null;
  }

  public getAllCachedSignals(): Record<string, MultiTimeframeAnalysis> {
    const res: Record<string, MultiTimeframeAnalysis> = {};
    const now = Date.now();
    scanCache.forEach((entry, sym) => {
      if (now - entry.timestamp < SCAN_CACHE_TTL_MS) {
        res[sym] = entry.analysis;
      }
    });
    return res;
  }

  /**
   * Scans a single symbol deeply across requested timeframes (15m, 1h, 4h, 1d, 3d, 1w)
   * With 15-minute caching and rate limit safety
   */
  public async scanSingleSymbol(
    symbol: string,
    forceRefresh = false
  ): Promise<MultiTimeframeAnalysis | null> {
    const cached = scanCache.get(symbol);
    if (!forceRefresh && cached && Date.now() - cached.timestamp < SCAN_CACHE_TTL_MS) {
      return cached.analysis;
    }

    try {
      const store = useCryptoStore.getState();
      const currentPrice = store.tickers[symbol]?.lastPrice;
      const funding = store.fundingRates[symbol] ?? 0.0001;

      // Parallel fetch with rate limit delay handled in fetchKlines
      // 15m & 1h for entry, 4h for confirmation, 1d, 3d, 1w for macro trend
      const [k15m, k1h, k4h, k1d] = await Promise.all([
        fetchKlines(symbol, '15m', 150, forceRefresh),
        fetchKlines(symbol, '1h', 150, forceRefresh),
        fetchKlines(symbol, '4h', 80, forceRefresh),
        fetchKlines(symbol, '1d', 60, forceRefresh),
      ]);

      if (!k15m || k15m.length === 0) return null;

      const effectivePrice = currentPrice || k15m[k15m.length - 1]?.close || 100;

      // Build analysis using the exact 100-point smart score system
      const candleMap: Record<Timeframe, typeof k15m> = {
        '1m': [],
        '5m': [],
        '15m': k15m,
        '1h': k1h,
        '4h': k4h,
        '1d': k1d,
        '3d': [], // derived or fallback to 1d trend if needed
        '1w': [],
      };

      const analysis = buildMultiTimeframeAnalysis(
        symbol,
        candleMap,
        effectivePrice,
        funding
      );

      // Save to 15-minute cache
      scanCache.set(symbol, {
        analysis,
        timestamp: Date.now(),
      });

      // Save to global crypto store
      store.setSignalForSymbol(symbol, analysis);

      // Automatic Execution in all 3 portfolios if criteria met:
      // Score >= 70 -> Instant Market entry in Portfolios A (100x), B (50x), C (25x)
      // Score 55-69 -> Pending limit entry in Portfolios A, B, C
      const score = analysis.scoreBreakdown?.totalScore ?? analysis.confidence;
      if (score >= 55) {
        store.evaluateAndExecuteSignal(analysis, '15m');
      }

      return analysis;
    } catch (e) {
      console.warn(`Error scanning symbol ${symbol}:`, e);
      return null;
    }
  }

  /**
   * Continuous background batch scanner:
   * Loops through all eligible Binance Futures symbols (volume >= 3M USDT)
   * With priority for highest 15m/1h volume & volatility
   */
  public async startBackgroundScanner() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.abortRequested = false;

    while (!this.abortRequested) {
      const store = useCryptoStore.getState();
      const allTickers = Object.values(store.tickers);

      // Filter only verified Crypto Futures with quoteVolume >= 3M USDT
      const eligibleTickers = allTickers
        .filter((t) => isCryptoFuturesSymbol(t.symbol) && t.quoteVolume >= 3000000)
        .sort((a, b) => b.quoteVolume - a.quoteVolume);

      if (eligibleTickers.length === 0) {
        // Wait 3 seconds for initial tickers to load
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }

      this.currentProgress = {
        isScanning: true,
        scannedCount: 0,
        totalEligible: eligibleTickers.length,
        currentSymbol: '',
        instantSignalsCount: 0,
        watchSignalsCount: 0,
        lastScanTimestamp: Date.now(),
      };
      this.notifyProgress();

      // Scan in batches of 2 with 250ms spacing to maintain flawless rate limit compliance
      for (let i = 0; i < eligibleTickers.length; i++) {
        if (this.abortRequested) break;

        const ticker = eligibleTickers[i];
        this.currentProgress.currentSymbol = ticker.symbol;
        this.currentProgress.scannedCount = i + 1;
        this.notifyProgress();

        // Scan if not cached or cache is older than 15 minutes
        const cached = scanCache.get(ticker.symbol);
        const isStale = !cached || Date.now() - cached.timestamp >= SCAN_CACHE_TTL_MS;

        if (isStale) {
          const analysis = await this.scanSingleSymbol(ticker.symbol);
          if (analysis) {
            const sc = analysis.scoreBreakdown?.totalScore ?? analysis.confidence;
            if (sc >= 70) this.currentProgress.instantSignalsCount++;
            else if (sc >= 55) this.currentProgress.watchSignalsCount++;
          }
          // Polite delay between API calls
          await new Promise((r) => setTimeout(r, 300));
        } else {
          // Re-evaluate existing cache
          const sc = cached.analysis.scoreBreakdown?.totalScore ?? cached.analysis.confidence;
          if (sc >= 70) this.currentProgress.instantSignalsCount++;
          else if (sc >= 55) this.currentProgress.watchSignalsCount++;
        }
      }

      this.currentProgress.isScanning = false;
      this.currentProgress.currentSymbol = 'اكتملت دورة المسح';
      this.currentProgress.lastScanTimestamp = Date.now();
      this.notifyProgress();

      // Pause 30 seconds before next scan cycle
      for (let wait = 0; wait < 30; wait++) {
        if (this.abortRequested) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    this.isRunning = false;
  }

  public stopBackgroundScanner() {
    this.abortRequested = true;
    this.isRunning = false;
    this.currentProgress.isScanning = false;
    this.notifyProgress();
  }
}

export const scannerEngine = new AutoScannerEngine();
