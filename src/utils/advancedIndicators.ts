import { Candle, SmartMoneyConcepts, IchimokuValues, PivotPointsData, OrderBlock, FairValueGap } from '../types/crypto';

/**
 * Calculates Volume Weighted Average Price (VWAP)
 */
export function calculateVWAP(candles: Candle[]): (number | null)[] {
  if (!candles || candles.length === 0) return [];
  const result: (number | null)[] = [];
  let cumulativeTypicalPriceVolume = 0;
  let cumulativeVolume = 0;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const typicalPrice = (c.high + c.low + c.close) / 3;
    const vol = c.volume > 0 ? c.volume : 1;

    cumulativeTypicalPriceVolume += typicalPrice * vol;
    cumulativeVolume += vol;

    if (cumulativeVolume > 0) {
      result.push(cumulativeTypicalPriceVolume / cumulativeVolume);
    } else {
      result.push(typicalPrice);
    }
  }

  return result;
}

/**
 * Calculates Ichimoku Cloud (Tenkan-sen 9, Kijun-sen 26, Senkou A 26, Senkou B 52)
 */
export function calculateIchimoku(candles: Candle[]): IchimokuValues[] {
  if (!candles || candles.length === 0) return [];

  const getHighLowMid = (slice: Candle[]) => {
    if (slice.length === 0) return 0;
    let high = -Infinity;
    let low = Infinity;
    for (const c of slice) {
      if (c.high > high) high = c.high;
      if (c.low < low) low = c.low;
    }
    return (high + low) / 2;
  };

  const results: IchimokuValues[] = [];

  for (let i = 0; i < candles.length; i++) {
    const tenkanSlice = candles.slice(Math.max(0, i - 8), i + 1);
    const kijunSlice = candles.slice(Math.max(0, i - 25), i + 1);
    const senkouBSlice = candles.slice(Math.max(0, i - 51), i + 1);

    const tenkan = i >= 8 ? getHighLowMid(tenkanSlice) : null;
    const kijun = i >= 25 ? getHighLowMid(kijunSlice) : null;
    const senkouA = tenkan !== null && kijun !== null ? (tenkan + kijun) / 2 : null;
    const senkouB = i >= 51 ? getHighLowMid(senkouBSlice) : null;
    const chikou = i + 26 < candles.length ? candles[i + 26].close : candles[i].close;

    results.push({
      tenkan,
      kijun,
      senkouA,
      senkouB,
      chikou,
    });
  }

  return results;
}

/**
 * Calculates Classic Standard Pivot Points from previous high, low, close
 */
export function calculatePivotPoints(prevHigh: number, prevLow: number, prevClose: number): PivotPointsData {
  const pivot = (prevHigh + prevLow + prevClose) / 3;
  const r1 = 2 * pivot - prevLow;
  const s1 = 2 * pivot - prevHigh;
  const r2 = pivot + (prevHigh - prevLow);
  const s2 = pivot - (prevHigh - prevLow);
  const r3 = prevHigh + 2 * (pivot - prevLow);
  const s3 = prevLow - 2 * (prevHigh - pivot);

  return { pivot, r1, r2, r3, s1, s2, s3 };
}

/**
 * Calculates Fibonacci Retracement & Extension levels from swing low to swing high
 */
export function calculateFibonacciLevels(swingLow: number, swingHigh: number, isBullish: boolean) {
  const diff = Math.abs(swingHigh - swingLow);
  if (isBullish) {
    return {
      fib0: swingHigh,
      fib236: swingHigh - diff * 0.236,
      fib382: swingHigh - diff * 0.382,
      fib500: swingHigh - diff * 0.5,
      fib618: swingHigh - diff * 0.618,
      fib786: swingHigh - diff * 0.786,
      fib1000: swingLow,
      ext1272: swingHigh + diff * 0.272,
      ext1618: swingHigh + diff * 0.618,
    };
  } else {
    return {
      fib0: swingLow,
      fib236: swingLow + diff * 0.236,
      fib382: swingLow + diff * 0.382,
      fib500: swingLow + diff * 0.5,
      fib618: swingLow + diff * 0.618,
      fib786: swingLow + diff * 0.786,
      fib1000: swingHigh,
      ext1272: swingLow - diff * 0.272,
      ext1618: swingLow - diff * 0.618,
    };
  }
}

/**
 * Smart Money Concepts (SMC):
 * - Order Blocks (OB)
 * - Fair Value Gaps (FVG)
 * - Break of Structure (BOS) / Change of Character (CHoCH)
 * - Equal Highs (EQH) / Equal Lows (EQL)
 */
