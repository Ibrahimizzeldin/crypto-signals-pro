import { SetupPattern, Timeframe } from '../types/crypto';

export type TradeType = 'SCALP' | 'DAY_TRADE' | 'SWING';

export interface TradeTypeInfo {
  type: TradeType;
  label: string;             // e.g. 'Trend (Breakout)', 'Reversion (Retest)', 'Scalp (5m)'
  labelArabic: string;       // e.g. 'تتبع الترند (اختراق)', 'الارتداد (إعادة اختبار)'
  badgeBg: string;           // Tailwind styling
  badgeBorder: string;
  textColor: string;
  badgeClass: string;
  atrMultiplier: number;     // 1.2x/1.5x for Scalp, 1.8x for Day, 2.5x for 4h, 3.0x for 1D
  timeframe: Timeframe;
}

/**
 * Returns dynamic trade category, ATR multiplier, and UI badge styles
 * accurately routing to Trend (Breakout), Reversion (Retest), or Scalp (5m/1m).
 */
export function getTradeTypeInfo(timeframe: Timeframe = '15m', pattern?: SetupPattern): TradeTypeInfo {
  // 1. Scalp: 1m or 5m
  if (timeframe === '1m' || timeframe === '5m') {
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
  }

  // 2. Breakout -> Trend Following (Strategy 1)
  if (pattern === 'BREAKOUT' || (!pattern && timeframe === '1h')) {
    return {
      type: 'DAY_TRADE',
      label: 'Trend (Breakout)',
      labelArabic: 'تتبع الترند (اختراق)',
      badgeBg: 'bg-emerald-500/15',
      badgeBorder: 'border-emerald-500/30',
      textColor: 'text-emerald-400',
      badgeClass: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
      atrMultiplier: 1.8,
      timeframe,
    };
  }

  // 3. Retest or Pullback -> Mean Reversion (Strategy 2)
  if (pattern === 'RETEST' || pattern === 'PULLBACK') {
    const isRetest = pattern === 'RETEST';
    return {
      type: 'DAY_TRADE',
      label: `Reversion (${isRetest ? 'Retest' : 'Pullback'})`,
      labelArabic: `الارتداد (${isRetest ? 'إعادة اختبار' : 'تصحيح'})`,
      badgeBg: 'bg-sky-500/15',
      badgeBorder: 'border-sky-500/30',
      textColor: 'text-sky-400',
      badgeClass: 'bg-sky-500/15 text-sky-400 border border-sky-500/30',
      atrMultiplier: 1.8,
      timeframe,
    };
  }

  // 4. Default by timeframe
  switch (timeframe) {
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
    case '15m':
    default:
      return {
        type: 'DAY_TRADE',
        label: 'Reversion (15m)',
        labelArabic: 'ارتداد (15m)',
        badgeBg: 'bg-sky-500/15',
        badgeBorder: 'border-sky-500/30',
        textColor: 'text-sky-400',
        badgeClass: 'bg-sky-500/15 text-sky-400 border border-sky-500/30',
        atrMultiplier: 1.6,
        timeframe: '15m',
      };
  }
}
