import { Candle, Timeframe } from '../types/crypto';

type CandleCallback = (candle: Candle, isClosed: boolean) => void;
type MarkPriceCallback = (markPrices: Record<string, number>) => void;
type StatusCallback = (connected: boolean) => void;

class BinanceWsManager {
  private klineWs: WebSocket | null = null;
  private markPriceWs: WebSocket | null = null;
  private currentSymbol: string = '';
  private currentInterval: Timeframe = '15m';

  private candleListeners: Set<CandleCallback> = new Set();
  private markPriceListeners: Set<MarkPriceCallback> = new Set();
  private statusListeners: Set<StatusCallback> = new Set();

  private isConnected: boolean = false;
  private reconnectTimeout: any = null;
  private isDestroyed: boolean = false;

  constructor() {
    // Listen for tab visibility / unload to conserve battery
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.destroy());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          // tab in background
        } else {
          // tab restored
          if (!this.isConnected && !this.isDestroyed) {
            this.reconnect();
          }
        }
      });
    }
  }

  public subscribeStatus(cb: StatusCallback) {
    this.statusListeners.add(cb);
    cb(this.isConnected);
    return () => {
      this.statusListeners.delete(cb);
    };
  }

  private notifyStatus(connected: boolean) {
    this.isConnected = connected;
    this.statusListeners.forEach((cb) => cb(connected));
  }

  /**
   * Subscribe to live mark prices for all pairs (!markPrice@arr@1s)
   */
  public subscribeMarkPrices(cb: MarkPriceCallback) {
    this.markPriceListeners.add(cb);
    if (!this.markPriceWs && !this.isDestroyed) {
      this.connectMarkPriceWs();
    }
    return () => {
      this.markPriceListeners.delete(cb);
      if (this.markPriceListeners.size === 0 && this.markPriceWs) {
        this.markPriceWs.close();
        this.markPriceWs = null;
      }
    };
  }

  private lastMarkPriceDispatch = 0;
  private pendingMarkPriceMap: Record<string, number> = {};
  private markPriceThrottleTimer: any = null;

  private dispatchMarkPricesThrottled(priceMap: Record<string, number>) {
    Object.assign(this.pendingMarkPriceMap, priceMap);
    const now = Date.now();
    const elapsed = now - this.lastMarkPriceDispatch;

    if (elapsed >= 500) {
      if (this.markPriceThrottleTimer) {
        clearTimeout(this.markPriceThrottleTimer);
        this.markPriceThrottleTimer = null;
      }
      this.lastMarkPriceDispatch = now;
      const snapshot = { ...this.pendingMarkPriceMap };
      this.markPriceListeners.forEach((cb) => cb(snapshot));
    } else if (!this.markPriceThrottleTimer) {
      this.markPriceThrottleTimer = setTimeout(() => {
        this.markPriceThrottleTimer = null;
        this.lastMarkPriceDispatch = Date.now();
        const snapshot = { ...this.pendingMarkPriceMap };
        this.markPriceListeners.forEach((cb) => cb(snapshot));
      }, 500 - elapsed);
    }
  }

  private connectMarkPriceWs() {
    try {
      const url = 'wss://fstream.binance.com/ws/!markPrice@arr@1s';
      this.markPriceWs = new WebSocket(url);

      this.markPriceWs.onopen = () => {
        this.notifyStatus(true);
      };

      this.markPriceWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (Array.isArray(data)) {
            const priceMap: Record<string, number> = {};
            data.forEach((item: any) => {
              if (item.s && item.p) {
                priceMap[item.s] = parseFloat(item.p);
              }
            });
            this.dispatchMarkPricesThrottled(priceMap);
          }
        } catch (err) {
          console.error('Error parsing markPrice WS message:', err);
        }
      };

      this.markPriceWs.onerror = () => {
        // Will trigger onclose
      };

      this.markPriceWs.onclose = () => {
        this.markPriceWs = null;
        if (!this.isDestroyed && this.markPriceListeners.size > 0) {
          setTimeout(() => this.connectMarkPriceWs(), 3000);
        }
      };
    } catch (e) {
      console.warn('Failed to initialize markPrice WebSocket:', e);
    }
  }

  /**
   * Subscribe to live Kline candles for the active chart symbol
   */
  public subscribeKlines(symbol: string, interval: Timeframe, cb: CandleCallback) {
    const symbolChanged = this.currentSymbol !== symbol || this.currentInterval !== interval;
    this.currentSymbol = symbol;
    this.currentInterval = interval;
    this.candleListeners.add(cb);

    if (symbolChanged || !this.klineWs) {
      this.connectKlineWs();
    }

    return () => {
      this.candleListeners.delete(cb);
      if (this.candleListeners.size === 0 && this.klineWs) {
        this.klineWs.close();
        this.klineWs = null;
        this.currentSymbol = '';
      }
    };
  }

  private connectKlineWs() {
    if (this.klineWs) {
      try {
        this.klineWs.close();
      } catch (e) {
        // ignore
      }
      this.klineWs = null;
    }

    if (!this.currentSymbol) return;

    try {
      const streamName = `${this.currentSymbol.toLowerCase()}@kline_${this.currentInterval}`;
      const url = `wss://fstream.binance.com/ws/${streamName}`;
      this.klineWs = new WebSocket(url);

      this.klineWs.onopen = () => {
        this.notifyStatus(true);
      };

      this.klineWs.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.e === 'kline' && msg.k) {
            const k = msg.k;
            const candle: Candle = {
              time: Math.floor(k.t / 1000), // in seconds
              open: parseFloat(k.o),
              high: parseFloat(k.h),
              low: parseFloat(k.l),
              close: parseFloat(k.c),
              volume: parseFloat(k.v),
            };
            const isClosed = Boolean(k.x);
            this.candleListeners.forEach((cb) => cb(candle, isClosed));
          }
        } catch (err) {
          console.error('Error parsing kline WS message:', err);
        }
      };

      this.klineWs.onerror = () => {
        this.notifyStatus(false);
      };

      this.klineWs.onclose = () => {
        this.klineWs = null;
        if (!this.isDestroyed && this.candleListeners.size > 0) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = setTimeout(() => {
            this.connectKlineWs();
          }, 3000); // Reconnect every 3s as specified
        }
      };
    } catch (e) {
      console.warn('Failed to initialize kline WebSocket:', e);
    }
  }

  public reconnect() {
    if (this.candleListeners.size > 0) {
      this.connectKlineWs();
    }
    if (this.markPriceListeners.size > 0) {
      this.connectMarkPriceWs();
    }
  }

  public destroy() {
    this.isDestroyed = true;
    clearTimeout(this.reconnectTimeout);
    if (this.klineWs) {
      try {
        this.klineWs.close();
      } catch (e) {}
      this.klineWs = null;
    }
    if (this.markPriceWs) {
      try {
        this.markPriceWs.close();
      } catch (e) {}
      this.markPriceWs = null;
    }
    this.candleListeners.clear();
    this.markPriceListeners.clear();
    this.notifyStatus(false);
  }
}

export const binanceWs = new BinanceWsManager();