export function detectSmartMoneyConcepts(candles: Candle[], atr: number): SmartMoneyConcepts {
  const orderBlocks: OrderBlock[] = [];
  const fvgList: FairValueGap[] = [];
  const equalHighs: number[] = [];
  const equalLows: number[] = [];
  let bos: { type: 'BULLISH' | 'BEARISH'; price: number; index: number } | null = null;
  let choch: { type: 'BULLISH' | 'BEARISH'; price: number; index: number } | null = null;

  if (candles.length < 15) {
    return { orderBlocks, fvgList, bos, choch, equalHighs, equalLows };
  }

  const len = candles.length;

  // 1. Fair Value Gaps (FVG) detection across 3-candle patterns
  for (let i = 2; i < len; i++) {
    const c1 = candles[i - 2];
    const c2 = candles[i - 1];
    const c3 = candles[i];

    // Bullish FVG: Candle 1 High < Candle 3 Low (Gap in Candle 2)
    if (c3.low > c1.high && (c3.low - c1.high) >= atr * 0.3) {
      // Check if mitigated by current price
      const latestClose = candles[len - 1].close;
      const filled = latestClose <= c1.high;
      fvgList.push({
        type: 'BULLISH',
        top: c3.low,
        bottom: c1.high,
        index: i - 1,
        filled,
      });
    }

    // Bearish FVG: Candle 1 Low > Candle 3 High (Gap in Candle 2)
    if (c1.low > c3.high && (c1.low - c3.high) >= atr * 0.3) {
      const latestClose = candles[len - 1].close;
      const filled = latestClose >= c1.low;
      fvgList.push({
        type: 'BEARISH',
        top: c1.low,
        bottom: c3.high,
        index: i - 1,
        filled,
      });
    }
  }

  // 2. Order Blocks (OB): Last opposite candle before large displacement candle
  for (let i = 3; i < len - 1; i++) {
    const prev = candles[i - 1];
    const cur = candles[i];
    const next = candles[i + 1];

    const bodyCur = Math.abs(cur.close - cur.open);
    const isDisplacement = bodyCur >= atr * 1.4;

    // Bullish OB: prev is bearish candle, followed by strong bullish displacement
    if (prev.close < prev.open && cur.close > cur.open && isDisplacement) {
      const mitigated = candles[len - 1].close < prev.low;
      orderBlocks.push({
        type: 'BULLISH',
        high: prev.high,
        low: prev.low,
        startIndex: i - 1,
        mitigated,
      });
    }

    // Bearish OB: prev is bullish candle, followed by strong bearish displacement
    if (prev.close > prev.open && cur.close < cur.open && isDisplacement) {
      const mitigated = candles[len - 1].close > prev.high;
      orderBlocks.push({
        type: 'BEARISH',
        high: prev.high,
        low: prev.low,
        startIndex: i - 1,
        mitigated,
      });
    }
  }

  // 3. Liquidity Zones: Equal Highs (EQH) and Equal Lows (EQL) within 0.12% tolerance
  for (let i = 5; i < len - 3; i++) {
    for (let j = i + 3; j < len; j++) {
      const diffHigh = Math.abs(candles[i].high - candles[j].high);
      if (diffHigh / candles[i].high < 0.0015) {
        equalHighs.push((candles[i].high + candles[j].high) / 2);
      }
      const diffLow = Math.abs(candles[i].low - candles[j].low);
      if (diffLow / candles[i].low < 0.0015) {
        equalLows.push((candles[i].low + candles[j].low) / 2);
      }
    }
  }

  // 4. BOS and CHoCH detection from recent swing points
  const recentSlice = candles.slice(-25);
  let highest = -Infinity;
  let highestIdx = 0;
  let lowest = Infinity;
  let lowestIdx = 0;

  recentSlice.forEach((c, idx) => {
    if (c.high > highest) {
      highest = c.high;
      highestIdx = idx;
    }
    if (c.low < lowest) {
      lowest = c.low;
      lowestIdx = idx;
    }
  });

  const lastCandle = candles[len - 1];
  if (lastCandle.close > highest && highestIdx < recentSlice.length - 1) {
    bos = { type: 'BULLISH', price: highest, index: len - 1 };
  } else if (lastCandle.close < lowest && lowestIdx < recentSlice.length - 1) {
    bos = { type: 'BEARISH', price: lowest, index: len - 1 };
  }

  // CHoCH if breaking previous counter-trend swing
  const prevTrendIsDown = candles[len - 15]?.close > candles[len - 5]?.close;
  if (prevTrendIsDown && lastCandle.close > highest) {
    choch = { type: 'BULLISH', price: highest, index: len - 1 };
  } else if (!prevTrendIsDown && lastCandle.close < lowest) {
    choch = { type: 'BEARISH', price: lowest, index: len - 1 };
  }

  return {
    orderBlocks: orderBlocks.slice(-4), // keep latest 4
    fvgList: fvgList.slice(-4),
    bos,
    choch,
    equalHighs: Array.from(new Set(equalHighs.slice(-2))),
    equalLows: Array.from(new Set(equalLows.slice(-2))),
  };
}
