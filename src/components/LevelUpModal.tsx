'use client';

import { useEffect } from 'react';
import { Level } from '@/lib/xp';

interface LevelUpModalProps {
  level: Level;
  onClose: () => void;
}

export default function LevelUpModal({ level, onClose }: LevelUpModalProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') onClose(); };
    window.addEventListener('keydown', handler);
    return () => { clearTimeout(t); window.removeEventListener('keydown', handler); };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      {/* Confetti particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-2.5 h-2.5 rounded-sm"
            style={{
              left: `${(i * 37 + 5) % 100}%`,
              top: '-10px',
              background: ['#e21b3c','#1368ce','#26890c','#e6820e','#282182','#f59e0b'][i % 6],
              animation: `confettiFall ${1.5 + (i % 5) * 0.3}s ease-in ${(i % 7) * 0.1}s forwards`,
              transform: `rotate(${i * 15}deg)`,
            }}
          />
        ))}
      </div>

      <div
        className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center level-up-bounce"
        onClick={e => e.stopPropagation()}
      >
        {/* Icon */}
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-5 text-5xl"
          style={{ background: level.color + '20', border: `3px solid ${level.color}` }}
        >
          {level.emoji}
        </div>

        <p className="text-sm font-semibold uppercase tracking-widest mb-1" style={{ color: level.color }}>
          ¡SUBISTE DE NIVEL!
        </p>
        <h2 className="text-3xl font-black text-gray-900 mb-2">{level.name}</h2>
        <p className="text-sm text-gray-500 mb-6">Nivel {level.level} desbloqueado</p>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-2xl font-bold text-white text-sm transition"
          style={{ background: level.color }}
        >
          ¡Seguir estudiando!
        </button>
        <p className="text-xs text-gray-400 mt-3">Se cierra automáticamente</p>
      </div>

      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .level-up-bounce {
          animation: levelBounce 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97);
        }
        @keyframes levelBounce {
          0%   { transform: scale(0.5); opacity: 0; }
          60%  { transform: scale(1.08); opacity: 1; }
          80%  { transform: scale(0.96); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
