/**
 * Universal Cryptocurrency Price & Number Formatting Utility
 */

/**
 * Returns number of decimal places needed for a price based on magnitude:
 * - >= 1000: 2 decimals (e.g. 88,450.25)
 * - >= 1: 4 decimals (e.g. 2.0634)
 * - >= 0.01: 6 decimals (e.g. 0.012345)
 * - < 0.01: 8 decimals (e.g. 0.00001234 for PEPE, SHIB)
 */
export function getPricePrecision(price: number): number {
  const abs = Math.abs(price);
  if (abs >= 1000) return 2;
  if (abs >= 1) return 4;
  if (abs >= 0.01) return 6;
  return 8;
}

/**
 * Smart price formatter adhering to precision guidelines:
 * - >= 1000: 2 decimals with commas (e.g. "81,276.40")
 * - >= 1: 4 decimals (e.g. "2.0634")
 * - >= 0.01: 6 decimals (e.g. "0.012345")
 * - < 0.01: 8 decimals (e.g. "0.00001234")
 */
export function formatPrice(price: number | undefined | null, forcedPrecision?: number): string {
  if (price === undefined || price === null || isNaN(price)) return '—';
  if (price === 0) return '0.00';

  if (forcedPrecision !== undefined) {
    return price.toFixed(forcedPrecision);
  }

  const abs = Math.abs(price);
  if (abs >= 1000) {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } else if (abs >= 1) {
    return price.toFixed(4);
  } else if (abs >= 0.01) {
    return price.toFixed(6);
  } else {
    // 8 decimals for micro-priced tokens like PEPE, SHIB, FLOKI
    return price.toFixed(8);
  }
}

/**
 * Formats USDT price with a dollar prefix:
 * e.g. "$88,450.25" or "$0.00001234"
 */
export function formatUSDT(price: number | undefined | null): string {
  if (price === undefined || price === null || isNaN(price)) return '$—';
  return `$${formatPrice(price)}`;
}

/**
 * Rounds a number to the appropriate decimal precision for calculations
 */
export function roundToPrecision(val: number, basePrice: number): number {
  const precision = getPricePrecision(basePrice);
  return Number(val.toFixed(precision));
}
