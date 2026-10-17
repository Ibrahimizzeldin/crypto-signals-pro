import axios from 'axios';
import { ProjectStrengthScore, ProjectStrengthTier } from '../types/crypto';

export interface CoinMetadata {
  symbol: string; // e.g. 'BTC'
  name: string;
  category: 'Layer 1' | 'DeFi' | 'Layer 2' | 'AI' | 'Meme' | 'Gaming' | 'Other';
  launchYear: number;
  marketCapUsd?: number;
  volume24hUsd?: number;
  rank?: number;
}

// Comprehensive database of major crypto futures assets
const COIN_DATABASE: Record<string, CoinMetadata> = {
  BTC: { symbol: 'BTC', name: 'Bitcoin', category: 'Layer 1', launchYear: 2009, marketCapUsd: 1300000000000, volume24hUsd: 25000000000, rank: 1 },
  ETH: { symbol: 'ETH', name: 'Ethereum', category: 'Layer 1', launchYear: 2015, marketCapUsd: 310000000000, volume24hUsd: 15000000000, rank: 2 },
  SOL: { symbol: 'SOL', name: 'Solana', category: 'Layer 1', launchYear: 2020, marketCapUsd: 85000000000, volume24hUsd: 6500000000, rank: 5 },
  BNB: { symbol: 'BNB', name: 'BNB Chain', category: 'Layer 1', launchYear: 2017, marketCapUsd: 88000000000, volume24hUsd: 1200000000, rank: 4 },
  XRP: { symbol: 'XRP', name: 'XRP', category: 'Layer 1', launchYear: 2012, marketCapUsd: 32000000000, volume24hUsd: 1800000000, rank: 7 },
  DOGE: { symbol: 'DOGE', name: 'Dogecoin', category: 'Meme', launchYear: 2013, marketCapUsd: 18000000000, volume24hUsd: 900000000, rank: 8 },
  ADA: { symbol: 'ADA', name: 'Cardano', category: 'Layer 1', launchYear: 2017, marketCapUsd: 14000000000, volume24hUsd: 400000000, rank: 10 },
  AVAX: { symbol: 'AVAX', name: 'Avalanche', category: 'Layer 1', launchYear: 2020, marketCapUsd: 11000000000, volume24hUsd: 450000000, rank: 12 },
  SUI: { symbol: 'SUI', name: 'Sui Network', category: 'Layer 1', launchYear: 2023, marketCapUsd: 7500000000, volume24hUsd: 1200000000, rank: 18 },
  NEAR: { symbol: 'NEAR', name: 'NEAR Protocol', category: 'Layer 1', launchYear: 2020, marketCapUsd: 6200000000, volume24hUsd: 500000000, rank: 22 },
  LINK: { symbol: 'LINK', name: 'Chainlink', category: 'DeFi', launchYear: 2017, marketCapUsd: 8000000000, volume24hUsd: 350000000, rank: 16 },
  DOT: { symbol: 'DOT', name: 'Polkadot', category: 'Layer 1', launchYear: 2020, marketCapUsd: 6500000000, volume24hUsd: 250000000, rank: 20 },
  UNI: { symbol: 'UNI', name: 'Uniswap', category: 'DeFi', launchYear: 2020, marketCapUsd: 5200000000, volume24hUsd: 220000000, rank: 25 },
  AAVE: { symbol: 'AAVE', name: 'Aave', category: 'DeFi', launchYear: 2020, marketCapUsd: 2400000000, volume24hUsd: 280000000, rank: 40 },
  MKR: { symbol: 'MKR', name: 'Maker', category: 'DeFi', launchYear: 2017, marketCapUsd: 1500000000, volume24hUsd: 80000000, rank: 55 },
  ARB: { symbol: 'ARB', name: 'Arbitrum', category: 'Layer 2', launchYear: 2023, marketCapUsd: 2500000000, volume24hUsd: 400000000, rank: 42 },
  OP: { symbol: 'OP', name: 'Optimism', category: 'Layer 2', launchYear: 2022, marketCapUsd: 2100000000, volume24hUsd: 250000000, rank: 48 },
  POL: { symbol: 'POL', name: 'Polygon', category: 'Layer 2', launchYear: 2019, marketCapUsd: 3800000000, volume24hUsd: 210000000, rank: 33 },
  STRK: { symbol: 'STRK', name: 'Starknet', category: 'Layer 2', launchYear: 2024, marketCapUsd: 950000000, volume24hUsd: 120000000, rank: 80 },
  RENDER: { symbol: 'RENDER', name: 'Render Network', category: 'AI', launchYear: 2020, marketCapUsd: 2800000000, volume24hUsd: 310000000, rank: 38 },
  FET: { symbol: 'FET', name: 'Artificial Superintelligence Alliance', category: 'AI', launchYear: 2019, marketCapUsd: 3200000000, volume24hUsd: 380000000, rank: 35 },
  TAO: { symbol: 'TAO', name: 'Bittensor', category: 'AI', launchYear: 2023, marketCapUsd: 4100000000, volume24hUsd: 290000000, rank: 30 },
  INJ: { symbol: 'INJ', name: 'Injective', category: 'DeFi', launchYear: 2020, marketCapUsd: 2100000000, volume24hUsd: 150000000, rank: 49 },
  APT: { symbol: 'APT', name: 'Aptos', category: 'Layer 1', launchYear: 2022, marketCapUsd: 4800000000, volume24hUsd: 380000000, rank: 27 },
  TIA: { symbol: 'TIA', name: 'Celestia', category: 'Layer 1', launchYear: 2023, marketCapUsd: 1300000000, volume24hUsd: 210000000, rank: 65 },
  PEPE: { symbol: 'PEPE', name: 'Pepe', category: 'Meme', launchYear: 2023, marketCapUsd: 4200000000, volume24hUsd: 950000000, rank: 28 },
  SHIB: { symbol: 'SHIB', name: 'Shiba Inu', category: 'Meme', launchYear: 2020, marketCapUsd: 9800000000, volume24hUsd: 550000000, rank: 14 },
  BONK: { symbol: 'BONK', name: 'Bonk', category: 'Meme', launchYear: 2023, marketCapUsd: 1500000000, volume24hUsd: 320000000, rank: 58 },
  WIF: { symbol: 'WIF', name: 'dogwifhat', category: 'Meme', launchYear: 2023, marketCapUsd: 2300000000, volume24hUsd: 450000000, rank: 45 },
  FLOKI: { symbol: 'FLOKI', name: 'FLOKI', category: 'Meme', launchYear: 2021, marketCapUsd: 1400000000, volume24hUsd: 280000000, rank: 62 },
  GALA: { symbol: 'GALA', name: 'Gala', category: 'Gaming', launchYear: 2020, marketCapUsd: 820000000, volume24hUsd: 110000000, rank: 90 },
  AXS: { symbol: 'AXS', name: 'Axie Infinity', category: 'Gaming', launchYear: 2020, marketCapUsd: 750000000, volume24hUsd: 95000000, rank: 95 },
  SAND: { symbol: 'SAND', name: 'The Sandbox', category: 'Gaming', launchYear: 2020, marketCapUsd: 680000000, volume24hUsd: 78000000, rank: 105 },
};

