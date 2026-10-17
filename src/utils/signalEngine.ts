import {
  Candle,
  MultiTimeframeAnalysis,
  SignalType,
  DirectionType,
  Timeframe,
  TimeframeSignal,
  TradeTarget,
  SetupPattern,
  TradeExecutionStatus,
} from '../types/crypto';
import {
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateATR,
  calculateSupportResistance,
  calculateVolumeSMA,
  detectPivots,
  detectRSIDivergence,
  hasGiantOpposingCandle,
} from './technicalAnalysis';
import { getPricePrecision, formatPrice } from './formatters';
import { classifyBtcCorrelation } from './btcCorrelation';
import {
  getProjectStrengthScore,
  getProjectScoreConfidenceModifier,
} from '../services/projectStrengthService';

/**
 * Analyzes a single timeframe's candles to produce individual direction and score
 */
export function analyzeSingleTimeframe(candles: Candle[], tf: Timeframe): TimeframeSignal {
  if (!candles || candles.length < 20) {
    return {
      timeframe: tf,
      direction: 'محايد',
      signal: 'انتظار',
      strength: 'منخفضة',
      score: 0,
      rsi: 50,
      trendReason: 'بيانات غير كافية',
    };
  }

  const lastCandle = candles[candles.length - 1];
  const currentPrice = lastCandle.close;

  const ema20 = calculateEMA(candles, 20);
  const ema50 = calculateEMA(candles, 50);
  const rsi = calculateRSI(candles, 14);
  const { histogram } = calculateMACD(candles, 12, 26, 9);
  const { upper, lower } = calculateBollingerBands(candles, 20, 2);

  const curEMA20 = ema20[ema20.length - 1] ?? currentPrice;
  const curEMA50 = ema50[ema50.length - 1] ?? currentPrice;
  const curRSI = Math.round((rsi[rsi.length - 1] ?? 50) * 10) / 10;
  const curHist = histogram[histogram.length - 1] ?? 0;
  const prevHist = histogram[histogram.length - 2] ?? 0;
  const curLowerBB = lower[lower.length - 1] ?? currentPrice * 0.98;
  const curUpperBB = upper[upper.length - 1] ?? currentPrice * 1.02;

  let score = 0; // -100 to +100
  const reasons: string[] = [];

  // 1. EMA Trend
  if (curEMA20 > curEMA50 && currentPrice >= curEMA20) {
    score += 40;
    reasons.push('EMA20 فوق EMA50 والسعر أعلى منهما');
  } else if (curEMA20 < curEMA50 && currentPrice <= curEMA20) {
    score -= 40;
    reasons.push('EMA20 تحت EMA50 والسعر أدنى منهما');
  } else if (currentPrice > curEMA20) {
    score += 15;
  } else {
    score -= 15;
  }

  // 2. RSI Assessment
  if (curRSI <= 32) {
    score += 25;
    reasons.push(`تشبع بيعي RSI (${curRSI})`);
  } else if (curRSI >= 68) {
    score -= 25;
    reasons.push(`تشبع شرائي RSI (${curRSI})`);
  } else if (curRSI > 52) {
    score += 15;
  } else if (curRSI < 48) {
    score -= 15;
  }

  // 3. MACD Momentum
  if (curHist > 0 && curHist > prevHist) {
    score += 25;
    reasons.push('زخم MACD إيجابي صاعد');
  } else if (curHist < 0 && curHist < prevHist) {
    score -= 25;
    reasons.push('زخم MACD سلبي هابط');
  }

  // 4. Bollinger Bands Touch
  if (currentPrice <= curLowerBB * 1.002) {
    score += 15;
  } else if (currentPrice >= curUpperBB * 0.998) {
    score -= 15;
  }

  let direction: 'صاعد' | 'هابط' | 'محايد' = 'محايد';
  let signal: 'شراء' | 'بيع' | 'انتظار' = 'انتظار';
  let strength: 'عالية' | 'متوسطة' | 'منخفضة' = 'منخفضة';

  if (score >= 40) {
    direction = 'صاعد';
    signal = 'شراء';
    strength = score >= 65 ? 'عالية' : 'متوسطة';
  } else if (score <= -40) {
    direction = 'هابط';
    signal = 'بيع';
    strength = score <= -65 ? 'عالية' : 'متوسطة';
  } else {
    direction = 'محايد';
    signal = 'انتظار';
    strength = 'منخفضة';
  }

  return {
    timeframe: tf,
    direction,
    signal,
    strength,
    score,
    rsi: curRSI,
    trendReason: reasons.join(' + ') || 'تذبذب واستقرار سعري',
  };
}

