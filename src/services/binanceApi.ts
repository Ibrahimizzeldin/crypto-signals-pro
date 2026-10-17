import axios from 'axios';
import { Candle, Ticker24h, Timeframe } from '../types/crypto';
import { getPricePrecision } from '../utils/formatters';

const BINANCE_FAPI_BASE = 'https://fapi.binance.com/fapi/v1';

// Seed top liquid Futures symbols
export const TOP_FUTURES_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'BNBUSDT',
  'XRPUSDT',
  'DOGEUSDT',
  'ADAUSDT',
  'SUIUSDT',
  'PEPEUSDT',
  'AVAXUSDT',
  'LINKUSDT',
  'NEARUSDT',
  'APTUSDT',
  'ARBUSDT',
  'OPUSDT',
  'RENDERUSDT',
  'FETUSDT',
  'TIAUSDT',
  'INJUSDT',
  'SHIBUSDT',
  'LTCUSDT',
  'BCHUSDT',
  'DOTUSDT',
  'UNIUSDT',
  'TAOUSDT',
  'WIFUSDT',
  'FLOKIUSDT',
  'BONKUSDT',
  'FILUSDT',
  'SEIUSDT',
  'ICPUSDT',
  'KASUSDT',
  'ATOMUSDT',
  'STXUSDT',
  'RUNEUSDT',
  'AAVEUSDT',
  'IMXUSDT',
  'GRTUSDT',
  'FTMUSDT',
  'THETAUSDT',
];

// Blacklist of non-crypto assets (metals, stocks, ETFs)
export const NON_CRYPTO_BLACKLIST = [
  'XAUUSDT',
  'XAGUSDT',
  'SOXLUSDT',
  'SOXSUSDT',
  'SKHYNIXUSDT',
  'KORUUSDT',
  'BZUSDT',
  'CLUSDT',
  'HYPEUSDT',
  'SPCXUSDT',
  'SNDKUSDT',
];

export const NON_CRYPTO_PATTERNS = ['XAU', 'XAG', 'SOX', 'SKH', 'KORU', 'BZ', 'CL', 'SPCX', 'SNDK'];

// In-memory set of verified Perpetual crypto symbols
export const perpetualSymbolsSet = new Set<string>();

/**
 * Filter: strict crypto Futures verification
 */
export function isCryptoFuturesSymbol(symbol: string): boolean {
  if (!symbol || !symbol.endsWith('USDT')) return false;
  const upper = symbol.toUpperCase();
  if (NON_CRYPTO_BLACKLIST.includes(upper)) return false;
  for (const pat of NON_CRYPTO_PATTERNS) {
    if (upper.includes(pat)) return false;
  }
  if (perpetualSymbolsSet.size > 0 && !perpetualSymbolsSet.has(upper)) {
    return false;
  }
  return true;
}

// In-memory cache for dynamic price precision from Binance exchangeInfo
const symbolPrecisionCache: Record<string, number> = {
  BTCUSDT: 1,
  ETHUSDT: 2,
  SOLUSDT: 3,
  BNBUSDT: 2,
  XRPUSDT: 4,
  DOGEUSDT: 5,
  ADAUSDT: 4,
  SUIUSDT: 4,
  PEPEUSDT: 8,
  SHIBUSDT: 8,
};

/**
 * Fetch Exchange Info from Binance Futures to dynamically populate exact pricePrecision and tickSize
 * and verify PERPETUAL crypto contracts
 */
export async function fetchExchangeInfo(): Promise<Record<string, number>> {
  try {
    const res = await axios.get(`${BINANCE_FAPI_BASE}/exchangeInfo`, { timeout: 6000 });
    if (res.data && Array.isArray(res.data.symbols)) {
      res.data.symbols.forEach((s: any) => {
        if (s.symbol && typeof s.pricePrecision === 'number') {
          symbolPrecisionCache[s.symbol] = s.pricePrecision;
        }
        if (s.symbol && s.contractType === 'PERPETUAL' && s.status === 'TRADING') {
          const sym = s.symbol.toUpperCase();
          const isBlacklisted =
            NON_CRYPTO_BLACKLIST.includes(sym) ||
            NON_CRYPTO_PATTERNS.some((p) => sym.includes(p));
          if (!isBlacklisted && sym.endsWith('USDT')) {
            perpetualSymbolsSet.add(sym);
          }
        }
      });
    }
  } catch (e) {
    // Graceful fallback to default/calculated precision
  }
  return symbolPrecisionCache;
}

