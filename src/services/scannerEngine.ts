import { fetchKlines, KLINE_CACHE_TTL_MS, isCryptoFuturesSymbol } from './binanceApi';
import { buildMultiTimeframeAnalysis } from '../utils/signalEngine';
import { useCryptoStore } from '../store/useCryptoStore';
import { MultiTimeframeAnalysis, Timeframe } from '../types/crypto';

export interface ScannerProgress {
  scannerId: 1 | 2;
  isScanning: boolean;
  scannedCount: number;
  totalEligible: number;
  currentSymbol: string;
  instantSignalsCount: number; // >= 70
  watchSignalsCount: number;   // 55 - 69
  lastScanTimestamp: number;
  symbols: string[];
}

// 15-Minute Scan Results Cache
const SCAN_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
interface CachedAnalysis {
  analysis: MultiTimeframeAnalysis;
  timestamp: number;
}
const scanCache = new Map<string, CachedAnalysis>();

class DualAutoScannerEngine {
  private isRunning: boolean = false;
  private abortRequested: boolean = false;

  private progress1Listeners: Array<(p: ScannerProgress) => void> = [];
  private progress2Listeners: Array<(p: ScannerProgress) => void> = [];

  private progress1: ScannerProgress = {
    scannerId: 1,
    isScanning: false,
    scannedCount: 0,
    totalEligible: 0,
    currentSymbol: '',
    instantSignalsCount: 0,
    watchSignalsCount: 0,
    lastScanTimestamp: 0,
    symbols: [],
  };

  private progress2: ScannerProgress = {
    scannerId: 2,
    isScanning: false,
    scannedCount: 0,
    totalEligible: 0,
    currentSymbol: '',
    instantSignalsCount: 0,
    watchSignalsCount: 0,
    lastScanTimestamp: 0,
    symbols: [],
  };

  public subscribeProgress1(listener: (p: ScannerProgress) => void) {
    this.progress1Listeners.push(listener);
    listener({ ...this.progress1 });
    return () => {
      this.progress1Listeners = this.progress1Listeners.filter((l) => l !== listener);
    };
  }

  public subscribeProgress2(listener: (p: ScannerProgress) => void) {
    this.progress2Listeners.push(listener);
    listener({ ...this.progress2 });
    return () => {
      this.progress2Listeners = this.progress2Listeners.filter((l) => l !== listener);
    };
  }

  // Generic subscribe for backward compatibility
  public subscribeProgress(listener: (p: ScannerProgress) => void) {
    return this.subscribeProgress1(listener);
  }

  public getProgress(scannerId: 1 | 2): ScannerProgress {
    return scannerId === 1 ? { ...this.progress1 } : { ...this.progress2 };
  }

  private notifyProgress1() {
    this.progress1Listeners.forEach((l) => l({ ...this.progress1 }));
  }

