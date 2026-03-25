'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { LEYES, CATEGORIA_LABELS, CATEGORIA_COLORS, getLeysForTrack, LeyGroup } from '@/lib/leyes';
import { OPE_TRACKS } from '@/lib/tracks';
import { loadQuestions, shuffleArray, Question } from '@/lib/questions';
import { recordAnswer } from '@/lib/progress';
import { addLocalXP, persistXP, XP_EXAM_CORRECT, XP_EXAM_WRONG, getLocalXP, getLevel, incrementTodayAnswerCount } from '@/lib/xp';
import { playCorrect, playWrong } from '@/lib/sound';
import { notifyAnswered } from '@/lib/quests';
import BottomNav from '@/components/BottomNav';
import LevelUpModal from '@/components/LevelUpModal';

type Phase = 'list' | 'studying';

interface StudyState {
  ley: LeyGroup;
  questions: Question[];
  idx: number;
  selected: number[];
  confirmed: boolean;
  correct: number;
  wrong: number;
  total: number;
}

// Badge para qué OPEs incluyen la ley
const TRACK_BADGE: Record<string, { label: string; color: string }> = {
  aux:   { label: 'AUX',  color: 'bg-emerald-100 text-emerald-700' },
  admin: { label: 'ADM',  color: 'bg-indigo-100 text-indigo-700' },
  tec:   { label: 'TEC',  color: 'bg-amber-100 text-amber-700' },
};