export function getSymbolPrecision(symbol: string, currentPrice?: number): number {
  if (symbolPrecisionCache[symbol] !== undefined) {
    return symbolPrecisionCache[symbol];
  }
  if (currentPrice !== undefined) {
    return getPricePrecision(currentPrice);
  }
  return 4;
}

// 15-minute in-memory cache to respect rate limit and save bandwidth
const klinesCache = new Map<string, { candles: Candle[]; timestamp: number }>();
export const KLINE_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Fetch 24hr tickers for ALL Binance Futures pairs
 * Excludes non-crypto pairs and symbols with 24h volume < 3 Million USDT
 */
export async function fetch24hTickers(): Promise<Ticker24h[]> {
  try {
    const res = await axios.get(`${BINANCE_FAPI_BASE}/ticker/24hr`, { timeout: 8000 });
    if (Array.isArray(res.data)) {
      const usdtPairs = res.data
        .filter((t: any) => isCryptoFuturesSymbol(t.symbol) && parseFloat(t.quoteVolume) >= 3000000)
        .map((t: any) => ({
          symbol: t.symbol,
          lastPrice: parseFloat(t.lastPrice) || 0,
          priceChangePercent: parseFloat(t.priceChangePercent) || 0,
          highPrice: parseFloat(t.highPrice) || 0,
          lowPrice: parseFloat(t.lowPrice) || 0,
          volume: parseFloat(t.volume) || 0,
          quoteVolume: parseFloat(t.quoteVolume) || 0,
        }))
        .sort((a: Ticker24h, b: Ticker24h) => b.quoteVolume - a.quoteVolume);
      return usdtPairs;
    }
  } catch (error) {
    console.warn('Direct fetch24hTickers failed, trying fallback...', error);
  }

  // Graceful fallback for offline / CORS restricted environment
  return getFallbackTickers().filter((t) => isCryptoFuturesSymbol(t.symbol));
}

/**
 * Fetch Funding Rates from premiumIndex
 */
export async function fetchFundingRates(): Promise<Record<string, number>> {
  try {
    const res = await axios.get(`${BINANCE_FAPI_BASE}/premiumIndex`, { timeout: 5000 });
    const rates: Record<string, number> = {};
    if (Array.isArray(res.data)) {
      res.data.forEach((item: any) => {
        rates[item.symbol] = parseFloat(item.lastFundingRate) || 0.0001;
      });
    }
    return rates;
  } catch (e) {
    return {};
  }
}

/**
 * Fetch Open Interest for a specific symbol
 */
export async function fetchOpenInterest(symbol: string): Promise<number | undefined> {
  try {
    const res = await axios.get(`${BINANCE_FAPI_BASE}/openInterest`, {
      params: { symbol },
      timeout: 4000,
    });
    return parseFloat(res.data.openInterest) || undefined;
  } catch (e) {
    return undefined;
  }
}

// Request rate limiter queue to avoid Binance 429
let lastRequestTime = 0;
const MIN_REQUEST_GAP_MS = 60; // Max ~16 reqs/sec, well within 1200 weight/min

async function throttleRequest(): Promise<void> {
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < MIN_REQUEST_GAP_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_GAP_MS - timeSinceLast));
  }
  lastRequestTime = Date.now();
}

/**
 * Fetch historical Kline Candlesticks with 15-minute caching to avoid Rate Limits
 */
export async function fetchKlines(
  symbol: string,
  interval: Timeframe = '15m',
  limit: number = 250,
  forceRefresh: boolean = false
): Promise<Candle[]> {
  const cacheKey = `${symbol}_${interval}_${limit}`;
  const cached = klinesCache.get(cacheKey);

  // Return from 15-minute cache if available and not forced
  if (!forceRefresh && cached && Date.now() - cached.timestamp < KLINE_CACHE_TTL_MS) {
    return cached.candles;
  }

  await throttleRequest();

  try {
    const res = await axios.get(`${BINANCE_FAPI_BASE}/klines`, {
      params: {
        symbol,
        interval,
        limit,
      },
      timeout: 6000,
    });

    if (Array.isArray(res.data) && res.data.length > 0) {
      const candles: Candle[] = res.data.map((k: any) => ({
        time: Math.floor(k[0] / 1000), // in seconds
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }));

      // Store in 15-minute cache
      klinesCache.set(cacheKey, {
        candles,
        timestamp: Date.now(),
      });

      return candles;
    }
  } catch (error) {
    console.warn(`Direct fetchKlines failed for ${symbol} ${interval}:`, error);
  }

  // If cache had stale data, use that first before fallback generator
  if (cached && cached.candles.length > 0) {
    return cached.candles;
  }

  // Generate realistic candles based on base price if offline
  const fallback = generateFallbackCandles(symbol, interval, limit);
  klinesCache.set(cacheKey, {
    candles: fallback,
    timestamp: Date.now(),
  });
  return fallback;
}