const COINGECKO_STORAGE_KEY = 'crypto_coingecko_markets_cache_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MEMORY_CACHE = new Map<string, ProjectStrengthScore>();

/**
 * Normalizes symbol like 'BTCUSDT' -> 'BTC'
 */
export function extractBaseAsset(symbol: string): string {
  const clean = symbol.replace(/USDT$|BUSD$|USDC$/, '').toUpperCase();
  return clean || symbol;
}

/**
 * Calculates Project Strength Score (0 to 100) exactly according to rules:
 * 1. Market Cap (30 pts):
 *    > $50B: 30
 *    > $10B: 25
 *    > $1B: 20
 *    > $100M: 10
 *    < $100M: 5
 * 2. Age (20 pts):
 *    > 4 years: 20
 *    > 2 years: 15
 *    > 1 year: 10
 *    < 1 year: 5
 * 3. Volume / Market Cap ratio (20 pts):
 *    > 0.3: 20 (high interest)
 *    > 0.1: 15
 *    > 0.05: 10
 *    else: 5
 * 4. Community Activity / CoinGecko Rank (15 pts):
 *    Rank <= 10: 15
 *    Rank <= 30: 12
 *    Rank <= 100: 9
 *    else: 5
 * 5. Category (15 pts):
 *    Layer 1 / DeFi: 15
 *    Layer 2 / AI: 12
 *    Meme / Gaming: 5
 *    Other: 8
 */
