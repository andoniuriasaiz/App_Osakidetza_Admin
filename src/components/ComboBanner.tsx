'use client';

import { useEffect, useState } from 'react';

interface ComboBannerProps {
  streak: number;  // el streak actual cuando se llama
  onDone?: () => void;
}

const COMBO_CONFIGS: Record<number, { emoji: string; label: string; sub: string; bg: string; glow: string }> = {
  3:  { emoji: '🔥',   label: '¡EN RACHA!',    sub: '×1.5 XP',    bg: '#e21b3c', glow: '#ff4560' },
  6:  { emoji: '🔥🔥', label: '¡IMPARABLE!',   sub: '×2 XP',      bg: '#e6820e', glow: '#ffb347' },
  10: { emoji: '🚀',   label: '¡MODO DIOS!',   sub: '×3 XP ∞',    bg: '#282182', glow: '#7c74e8' },
};

export default function ComboBanner({ streak, onDone }: ComboBannerProps) {
  const [visible, setVisible] = useState(true);

  // Find which milestone this streak hits
  const milestone = [10, 6, 3].find(n => streak === n) ?? null;
  const cfg = milestone ? COMBO_CONFIGS[milestone] : null;

  useEffect(() => {
    if (!cfg) { onDone?.(); return; }
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDone?.(), 400);
    }, 2200);
    return () => clearTimeout(t);
  }, [cfg, onDone]);

  if (!cfg) return null;

  return (
    <div
      className="fixed inset-x-0 z-50 flex justify-center"
      style={{ top: 64, pointerEvents: 'none' }}
    >
      <div
        style={{
          background: cfg.bg,
          boxShadow: `0 0 40px 8px ${cfg.glow}88, 0 8px 32px rgba(0,0,0,0.3)`,
          borderRadius: 16,
          padding: '10px 28px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(-20px) scale(0.92)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s ease',
          willChange: 'transform, opacity',
        }}
      >
        <span style={{ fontSize: 28, lineHeight: 1 }}>{cfg.emoji}</span>
        <div style={{ color: 'white', lineHeight: 1.2 }}>
          <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: '-0.5px' }}>{cfg.label}</div>
          <div style={{ fontWeight: 700, fontSize: 13, opacity: 0.85 }}>{cfg.sub} · Racha {streak}</div>
        </div>
        {milestone === 10 && (
          <span style={{ fontSize: 22, lineHeight: 1, marginLeft: 4 }}>⚡</span>
        )}
      </div>

      <style>{`
        @keyframes comboPop {
          0%   { transform: translateY(-30px) scale(0.7); opacity: 0; }
          50%  { transform: translateY(4px) scale(1.06); opacity: 1; }
          70%  { transform: translateY(-2px) scale(0.98); }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
