'use client';

import { getLevelProgress } from '@/lib/xp';

interface XPBarProps {
  xp: number;
  className?: string;
  variant?: 'light' | 'dark';
}

export default function XPBar({ xp, className = '', variant = 'light' }: XPBarProps) {
  const { level, pct, xpInLevel, xpNeeded } = getLevelProgress(xp);

  const isDark = variant === 'dark';
  const labelColor = isDark ? 'rgba(255,255,255,0.9)' : level.color;
  const xpTextColor = isDark ? 'rgba(255,255,255,0.6)' : undefined;
  const trackBg = isDark ? 'rgba(255,255,255,0.15)' : undefined;
  const fillBg = isDark ? 'rgba(255,255,255,0.9)' : level.color;

  return (
    <div className={`${className}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold" style={{ color: labelColor }}>
          {level.emoji} {level.name}
        </span>
        <span className={`text-xs ${isDark ? '' : 'text-gray-400'}`} style={xpTextColor ? { color: xpTextColor } : undefined}>
          {level.level < 6 ? `${xpInLevel} / ${xpNeeded} XP` : `${xp} XP total`}
        </span>
      </div>
      <div className={`w-full rounded-full h-2 overflow-hidden ${isDark ? '' : 'bg-gray-100'}`} style={trackBg ? { background: trackBg } : undefined}>
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: fillBg }}
        />
      </div>
    </div>
  );
}