export default function LeyesPage() {
  const router = useRouter();
  const [activeTrack, setActiveTrack] = useState<'aux' | 'admin' | 'tec'>('aux');
  const [phase, setPhase] = useState<Phase>('list');
  const [study, setStudy] = useState<StudyState | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpLevel, setLevelUpLevel] = useState<ReturnType<typeof getLevel> | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session) { router.push('/login'); return; }
    const t = localStorage.getItem('osakidetza_active_track') as 'aux' | 'admin' | 'tec';
    if (t) setActiveTrack(t);
  }, [router]);

  const leyes = getLeysForTrack(activeTrack);
  const filtered = search.trim()
    ? leyes.filter(l =>
        l.nombre.toLowerCase().includes(search.toLowerCase()) ||
        l.descripcion.toLowerCase().includes(search.toLowerCase())
      )
    : leyes;

  // Group by category
  const grouped = filtered.reduce<Record<string, LeyGroup[]>>((acc, l) => {
    if (!acc[l.categoria]) acc[l.categoria] = [];
    acc[l.categoria].push(l);
    return acc;
  }, {});

  async function startLey(ley: LeyGroup) {
    setLoading(true);
    const allQ = await Promise.all(ley.modulos.map(id => loadQuestions(id)));
    const questions = shuffleArray(
      allQ.flat().filter(q => q.type === 'C' || q.type === 'I')
    );
    if (questions.length === 0) { setLoading(false); return; }
    setStudy({
      ley, questions, idx: 0, selected: [], confirmed: false,
      correct: 0, wrong: 0, total: questions.length,
    });
    setPhase('studying');
    setLoading(false);
  }

  function selectOption(val: number) {
    if (!study || study.confirmed) return;
    const q = study.questions[study.idx];
    setStudy(s => {
      if (!s) return s;
      if (q.correctAnswerNums.length === 1) {
        return { ...s, selected: [val] };
      }
      const cur = s.selected.includes(val)
        ? s.selected.filter(v => v !== val)
        : [...s.selected, val];
      return { ...s, selected: cur };
    });
  }

  const confirm = useCallback(() => {
    if (!study || study.confirmed || study.selected.length === 0) return;
    const q = study.questions[study.idx];
    const correctSet = new Set(q.correctAnswerNums);
    const selSet = new Set(study.selected);
    const isCorrect =
      correctSet.size === selSet.size &&
      [...correctSet].every(v => selSet.has(v));

    recordAnswer(q.id, isCorrect ? 2 : 0);

    const prevXP = getLocalXP();
    const xp = isCorrect ? XP_EXAM_CORRECT : XP_EXAM_WRONG;
    addLocalXP(xp);
    persistXP(getLocalXP());
    const count = incrementTodayAnswerCount();
    notifyAnswered(count);

    if (isCorrect) playCorrect(); else playWrong();

    const prevLvl = getLevel(prevXP);
    const newLvl = getLevel(getLocalXP());
    if (newLvl.level > prevLvl.level) {
      setTimeout(() => { setLevelUpLevel(newLvl); setShowLevelUp(true); }, 600);
    }

    setStudy(s => s ? {
      ...s,
      confirmed: true,
      correct: isCorrect ? s.correct + 1 : s.correct,
      wrong: !isCorrect ? s.wrong + 1 : s.wrong,
    } : s);
  }, [study]);

  function next() {
    if (!study) return;
    if (study.idx >= study.questions.length - 1) {
      setPhase('list');
      return;
    }
    setStudy(s => s ? { ...s, idx: s.idx + 1, selected: [], confirmed: false } : s);
  }

  // Keyboard
  useEffect(() => {
    if (phase !== 'studying' || !study) return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (study?.confirmed) next(); else confirm();
      }
      const letters: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 };
      const lk = e.key.toLowerCase();
      if (letters[lk] !== undefined && study && !study.confirmed) {
        const q = study.questions[study.idx];
        if (q.options && q.options[letters[lk]]) selectOption(q.options[letters[lk]].value);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, study, confirm]);

  // ─── STUDY VIEW ─────────────────────────────────────────────────────────
  if (phase === 'studying' && study) {
    const q = study.questions[study.idx];
    const pct = Math.round((study.idx / study.total) * 100);
    const track = OPE_TRACKS.find(t => t.id === activeTrack)!;

    return (
      <>
        {showLevelUp && levelUpLevel && (
          <LevelUpModal level={levelUpLevel} onClose={() => setShowLevelUp(false)} />
        )}
        <div className="min-h-screen bg-slate-50 flex flex-col">
          <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-2">
                <button onClick={() => setPhase('list')}
                  className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition text-lg">←</button>
                <div className="text-center">
                  <p className="font-bold text-sm text-gray-900">{study.ley.icono} {study.ley.nombre}</p>
                  <p className="text-[10px] text-gray-400">{study.idx + 1} / {study.total} · {study.correct} ✓ {study.wrong} ✗</p>
                </div>
                <div className="w-8" />
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#282182] rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </header>

          <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 space-y-4 pb-24">
            {/* Track badge — shows which OPE this question is from */}
            <div className="flex items-center gap-2">
              {q.module && (() => {
                const isComun = q.module.startsWith('comun-') || q.module.startsWith('tec-comun-');
                const isAux  = q.module.startsWith('aux-');
                const isAdm  = q.module.startsWith('adm-');
                const isTec  = q.module.startsWith('tec-t');
                return (
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                    isComun ? 'bg-blue-100 text-blue-700' :
                    isAux   ? 'bg-emerald-100 text-emerald-800' :
                    isAdm   ? 'bg-indigo-100 text-indigo-800' :
                    isTec   ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {isComun ? 'COMÚN' : isAux ? 'AUX C2' : isAdm ? 'ADM C1' : isTec ? 'TEC A1' : q.module}
                  </span>
                );
              })()}
              <span className="text-xs text-gray-400">#{q.questionNum}</span>
              {q.multipleCorrect && <span className="text-xs text-blue-500">· varias correctas</span>}
            </div>

            {/* Question */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-4">
                <h2 className="text-base font-semibold text-gray-900 leading-snug">{q.question}</h2>
              </div>
              <div className="px-4 pb-4 grid grid-cols-1 gap-2">
                {q.options?.map((opt, i) => {
                  const letter = ['A', 'B', 'C', 'D'][i % 4];
                  const isSelected = study.selected.includes(opt.value);
                  const isCorrect  = q.correctAnswerNums.includes(opt.value);
                  const isWrong    = study.confirmed && isSelected && !isCorrect;
                  const showRight  = study.confirmed && isCorrect;

                  let bg = isSelected ? '#ffffff' : '#f8f9fa';
                  let border = isSelected ? '#282182' : '#e5e7eb';
                  let color = isSelected ? '#282182' : '#374151';
                  if (showRight) { bg = '#f0fdf4'; border = '#22c55e'; color = '#166534'; }
                  if (isWrong)   { bg = '#fef2f2'; border = '#ef4444'; color = '#991b1b'; }

                  return (
                    <button key={opt.value} onClick={() => selectOption(opt.value)}
                      disabled={study.confirmed}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-left transition-all"
                      style={{ background: bg, border: `2px solid ${border}`, color }}
                    >
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black flex-shrink-0"
                        style={{
                          background: showRight ? '#22c55e' : isWrong ? '#ef4444' : isSelected ? '#282182' : '#e8e7f7',
                          color: (showRight || isWrong || isSelected) ? 'white' : '#282182',
                        }}>
                        {showRight ? '✓' : isWrong ? '✗' : letter}
                      </span>
                      <span className="flex-1 leading-snug font-medium">{opt.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Explanation after confirm */}
            {study.confirmed && (
              <div className={`rounded-xl p-4 text-sm ${
                (() => {
                  const correctSet = new Set(q.correctAnswerNums);
                  const selSet = new Set(study.selected);
                  const ok = correctSet.size === selSet.size && [...correctSet].every(v => selSet.has(v));
                  return ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200';
                })()
              }`}>
                <p className="font-semibold mb-1">
                  {(() => {
                    const correctSet = new Set(q.correctAnswerNums);
                    const selSet = new Set(study.selected);
                    return correctSet.size === selSet.size && [...correctSet].every(v => selSet.has(v))
                      ? '✓ ¡Correcto!' : '✗ Incorrecto';
                  })()}
                </p>
                {q.correctAnswers?.length > 0 && (
                  <p className="text-xs opacity-80">Respuesta: {q.correctAnswers.join(', ')}</p>
                )}
              </div>
            )}

            {/* Action buttons */}
            {!study.confirmed ? (
              <button onClick={confirm} disabled={study.selected.length === 0}
                className="w-full py-4 rounded-2xl font-bold text-sm transition bg-[#282182] hover:bg-[#1e1965] text-white disabled:opacity-40 disabled:cursor-not-allowed">
                Confirmar respuesta
              </button>
            ) : (
              <button onClick={next}
                className="w-full py-4 rounded-2xl font-bold text-sm transition bg-[#282182] hover:bg-[#1e1965] text-white">
                {study.idx >= study.total - 1 ? '🏁 Finalizar' : 'Siguiente →'}
              </button>
            )}
          </main>
        </div>
      </>
    );
  }

  // ─── LIST VIEW ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => router.push('/dashboard')}
              className="text-gray-400 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition text-lg">←</button>
            <div>
              <h1 className="font-bold text-gray-900">Vista por Ley / Norma</h1>
              <p className="text-xs text-gray-400">Estudia por norma — mezcla AUX + ADM + TEC automáticamente</p>
            </div>
          </div>
          {/* Track selector */}
          <div className="flex gap-1.5 mb-3">
            {(['aux', 'admin', 'tec'] as const).map(t => {
              const track = OPE_TRACKS.find(tr => tr.id === t)!;
              return (
                <button key={t} onClick={() => setActiveTrack(t)}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition ${
                    activeTrack === t ? 'bg-[#282182] text-white' : 'bg-slate-100 text-gray-600 hover:bg-slate-200'
                  }`}>
                  {track.icon} {track.shortName}
                </button>
              );
            })}
          </div>
          {/* Search */}
          <input
            type="text"
            placeholder="Buscar ley o norma…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:border-[#282182] transition"
          />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 pb-28 space-y-6">
        {(Object.keys(grouped) as LeyGroup['categoria'][]).map(cat => (
          <section key={cat}>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
              {CATEGORIA_LABELS[cat]}
            </h2>
            <div className="space-y-2">
              {grouped[cat].map(ley => {
                const colors = CATEGORIA_COLORS[ley.categoria];
                return (
                  <button
                    key={ley.id}
                    onClick={() => startLey(ley)}
                    disabled={loading}
                    className={`w-full text-left p-4 rounded-2xl border ${colors.bg} ${colors.border} hover:shadow-sm transition-all active:scale-[0.98]`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl mt-0.5 flex-shrink-0">{ley.icono}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold text-sm ${colors.text} leading-snug`}>{ley.nombre}</p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{ley.descripcion}</p>
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {ley.tracks.map(t => (
                            <span key={t} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TRACK_BADGE[t].color}`}>
                              {TRACK_BADGE[t].label}
                            </span>
                          ))}
                          <span className="text-[10px] text-gray-400 ml-1 self-center">
                            {ley.modulos.length} módulo{ley.modulos.length > 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <span className="text-gray-400 text-sm flex-shrink-0 mt-1">→</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-sm">No se encontró ninguna ley con ese nombre.</p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
