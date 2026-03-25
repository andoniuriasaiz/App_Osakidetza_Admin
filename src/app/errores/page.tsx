'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { OPE_TRACKS } from '@/lib/tracks';
import { loadQuestions, Question, shuffleArray } from '@/lib/questions';
import { getAllProgress, recordAnswer, getWrongCount } from '@/lib/progress';
import { addLocalXP, persistXP, XP_EXAM_CORRECT, XP_EXAM_WRONG, getLocalXP, getLevel, incrementTodayAnswerCount } from '@/lib/xp';
import { playCorrect, playWrong } from '@/lib/sound';
import { notifyAnswered } from '@/lib/quests';
import BottomNav from '@/components/BottomNav';
import LevelUpModal from '@/components/LevelUpModal';

type Phase = 'loading' | 'empty' | 'studying' | 'finished';

interface ErrorQuestion {
  question: Question;
  wrongCount: number;
  moduleId: string;
}

const MIN_WRONG = 2; // umbral para aparecer en la cola

export default function ErroresPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [activeTrack, setActiveTrack] = useState<'aux' | 'admin' | 'tec'>('aux');
  const [queue, setQueue] = useState<ErrorQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionWrong, setSessionWrong] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpLevel, setLevelUpLevel] = useState<ReturnType<typeof getLevel> | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session) { router.push('/login'); return; }
    const t = localStorage.getItem('osakidetza_active_track') as 'aux' | 'admin' | 'tec';
    const track = t || 'aux';
    setActiveTrack(track);
    buildQueue(track);
  }, [router]);

  async function buildQueue(trackId: string) {
    setPhase('loading');
    const track = OPE_TRACKS.find(t => t.id === trackId) || OPE_TRACKS[0];
    const allIds = [...track.commonModuleIds, ...track.specificModuleIds];

    const allQ = await Promise.all(allIds.map(id => loadQuestions(id)));
    const questions = allQ.flat().filter(q => q.type === 'C' || q.type === 'I');

    const progress = getAllProgress();
    const wc = progress.wrongCounts || {};

    const errorQs: ErrorQuestion[] = questions
      .filter(q => (wc[q.id] || 0) >= MIN_WRONG)
      .map(q => ({ question: q, wrongCount: wc[q.id] || 0, moduleId: q.module }))
      .sort((a, b) => b.wrongCount - a.wrongCount); // más falladas primero

    if (errorQs.length === 0) {
      setPhase('empty');
      return;
    }

    setQueue(errorQs);
    setIdx(0);
    setSelected([]);
    setConfirmed(false);
    setSessionCorrect(0);
    setSessionWrong(0);
    setPhase('studying');
  }

  function selectOption(val: number) {
    if (confirmed || phase !== 'studying') return;
    const q = queue[idx].question;
    if (q.correctAnswerNums.length === 1) {
      setSelected([val]);
    } else {
      setSelected(prev =>
        prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
      );
    }
  }

  const confirm = useCallback(() => {
    if (confirmed || selected.length === 0 || phase !== 'studying') return;
    const eq = queue[idx];
    const q = eq.question;
    const correctSet = new Set(q.correctAnswerNums);
    const selSet = new Set(selected);
    const isCorrect =
      correctSet.size === selSet.size &&
      [...correctSet].every(v => selSet.has(v));

    recordAnswer(q.id, isCorrect ? 2 : 0);

    const prevXP = getLocalXP();
    addLocalXP(isCorrect ? XP_EXAM_CORRECT : XP_EXAM_WRONG);
    persistXP(getLocalXP());
    notifyAnswered(incrementTodayAnswerCount());

    if (isCorrect) { playCorrect(); setSessionCorrect(c => c + 1); }
    else           { playWrong();   setSessionWrong(w => w + 1); }

    const newLvl = getLevel(getLocalXP());
    if (newLvl.level > getLevel(prevXP).level) {
      setTimeout(() => { setLevelUpLevel(newLvl); setShowLevelUp(true); }, 600);
    }

    setConfirmed(true);
  }, [confirmed, selected, phase, queue, idx]);

  function next() {
    if (idx >= queue.length - 1) {
      setPhase('finished');
      return;
    }
    setIdx(i => i + 1);
    setSelected([]);
    setConfirmed(false);
  }

  // Keyboard
  useEffect(() => {
    if (phase !== 'studying') return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); confirmed ? next() : confirm(); }
      const map: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 };
      const lk = e.key.toLowerCase();
      if (map[lk] !== undefined && !confirmed) {
        const q = queue[idx]?.question;
        if (q?.options?.[map[lk]]) selectOption(q.options[map[lk]].value);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, confirmed, idx, queue, confirm]);

  // ─── LOADING ─────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">🔄</div>
          <p className="text-gray-500 text-sm">Analizando tus errores…</p>
        </div>
      </div>
    );
  }

  // ─── EMPTY ───────────────────────────────────────────────────────────────
  if (phase === 'empty') {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 px-4 py-4">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')}
              className="text-gray-400 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition text-lg">←</button>
            <h1 className="font-bold text-gray-900">Errores Frecuentes</h1>
          </div>
        </header>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">¡Sin errores frecuentes!</h2>
          <p className="text-gray-500 text-sm mb-6">
            Ninguna pregunta tiene {MIN_WRONG} o más fallos acumulados en el track {activeTrack.toUpperCase()}.
            Sigue practicando y aquí aparecerán las que más te cuesten.
          </p>
          <button onClick={() => router.push('/dashboard')}
            className="px-6 py-3 bg-[#282182] text-white rounded-xl font-semibold text-sm">
            Volver al inicio
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ─── FINISHED ────────────────────────────────────────────────────────────
  if (phase === 'finished') {
    const total = sessionCorrect + sessionWrong;
    const pct = total > 0 ? Math.round((sessionCorrect / total) * 100) : 0;
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 px-4 py-4">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <h1 className="font-bold text-gray-900">Resultado — Errores Frecuentes</h1>
          </div>
        </header>
        <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
          <div className={`rounded-2xl p-8 text-center border-2 ${pct >= 60 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="text-5xl mb-2">{pct >= 80 ? '🏆' : pct >= 60 ? '✅' : '📚'}</div>
            <div className={`text-5xl font-black mb-1 ${pct >= 60 ? 'text-green-600' : 'text-amber-600'}`}>{pct}%</div>
            <p className="text-sm text-gray-600 mt-1">{sessionCorrect} correctas · {sessionWrong} incorrectas</p>
            <p className="text-xs text-gray-400 mt-2">de {queue.length} preguntas problemáticas</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 text-sm text-gray-700">
            {pct >= 80 ? (
              <p>🎯 <strong>Excelente.</strong> Has superado la mayoría de tus errores frecuentes. Esas preguntas bajarán en la cola.</p>
            ) : pct >= 60 ? (
              <p>✅ <strong>Bien.</strong> Has mejorado en más de la mitad. Repite esta sesión en unos días para consolidar.</p>
            ) : (
              <p>📚 <strong>Sigue practicando.</strong> Estas preguntas son tus puntos débiles. La repetición espaciada las irá consolidando.</p>
            )}
          </div>

          <div className="space-y-2 pb-20">
            <button onClick={() => buildQueue(activeTrack)}
              className="w-full bg-[#282182] text-white font-bold py-3.5 rounded-xl text-sm">
              Repetir cola de errores
            </button>
            <button onClick={() => router.push('/dashboard')}
              className="w-full bg-slate-100 text-gray-700 font-semibold py-3.5 rounded-xl text-sm">
              Volver al inicio
            </button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ─── STUDYING ────────────────────────────────────────────────────────────
  const eq = queue[idx];
  const q = eq.question;
  const pct = Math.round((idx / queue.length) * 100);
  const isCorrect = (() => {
    if (!confirmed) return false;
    const cs = new Set(q.correctAnswerNums);
    const ss = new Set(selected);
    return cs.size === ss.size && [...cs].every(v => ss.has(v));
  })();

  return (
    <>
      {showLevelUp && levelUpLevel && (
        <LevelUpModal level={levelUpLevel} onClose={() => setShowLevelUp(false)} />
      )}
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => router.push('/dashboard')}
                className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 text-lg">←</button>
              <div className="text-center">
                <p className="font-bold text-sm text-gray-900">🔥 Errores Frecuentes</p>
                <p className="text-[10px] text-gray-400">{idx + 1} / {queue.length} · {sessionCorrect} ✓</p>
              </div>
              <div className="w-8" />
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 space-y-4 pb-24">
          {/* Error count badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700">
              ✗ Fallada {eq.wrongCount}× antes
            </span>
            {q.module && (
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                q.module.startsWith('comun-') || q.module.startsWith('tec-comun-')
                  ? 'bg-blue-100 text-blue-700'
                  : q.module.startsWith('aux-') ? 'bg-emerald-100 text-emerald-700'
                  : q.module.startsWith('adm-') ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {q.module.startsWith('comun-') || q.module.startsWith('tec-comun-') ? 'COMÚN'
                  : q.module.startsWith('aux-') ? 'AUX'
                  : q.module.startsWith('adm-') ? 'ADM'
                  : 'TEC'}
              </span>
            )}
            <span className="text-xs text-gray-400">#{q.questionNum}</span>
          </div>

          {/* Question */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 pt-5 pb-4">
              <h2 className="text-base font-semibold text-gray-900 leading-snug">{q.question}</h2>
            </div>
            <div className="px-4 pb-4 grid grid-cols-1 gap-2">
              {q.options?.map((opt, i) => {
                const letter = ['A', 'B', 'C', 'D'][i % 4];
                const isSel  = selected.includes(opt.value);
                const isOk   = q.correctAnswerNums.includes(opt.value);
                const isWrng = confirmed && isSel && !isOk;
                const showOk = confirmed && isOk;

                let bg = isSel ? '#fff' : '#f8f9fa';
                let border = isSel ? '#282182' : '#e5e7eb';
                let clr = isSel ? '#282182' : '#374151';
                if (showOk) { bg = '#f0fdf4'; border = '#22c55e'; clr = '#166534'; }
                if (isWrng) { bg = '#fef2f2'; border = '#ef4444'; clr = '#991b1b'; }

                return (
                  <button key={opt.value} onClick={() => selectOption(opt.value)}
                    disabled={confirmed}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-left transition-all"
                    style={{ background: bg, border: `2px solid ${border}`, color: clr }}
                  >
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black flex-shrink-0"
                      style={{
                        background: showOk ? '#22c55e' : isWrng ? '#ef4444' : isSel ? '#282182' : '#e8e7f7',
                        color: (showOk || isWrng || isSel) ? 'white' : '#282182',
                      }}>
                      {showOk ? '✓' : isWrng ? '✗' : letter}
                    </span>
                    <span className="flex-1 leading-snug font-medium">{opt.text}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Feedback */}
          {confirmed && (
            <div className={`rounded-xl p-4 text-sm ${isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <p className="font-semibold mb-1">{isCorrect ? '✓ ¡Correcto! Has superado este error.' : '✗ Todavía cuesta. Vuelve a repasarla más tarde.'}</p>
              {q.correctAnswers?.length > 0 && (
                <p className="text-xs opacity-80">Respuesta: {q.correctAnswers.join(', ')}</p>
              )}
            </div>
          )}

          {/* CTA */}
          {!confirmed ? (
            <button onClick={confirm} disabled={selected.length === 0}
              className="w-full py-4 rounded-2xl font-bold text-sm bg-[#282182] hover:bg-[#1e1965] text-white transition disabled:opacity-40 disabled:cursor-not-allowed">
              Confirmar respuesta
            </button>
          ) : (
            <button onClick={next}
              className="w-full py-4 rounded-2xl font-bold text-sm bg-[#282182] hover:bg-[#1e1965] text-white transition">
              {idx >= queue.length - 1 ? '🏁 Ver resultado' : 'Siguiente →'}
            </button>
          )}
        </main>
      </div>
    </>
  );
}
