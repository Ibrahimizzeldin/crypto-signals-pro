import { Candle, BtcCorrelationCategory, BtcCorrelationInfo } from '../types/crypto';

/**
 * Calculates Pearson Correlation Coefficient between two series of prices/returns
 */
export function calculatePearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 5) return 0.5; // neutral fallback

  // Calculate percentage returns
  const returnsX: number[] = [];
  const returnsY: number[] = [];
  for (let i = 1; i < n; i++) {
    if (x[i - 1] > 0 && y[i - 1] > 0) {
      returnsX.push((x[i] - x[i - 1]) / x[i - 1]);
      returnsY.push((y[i] - y[i - 1]) / y[i - 1]);
    }
  }

  const len = returnsX.length;
  if (len < 4) return 0.5;

  const meanX = returnsX.reduce((a, b) => a + b, 0) / len;
  const meanY = returnsY.reduce((a, b) => a + b, 0) / len;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < len; i++) {
    const diffX = returnsX[i] - meanX;
    const diffY = returnsY[i] - meanY;
    numerator += diffX * diffY;
    denomX += diffX * diffX;
    denomY += diffY * diffY;
  }

  const denominator = Math.sqrt(denomX * denomY);
  if (denominator === 0) return 0;

  const r = numerator / denominator;
  return Number(Math.max(-1, Math.min(1, r)).toFixed(2));
}

/**
 * Known behavioral baseline correlation profiles for major crypto categories
 * Used when candle history is limited or being synchronized
 */
const KNOWN_CORRELATION_MAP: Record<string, number> = {
  BTCUSDT: 1.0,
  ETHUSDT: 0.88,
  SOLUSDT: 0.82,
  BNBUSDT: 0.79,
  ADAUSDT: 0.76,
  AVAXUSDT: 0.78,
  NEARUSDT: 0.74,
  SUIUSDT: 0.71,
  DOTUSDT: 0.75,
  LINKUSDT: 0.73,
  DOGEUSDT: 0.62,
  PEPEUSDT: 0.54,
  SHIBUSDT: 0.58,
  WIFUSDT: 0.48,
  RENDERUSDT: 0.61,
  FETUSDT: 0.59,
  TRXUSDT: 0.22,
  XMRUSDT: -0.24,
  LUNCUSDT: -0.15,
  USTCUSDT: -0.28,
};

/**
 * Classifies a cryptocurrency relative to Bitcoin:
 * - Followers (تابعة للبتكوين): Correlation > 0.7
 * - Counter-trend (معاكسة للبتكوين): Correlation < -0.2
 * - Independent (مستقلة): Correlation between -0.2 and 0.7
 */
export function classifyBtcCorrelation(
  symbol: string,
  symbolCandles?: Candle[],
  btcCandles?: Candle[]
): BtcCorrelationInfo {
  let coefficient = KNOWN_CORRELATION_MAP[symbol] ?? 0.65;

  if (symbol === 'BTCUSDT') {
    return {
      coefficient: 1.0,
      category: 'FOLLOWER',
      categoryArabic: 'المرجع الرئيسي (BTC)',
      descriptionArabic: 'العملة الأم وقائدة حركة السوق ككل.',
    };
  }

  // Calculate live correlation if both candle series are provided
  if (symbolCandles && btcCandles && symbolCandles.length >= 20 && btcCandles.length >= 20) {
    const symCloses = symbolCandles.slice(-30).map((c) => c.close);
    const btcCloses = btcCandles.slice(-30).map((c) => c.close);
    const calculated = calculatePearsonCorrelation(symCloses, btcCloses);
    if (!isNaN(calculated)) {
      coefficient = calculated;
    }
  }

  let category: BtcCorrelationCategory;
  let categoryArabic: string;
  let descriptionArabic: string;

  if (coefficient > 0.7) {
    category = 'FOLLOWER';
    categoryArabic = 'تابعة للبتكوين';
    descriptionArabic = `ارتباط إيجابي قوي (${coefficient}+). تتحرك بالتزامن المباشر مع اتجاه البيتكوين.`;
  } else if (coefficient < -0.2) {
    category = 'COUNTER';
    categoryArabic = 'معاكسة للبتكوين';
    descriptionArabic = `ارتباط سلبي (${coefficient}). تتحرك عكس اتجاه البيتكوين غالباً وتوفر فرص تحوط.`;
  } else {
    category = 'INDEPENDENT';
    categoryArabic = 'مستقلة';
    descriptionArabic = `ارتباط ضعيف أو معتدل (${coefficient}). تتحرك بزخمها الذاتي وأخبار مشروعها المستقل.`;
  }

  return {
    coefficient,
    category,
    categoryArabic,
    descriptionArabic,
  };
}
