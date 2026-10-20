import { Timeframe } from '../types/crypto';

export type TradeType = 'SCALP' | 'DAY_TRADE' | 'SWING';

export interface TradeTypeInfo {
  type: TradeType;
  label: string;             // e.g. 'Scalp (15m)', 'Swing (1D)'
  labelArabic: string;       // e.g. 'مضاربة سريعة (15m)', 'تداول سوينغ (1D)'
  badgeBg: string;           // Tailwind styling
  badgeBorder: string;
  textColor: string;
  badgeClass: string;
  atrMultiplier: number;     // 1.2x/1.5x for Scalp, 1.8x for Day, 2.5x for 4h, 3.0x for 1D
  timeframe: Timeframe;
}

/**
 * Returns dynamic trade category, ATR multiplier, and UI badge styles for a given timeframe
 */
export function getTradeTypeInfo(timeframe: Timeframe = '15m'): TradeTypeInfo {
  switch (timeframe) {
    case '1m':
    case '5m':
      return {
        type: 'SCALP',
        label: `Scalp (${timeframe})`,
        labelArabic: `مضاربة سريعة (${timeframe})`,
        badgeBg: 'bg-amber-500/15',
        badgeBorder: 'border-amber-500/30',
        textColor: 'text-amber-400',
        badgeClass: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
        atrMultiplier: 1.5,
        timeframe,
      };
    case '15m':
      return {
        type: 'SCALP',
        label: 'Scalp (15m)',
        labelArabic: 'مضاربة سريعة (15m)',
        badgeBg: 'bg-amber-500/15',
        badgeBorder: 'border-amber-500/30',
        textColor: 'text-amber-400',
        badgeClass: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
        atrMultiplier: 1.5,
        timeframe: '15m',
      };
    case '1h':
      return {
        type: 'DAY_TRADE',
        label: 'Day Trade (1h)',
        labelArabic: 'تداول يومي (1h)',
        badgeBg: 'bg-sky-500/15',
        badgeBorder: 'border-sky-500/30',
        textColor: 'text-sky-400',
        badgeClass: 'bg-sky-500/15 text-sky-400 border border-sky-500/30',
        atrMultiplier: 1.8,
        timeframe: '1h',
      };
    case '4h':
      return {
        type: 'SWING',
        label: 'Swing (4h)',
        labelArabic: 'تداول سوينغ (4h)',
        badgeBg: 'bg-purple-500/15',
        badgeBorder: 'border-purple-500/30',
        textColor: 'text-purple-400',
        badgeClass: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
        atrMultiplier: 2.5,
        timeframe: '4h',
      };
    case '1d':
    case '3d':
    case '1w':
    default:
      const displayTf = timeframe === '1d' ? '1D' : timeframe === '1w' ? '1W' : timeframe;
      return {
        type: 'SWING',
        label: `Swing (${displayTf})`,
        labelArabic: `تداول سوينغ (${displayTf})`,
        badgeBg: 'bg-indigo-500/15',
        badgeBorder: 'border-indigo-500/30',
        textColor: 'text-indigo-400',
        badgeClass: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30',
        atrMultiplier: 2.5,
        timeframe,
      };
  }
}
