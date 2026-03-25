'use client';

import { useEffect, useState } from 'react';

interface CelebrationFlashProps {
  xpGained?: number;
  onDone?: () => void;
}

export default function CelebrationFlash({ xpGained = 10, onDone }: CelebrationFlashProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 900);
    return () => clearTimeout(t);
  }, [onDone]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-40 flex items-start justify-center pt-20"
      aria-hidden="true"
    >
      {/* Green flash overlay */}
      <div
        className="absolute inset-0 transition-opacity"
        style={{
          background: 'rgba(34, 197, 94, 0.12)',
          animation: 'flashFade 0.9s ease-out forwards',
        }}
      />
      {/* XP pill */}
      <div
        className="relative z-10 font-black text-lg px-5 py-2.5 rounded-full shadow-lg text-white"
        style={{
          background: 'linear-gradient(135deg, #22c55e, #16a34a)',
          animation: 'xpFloat 0.9s ease-out forwards',
        }}
      >
        +{xpGained} XP ⚡
      </div>

      <style>{`
        @keyframes flashFade {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes xpFloat {
          0%   { transform: translateY(0)   scale(1);    opacity: 1; }
          60%  { transform: translateY(-20px) scale(1.1); opacity: 1; }
          100% { transform: translateY(-50px) scale(0.9); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