  private notifyProgress2() {
    this.progress2Listeners.forEach((l) => l({ ...this.progress2 }));
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
   * Scans a single symbol deeply across multi-timeframes (15m, 1h, 4h, 1d)
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

      const [k15m, k1h, k4h, k1d] = await Promise.all([
        fetchKlines(symbol, '15m', 150, forceRefresh),
        fetchKlines(symbol, '1h', 150, forceRefresh),
        fetchKlines(symbol, '4h', 80, forceRefresh),
        fetchKlines(symbol, '1d', 100, forceRefresh),
      ]);

      if (!k15m || k15m.length === 0) return null;

      const effectivePrice = currentPrice || k15m[k15m.length - 1]?.close || 100;

      const candleMap: Record<Timeframe, typeof k15m> = {
        '1m': [],
        '5m': [],
        '15m': k15m,
        '1h': k1h,
        '4h': k4h,
        '1d': k1d,
        '3d': [],
        '1w': [],
      };

      const analysis = buildMultiTimeframeAnalysis(
        symbol,
        candleMap,
        effectivePrice,
        funding
      );

      scanCache.set(symbol, {
        analysis,
        timestamp: Date.now(),
      });

      // Update signal cache in store
      store.setSignalForSymbol(symbol, analysis);

      // Auto evaluate & execute trade into matching strategy
      const sc = analysis.scoreBreakdown?.totalScore ?? analysis.confidence;
      if (sc >= 55 && (analysis.targets?.riskRewardRatio || 0) >= 1.5) {
        store.evaluateAndExecuteSignal(analysis, '15m');
      }

      return analysis;
    } catch (e) {
      console.warn(`Scan error for ${symbol}:`, e);
      return null;
    }
  }

  /**
   * Internal worker loop for one half of the symbol list
   */
  private async runWorker(
    scannerId: 1 | 2,
    getSymbols: () => string[]
  ) {
    while (!this.abortRequested) {
      const symbols = getSymbols();
      if (symbols.length === 0) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }

      const progress = scannerId === 1 ? this.progress1 : this.progress2;
      const notify = scannerId === 1 ? () => this.notifyProgress1() : () => this.notifyProgress2();

      progress.isScanning = true;
      progress.scannedCount = 0;
      progress.totalEligible = symbols.length;
      progress.currentSymbol = 'جاري المسح المستمر...';
      progress.symbols = symbols;
      progress.lastScanTimestamp = Date.now();
      notify();

      for (let i = 0; i < symbols.length; i++) {
        if (this.abortRequested) break;

        const sym = symbols[i];
        progress.currentSymbol = sym;
        progress.scannedCount = i + 1;
        notify();

        const cached = scanCache.get(sym);
        const isStale = !cached || Date.now() - cached.timestamp >= SCAN_CACHE_TTL_MS;

        if (isStale) {
          const analysis = await this.scanSingleSymbol(sym);
          if (analysis) {
            const sc = analysis.scoreBreakdown?.totalScore ?? analysis.confidence;
            if (sc >= 70) progress.instantSignalsCount++;
            else if (sc >= 55) progress.watchSignalsCount++;
          }
          // Spacing between requests
          await new Promise((r) => setTimeout(r, 250));
        } else {
          const sc = cached.analysis.scoreBreakdown?.totalScore ?? cached.analysis.confidence;
          if (sc >= 70) progress.instantSignalsCount++;
          else if (sc >= 55) progress.watchSignalsCount++;

          if (sc >= 55 && (cached.analysis.targets?.riskRewardRatio || 0) >= 1.5) {
            useCryptoStore.getState().evaluateAndExecuteSignal(cached.analysis, '15m');
          }
        }
      }

      progress.isScanning = true;
      progress.currentSymbol = 'اكتملت الدورة • إعادة المسح...';
      progress.lastScanTimestamp = Date.now();
      notify();

      // Pause 1 second before next cycle
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  /**
   * Starts both Scanner 1 and Scanner 2 in parallel continuous loops
   * dividing the Binance Futures symbols list into two halves.
   */
  public async startBackgroundScanner() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.abortRequested = false;

    const getSplitSymbols = (): { part1: string[]; part2: string[] } => {
      const store = useCryptoStore.getState();
      const allTickers = Object.values(store.tickers);
      const eligibleTickers = allTickers
        .filter((t) => isCryptoFuturesSymbol(t.symbol) && t.quoteVolume >= 3000000)
        .sort((a, b) => b.quoteVolume - a.quoteVolume);

      const symbols = eligibleTickers.map((t) => t.symbol);
      const half = Math.ceil(symbols.length / 2);
      return {
        part1: symbols.slice(0, half),
        part2: symbols.slice(half),
      };
    };

    // Wait until tickers are loaded
    let splits = getSplitSymbols();
    while (splits.part1.length === 0 && !this.abortRequested) {
      await new Promise((r) => setTimeout(r, 1500));
      splits = getSplitSymbols();
    }

    if (this.abortRequested) {
      this.isRunning = false;
      return;
    }

    // Launch both workers in parallel!
    Promise.all([
      this.runWorker(1, () => getSplitSymbols().part1),
      this.runWorker(2, () => getSplitSymbols().part2),
    ]).catch((err) => {
      console.error('Scanner workers error:', err);
    });
  }

  public stopBackgroundScanner() {
    this.abortRequested = true;
    this.isRunning = false;
    this.progress1.isScanning = false;
    this.progress2.isScanning = false;
    this.notifyProgress1();
    this.notifyProgress2();
  }
}

export const scannerEngine = new DualAutoScannerEngine();
