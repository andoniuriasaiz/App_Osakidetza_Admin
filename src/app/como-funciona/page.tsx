'use client';

import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import {
  IconClock, IconBolt, IconShuffle, IconTarget,
  IconBookOpen, IconRepeatSm, IconLightbulb,
  IconArrowRight, IconCheckCircle, IconSignal,
  IconFlame, IconInfo,
} from '@/components/AppIcons';

// ─── Visual: Spaced Repetition Timeline ──────────────────────────────────────
function RepetitionTimeline() {
  const steps = [
    { label: 'Día 0', sub: 'Aprendes', bg: 'bg-[#282182]', text: 'text-white', w: 'w-14' },
    { label: 'Día 1', sub: '+1d', bg: 'bg-[#4a49b5]', text: 'text-white', w: 'w-14' },
    { label: 'Día 4', sub: '+3d', bg: 'bg-[#6e6dcb]', text: 'text-white', w: 'w-14' },
    { label: 'Día 11', sub: '+7d', bg: 'bg-[#9291dc]', text: 'text-white', w: 'w-14' },
    { label: 'Día 25', sub: '+14d', bg: 'bg-[#b5b4ea]', text: 'text-[#282182]', w: 'w-14' },
    { label: 'Día 55', sub: '+30d', bg: 'bg-[#d8d7f4]', text: 'text-[#282182]', w: 'w-14' },
  ];

  return (
    <div className="overflow-x-auto -mx-1 px-1 pb-2">
      <div className="flex items-end gap-0 min-w-max">
        {steps.map((s, i) => (
          <div key={i} className="flex items-end">
            {/* Spacer — grows with i to show increasing gaps */}
            {i > 0 && (
              <div
                className="flex items-center justify-center mb-3"
                style={{ width: `${i * 16 + 8}px` }}
              >
                <div className="h-[2px] w-full bg-slate-200 relative">
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                    bg-white text-[9px] text-slate-400 font-bold px-0.5 whitespace-nowrap">
                    {s.sub}
                  </span>
                </div>
              </div>
            )}
            <div className={`${s.bg} ${s.text} rounded-xl flex flex-col items-center justify-end px-2 py-2 shrink-0`}
              style={{ height: `${44 + i * 8}px`, width: '52px' }}>
              <span className="text-[10px] font-bold leading-none">{s.label}</span>
              {i === 0 && <span className="text-[8px] opacity-70 mt-0.5">Estudio</span>}
              {i > 0 && <span className="text-[8px] opacity-70 mt-0.5">Repaso</span>}
            </div>
          </div>
        ))}
        <div className="flex items-center mb-3 ml-2">
          <span className="text-slate-400 text-xs font-semibold">→ Memoria a largo plazo</span>
        </div>
      </div>
    </div>
  );
}

// ─── Visual: Forgetting Curve ─────────────────────────────────────────────────
function ForgettingCurve() {
  // Simple SVG showing retention dropping and being restored at each review
  return (
    <svg viewBox="0 0 300 100" className="w-full max-w-sm mx-auto" style={{ height: '80px' }}>
      {/* Axes */}
      <line x1="20" y1="90" x2="290" y2="90" stroke="#e2e8f0" strokeWidth="1.5" />
      <line x1="20" y1="10" x2="20" y2="90" stroke="#e2e8f0" strokeWidth="1.5" />
      {/* Labels */}
      <text x="22" y="96" fontSize="7" fill="#94a3b8">tiempo</text>
      <text x="2" y="14" fontSize="7" fill="#94a3b8" transform="rotate(-90 8 50)">retención</text>

      {/* Decay curve 1 */}
      <path d="M30 18 Q60 18 90 58" stroke="#9291dc" strokeWidth="2" fill="none" />
      {/* Review 1 spike */}
      <line x1="90" y1="58" x2="90" y2="20" stroke="#282182" strokeWidth="1.5" strokeDasharray="3,2" />
      <circle cx="90" cy="20" r="3" fill="#282182" />

      {/* Decay curve 2 */}
      <path d="M90 20 Q130 20 165 50" stroke="#9291dc" strokeWidth="2" fill="none" />
      {/* Review 2 spike */}
      <line x1="165" y1="50" x2="165" y2="15" stroke="#282182" strokeWidth="1.5" strokeDasharray="3,2" />
      <circle cx="165" cy="15" r="3" fill="#282182" />

      {/* Decay curve 3 (shallower) */}
      <path d="M165 15 Q215 15 255 42" stroke="#9291dc" strokeWidth="2" fill="none" />
      {/* Review 3 spike */}
      <line x1="255" y1="42" x2="255" y2="12" stroke="#282182" strokeWidth="1.5" strokeDasharray="3,2" />
      <circle cx="255" cy="12" r="3" fill="#282182" />

      {/* Final decay (very shallow) */}
      <path d="M255 12 Q275 12 285 22" stroke="#b5b4ea" strokeWidth="2" fill="none" strokeDasharray="4,2" />

      {/* Review labels */}
      <text x="84" y="70" fontSize="6.5" fill="#282182" textAnchor="middle">R1</text>
      <text x="159" y="62" fontSize="6.5" fill="#282182" textAnchor="middle">R2</text>
      <text x="249" y="54" fontSize="6.5" fill="#282182" textAnchor="middle">R3</text>
    </svg>
  );
}