/**
 * Fallback Tickers with realistic prices
 */
function getFallbackTickers(): Ticker24h[] {
  const basePrices: Record<string, { price: number; change: number; vol: number }> = {
    BTCUSDT: { price: 88450.0, change: 2.85, vol: 3200000000 },
    ETHUSDT: { price: 2650.5, change: 3.42, vol: 1850000000 },
    SOLUSDT: { price: 182.2, change: 5.61, vol: 1200000000 },
    BNBUSDT: { price: 624.8, change: 1.15, vol: 480000000 },
    XRPUSDT: { price: 1.48, change: 8.75, vol: 920000000 },
    DOGEUSDT: { price: 0.224, change: 4.10, vol: 780000000 },
    ADAUSDT: { price: 0.765, change: 2.12, vol: 410000000 },
    SUIUSDT: { price: 2.95, change: 6.84, vol: 640000000 },
    PEPEUSDT: { price: 0.00001248, change: 4.82, vol: 550000000 },
    AVAXUSDT: { price: 28.6, change: 2.05, vol: 310000000 },
    LINKUSDT: { price: 16.4, change: 3.90, vol: 290000000 },
    NEARUSDT: { price: 5.34, change: 4.50, vol: 330000000 },
    APTUSDT: { price: 9.85, change: -0.65, vol: 220000000 },
    ARBUSDT: { price: 0.68, change: 1.20, vol: 190000000 },
    OPUSDT: { price: 1.54, change: 2.10, vol: 180000000 },
    RENDERUSDT: { price: 6.12, change: 5.30, vol: 210000000 },
    FETUSDT: { price: 1.28, change: 3.80, vol: 195000000 },
    TIAUSDT: { price: 4.95, change: -2.10, vol: 160000000 },
    INJUSDT: { price: 19.8, change: 3.15, vol: 175000000 },
    SHIBUSDT: { price: 0.00001925, change: 1.85, vol: 240000000 },
  };

  return Object.entries(basePrices).map(([sym, data]) => ({
    symbol: sym,
    lastPrice: data.price,
    priceChangePercent: data.change,
    highPrice: data.price * 1.03,
    lowPrice: data.price * 0.97,
    volume: data.vol / data.price,
    quoteVolume: data.vol,
    fundingRate: 0.00012,
  }));
}

/**
 * Fallback Candles Generator with full micro-price precision
 */
export function generateFallbackCandles(symbol: string, interval: Timeframe, count = 250): Candle[] {
  let basePrice = 88000;
  if (symbol.startsWith('ETH')) basePrice = 2650;
  else if (symbol.startsWith('SOL')) basePrice = 180;
  else if (symbol.startsWith('BNB')) basePrice = 620;
  else if (symbol.startsWith('XRP')) basePrice = 1.45;
  else if (symbol.startsWith('DOGE')) basePrice = 0.224;
  else if (symbol.startsWith('SUI')) basePrice = 2.95;
  else if (symbol.startsWith('PEPE')) basePrice = 0.00001248;
  else if (symbol.startsWith('SHIB')) basePrice = 0.00001925;

  const secondsPerInterval: Record<Timeframe, number> = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '1h': 3600,
    '4h': 14400,
    '1d': 86400,
    '3d': 259200,
    '1w': 604800,
  };

  const stepSec = secondsPerInterval[interval] || 900;
  const now = Math.floor(Date.now() / 1000);
  const startTime = now - count * stepSec;

  const candles: Candle[] = [];
  let current = basePrice * 0.95;
  const decimals = getPricePrecision(basePrice);

  for (let i = 0; i < count; i++) {
    const time = startTime + i * stepSec;
    const change = (Math.random() - 0.48) * 0.015 * current;
    const open = current;
    const close = Math.max(0.00000001, open + change);
    const high = Math.max(open, close) + Math.random() * 0.008 * current;
    const low = Math.min(open, close) - Math.random() * 0.008 * current;
    const volume = Math.random() * 50000 + 5000;

    candles.push({
      time,
      open: Number(open.toFixed(decimals)),
      high: Number(high.toFixed(decimals)),
      low: Number(low.toFixed(decimals)),
      close: Number(close.toFixed(decimals)),
      volume: Math.round(volume),
    });

    current = close;
  }

  return candles;
}
