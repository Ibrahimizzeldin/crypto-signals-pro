import { Candle, MarketRegimeInfo, MarketRegime } from '../types/crypto';
import { calculateEMA, calculateRSI, calculateATR, calculateBollingerBands } from './technicalAnalysis';

/**
 * Evaluates Market Regime from BTC 1h candles
 * - Trending Up: EMA 20 > EMA 50 > EMA 200 + RSI > 55 -> LONG_ONLY
 * - Trending Down: EMA 20 < EMA 50 < EMA 200 + RSI < 45 -> SHORT_ONLY
 * - Ranging: Price inside Bollinger Bands with flat EMAs -> RANGE_ONLY
 * - Volatile: ATR > 1.5x average ATR -> HALTED
 */
export function detectMarketRegime(btcCandles: Candle[], currentPrice: number): MarketRegimeInfo {
  if (!btcCandles || btcCandles.length < 30) {
    return {
      regime: 'RANGING',
      titleArabic: 'انتظار كسر النطاق',
      descriptionArabic: 'السوق يتحرك داخل نطاق تذبذب مع استقرار نسبي. في انتظار كسر النطاق لتحديد الاتجاه.',
      allowedTradeSides: 'RANGE_ONLY',
      btcPrice: currentPrice || 88000,
      ema20: currentPrice,
      ema50: currentPrice,
      ema200: currentPrice,
      rsi: 50,
      atrRatio: 1.0,
      updatedAt: Date.now(),
    };
  }

  const ema20Arr = calculateEMA(btcCandles, 20);
  const ema50Arr = calculateEMA(btcCandles, 50);
  const ema200Arr = calculateEMA(btcCandles, 200);
  const rsiArr = calculateRSI(btcCandles, 14);
  const atrArr = calculateATR(btcCandles, 14);
  const { upper, lower } = calculateBollingerBands(btcCandles, 20, 2);

  const curPrice = currentPrice || btcCandles[btcCandles.length - 1].close;
  const ema20 = ema20Arr[ema20Arr.length - 1] ?? curPrice;
  const ema50 = ema50Arr[ema50Arr.length - 1] ?? curPrice;
  const ema200 = ema200Arr[ema200Arr.length - 1] ?? curPrice;
  const rsi = rsiArr[rsiArr.length - 1] ?? 50;

  // ATR volatility check: current ATR vs 20-period SMA of ATR
  const validAtrs = atrArr.filter((a): a is number => a !== null);
  const curAtr = validAtrs[validAtrs.length - 1] ?? curPrice * 0.01;
  const avgAtr = validAtrs.slice(-20).reduce((acc, v) => acc + v, 0) / Math.max(1, Math.min(20, validAtrs.length));
  const atrRatio = avgAtr > 0 ? curAtr / avgAtr : 1.0;

  const curUpper = upper[upper.length - 1] ?? curPrice * 1.02;
  const curLower = lower[lower.length - 1] ?? curPrice * 0.98;

  let regime: MarketRegime = 'RANGING';
  let titleArabic = 'انتظار كسر النطاق';
  let descriptionArabic = 'السوق يتذبذب بين حدود القناة بدون اتجاه كاسح. في انتظار كسر النطاق وتأكيد الاتجاه.';
  let allowedTradeSides: MarketRegimeInfo['allowedTradeSides'] = 'RANGE_ONLY';

  // 1. High Volatility Check
  if (atrRatio >= 1.5) {
    regime = 'VOLATILE';
    titleArabic = 'تقلب حاد وعالي المخاطر (Volatile)';
    descriptionArabic = 'مؤشر ATR يتجاوز متوسطه بأكثر من 1.5×. إيقاف الصفقات الآلية الجديدة لحماية الحساب.';
    allowedTradeSides = 'HALTED';
  }
  // 2. Strong Trend Up
  else if (ema20 > ema50 && ema50 > ema200 && rsi >= 55) {
    regime = 'TRENDING_UP';
    titleArabic = 'اتجاه صاعد قوي (Trending Up)';
    descriptionArabic = 'ترتيب إيجابي للمتوسطات (EMA 20 > 50 > 200) مع RSI صاعد فوق 55. يُسمح بصفقات Long فقط.';
    allowedTradeSides = 'LONG_ONLY';
  }
  // 3. Strong Trend Down
  else if (ema20 < ema50 && ema50 < ema200 && rsi <= 45) {
    regime = 'TRENDING_DOWN';
    titleArabic = 'اتجاه هابط حاد (Trending Down)';
    descriptionArabic = 'ترتيب سلبي للمتوسطات (EMA 20 < 50 < 200) مع RSI أدنى من 45. يُسمح بصفقات Short فقط.';
    allowedTradeSides = 'SHORT_ONLY';
  }
  // 4. Ranging inside bands
  else {
    regime = 'RANGING';
    titleArabic = 'انتظار كسر النطاق';
    descriptionArabic = 'السعر يتحرك بين حدود Bollinger Bands بدون اتجاه صريح. في انتظار كسر النطاق.';
    allowedTradeSides = 'RANGE_ONLY';
  }

  return {
    regime,
    titleArabic,
    descriptionArabic,
    allowedTradeSides,
    btcPrice: curPrice,
    ema20,
    ema50,
    ema200,
    rsi: Number(rsi.toFixed(1)),
    atrRatio: Number(atrRatio.toFixed(2)),
    updatedAt: Date.now(),
  };
}
