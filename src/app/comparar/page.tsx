'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { LEYES, LeyGroup } from '@/lib/leyes';
import { loadQuestions, shuffleArray, Question } from '@/lib/questions';
import BottomNav from '@/components/BottomNav';

/**
 * Modo Comparativo AUX vs ADM
 * Para una ley seleccionada (LPAC, EBEP…), muestra una pregunta de AUX
 * y otra de ADM en paralelo, para comparar nivel y enfoque.
 */

// Leyes que tienen módulos tanto en AUX como en ADM
const LEYES_COMPARABLES = LEYES.filter(
  l => l.tracks.includes('aux') && l.tracks.includes('admin') &&
       l.modulos.some(m => m.startsWith('aux-')) &&
       l.modulos.some(m => m.startsWith('adm-'))
);

interface Pair {
  ley: LeyGroup;
  auxQ: Question;
  admQ: Question;
}

type Phase = 'selector' | 'loading' | 'comparing';

function QuestionCard({
  q, track, trackLabel, trackBg, trackColor,
  selected, onSelect, revealed, onReveal,
}: {
  q: Question; track: 'aux' | 'adm'; trackLabel: string; trackBg: string; trackColor: string;
  selected: number | null; onSelect: (v: number) => void; revealed: boolean; onReveal: () => void;
}) {
  return (
    <div className={`rounded-2xl border-2 overflow-hidden ${trackBg}`}>
      {/* Header */}
      <div className={`px-4 py-3 border-b ${trackBg}`}>
        <span className={`text-xs font-black px-2.5 py-1 rounded-full ${trackColor}`}>{trackLabel}</span>
        <p className="text-xs text-gray-400 mt-1">#{q.questionNum}</p>
      </div>
      {/* Question text */}
      <div className="px-4 py-4 bg-white">
        <p className="text-sm font-semibold text-gray-900 leading-snug">{q.question}</p>
      </div>
      {/* Options */}
      <div className="bg-white px-4 pb-4 grid grid-cols-1 gap-1.5">
        {q.options?.map((opt, i) => {
          const letter = ['A', 'B', 'C', 'D'][i % 4];
          const isSel  = selected === opt.value;
          const isOk   = q.correctAnswerNums.includes(opt.value);
          const showOk = revealed && isOk;
          const showWrong = revealed && isSel && !isOk;

          let bg = '#f8f9fa'; let border = '#e5e7eb'; let clr = '#374151';
          if (isSel && !revealed) { bg = '#fff'; border = track === 'aux' ? '#059669' : '#4f46e5'; clr = track === 'aux' ? '#065f46' : '#312e81'; }
          if (showOk)  { bg = '#f0fdf4'; border = '#22c55e'; clr = '#166534'; }
          if (showWrong) { bg = '#fef2f2'; border = '#ef4444'; clr = '#991b1b'; }

          return (
            <button key={opt.value}
              onClick={() => !revealed && onSelect(opt.value)}
              disabled={revealed}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs text-left transition-all"
              style={{ background: bg, border: `2px solid ${border}`, color: clr }}
            >
              <span className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0"
                style={{
                  background: showOk ? '#22c55e' : showWrong ? '#ef4444' : (isSel && !revealed) ? (track === 'aux' ? '#059669' : '#4f46e5') : '#e8e7f7',
                  color: (showOk || showWrong || (isSel && !revealed)) ? 'white' : '#282182',
                }}>
                {showOk ? '✓' : showWrong ? '✗' : letter}
              </span>
              <span className="flex-1 leading-snug">{opt.text}</span>
            </button>
          );
        })}
      </div>
      {/* Reveal button */}
      {!revealed ? (
        <div className="bg-white px-4 pb-4">
          <button onClick={onReveal}
            disabled={selected === null}
            className={`w-full py-2.5 rounded-xl font-bold text-xs transition ${
              selected !== null
                ? (track === 'aux' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700') + ' text-white'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}>
            Ver respuesta
          </button>
        </div>
      ) : (
        <div className={`px-4 pb-4 bg-white`}>
          <div className={`rounded-xl p-3 text-xs ${
            (() => {
              const isCorrect = selected !== null && q.correctAnswerNums.includes(selected);
              return isCorrect ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800';
            })()
          }`}>
            {(() => {
              const isCorrect = selected !== null && q.correctAnswerNums.includes(selected);
              return isCorrect ? '✓ Correcto' : '✗ Incorrecto — ' + q.correctAnswers?.join(', ');
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CompararPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('selector');
  const [selectedLeyId, setSelectedLeyId] = useState<string>('lpac');
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [pairIdx, setPairIdx] = useState(0);
  const [revealAux, setRevealAux] = useState(false);
  const [revealAdm, setRevealAdm] = useState(false);
  const [selectedAux, setSelectedAux] = useState<number | null>(null);
  const [selectedAdm, setSelectedAdm] = useState<number | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session) router.push('/login');
  }, [router]);

  async function loadPairs(leyId: string) {
    setPhase('loading');
    const ley = LEYES_COMPARABLES.find(l => l.id === leyId);
    if (!ley) { setPhase('selector'); return; }

    const auxIds = ley.modulos.filter(m => m.startsWith('aux-'));
    const admIds = ley.modulos.filter(m => m.startsWith('adm-'));

    const [auxAllArrays, admAllArrays] = await Promise.all([
      Promise.all(auxIds.map(id => loadQuestions(id))),
      Promise.all(admIds.map(id => loadQuestions(id))),
    ]);

    const auxQs = shuffleArray(auxAllArrays.flat().filter(q => q.type === 'C' || q.type === 'I'));
    const admQs = shuffleArray(admAllArrays.flat().filter(q => q.type === 'C' || q.type === 'I'));

    if (auxQs.length === 0 || admQs.length === 0) {
      setPhase('selector');
      return;
    }

    const count = Math.min(auxQs.length, admQs.length, 20);
    const built: Pair[] = Array.from({ length: count }, (_, i) => ({
      ley,
      auxQ: auxQs[i],
      admQ: admQs[i],
    }));

    setPairs(built);
    setPairIdx(0);
    resetPair();
    setPhase('comparing');
  }

  function resetPair() {
    setRevealAux(false);
    setRevealAdm(false);
    setSelectedAux(null);
    setSelectedAdm(null);
  }

  function nextPair() {
    if (pairIdx >= pairs.length - 1) {
      setPhase('selector');
      return;
    }
    setPairIdx(i => i + 1);
    resetPair();
  }

  // ─── SELECTOR ───────────────────────────────────────────────────────────
  if (phase === 'selector') {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')}
              className="text-gray-400 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition text-lg">←</button>
            <div>
              <h1 className="font-bold text-gray-900">Comparativo AUX vs ADM</h1>
              <p className="text-xs text-gray-400">Misma ley — nivel C2 (AUX) frente a C1 (ADM)</p>
            </div>
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-4 py-6 pb-28 space-y-4">
          {/* Info card */}
          <div className="bg-gradient-to-br from-indigo-50 to-emerald-50 border border-indigo-100 rounded-2xl p-5">
            <h2 className="font-bold text-gray-800 text-sm mb-2">¿Para qué sirve esto?</h2>
            <p className="text-xs text-gray-600 leading-relaxed">
              AUX y ADM comparten las mismas leyes (LPAC, EBEP, EAPV…) pero a distinto nivel de profundidad.
              Este modo te muestra <strong>dos preguntas de la misma norma en paralelo</strong>: una de nivel C2 (AUX)
              y otra de C1 (ADM), para que compruebes las diferencias y aproveches el solapamiento.
            </p>
            <div className="flex gap-2 mt-3">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">AUX C2 — más conceptual</span>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800">ADM C1 — más detallado</span>
            </div>
          </div>

          {/* Ley selector */}
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Elige la norma a comparar</p>
          <div className="space-y-2">
            {LEYES_COMPARABLES.map(ley => (
              <button
                key={ley.id}
                onClick={() => setSelectedLeyId(ley.id)}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                  selectedLeyId === ley.id
                    ? 'border-[#282182] bg-[#e8e7f7]'
                    : 'border-slate-200 bg-white hover:border-[#9591d0]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl flex-shrink-0">{ley.icono}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm ${selectedLeyId === ley.id ? 'text-[#282182]' : 'text-gray-800'}`}>
                      {ley.nombre}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{ley.descripcion}</p>
                  </div>
                  {selectedLeyId === ley.id && (
                    <span className="text-[#282182] font-bold flex-shrink-0">✓</span>
                  )}
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={() => loadPairs(selectedLeyId)}
            className="w-full bg-[#282182] hover:bg-[#1e1965] text-white font-bold py-4 rounded-2xl text-sm transition mt-4"
          >
            ⚖️ Comparar AUX vs ADM
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ─── LOADING ─────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">⚖️</div>
          <p className="text-gray-500 text-sm">Cargando preguntas comparativas…</p>
        </div>
      </div>
    );
  }

  // ─── COMPARING ───────────────────────────────────────────────────────────
  const pair = pairs[pairIdx];
  if (!pair) return null;
  const pct = Math.round((pairIdx / pairs.length) * 100);

  const bothRevealed = revealAux && revealAdm;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setPhase('selector')}
              className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 text-lg">←</button>
            <div className="text-center">
              <p className="font-bold text-sm text-gray-900">⚖️ {pair.ley.nombre}</p>
              <p className="text-[10px] text-gray-400">Par {pairIdx + 1} de {pairs.length}</p>
            </div>
            <div className="w-8" />
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 space-y-4 pb-24">
        {/* Level comparison header */}
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl py-2">
            <p className="text-xs font-black text-emerald-800">AUX · C2</p>
            <p className="text-[10px] text-emerald-600">Auxiliar Administrativo</p>
          </div>
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl py-2">
            <p className="text-xs font-black text-indigo-800">ADM · C1</p>
            <p className="text-[10px] text-indigo-600">Administrativo</p>
          </div>
        </div>

        {/* Two question cards */}
        <QuestionCard
          q={pair.auxQ} track="aux" trackLabel="AUX C2"
          trackBg="border-emerald-200 bg-emerald-50" trackColor="bg-emerald-100 text-emerald-800"
          selected={selectedAux} onSelect={setSelectedAux}
          revealed={revealAux} onReveal={() => setRevealAux(true)}
        />
        <QuestionCard
          q={pair.admQ} track="adm" trackLabel="ADM C1"
          trackBg="border-indigo-200 bg-indigo-50" trackColor="bg-indigo-100 text-indigo-800"
          selected={selectedAdm} onSelect={setSelectedAdm}
          revealed={revealAdm} onReveal={() => setRevealAdm(true)}
        />

        {/* Comparison insight — only after both revealed */}
        {bothRevealed && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm">
            <p className="font-semibold text-amber-800 mb-1">💡 ¿Notaste la diferencia?</p>
            <p className="text-xs text-amber-700 leading-relaxed">
              AUX suele preguntar <strong>definiciones y conceptos generales</strong> de la norma,
              mientras que ADM profundiza en <strong>plazos, procedimientos y excepciones concretas</strong>.
              Si dominas el nivel ADM, el nivel AUX te saldrá solo.
            </p>
          </div>
        )}

        {/* Next pair button */}
        {bothRevealed && (
          <button onClick={nextPair}
            className="w-full bg-[#282182] hover:bg-[#1e1965] text-white font-bold py-4 rounded-2xl text-sm transition">
            {pairIdx >= pairs.length - 1 ? '🏁 Finalizar comparativo' : 'Siguiente par →'}
          </button>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