export function computeProjectScore(
  symbol: string,
  meta: Partial<CoinMetadata> = {}
): ProjectStrengthScore {
  const base = extractBaseAsset(symbol);
  const defaultMeta = COIN_DATABASE[base] || {
    symbol: base,
    name: base,
    category: 'Other' as const,
    launchYear: 2022,
    marketCapUsd: 500000000,
    volume24hUsd: 40000000,
    rank: 120,
  };

  const name = meta.name || defaultMeta.name;
  const category = meta.category || defaultMeta.category;
  const launchYear = meta.launchYear || defaultMeta.launchYear;
  const marketCap = meta.marketCapUsd ?? defaultMeta.marketCapUsd ?? 500000000;
  const volume24h = meta.volume24hUsd ?? defaultMeta.volume24hUsd ?? 40000000;
  const rank = meta.rank ?? defaultMeta.rank ?? 120;

  // 1. Market Cap Score (max 30)
  let marketCapScore = 5;
  if (marketCap > 50_000_000_000) marketCapScore = 30;
  else if (marketCap > 10_000_000_000) marketCapScore = 25;
  else if (marketCap > 1_000_000_000) marketCapScore = 20;
  else if (marketCap > 100_000_000) marketCapScore = 10;
  else marketCapScore = 5;

  // 2. Age Score (max 20)
  const currentYear = new Date().getFullYear();
  const ageYears = Math.max(0.5, currentYear - launchYear);
  let ageScore = 5;
  if (ageYears > 4) ageScore = 20;
  else if (ageYears > 2) ageScore = 15;
  else if (ageYears > 1) ageScore = 10;
  else ageScore = 5;

  // 3. Vol / MC Ratio (max 20)
  const volToMcRatio = marketCap > 0 ? volume24h / marketCap : 0.05;
  let volToMcRatioScore = 5;
  if (volToMcRatio > 0.3) volToMcRatioScore = 20;
  else if (volToMcRatio > 0.1) volToMcRatioScore = 15;
  else if (volToMcRatio > 0.05) volToMcRatioScore = 10;
  else volToMcRatioScore = 5;

  // 4. Community / Rank (max 15)
  let communityScore = 5;
  if (rank <= 10) communityScore = 15;
  else if (rank <= 30) communityScore = 12;
  else if (rank <= 100) communityScore = 9;
  else communityScore = 5;

  // 5. Category (max 15)
  let categoryScore = 8;
  if (category === 'Layer 1' || category === 'DeFi') categoryScore = 15;
  else if (category === 'Layer 2' || category === 'AI') categoryScore = 12;
  else if (category === 'Meme' || category === 'Gaming') categoryScore = 5;
  else categoryScore = 8;

  const totalScore = marketCapScore + ageScore + volToMcRatioScore + communityScore + categoryScore;

  // Tier Classification
  let tier: ProjectStrengthTier = 'MODERATE';
  let tierArabic = 'متوسط 🟡';

  if (totalScore >= 80) {
    tier = 'VERY_STRONG';
    tierArabic = 'قوي جداً 🟢';
  } else if (totalScore >= 60) {
    tier = 'STRONG';
    tierArabic = 'قوي 🟢';
  } else if (totalScore >= 40) {
    tier = 'MODERATE';
    tierArabic = 'متوسط 🟡';
  } else if (totalScore >= 20) {
    tier = 'WEAK';
    tierArabic = 'ضعيف 🔴';
  } else {
    tier = 'VERY_WEAK';
    tierArabic = 'ضعيف جداً 🔴';
  }

  return {
    symbol: symbol.endsWith('USDT') ? symbol : `${base}USDT`,
    baseAsset: base,
    name,
    totalScore,
    tier,
    tierArabic,
    marketCapScore,
    ageScore,
    volToMcRatioScore,
    communityScore,
    categoryScore,
    categoryName: category,
    marketCapUsd: marketCap,
    volume24hUsd: volume24h,
    volToMcRatio: Number(volToMcRatio.toFixed(3)),
    ageYears,
    coinGeckoRank: rank,
    updatedAt: Date.now(),
  };
}