/**
 * Executes Professional Multi-Timeframe Analysis Engine
 */
export function buildMultiTimeframeAnalysis(
  symbol: string,
  timeframeCandles: Record<Timeframe, Candle[]>,
  currentPrice: number,
  fundingRate: number = 0.0001
): MultiTimeframeAnalysis {
  const timeframes: Timeframe[] = ['15m', '1h', '4h', '1d', '3d', '1w'];

  // 1. Analyze each timeframe individually
  const timeframeResults: Record<Timeframe, TimeframeSignal> = {
    '15m': analyzeSingleTimeframe(timeframeCandles['15m'] || [], '15m'),
    '1h': analyzeSingleTimeframe(timeframeCandles['1h'] || [], '1h'),
    '4h': analyzeSingleTimeframe(timeframeCandles['4h'] || [], '4h'),
    '1d': analyzeSingleTimeframe(timeframeCandles['1d'] || [], '1d'),
    '3d': analyzeSingleTimeframe(timeframeCandles['3d'] || [], '3d'),
    '1w': analyzeSingleTimeframe(timeframeCandles['1w'] || [], '1w'),
    '5m': analyzeSingleTimeframe(timeframeCandles['5m'] || [], '5m'),
    '1m': analyzeSingleTimeframe(timeframeCandles['1m'] || [], '1m'),
  };

  // 2. Multi-timeframe agreement counting
  // Small timeframes (15m, 1h) for entry, 4h for confirmation, 1d, 3d, 1w for macro trend
  let buyVotes = 0;
  let sellVotes = 0;

  timeframes.forEach((tf) => {
    const res = timeframeResults[tf];
    if (res.direction === 'صاعد') buyVotes++;
    if (res.direction === 'هابط') sellVotes++;
  });

  const isBullish = buyVotes >= sellVotes;
  let setupDirection: DirectionType = isBullish ? 'BULLISH' : 'BEARISH';
  const matchingTimeframesCount = isBullish ? buyVotes : sellVotes;

  // 3. Technical & Price Action Context on Execution Timeframe (15m / 1h)
  const execCandles = (timeframeCandles['15m'] && timeframeCandles['15m'].length >= 20)
    ? timeframeCandles['15m']
    : (timeframeCandles['1h'] && timeframeCandles['1h'].length >= 20)
    ? timeframeCandles['1h']
    : (timeframeCandles['4h'] || []);

  const sr = calculateSupportResistance(execCandles, currentPrice);
  const atrArray = calculateATR(execCandles, 14);
  const curAtr = atrArray[atrArray.length - 1] ?? currentPrice * 0.012;

  const ema20Arr = calculateEMA(execCandles, 20);
  const ema50Arr = calculateEMA(execCandles, 50);
  const ema200Arr = calculateEMA(execCandles, 200);
  const curEMA20 = ema20Arr[ema20Arr.length - 1] ?? currentPrice;
  const curEMA50 = ema50Arr[ema50Arr.length - 1] ?? currentPrice;
  const curEMA200 = ema200Arr[ema200Arr.length - 1] ?? currentPrice;

  const volSMA = calculateVolumeSMA(execCandles, 20);
  const lastVol = execCandles[execCandles.length - 1]?.volume ?? 1;
  const avgVol = volSMA[volSMA.length - 1] ?? lastVol;
  const volRatio = avgVol > 0 ? Number((lastVol / avgVol).toFixed(2)) : 1.0;

  const rsiArr = calculateRSI(execCandles, 14);
  const curRsi = rsiArr[rsiArr.length - 1] ?? 50;
  const rsiDiv = detectRSIDivergence(execCandles, rsiArr);
  const { histogram } = calculateMACD(execCandles, 12, 26, 9);
  const curHist = histogram[histogram.length - 1] ?? 0;
  const prevHist = histogram[histogram.length - 2] ?? 0;

  const pivots = detectPivots(execCandles, 5);
  const swingHigh = pivots.lastSwingHigh;
  const swingLow = pivots.lastSwingLow;
  const swingRange = Math.max(curAtr * 2, Math.abs(swingHigh - swingLow));

  // 4. Pattern Recognition (Breakout, Retest, Pullback, Reversal, Range)
  let setupPattern: SetupPattern = 'PULLBACK';
  let patternNameArabic = 'Pullback (تصحيح داخل الترند)';
  const conditionsMet: string[] = [];
  const warnings: string[] = [];

  // Check Volume confirmation
  if (volRatio >= 2.0) {
    conditionsMet.push(`حجم تداول استثنائي (${volRatio.toFixed(1)}× أعلى من المتوسط بـ 2×)`);
  } else if (volRatio >= 1.5) {
    conditionsMet.push(`حجم تداول نشط (${volRatio.toFixed(1)}× أعلى من المتوسط بـ 1.5×)`);
  } else if (volRatio >= 1.2) {
    conditionsMet.push(`حجم تداول معتدل (${volRatio.toFixed(1)}×)`);
  }

  // Check timeframe agreement
  if (matchingTimeframesCount >= 3) {
    conditionsMet.push(`توافق ${matchingTimeframesCount} من 6 فريمات رئيسية`);
  }

  // Enhanced Breakout Detection:
  // - 1h or higher timeframe only (never 15m or 5m)
  // - Volume >= 2.0x average
  const candles1h = timeframeCandles['1h'] || [];
  const is1hOrHigherAvailable = candles1h.length >= 20;
  let swing1hHigh = swingHigh;
  let swing1hLow = swingLow;
  if (is1hOrHigherAvailable) {
    const p1h = detectPivots(candles1h, 5);
    swing1hHigh = p1h.lastSwingHigh;
    swing1hLow = p1h.lastSwingLow;
  }
  const isVolumeConfirmedForBreakout = volRatio >= 2.0;

  // Pattern detection logic - Only Retest, Breakout, Pullback (Reversal & Range removed)
  const isBreakoutLong = is1hOrHigherAvailable && currentPrice > swing1hHigh * 0.999 && isVolumeConfirmedForBreakout && isBullish;
  const isBreakoutShort = is1hOrHigherAvailable && currentPrice < swing1hLow * 1.001 && isVolumeConfirmedForBreakout && !isBullish;
  const isRetestLong = isBullish && Math.abs(currentPrice - sr.nearestSupport) <= curAtr * 1.2 && currentPrice >= sr.nearestSupport;
  const isRetestShort = !isBullish && Math.abs(currentPrice - sr.nearestResistance) <= curAtr * 1.2 && currentPrice <= sr.nearestResistance;

  if (isBreakoutLong || isBreakoutShort) {
    setupPattern = 'BREAKOUT';
    patternNameArabic = 'Breakout (اختراق هيكلي قوي)';
    setupDirection = isBreakoutLong ? 'BULLISH' : 'BEARISH';
    conditionsMet.push(isBreakoutLong ? 'اختراق قمة 1h بحجم تداول مضاعف 2×' : 'كسر قاع 1h بحجم تداول مضاعف 2×');
  } else if (isRetestLong || isRetestShort) {
    setupPattern = 'RETEST';
    patternNameArabic = 'Retest (إعادة اختبار مستوى مكسور)';
    setupDirection = isRetestLong ? 'BULLISH' : 'BEARISH';
    conditionsMet.push('إعادة اختبار مستوى محوري مكسور بنجاح');
  } else {
    setupPattern = 'PULLBACK';
    patternNameArabic = 'Pullback (تصحيح داخل الترند)';
    setupDirection = isBullish ? 'BULLISH' : 'BEARISH';
    conditionsMet.push('تصحيح صحي نحو متوسطات EMA 20/50 مع اتجاه قوي');
  }

  // 5. Smart Entry, SL & TP Calculations with Mandatory 1.5 × ATR Floor
  let entry = currentPrice;
  let sl = 0;
  let tp1 = 0;
  let tp2 = 0;
  let tp3 = 0;

  // Enforce ATR(14) 1.5x minimum distance
  const minSlDistance = 1.5 * curAtr;
  let slCalculationReason = 'SL محسوب من: ATR × 1.5';

  if (setupDirection === 'BULLISH') {
    switch (setupPattern) {
      case 'BREAKOUT':
        entry = currentPrice;
        sl = Math.min(swingHigh - curAtr * 1.0, currentPrice - minSlDistance);
        tp1 = entry + Math.max(curAtr * 2.5, minSlDistance * 1.5);
        tp2 = entry + swingRange * 1.272;
        tp3 = entry + swingRange * 1.618;
        break;
      case 'RETEST':
        entry = sr.nearestSupport > 0 ? sr.nearestSupport : currentPrice - curAtr * 0.4;
        sl = entry - minSlDistance;
        tp1 = swingHigh > entry + curAtr ? swingHigh : entry + Math.max(curAtr * 2.5, minSlDistance * 1.5);
        tp2 = entry + swingRange * 1.272;
        tp3 = entry + swingRange * 1.618;
        break;
      case 'PULLBACK':
        entry = Math.min(currentPrice, Math.max(curEMA20, curEMA50));
        sl = Math.min(curEMA50 - curAtr * 0.8, entry - minSlDistance);
        tp1 = entry + Math.max(curAtr * 2.5, minSlDistance * 1.5);
        tp2 = entry + swingRange * 1.272;
        tp3 = entry + swingRange * 1.618;
        break;
    }

    // Mandatory rule: Minimum SL distance = 1.5 × ATR(14)
    const currentSlDist = entry - sl;
    if (currentSlDist < minSlDistance) {
      sl = entry - minSlDistance;
      slCalculationReason = 'SL محسوب من: ATR × 1.5';
    } else {
      slCalculationReason = `SL محسوب من: ATR × 1.5 (هيكلي ${(currentSlDist / curAtr).toFixed(1)}×)`;
    }
  } else {
    // BEARISH Setups
    switch (setupPattern) {
      case 'BREAKOUT':
        entry = currentPrice;
        sl = Math.max(swingLow + curAtr * 1.0, currentPrice + minSlDistance);
        tp1 = entry - Math.max(curAtr * 2.5, minSlDistance * 1.5);
        tp2 = entry - swingRange * 1.272;
        tp3 = entry - swingRange * 1.618;
        break;
      case 'RETEST':
        entry = sr.nearestResistance > 0 ? sr.nearestResistance : currentPrice + curAtr * 0.4;
        sl = entry + minSlDistance;
        tp1 = swingLow < entry - curAtr ? swingLow : entry - Math.max(curAtr * 2.5, minSlDistance * 1.5);
        tp2 = entry - swingRange * 1.272;
        tp3 = entry - swingRange * 1.618;
        break;
      case 'PULLBACK':
        entry = Math.max(currentPrice, Math.min(curEMA20, curEMA50));
        sl = Math.max(curEMA50 + curAtr * 0.8, entry + minSlDistance);
        tp1 = entry - Math.max(curAtr * 2.5, minSlDistance * 1.5);
        tp2 = entry - swingRange * 1.272;
        tp3 = entry - swingRange * 1.618;
        break;
    }

    // Mandatory rule: Minimum SL distance = 1.5 × ATR(14)
    const currentSlDist = sl - entry;
    if (currentSlDist < minSlDistance) {
      sl = entry + minSlDistance;
      slCalculationReason = 'SL محسوب من: ATR × 1.5';
    } else {
      slCalculationReason = `SL محسوب من: ATR × 1.5 (هيكلي ${(currentSlDist / curAtr).toFixed(1)}×)`;
    }
  }

  // Precision formatting
  const precision = getPricePrecision(currentPrice);
  const roundDec = (val: number) => Number(val.toFixed(precision));

  entry = roundDec(entry);
  tp1 = roundDec(tp1);
  tp2 = roundDec(tp2);
  tp3 = roundDec(tp3);
  sl = roundDec(sl);

  const minTick = Number(Math.pow(10, -precision).toFixed(precision));
  if (setupDirection === 'BULLISH') {
    if (tp1 <= entry) tp1 = roundDec(entry + Math.max(curAtr * 1.5, minTick * 10));
    if (tp2 <= tp1) tp2 = roundDec(tp1 + Math.max(curAtr * 1.0, minTick * 10));
    if (sl >= entry) sl = roundDec(entry - Math.max(curAtr * 0.8, minTick * 10));
  } else {
    if (tp1 >= entry) tp1 = roundDec(entry - Math.max(curAtr * 1.5, minTick * 10));
    if (tp2 >= tp1) tp2 = roundDec(tp1 - Math.max(curAtr * 1.0, minTick * 10));
    if (sl <= entry) sl = roundDec(entry + Math.max(curAtr * 0.8, minTick * 10));
  }

  const tp1Percent = Number((((tp1 - entry) / entry) * 100).toFixed(2));
  const tp2Percent = Number((((tp2 - entry) / entry) * 100).toFixed(2));
  const tp3Percent = Number((((tp3 - entry) / entry) * 100).toFixed(2));
  const slPercent = Number((((sl - entry) / entry) * 100).toFixed(2));

  const targetReward = Math.abs(tp1 - entry);
  const targetRisk = Math.abs(entry - sl);
  const tp1AtrDist = Number((targetReward / curAtr).toFixed(1));
  const tp2AtrDist = Number((Math.abs(tp2 - entry) / curAtr).toFixed(1));
  const slAtrDist = Number((targetRisk / curAtr).toFixed(1));
  const rawRR = targetRisk > 0 ? targetReward / targetRisk : 1.0;
  const riskRewardRatio = Number(rawRR.toFixed(2));
  const entryDistancePercent = Number((((entry - currentPrice) / currentPrice) * 100).toFixed(2));

  // Check for opposing giant candle
  const side = setupDirection === 'BULLISH' ? 'LONG' : 'SHORT';
  const hasOpposing = hasGiantOpposingCandle(execCandles, curAtr, side);
  if (hasOpposing) {
    warnings.push('ظهور شمعة ابتلاعية معاكسة حديثة');
  }

  // =====================================================================
  // ========== 1. نظام النقاط الذكي الاحترافي (Score-Based 100) ==========
  // =====================================================================
  // 1. توافق الفريمات: حتى 25 نقطة (كل فريم متفقة تعطي 5 نقاط)
  const timeframeAlignment = Math.min(25, matchingTimeframesCount * 5);

  // 2. قوة الاتجاه العام (EMA ترتيب): حتى 15 نقطة
  let emaTrendStrength = 0;
  if (setupDirection === 'BULLISH') {
    if (curEMA20 > curEMA50 && curEMA50 > curEMA200) {
      emaTrendStrength = 15;
    } else if (curEMA20 > curEMA50) {
      emaTrendStrength = 10;
    } else if (currentPrice >= curEMA20) {
      emaTrendStrength = 5;
    }
  } else {
    if (curEMA20 < curEMA50 && curEMA50 < curEMA200) {
      emaTrendStrength = 15;
    } else if (curEMA20 < curEMA50) {
      emaTrendStrength = 10;
    } else if (currentPrice <= curEMA20) {
      emaTrendStrength = 5;
    }
  }

  // 3. R:R (نسبة العائد للمخاطرة): 10 إذا >= 1:2، 7 إذا 1:1.5، 3 إذا 1:1
  let riskReward = 0;
  if (riskRewardRatio >= 2.0) {
    riskReward = 10;
  } else if (riskRewardRatio >= 1.5) {
    riskReward = 7;
  } else if (riskRewardRatio >= 1.0) {
    riskReward = 3;
  } else {
    riskReward = 0;
  }

  // 4. الحجم (Volume): 10 إذا أعلى من المتوسط بـ 1.5×، 5 إذا 1.2×
  let volumeScore = 0;
  if (volRatio >= 1.5) {
    volumeScore = 10;
  } else if (volRatio >= 1.2) {
    volumeScore = 5;
  } else {
    volumeScore = 0;
  }

  // 5. حالة السوق متوافقة مع النمط: 15 نقطة
  let marketRegimeMatch = 15;
  if (setupPattern === 'BREAKOUT') {
    marketRegimeMatch = volRatio >= 1.2 ? 15 : 10;
  } else if (setupPattern === 'PULLBACK' || setupPattern === 'RETEST') {
    marketRegimeMatch = emaTrendStrength >= 10 ? 15 : 12;
  }

  // 6. RSI في المنطقة المناسبة: 10 نقاط
  let rsiQuality = 5;
  if (setupDirection === 'BULLISH') {
    if (curRsi <= 35) {
      rsiQuality = 10; // تشبع بيعي مثالي للشراء
    } else if (curRsi >= 42 && curRsi <= 62) {
      rsiQuality = 10; // منطقة صحية لصعود ترند
    } else if (curRsi < 70) {
      rsiQuality = 7;
    } else {
      rsiQuality = 2; // تشبع شرائي زائد
      warnings.push(`مؤشر RSI مرتفع (${curRsi.toFixed(1)})`);
    }
  } else {
    if (curRsi >= 65) {
      rsiQuality = 10; // تشبع شرائي مثالي للبيع
    } else if (curRsi >= 38 && curRsi <= 58) {
      rsiQuality = 10; // منطقة صحية لهبوط ترند
    } else if (curRsi > 30) {
      rsiQuality = 7;
    } else {
      rsiQuality = 2; // تشبع بيعي زائد
      warnings.push(`مؤشر RSI منخفض (${curRsi.toFixed(1)})`);
    }
  }

  // 7. MACD يؤكد: 10 نقاط
  let macdConfirmation = 3;
  if (setupDirection === 'BULLISH') {
    if (curHist > 0 && curHist >= prevHist) {
      macdConfirmation = 10;
    } else if (curHist > 0) {
      macdConfirmation = 7;
    } else if (curHist > prevHist) {
      macdConfirmation = 6;
    }
  } else {
    if (curHist < 0 && curHist <= prevHist) {
      macdConfirmation = 10;
    } else if (curHist < 0) {
      macdConfirmation = 7;
    } else if (curHist < prevHist) {
      macdConfirmation = 6;
    }
  }

  // 8. لا توجد مقاومة/دعم قريب يعرقل: 5 نقاط
  let supportResistanceClear = 5;
  if (setupDirection === 'BULLISH') {
    if (sr.nearestResistance > entry && (sr.nearestResistance - entry) < curAtr * 0.7) {
      supportResistanceClear = 2;
      warnings.push('مقاومة قريبة قد تعيق مسار الصعود الأولي');
    }
  } else {
    if (sr.nearestSupport < entry && (entry - sr.nearestSupport) < curAtr * 0.7) {
      supportResistanceClear = 2;
      warnings.push('دعم قريب قد يعيق مسار الهبوط الأولي');
    }
  }

  // وزن قوة المشروع (Project Strength Score 0-100):
  // >= 80: +10 نقاط ثقة | 60-79: +5 نقاط | < 40: -10 نقاط
  const projectStrength = getProjectStrengthScore(symbol);
  const { modifier: projectModifier, reason: projectReason } =
    getProjectScoreConfidenceModifier(projectStrength.totalScore);

  if (projectModifier > 0) {
    conditionsMet.push(`${projectReason} (${projectStrength.totalScore}/100 - ${projectStrength.tierArabic})`);
  } else if (projectModifier < 0) {
    warnings.push(`${projectReason} (${projectStrength.totalScore}/100 - ${projectStrength.tierArabic})`);
  }

  // الإجمالي من 100 نقطة شامل وزن قوة المشروع
  const rawScore =
    timeframeAlignment +
    emaTrendStrength +
    riskReward +
    volumeScore +
    marketRegimeMatch +
    rsiQuality +
    macdConfirmation +
    supportResistanceClear +
    projectModifier;

  const totalScore = Math.max(0, Math.min(100, rawScore));

  // قواعد التصنيف والتنفيذ:
  // - شرط صارم: استبعاد تام لأي عملة تقييمها أقل من 60 (ممنوع للعملات المتوسطة والضعيفة)
  // >= 70 نقطة → تنفيذ فوري
  // 55-69 نقطة → إشارة "مراقبة" تُنفّذ إذا تحسن السعر أو وصل للدخول
  // < 55 نقطة → تجاهل
  let executionCategory: 'INSTANT' | 'WATCH' | 'IGNORE' = 'IGNORE';
  let executionCategoryArabic = 'تجاهل (أقل من 55)';
  let executionStatus: TradeExecutionStatus = 'IGNORE';
  let executionStatusArabic = 'تجاهل';
  let recommendation: 'ادخل الآن' | 'انتظر السعر' | 'تجاهل' = 'تجاهل';
  let overallSignal: SignalType = 'NEUTRAL';

  const isCoinRejectedForLowScore = projectStrength.totalScore < 60;

  if (isCoinRejectedForLowScore) {
    executionCategory = 'IGNORE';
    executionCategoryArabic = 'استبعاد عملة غير مؤهلة ❌';
    executionStatus = 'IGNORE';
    executionStatusArabic = `استبعاد: تقييم العملة (${projectStrength.totalScore}/100) أقل من الحد الأدنى 60`;
    recommendation = 'تجاهل';
    overallSignal = 'NEUTRAL';
    warnings.push(`تم استبعاد العملة نهائياً: تقييمها ${projectStrength.totalScore}/100 أقل من 60 نقطة (ممنوع للمتوسطة والضعيفة)`);
  } else if (totalScore >= 70) {
    // Breakout requires strict 85%+ confidence; if < 85, do not issue signal!
    if (setupPattern === 'BREAKOUT' && totalScore < 85) {
      executionCategory = 'IGNORE';
      executionCategoryArabic = 'تجاهل ❌';
      executionStatus = 'IGNORE';
      executionStatusArabic = `تجاهل نمط Breakout (النقاط ${totalScore}/100 < 85% المطلوبة)`;
      recommendation = 'تجاهل';
      overallSignal = 'NEUTRAL';
      warnings.push('تم استبعاد إشارة Breakout لأن الثقة أقل من 85% المعتمدة للأمان');
    } else {
      executionCategory = 'INSTANT';
      executionCategoryArabic = 'تنفيذ فوري ⚡';
      executionStatus = 'READY_NOW';
      executionStatusArabic = `جاهزة للتنفيذ الآن (${totalScore}/100)`;
      recommendation = 'ادخل الآن';
      overallSignal = setupDirection === 'BULLISH' ? 'STRONG_BUY' : 'STRONG_SELL';
    }
  } else if (totalScore >= 55) {
    if (setupPattern === 'BREAKOUT') {
      executionCategory = 'IGNORE';
      executionCategoryArabic = 'تجاهل ❌';
      executionStatus = 'IGNORE';
      executionStatusArabic = `تجاهل نمط Breakout (النقاط ${totalScore}/100 < 85%)`;
      recommendation = 'تجاهل';
      overallSignal = 'NEUTRAL';
    } else {
      executionCategory = 'WATCH';
      executionCategoryArabic = 'إشارة مراقبة ⏳';
      executionStatus = 'WAITING_PRICE';
      executionStatusArabic = `في انتظار السعر (${totalScore}/100)`;
      recommendation = 'انتظر السعر';
      overallSignal = setupDirection === 'BULLISH' ? 'BUY' : 'SELL';
    }
  } else {
    executionCategory = 'IGNORE';
    executionCategoryArabic = 'تجاهل ❌';
    executionStatus = 'IGNORE';
    executionStatusArabic = `تجاهل (النقاط ${totalScore}/100 < 55)`;
    recommendation = 'تجاهل';
    overallSignal = 'NEUTRAL';
  }

  const confidence = isCoinRejectedForLowScore ? 0 : Math.max(35, Math.min(98, totalScore));
  const isWeakTrade = totalScore < 55 || isCoinRejectedForLowScore;
  const weakTradeReason = isCoinRejectedForLowScore
    ? `تقييم المشروع (${projectStrength.totalScore}/100) أقل من 60`
    : isWeakTrade
    ? `مجموع النقاط (${totalScore}/100) أقل من الحد الأدنى 55`
    : undefined;

  const targets: TradeTarget = {
    entry,
    tp1,
    tp2,
    tp3,
    sl,
    tp1Percent,
    tp2Percent,
    tp3Percent,
    slPercent,
    riskRewardRatio,
    tp1AtrDistance: tp1AtrDist,
    tp2AtrDistance: tp2AtrDist,
    tp3AtrDistance: tp3 ? Number((Math.abs(tp3 - entry) / curAtr).toFixed(1)) : undefined,
    slAtrDistance: slAtrDist,
    entryDistancePercent,
    isWeakTrade,
    weakTradeReason,
    slCalculationReason: 'SL محسوب من: ATR × 1.5',
    atr14: curAtr,
  };

  const explanation = `${patternNameArabic} • نظام النقاط: ${totalScore}/100 (${executionCategoryArabic}). ${conditionsMet.join(' + ')}${
    warnings.length > 0 ? ` [ملاحظات: ${warnings.join('، ')}]` : ''
  }.`;

  const bullishScenario = `تحقيق السعر للأهداف عند ${formatPrice(tp1)} بنسبة +${tp1Percent}% يمهد للهدف الثاني ${formatPrice(tp2)}.`;
  const bearishScenario = `كسر وقف الخسارة عند ${formatPrice(sl)} يلغي فرضية الدخول ويتطلب حماية رأس المال.`;
  const volatilityStatus = curAtr / currentPrice > 0.02 ? 'تقلبات نشطة (ATR عالي)' : 'تقلبات مستقرة ومعتدلة';
  const momentumStatus = setupDirection === 'BULLISH' ? 'زخم شرائي إيجابي' : 'زخم بيعي سلبي';

  return {
    symbol,
    overallSignal,
    overallDirection: setupDirection,
    confidence,
    agreedTimeframesCount: matchingTimeframesCount,
    totalTimeframesCount: 6,
    timeframeResults,
    setupPattern,
    patternNameArabic,
    executionStatus,
    executionStatusArabic,
    recommendation,
    conditionsMet,
    warnings,
    scoreBreakdown: {
      totalScore,
      timeframeAlignment,
      emaTrendStrength,
      riskReward,
      volume: volumeScore,
      marketRegimeMatch,
      rsiQuality,
      macdConfirmation,
      supportResistanceClear,
      executionCategory,
      executionCategoryArabic,
    },
    targets,
    currentPrice,
    explanation,
    bullishScenario,
    bearishScenario,
    volatilityStatus,
    momentumStatus,
    supportResistance: sr,
    btcCorrelation: classifyBtcCorrelation(symbol, timeframeCandles['1h']),
    projectStrength,
    timestamp: Date.now(),
  };
}
