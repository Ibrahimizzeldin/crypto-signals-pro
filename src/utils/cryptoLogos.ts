/**
 * Crypto Logos and Pattern Visual Utility
 */

export function getCleanSymbol(symbol: string): string {
  if (!symbol) return '';
  return symbol.replace(/(USDT|BUSD|USDC|USD)$/i, '').toUpperCase();
}

/**
 * Returns high quality CDN icon URL for cryptocurrency
 */
export function getCoinLogoUrl(symbol: string): string {
  const clean = getCleanSymbol(symbol).toLowerCase();
  // Fast & reliable CoinCap / SpotHQ cryptocurrency icons CDN
  return `https://assets.coincap.io/assets/icons/${clean}@2x.png`;
}

/**
 * Fallback secondary CDN if primary fails
 */
export function getCoinSecondaryLogoUrl(symbol: string): string {
  const clean = getCleanSymbol(symbol).toLowerCase();
  return `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${clean}.png`;
}

/**
 * Pattern icons required by prompt:
 * Breakout: 🚀
 * Retest: 🔄
 * Pullback: 📉
 * Reversal: 🔄
 * Range: ↔️
 */
export const PATTERN_EMOJIS: Record<string, string> = {
  BREAKOUT: '🚀',
  RETEST: '🔄',
  PULLBACK: '📉',
  REVERSAL: '🔄',
  RANGE: '↔️',
};

export function getPatternEmoji(pattern: string): string {
  return PATTERN_EMOJIS[pattern?.toUpperCase()] || '⚡';
}

/**
 * Returns coin theme color based on symbol name hash for pleasant avatar fallback
 */
export function getCoinAvatarColor(symbol: string): string {
  const colors = [
    'bg-amber-500/20 text-amber-400 border-amber-500/30',
    'bg-sky-500/20 text-sky-400 border-sky-500/30',
    'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    'bg-rose-500/20 text-rose-400 border-rose-500/30',
    'bg-purple-500/20 text-purple-400 border-purple-500/30',
    'bg-teal-500/20 text-teal-400 border-teal-500/30',
  ];
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}
