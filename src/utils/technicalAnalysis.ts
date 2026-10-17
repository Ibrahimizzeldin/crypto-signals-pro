import { Candle, SupportResistance } from '../types/crypto';

/**
 * Calculates Exponential Moving Average (EMA) with adaptive seeding to prevent broken lines
 */
export function calculateEMA(candles: Candle[], period: number): (number | null)[] {
  if (candles.length < 5) return candles.map(() => null);

  // If candles.length is less than requested period, adapt seed so EMA 200 line does not break
  const effectivePeriod = Math.min(period, Math.max(10, Math.floor(candles.length / 2)));
  const k = 2 / (period + 1);
  const result: (number | null)[] = [];

  // Initial SMA as seed
  let sum = 0;
  for (let i = 0; i < effectivePeriod; i++) {
    sum += candles[i].close;
    result.push(null);
  }

  let prevEMA = sum / effectivePeriod;
  result[effectivePeriod - 1] = prevEMA;

  for (let i = effectivePeriod; i < candles.length; i++) {
    const currentEMA = candles[i].close * k + prevEMA * (1 - k);
    result.push(currentEMA);
    prevEMA = currentEMA;
  }

  return result;
}

/**
 * Calculates Relative Strength Index (RSI - 14)
 */
export function calculateRSI(candles: Candle[], period: number = 14): (number | null)[] {
  if (candles.length <= period) return candles.map(() => null);

  const result: (number | null)[] = [null];
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses -= diff;
    result.push(null);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result[period] = 100 - 100 / (1 + rs);

  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs));
  }

  return result;
}

/**
 * Calculates MACD (12, 26, 9)
 */
export function calculateMACD(
  candles: Candle[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
) {
  const fastEMA = calculateEMA(candles, fastPeriod);
  const slowEMA = calculateEMA(candles, slowPeriod);

  const macdLine: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    const fast = fastEMA[i];
    const slow = slowEMA[i];
    if (fast !== null && slow !== null) {
      macdLine.push(fast - slow);
    } else {
      macdLine.push(null);
    }
  }

  // Calculate signal line of macdLine
  const validMacdIndices = macdLine
    .map((val, idx) => (val !== null ? { val, idx } : null))
    .filter((x): x is { val: number; idx: number } => x !== null);

  const signalLine: (number | null)[] = candles.map(() => null);
  const histogram: (number | null)[] = candles.map(() => null);

  if (validMacdIndices.length >= signalPeriod) {
    const k = 2 / (signalPeriod + 1);
    let sum = 0;
    for (let i = 0; i < signalPeriod; i++) {
      sum += validMacdIndices[i].val;
    }
    let prevSignal = sum / signalPeriod;
    const firstSignalIdx = validMacdIndices[signalPeriod - 1].idx;
    signalLine[firstSignalIdx] = prevSignal;
    histogram[firstSignalIdx] = (macdLine[firstSignalIdx] ?? 0) - prevSignal;

    for (let i = signalPeriod; i < validMacdIndices.length; i++) {
      const idx = validMacdIndices[i].idx;
      const macdVal = validMacdIndices[i].val;
      const currentSignal = macdVal * k + prevSignal * (1 - k);
      signalLine[idx] = currentSignal;
      histogram[idx] = macdVal - currentSignal;
      prevSignal = currentSignal;
    }
  }

  return { macdLine, signalLine, histogram };
}

/**
 * Calculates Bollinger Bands (20, 2)
 */
export function calculateBollingerBands(candles: Candle[], period = 20, multiplier = 2) {
  const upper: (number | null)[] = [];
  const middle: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      upper.push(null);
      middle.push(null);
      lower.push(null);
      continue;
    }

    const slice = candles.slice(i - period + 1, i + 1);
    const sum = slice.reduce((acc, c) => acc + c.close, 0);
    const mean = sum / period;

    const variance = slice.reduce((acc, c) => acc + Math.pow(c.close - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    upper.push(mean + multiplier * stdDev);
    middle.push(mean);
    lower.push(mean - multiplier * stdDev);
  }

  return { upper, middle, lower };
}

/**
 * Calculates Average True Range (ATR - 14)
 */
export function calculateATR(candles: Candle[], period = 14): (number | null)[] {
  if (candles.length < 2) return candles.map(() => null);

  const tr: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    const hl = candles[i].high - candles[i].low;
    const hc = Math.abs(candles[i].high - candles[i - 1].close);
    const lc = Math.abs(candles[i].low - candles[i - 1].close);
    tr.push(Math.max(hl, hc, lc));
  }

  const atr: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      atr.push(null);
      continue;
    }
    if (i === period - 1) {
      const sum = tr.slice(0, period).reduce((a, b) => a + b, 0);
      atr.push(sum / period);
      continue;
    }
    const prevAtr = atr[i - 1]!;
    const curAtr = (prevAtr * (period - 1) + tr[i]) / period;
    atr.push(curAtr);
  }

  return atr;
}

/**
 * Calculates 20-period Volume Simple Moving Average
 */
export function calculateVolumeSMA(candles: Candle[], period = 20): (number | null)[] {
  const result: (number | null)[] = [];
  let sum = 0;

  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].volume;
    if (i < period - 1) {
      result.push(null);
    } else {
      if (i >= period) {
        sum -= candles[i - period].volume;
      }
      result.push(sum / period);
    }
  }

  return result;
}