/**
 * Returns project strength score for any symbol with caching
 */
export function getProjectStrengthScore(symbol: string): ProjectStrengthScore {
  const normSym = symbol.endsWith('USDT') ? symbol : `${extractBaseAsset(symbol)}USDT`;
  if (MEMORY_CACHE.has(normSym)) {
    return MEMORY_CACHE.get(normSym)!;
  }

  const score = computeProjectScore(normSym);
  MEMORY_CACHE.set(normSym, score);
  return score;
}

/**
 * Confidence score modifier based on project strength:
 * - score >= 80: +10 pts
 * - score 60-79: +5 pts
 * - score < 40: -10 pts (or skip)
 */
export function getProjectScoreConfidenceModifier(score: number): {
  modifier: number;
  reason: string;
} {
  if (score >= 80) {
    return { modifier: 10, reason: `مشروع قيادي فائق القوة (+10 نقاط ثقة)` };
  } else if (score >= 60) {
    return { modifier: 5, reason: `مشروع قوي ذو سيولة وتاريخ مستقر (+5 نقاط ثقة)` };
  } else if (score < 40) {
    return { modifier: -10, reason: `مشروع ضعيف أو عالي المخاطر (-10 نقاط ثقة)` };
  }
  return { modifier: 0, reason: 'مشروع متوسط' };
}

/**
 * Fetches latest markets data from CoinGecko API with 24h caching
 * Safe against rate limits (HTTP 429)
 */
export async function syncCoinGeckoProjectData(): Promise<Record<string, ProjectStrengthScore>> {
  const cachedRaw = typeof window !== 'undefined' ? localStorage.getItem(COINGECKO_STORAGE_KEY) : null;
  if (cachedRaw) {
    try {
      const parsed = JSON.parse(cachedRaw);
      if (Date.now() - parsed.timestamp < CACHE_TTL_MS && parsed.data) {
        Object.entries(parsed.data).forEach(([sym, score]) => {
          MEMORY_CACHE.set(sym, score as ProjectStrengthScore);
        });
        return parsed.data;
      }
    } catch (e) {
      // ignore JSON parse error
    }
  }

  // Attempt fresh API call
  try {
    const res = await axios.get(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250',
      { timeout: 7000 }
    );

    if (Array.isArray(res.data) && res.data.length > 0) {
      const resultMap: Record<string, ProjectStrengthScore> = {};

      res.data.forEach((coin: any) => {
        const base = (coin.symbol || '').toUpperCase();
        const sym = `${base}USDT`;
        const existingMeta = COIN_DATABASE[base] || {
          category: 'Other' as const,
          launchYear: 2021,
        };

        const score = computeProjectScore(sym, {
          name: coin.name,
          category: existingMeta.category,
          launchYear: existingMeta.launchYear,
          marketCapUsd: coin.market_cap || existingMeta.marketCapUsd,
          volume24hUsd: coin.total_volume || existingMeta.volume24hUsd,
          rank: coin.market_cap_rank || existingMeta.rank,
        });

        resultMap[sym] = score;
        MEMORY_CACHE.set(sym, score);
      });

      if (typeof window !== 'undefined') {
        localStorage.setItem(
          COINGECKO_STORAGE_KEY,
          JSON.stringify({ timestamp: Date.now(), data: resultMap })
        );
      }
      return resultMap;
    }
  } catch (err) {
    // If rate-limited or offline, populate memory cache from COIN_DATABASE
    console.warn('CoinGecko API rate limit or network issue. Using built-in database.', err);
  }

  // Fallback to built-in database
  const fallbackMap: Record<string, ProjectStrengthScore> = {};
  Object.keys(COIN_DATABASE).forEach((base) => {
    const sym = `${base}USDT`;
    const score = computeProjectScore(sym);
    fallbackMap[sym] = score;
    MEMORY_CACHE.set(sym, score);
  });

  return fallbackMap;
}
