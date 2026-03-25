'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { OPE_TRACKS, daysUntilExam } from '@/lib/tracks';
import BottomNav from '@/components/BottomNav';

// ── Constantes del plan ──────────────────────────────────────────────────────
const EXAM_DATE = '2026-06-21';
const START_DATE = '2026-03-25'; // inicio del plan

interface Phase {
  name: string;
  emoji: string;
  weeks: string;
  days: [number, number]; // [día inicio, día fin] desde el 25 mar
  description: string;
  focus: string[];
  color: string;
  bgColor: string;
  borderColor: string;
}

const PHASES: Phase[] = [
  {
    name: 'Fase 1: Adquisición',
    emoji: '📖',
    weeks: 'Semanas 1-6 (25 mar – 5 may)',
    days: [0, 41],
    description: 'Ver todo el temario por primera vez. Estudia un bloque completo al día y haz un mini-test al terminar cada tema para afianzar con active recall.',
    focus: [
      'Sem 1-2: Temas comunes C2 (T01-T19) — valen para AUX y ADM a la vez',
      'Sem 3: Específicos AUX (E01-E13)',
      'Sem 4: Específicos ADM (E01-E14)',
      'Sem 5: Comunes ABC1 TEC (T01-T16)',
      'Sem 6: Específicos TEC (T01-T08) + revisión global',
    ],
    color: 'text-blue-800',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  {
    name: 'Fase 2: Consolidación',
    emoji: '🔄',
    weeks: 'Semanas 7-10 (6 may – 2 jun)',
    days: [42, 69],
    description: 'Convertir lo aprendido en memoria a largo plazo. La repetición espaciada (SM-2) ya funciona automáticamente. Empieza a mezclar temas de distintos tracks.',
    focus: [
      'Repaso espaciado diario: estudia las preguntas "pendientes" de la app',
      '1-2 simulacros/semana cronometrados',
      'Interleaving: usa el Entrenamiento Mixto mezclando las 3 OPEs',
      'Identifica tus puntos débiles en Stats → practica esos módulos',
    ],
    color: 'text-emerald-800',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  {
    name: 'Fase 3: Sprint Final',
    emoji: '🚀',
    weeks: 'Semanas 11-12 (3 jun – 21 jun)',
    days: [70, 88],
    description: 'Máxima retención y confianza. No aprendas material nuevo. Enfócate en consolidar los fallos más frecuentes y simular las condiciones del examen.',
    focus: [
      '2-3 simulacros/semana (60 preguntas, 90 min, formato oficial)',
      'Solo repasa temas donde falles en los simulacros',
      '3 días antes: descanso activo, solo flashcards rápidas',
      'Prioridad: sueño de calidad (la memoria se consolida durmiendo)',
    ],
    color: 'text-amber-800',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
];

// ── Recomendaciones de estudio basadas en ciencia cognitiva ─────────────────
const TIPS = [
  {
    icon: '🧠',
    title: 'Repetición Espaciada (SM-2)',
    body: 'La app ya la usa. Estudia las preguntas "pendientes" cada día — el algoritmo te mostrará cada pregunta justo antes de que la olvides. Es 2x más eficiente que releer apuntes.',
  },
  {
    icon: '🔀',
    title: 'Interleaving: mezcla temas',
    body: 'Estudiar temas mezclados (vs. un tema seguido) produce 2-3x mejor retención a largo plazo. Usa el Entrenamiento Mixto en Fase 2+. Al principio parece más difícil — es normal y significa que funciona.',
  },
  {
    icon: '📝',
    title: 'Active Recall > releer',
    body: 'Hacerse preguntas (active recall) produce 57% de retención vs. 29% releyendo. Por eso los tests son mejores que los apuntes. Nunca "repases" sin intentar responder primero.',
  },
  {
    icon: '🎯',
    title: 'Simula el examen real',
    body: 'Los simulacros en condiciones reales (sin ayudas, cronometrado) son la mejor preparación. Hazlos 2x/semana en Fase 2 y 3x/semana en Fase 3. Analiza los errores — esa revisión vale más que 30 min estudiando.',
  },
  {
    icon: '⚡',
    title: 'AUX + ADM: eficiencia x2',
    body: 'Los 18 temas comunes C2 son idénticos para AUX y ADM. Estudiarlos una vez te prepara las dos oposiciones. Los específicos comparten leyes (LPAC, EBEP, D.255) — aprende AUX primero y ADM será más rápido.',
  },
  {
    icon: '😴',
    title: 'El sueño consolida la memoria',
    body: 'La memoria a largo plazo se forma principalmente durante el sueño. 7-8 horas son tan importantes como horas de estudio. En los últimos días, prioriza dormir bien sobre estudiar más.',
  },
];

// ── Objetivo diario recomendado por fase ────────────────────────────────────
function getDailyRecommendation(daysSinceStart: number): { questions: number; hours: string; phase: number } {
  if (daysSinceStart < 42) return { questions: 30, hours: '2-3h', phase: 1 };
  if (daysSinceStart < 70) return { questions: 50, hours: '3-4h', phase: 2 };
  return { questions: 60, hours: '4-5h', phase: 3 };
}

function getCurrentPhase(daysSinceStart: number): number {
  if (daysSinceStart < 42) return 0;
  if (daysSinceStart < 70) return 1;
  return 2;
}

export default function PlanPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');

  useEffect(() => {
    const session = getSession();
    if (!session) { router.push('/login'); return; }
    setUsername(session.username);
  }, [router]);

  const today = new Date();
  const startDate = new Date(START_DATE);
  const examDate = new Date(EXAM_DATE);
  const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysLeft = daysUntilExam(EXAM_DATE);
  const totalDays = Math.floor((examDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const progressPct = Math.min(100, Math.round((daysSinceStart / totalDays) * 100));
  const currentPhaseIdx = getCurrentPhase(daysSinceStart);
  const rec = getDailyRecommendation(daysSinceStart);

  return (
    <div className="min-h-screen pb-24" style={{ background: '#f4f4fb' }}>
      {/* ── Header ── */}
      <header className="bg-white sticky top-0 z-10 border-b border-slate-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition text-lg">←</button>
          <div>
            <h1 className="font-bold text-gray-900 text-base leading-none mb-0.5">Plan de Estudio</h1>
            <p className="text-[10px] font-bold text-[#7070a0] uppercase tracking-wider">Examen 21 jun. 2026</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* ── Countdown banner ── */}
        <div className="rounded-2xl p-6 text-white bg-gradient-to-br from-[#282182] to-[#170f55] shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-2xl font-bold mb-1">¡Hola, {username}!</h2>
                <p className="text-sm opacity-70">OPEs: {OPE_TRACKS.map(t => t.shortName).join(' · ')} — 21 junio 2026</p>
              </div>
              <div className="text-right bg-white/10 rounded-2xl px-5 py-3 border border-white/15">
                <div className="text-4xl font-black leading-none">{daysLeft}</div>
                <div className="text-xs opacity-60 mt-0.5">días</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-2">
              <div className="flex justify-between text-xs opacity-70 mb-1.5">
                <span>25 mar</span>
                <span>{progressPct}% del tiempo</span>
                <span>21 jun</span>
              </div>
              <div className="w-full bg-white/15 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-white transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <div className="flex-1 bg-white/10 rounded-xl p-3 border border-white/10 text-center">
                <div className="text-[10px] uppercase font-bold opacity-60 mb-1">Fase actual</div>
                <div className="text-sm font-bold">{PHASES[currentPhaseIdx].emoji} {currentPhaseIdx + 1}/3</div>
              </div>
              <div className="flex-1 bg-white/10 rounded-xl p-3 border border-white/10 text-center">
                <div className="text-[10px] uppercase font-bold opacity-60 mb-1">Objetivo hoy</div>
                <div className="text-sm font-bold">{rec.questions} preg.</div>
              </div>
              <div className="flex-1 bg-white/10 rounded-xl p-3 border border-white/10 text-center">
                <div className="text-[10px] uppercase font-bold opacity-60 mb-1">Tiempo/día</div>
                <div className="text-sm font-bold">{rec.hours}</div>
              </div>
            </div>
          </div>
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full" />
        </div>

        {/* ── Fases ── */}
        <section>
          <h2 className="text-base font-black text-slate-800 uppercase tracking-tight mb-4 flex items-center gap-2">
            <span className="w-1 h-6 bg-[#282182] rounded-full inline-block" />
            Las 3 Fases (88 días)
          </h2>
          <div className="space-y-4">
            {PHASES.map((phase, idx) => {
              const isCurrent = idx === currentPhaseIdx;
              const isPast = idx < currentPhaseIdx;
              return (
                <div
                  key={idx}
                  className={`rounded-2xl border-2 p-5 transition-all ${phase.borderColor} ${phase.bgColor} ${isCurrent ? 'ring-2 ring-[#282182] ring-offset-2' : ''} ${isPast ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-lg">{phase.emoji}</span>
                        <h3 className={`font-black text-sm ${phase.color}`}>{phase.name}</h3>
                        {isCurrent && (
                          <span className="bg-[#282182] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">HOY</span>
                        )}
                        {isPast && (
                          <span className="bg-slate-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">COMPLETADA</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-medium">{phase.weeks}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 mb-3 leading-relaxed">{phase.description}</p>
                  <ul className="space-y-1.5">
                    {phase.focus.map((f, fi) => (
                      <li key={fi} className="flex items-start gap-2 text-xs text-slate-600">
                        <span className={`${phase.color} font-bold mt-0.5 flex-shrink-0`}>›</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Técnicas de estudio ── */}
        <section>
          <h2 className="text-base font-black text-slate-800 uppercase tracking-tight mb-4 flex items-center gap-2">
            <span className="w-1 h-6 bg-emerald-500 rounded-full inline-block" />
            Ciencia del estudio aplicada
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {TIPS.map((tip, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">{tip.icon}</span>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm mb-1">{tip.title}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">{tip.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Quick actions ── */}
        <section>
          <h2 className="text-base font-black text-slate-800 uppercase tracking-tight mb-4 flex items-center gap-2">
            <span className="w-1 h-6 bg-amber-400 rounded-full inline-block" />
            Acciones rápidas
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-white border-2 border-[#282182] rounded-2xl p-4 text-left hover:bg-[#e8e7f7] transition"
            >
              <div className="text-xl mb-2">📚</div>
              <div className="font-bold text-[#282182] text-sm">Estudiar ahora</div>
              <div className="text-xs text-slate-400 mt-0.5">Repaso espaciado</div>
            </button>
            <button
              onClick={() => router.push('/exam')}
              className="bg-white border-2 border-emerald-400 rounded-2xl p-4 text-left hover:bg-emerald-50 transition"
            >
              <div className="text-xl mb-2">🎯</div>
              <div className="font-bold text-emerald-700 text-sm">Simulacro</div>
              <div className="text-xs text-slate-400 mt-0.5">60 preg. / 90 min</div>
            </button>
            <button
              onClick={() => router.push('/stats')}
              className="bg-white border-2 border-amber-300 rounded-2xl p-4 text-left hover:bg-amber-50 transition"
            >
              <div className="text-xl mb-2">📊</div>
              <div className="font-bold text-amber-700 text-sm">Ver estadísticas</div>
              <div className="text-xs text-slate-400 mt-0.5">Puntos débiles</div>
            </button>
            <button
              onClick={() => {
                const track = OPE_TRACKS[0];
                router.push(`/study/${track.commonModuleIds[0]}`);
              }}
              className="bg-white border-2 border-violet-300 rounded-2xl p-4 text-left hover:bg-violet-50 transition"
            >
              <div className="text-xl mb-2">🔥</div>
              <div className="font-bold text-violet-700 text-sm">Primer tema</div>
              <div className="text-xs text-slate-400 mt-0.5">Comunes C2 T01</div>
            </button>
          </div>
        </section>

      </main>

      <BottomNav />
    </div>
  );
}