export interface PivotPoints {
  swingHighs: { price: number; index: number }[];
  swingLows: { price: number; index: number }[];
  lastSwingHigh: number;
  lastSwingLow: number;
}

/**
 * Extracts recent swing highs and swing lows (pivots)
 */
export function detectPivots(candles: Candle[], window = 4): PivotPoints {
  const swingHighs: { price: number; index: number }[] = [];
  const swingLows: { price: number; index: number }[] = [];

  if (candles.length < window * 2 + 1) {
    const high = Math.max(...candles.map((c) => c.high));
    const low = Math.min(...candles.map((c) => c.low));
    return {
      swingHighs: [{ price: high, index: 0 }],
      swingLows: [{ price: low, index: 0 }],
      lastSwingHigh: high,
      lastSwingLow: low,
    };
  }

  for (let i = window; i < candles.length - 1; i++) {
    const cur = candles[i];
    let isHigh = true;
    let isLow = true;

    for (let j = 1; j <= window; j++) {
      if (candles[i - j].high > cur.high || (candles[i + j] && candles[i + j].high > cur.high)) {
        isHigh = false;
      }
      if (candles[i - j].low < cur.low || (candles[i + j] && candles[i + j].low < cur.low)) {
        isLow = false;
      }
    }

    if (isHigh) swingHighs.push({ price: cur.high, index: i });
    if (isLow) swingLows.push({ price: cur.low, index: i });
  }

  const lastHigh = swingHighs.length > 0 ? swingHighs[swingHighs.length - 1].price : candles[candles.length - 1].high;
  const lastLow = swingLows.length > 0 ? swingLows[swingLows.length - 1].price : candles[candles.length - 1].low;

  return {
    swingHighs,
    swingLows,
    lastSwingHigh: lastHigh,
    lastSwingLow: lastLow,
  };
}

/**
 * Detects RSI Divergence between price pivots and RSI
 */
export function detectRSIDivergence(candles: Candle[], rsiValues: (number | null)[]): 'BULLISH_DIV' | 'BEARISH_DIV' | 'NONE' {
  if (candles.length < 25 || rsiValues.length < 25) return 'NONE';

  const len = candles.length;
  const c1 = candles[len - 1];
  const c2 = candles[len - 8];
  const r1 = rsiValues[len - 1];
  const r2 = rsiValues[len - 8];

  if (r1 === null || r2 === null) return 'NONE';

  // Regular Bullish Divergence: Lower Low in Price, Higher Low in RSI
  if (c1.low < c2.low * 0.998 && r1 > r2 + 2 && r1 <= 40) {
    return 'BULLISH_DIV';
  }

  // Regular Bearish Divergence: Higher High in Price, Lower High in RSI
  if (c1.high > c2.high * 1.002 && r1 < r2 - 2 && r1 >= 60) {
    return 'BEARISH_DIV';
  }

  return 'NONE';
}

/**
 * Checks if any of the last 3 candles is a giant opposing candle (> 1.6x ATR)
 */
export function hasGiantOpposingCandle(candles: Candle[], atr: number, side: 'LONG' | 'SHORT'): boolean {
  if (candles.length < 4 || atr <= 0) return false;

  const last3 = candles.slice(-3);
  for (const c of last3) {
    const body = Math.abs(c.close - c.open);
    if (side === 'LONG' && c.close < c.open && body >= atr * 1.6) {
      return true; // Large red dump candle opposes Long
    }
    if (side === 'SHORT' && c.close > c.open && body >= atr * 1.6) {
      return true; // Large green pump candle opposes Short
    }
  }

  return false;
}

/**
 * Detects dynamic Support and Resistance levels from pivot highs and lows
 */
export function calculateSupportResistance(candles: Candle[], currentPrice: number): SupportResistance {
  if (candles.length < 10) {
    const dummyRange = currentPrice * 0.02;
    return {
      resistances: [currentPrice + dummyRange, currentPrice + dummyRange * 2],
      supports: [currentPrice - dummyRange, currentPrice - dummyRange * 2],
      nearestResistance: currentPrice + dummyRange,
      nearestSupport: currentPrice - dummyRange,
    };
  }

  const { swingHighs, swingLows } = detectPivots(candles, 4);

  // Filter levels: resistances > currentPrice, supports < currentPrice
  const resistances = Array.from(new Set(swingHighs.map((h) => h.price).filter((p) => p > currentPrice))).sort((a, b) => a - b);
  const supports = Array.from(new Set(swingLows.map((l) => l.price).filter((p) => p < currentPrice))).sort((a, b) => b - a);

  const fallbackStep = currentPrice * 0.015;

  const nearestResistance = resistances.length > 0 ? resistances[0] : currentPrice + fallbackStep;
  const secondResistance = resistances.length > 1 ? resistances[1] : nearestResistance + fallbackStep;

  const nearestSupport = supports.length > 0 ? supports[0] : currentPrice - fallbackStep;
  const secondSupport = supports.length > 1 ? supports[1] : nearestSupport - fallbackStep;

  return {
    resistances: [nearestResistance, secondResistance],
    supports: [nearestSupport, secondSupport],
    nearestResistance,
    nearestSupport,
  };
}
