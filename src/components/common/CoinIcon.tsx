import React, { useState } from 'react';
import { getCoinLogoUrl, getCoinSecondaryLogoUrl, getCleanSymbol, getCoinAvatarColor } from '../../utils/cryptoLogos';

interface CoinIconProps {
  symbol: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const CoinIcon: React.FC<CoinIconProps> = ({
  symbol,
  size = 'md',
  className = '',
}) => {
  const [srcIndex, setSrcIndex] = useState<number>(0);
  const clean = getCleanSymbol(symbol);

  const sizeClasses = {
    xs: 'w-4 h-4 text-[9px]',
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm font-bold',
  };

  const handleError = () => {
    setSrcIndex((prev) => prev + 1);
  };

  if (srcIndex === 0) {
    return (
      <img
        src={getCoinLogoUrl(symbol)}
        alt={symbol}
        onError={handleError}
        loading="lazy"
        className={`${sizeClasses[size]} rounded-full object-cover shrink-0 bg-slate-800 ${className}`}
      />
    );
  }

  if (srcIndex === 1) {
    return (
      <img
        src={getCoinSecondaryLogoUrl(symbol)}
        alt={symbol}
        onError={handleError}
        loading="lazy"
        className={`${sizeClasses[size]} rounded-full object-cover shrink-0 bg-slate-800 ${className}`}
      />
    );
  }

  // Fallback badge with clean symbol initials
  const avatarColor = getCoinAvatarColor(clean);
  return (
    <div
      className={`${sizeClasses[size]} rounded-full border flex items-center justify-center font-black font-num shrink-0 select-none ${avatarColor} ${className}`}
    >
      {clean.slice(0, 3)}
    </div>
  );
};