// ─── Rating pill ─────────────────────────────────────────────────────────────
function RatingPill({ label, sub, color }: { label: string; sub: string; color: string }) {
  return (
    <div className={`flex-1 rounded-xl p-3 text-center border ${color}`}>
      <div className="text-xs font-bold">{label}</div>
      <div className="text-[10px] opacity-70 mt-0.5">{sub}</div>
    </div>
  );
}

// ─── Mode card ───────────────────────────────────────────────────────────────
function ModeCard({ icon, title, sub, color }: { icon: React.ReactNode; title: string; sub: string; color: string }) {
  return (
    <div className={`rounded-2xl p-4 border ${color}`}>
      <div className="mb-2">{icon}</div>
      <div className="font-bold text-sm text-slate-800 leading-snug">{title}</div>
      <div className="text-xs text-slate-500 mt-1 leading-relaxed">{sub}</div>
    </div>
  );
}

// ─── Technique card ──────────────────────────────────────────────────────────
function TechniqueCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-3 bg-white rounded-2xl p-4 border border-slate-100">
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div>
        <div className="font-bold text-sm text-slate-800">{title}</div>
        <div className="text-xs text-slate-500 mt-1 leading-relaxed">{body}</div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ComoFuncionaPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-50 pb-24">

      {/* ── Header ── */}
      <div style={{ background: 'linear-gradient(135deg, #1a1660 0%, #282182 60%, #3d3ba8 100%)' }}
        className="px-5 pt-12 pb-10 text-white relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-10"
          style={{ background: 'white' }} />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full opacity-10"
          style={{ background: 'white' }} />

        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-white/70 hover:text-white transition text-sm mb-6 relative"
        >
          <span>←</span> Volver
        </button>

        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-white/15 rounded-full px-3 py-1 text-xs font-semibold mb-3">
            <IconLightbulb size={12} /> Guía de estudio
          </div>
          <h1 className="text-2xl font-black leading-tight mb-2">
            Cómo funciona<br />esta app
          </h1>
          <p className="text-white/70 text-sm leading-relaxed max-w-sm">
            La ciencia detrás de por qué estudiar 15 minutos al día con este sistema es más efectivo que horas de apuntes.
          </p>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 space-y-6 mt-6">

        {/* ── 1. Repetición espaciada ── */}
        <section className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-[#e8e7f7] flex items-center justify-center">
                <IconClock size={16} className="text-[#282182]" />
              </div>
              <span className="text-[10px] font-bold text-[#282182] uppercase tracking-widest">Técnica 1</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 mt-2">Repetición Espaciada</h2>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              El sistema decide <strong>cuándo</strong> mostrarte cada pregunta — justo antes de que la vayas a olvidar.
              Cada vez que la repasas correctamente, el intervalo se alarga. Cada vez que fallas, vuelve a empezar.
            </p>
          </div>

          {/* Forgetting curve */}
          <div className="px-5 py-3 bg-slate-50 border-t border-b border-slate-100">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-2">Curva del olvido — cada repaso refuerza la memoria</p>
            <ForgettingCurve />
          </div>

          {/* Timeline */}
          <div className="px-5 py-4">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-3">Los intervalos crecen a medida que la dominas</p>
            <RepetitionTimeline />
          </div>

          {/* Rating explanation */}
          <div className="px-5 pb-5">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-2">Tus respuestas ajustan el intervalo</p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <RatingPill label="Fácil" sub="Intervalo × 3.25" color="bg-blue-50 border-blue-100 text-blue-700" />
              <RatingPill label="Bien" sub="Intervalo × 2.5" color="bg-emerald-50 border-emerald-100 text-emerald-700" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <RatingPill label="Ya lo sé" sub="3+ días" color="bg-slate-50 border-slate-200 text-slate-600" />
              <RatingPill label="Mañana" sub="1 día" color="bg-orange-50 border-orange-100 text-orange-600" />
              <RatingPill label="Repetir" sub="Ahora" color="bg-red-50 border-red-100 text-red-600" />
            </div>
          </div>
        </section>

        {/* ── 2. Recuerdo activo ── */}
        <section className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
          <div className="px-5 pt-5 pb-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                <IconBolt size={16} className="text-emerald-600" />
              </div>
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Técnica 2</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 mt-2">Recuerdo Activo</h2>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              En lugar de <em>leer</em> la respuesta, la app te obliga a <strong>intentar recordarla primero</strong>.
              Este esfuerzo de recuperación es lo que crea recuerdos duraderos — el cerebro consolida lo que cuesta recordar.
            </p>

            {/* Visual comparison */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-red-50 border border-red-100 rounded-2xl p-3 text-center">
                <div className="text-2xl mb-1">📖</div>
                <div className="text-xs font-bold text-red-700">Releer apuntes</div>
                <div className="text-[10px] text-red-500 mt-1">Sensación de que lo sabes, pero no se consolida</div>
                <div className="mt-2 flex items-center justify-center gap-1">
                  <div className="h-1.5 rounded-full bg-red-200 flex-1" />
                  <div className="h-1.5 rounded-full bg-red-200 flex-1" />
                  <div className="h-1.5 rounded-full bg-red-100 flex-1" />
                  <div className="h-1.5 rounded-full bg-red-50 flex-1" />
                </div>
                <div className="text-[9px] text-red-400 mt-1">retención a largo plazo</div>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-center">
                <div className="text-2xl mb-1">✏️</div>
                <div className="text-xs font-bold text-emerald-700">Responder preguntas</div>
                <div className="text-[10px] text-emerald-600 mt-1">El esfuerzo de recordar refuerza la memoria</div>
                <div className="mt-2 flex items-center justify-center gap-1">
                  <div className="h-1.5 rounded-full bg-emerald-400 flex-1" />
                  <div className="h-1.5 rounded-full bg-emerald-400 flex-1" />
                  <div className="h-1.5 rounded-full bg-emerald-300 flex-1" />
                  <div className="h-1.5 rounded-full bg-emerald-200 flex-1" />
                </div>
                <div className="text-[9px] text-emerald-600 mt-1">retención a largo plazo</div>
              </div>
            </div>

            {/* Question types */}
            <div className="mt-4 space-y-2">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Tipos de preguntas</p>
              <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5">
                <IconCheckCircle size={15} className="text-emerald-500 shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-slate-700">Test</span>
                  <span className="text-xs text-slate-400 ml-2">Elige la opción correcta entre varias</span>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5">
                <IconInfo size={15} className="text-blue-500 shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-slate-700">Imagen</span>
                  <span className="text-xs text-slate-400 ml-2">Pregunta con apoyo visual o diagrama</span>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5">
                <IconTarget size={15} className="text-purple-500 shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-slate-700">Simulación</span>
                  <span className="text-xs text-slate-400 ml-2">Pincha en la zona correcta de la pantalla</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 3. Modos de estudio ── */}
        <section>
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
              <IconShuffle size={16} className="text-amber-600" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest block">Técnica 3</span>
              <h2 className="text-xl font-black text-slate-900 leading-tight">Modos de estudio</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ModeCard
              icon={<div className="w-9 h-9 rounded-xl bg-[#e8e7f7] flex items-center justify-center"><IconClock size={18} className="text-[#282182]" /></div>}
              title="Práctica de hoy"
              sub="Solo las preguntas que el algoritmo programa para hoy. Nunca repites lo que ya sabes."
              color="border-[#d0cff5] bg-[#f7f7fd]"
            />
            <ModeCard
              icon={<div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center"><IconBolt size={18} className="text-emerald-600" /></div>}
              title="Preguntas nuevas"
              sub="Las que nunca has visto. Perfectas para avanzar temario sin mezclar con el repaso."
              color="border-emerald-100 bg-emerald-50"
            />
            <ModeCard
              icon={<div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center"><IconShuffle size={18} className="text-slate-500" /></div>}
              title="Repaso libre"
              sub="Todas las preguntas, en orden o aleatorio. Tú mandas — el algoritmo no interfiere."
              color="border-slate-200 bg-white"
            />
            <ModeCard
              icon={<div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center"><IconTarget size={18} className="text-rose-600" /></div>}
              title="Simulacro"
              sub="Examen completo con tiempo real, penalización y corrección al final. Como el día D."
              color="border-rose-100 bg-rose-50"
            />
          </div>
        </section>

        {/* ── 4. Fuentes de fiabilidad ── */}
        <section className="bg-white rounded-3xl border border-amber-100 overflow-hidden">
          <div className="px-5 pt-5 pb-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                <IconSignal size={16} className="text-amber-600" />
              </div>
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Fiabilidad</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 mt-2">Las tres fuentes</h2>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              Cada respuesta ha sido contrastada entre tres fuentes independientes. El badge de fiabilidad te muestra si concuerdan.
            </p>

            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5">
                <span className="text-[10px] font-black text-white bg-slate-500 rounded-full px-2 py-0.5">k</span>
                <div className="text-xs text-slate-700 font-medium">kaixo.com — exámenes anteriores OPE Osakidetza</div>
              </div>
              <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5">
                <span className="text-[10px] font-black text-white bg-slate-500 rounded-full px-2 py-0.5">o</span>
                <div className="text-xs text-slate-700 font-medium">osasuntest.com — banco de preguntas verificadas</div>
              </div>
              <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5">
                <span className="text-[10px] font-black text-white bg-slate-500 rounded-full px-2 py-0.5">IA</span>
                <div className="text-xs text-slate-700 font-medium">Modelo de lenguaje — análisis independiente del temario</div>
              </div>
            </div>

            {/* Badges */}
            <div className="mt-4 space-y-2">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Qué significa cada badge</p>
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-xs font-semibold text-emerald-700">3 fuentes coinciden</span>
                <span className="text-[10px] text-emerald-600 ml-auto">Alta confianza</span>
              </div>
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <span className="text-xs font-semibold text-amber-700">Fuentes discrepan</span>
                <span className="text-[10px] text-amber-600 ml-auto">Revisar con atención</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <div className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-600">kaixo + IA confirman</span>
                <span className="text-[10px] text-slate-500 ml-auto">Buena confianza</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── 5. Consejos prácticos ── */}
        <section>
          <h2 className="text-lg font-black text-slate-900 mb-3 px-1">Consejos para sacarle el máximo</h2>
          <div className="space-y-3">
            <TechniqueCard
              icon={<div className="w-9 h-9 rounded-xl bg-[#e8e7f7] flex items-center justify-center shrink-0"><IconRepeatSm size={16} className="text-[#282182]" /></div>}
              title="Constancia diaria, no sesiones maratón"
              body="15–20 minutos cada día es mucho más efectivo que 3 horas el fin de semana. El olvido es tu aliado si lo usas bien: cada repaso justo antes de olvidar fortalece más la memoria."
            />
            <TechniqueCard
              icon={<div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0"><IconBookOpen size={16} className="text-emerald-600" /></div>}
              title="Empieza siempre por «Práctica de hoy»"
              body="Las preguntas programadas llevan semanas sin aparecer. Si las saltas para ver cosas nuevas, el repaso espaciado pierde su efecto y tendrás que empezar desde cero."
            />
            <TechniqueCard
              icon={<div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center shrink-0"><IconFlame size={16} className="text-rose-600" /></div>}
              title="Los errores son los más valiosos"
              body="Una pregunta fallada que corriges y repasas varias veces vale más que diez que aciertas a la primera. El sistema pone más énfasis en tus puntos débiles automáticamente."
            />
            <TechniqueCard
              icon={<div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0"><IconTarget size={16} className="text-amber-600" /></div>}
              title="Usa el simulacro como diagnóstico"
              body="Haz un simulacro completo cada 1–2 semanas. No solo mide tu nivel — activa el «efecto test», que mejora la retención incluso de las preguntas que no sabías contestar."
            />
          </div>
        </section>

        {/* ── Back button ── */}
        <button
          onClick={() => router.back()}
          className="w-full flex items-center justify-center gap-2 bg-[#282182] text-white font-bold py-4 rounded-2xl text-sm transition hover:bg-[#1e1965]"
        >
          Volver al panel
          <IconArrowRight size={14} />
        </button>

      </div>
    </div>
  );
}
