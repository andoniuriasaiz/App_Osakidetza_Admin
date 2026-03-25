'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { MODULES } from '@/lib/modules';
import { OPE_TRACKS, daysUntilExam } from '@/lib/tracks';
import { loadQuestions, Question, shuffleArray, getModuleBaseUrl } from '@/lib/questions';
import { recordAnswer } from '@/lib/progress';
import { addLocalXP, getLocalXP, persistXP, XP_EXAM_CORRECT, XP_EXAM_WRONG, getLevel, incrementTodayAnswerCount } from '@/lib/xp';
import { playCorrect, playWrong, playSessionDone } from '@/lib/sound';
import { notifyAnswered } from '@/lib/quests';
import BottomNav from '@/components/BottomNav';
import ConfirmModal from '@/components/ConfirmModal';
import LevelUpModal from '@/components/LevelUpModal';
import { IconShare } from '@/components/AppIcons';

// ─── Types ─────────────────────────────────────────────────
type ExamPhase = 'config' | 'taking' | 'review';

interface ExamConfig {
  moduleId: string;
  questionCount: number;
  timeLimitMin: number | null; // null = sin límite
}

interface ExamAnswer {
  question: Question;
  selected: number[];
  isCorrect: boolean;
  skipped: boolean;
}


// ─── Helpers ────────────────────────────────────────────────
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Main component ─────────────────────────────────────────
export default function ExamPage() {
  const router = useRouter();

  const [phase, setPhase] = useState<ExamPhase>('config');
  const [config, setConfig] = useState<ExamConfig>({
    moduleId: 'mezcla',
    questionCount: 30,
    timeLimitMin: null,
  });

  // Taking phase
  const [questions, setQuestions]   = useState<Question[]>([]);
  const [answers, setAnswers]       = useState<Map<number, number[]>>(new Map());
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft]     = useState<number | null>(null);
  const [loading, setLoading]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Review phase
  const [results, setResults] = useState<ExamAnswer[]>([]);
  const [timeTaken, setTimeTaken] = useState(0);
  const [reviewIdx, setReviewIdx] = useState<number | null>(null);
  const [examXP, setExamXP] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpLevel, setLevelUpLevel] = useState<ReturnType<typeof getLevel> | null>(null);
  const [activeTrack, setActiveTrack] = useState<'aux' | 'admin' | 'tec'>('aux');

  // ─── Submit exam ─────────────────────────────────────────
  const submitExam = useCallback(() => {
    const totalSecs = config.timeLimitMin
      ? config.timeLimitMin * 60 - (timeLeft ?? 0)
      : 0;
    setTimeTaken(totalSecs);

    const prevTotalXP = getLocalXP();
    let totalXP = 0;

    const examResults: ExamAnswer[] = questions.map((q: Question, i: number) => {
      const selected = answers.get(i) ?? [];
      const skipped = selected.length === 0;
      const correctSet = new Set(q.correctAnswerNums);
      const selectedSet = new Set(selected);
      const isCorrect = !skipped &&
        correctSet.size === selectedSet.size &&
        [...correctSet].every(v => selectedSet.has(v));

      // Record to SM-2
      if (!skipped) recordAnswer(q.id, isCorrect ? 2 : 0);

      // Award XP + quests
      if (!skipped) {
        const xp = isCorrect ? XP_EXAM_CORRECT : XP_EXAM_WRONG;
        addLocalXP(xp);
        totalXP += xp;
        const count = incrementTodayAnswerCount();
        notifyAnswered(count);
      }

      return { question: q, selected, isCorrect, skipped };
    });

    persistXP(getLocalXP());
    setExamXP(totalXP);

    // Sound
    playSessionDone();

    // Level-up detection
    const newTotalXP = getLocalXP();
    const prevLvl = getLevel(prevTotalXP);
    const newLvl = getLevel(newTotalXP);
    if (newLvl.level > prevLvl.level) {
      setTimeout(() => { setLevelUpLevel(newLvl); setShowLevelUp(true); }, 1000);
    }

    setResults(examResults);
    setPhase('review');
    setShowConfirm(false);
  }, [questions, answers, timeLeft, config.timeLimitMin]);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.push('/login');
    } else {
      const savedTrack = localStorage.getItem('osakidetza_active_track') as 'aux' | 'admin' | 'tec';
      if (savedTrack) setActiveTrack(savedTrack);
    }
  }, [router]);

  // ─── Timer ──────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'taking' || timeLeft === null) return;
    if (timeLeft <= 0) { submitExam(); return; }
    const t = setTimeout(() => setTimeLeft((prev: number | null) => (prev ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft, submitExam]);

  // ─── Start exam ──────────────────────────────────────────
  async function startExam() {
    setLoading(true);
    const all = await loadQuestions(config.moduleId);
    // Only test-type questions (C and I) for the exam
    const testQs = all.filter(q => q.type === 'C' || q.type === 'I');
    const selected = shuffleArray(testQs).slice(0, config.questionCount);
    setQuestions(selected);
    setAnswers(new Map());
    setCurrentIdx(0);
    setTimeLeft(config.timeLimitMin ? config.timeLimitMin * 60 : null);
    setTimeTaken(0);
    setLoading(false);
    setPhase('taking');
  }

  // ─── Toggle answer ───────────────────────────────────────
  function toggleAnswer(val: number) {
    const q = questions[currentIdx];
    if (!q) return;
    setAnswers((prev: Map<number, number[]>) => {
      const next = new Map(prev);
      const current = next.get(currentIdx) ?? [];
      if (q.correctAnswerNums.length === 1) {
        next.set(currentIdx, [val]);
      } else {
        if (current.includes(val)) next.set(currentIdx, current.filter((v: number) => v !== val));
        else next.set(currentIdx, [...current, val]);
      }
      return next;
    });
  }

  // ─── Navigate ────────────────────────────────────────────
  function goTo(idx: number) {
    setCurrentIdx(Math.max(0, Math.min(idx, questions.length - 1)));
  }

  // ─── Keyboard shortcuts ──────────────────────────────────
  useEffect(() => {
    if (phase !== 'taking') return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'l') goTo(currentIdx + 1);
      if (e.key === 'ArrowLeft'  || e.key === 'h') goTo(currentIdx - 1);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [phase, currentIdx]);

  // ──────────────────────────────────────────────────────────
  // CONFIG PHASE
  // ──────────────────────────────────────────────────────────
  if (phase === 'config') {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')}
              className="text-gray-400 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition text-lg">←</button>
            <div>
              <h1 className="font-bold text-gray-900">Simulacro de Examen</h1>
              <p className="text-xs text-gray-400">Sin corrección inmediata — como el examen real</p>
            </div>
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-4 py-8 pb-24 space-y-6">
          {/* OPE Preset */}
          {(() => {
            const track = OPE_TRACKS.find(t => t.id === activeTrack) || OPE_TRACKS[0];
            const daysLeft = daysUntilExam(track.examDate);
            return (
              <div className="bg-gradient-to-br from-[#282182] to-[#170f55] rounded-2xl p-5 text-white">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-bold text-base">{track.icon} Simulacro OPE {track.shortName}</p>
                    <p className="text-xs opacity-70 mt-0.5">{track.name}</p>
                  </div>
                  <div className="text-right bg-white/10 rounded-xl px-3 py-2">
                    <div className="text-xl font-black leading-none">{daysLeft}</div>
                    <div className="text-[10px] opacity-60">días</div>
                  </div>
                </div>
                <button
                  onClick={() => setConfig({ moduleId: 'mezcla', questionCount: 60, timeLimitMin: 90 })}
                  className="w-full bg-white/15 hover:bg-white/25 border border-white/20 rounded-xl py-2.5 text-sm font-bold transition"
                >
                  🎯 Formato oficial — 60 preguntas, 90 min
                </button>
              </div>
            );
          })()}

          {/* Module selector */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Módulo de examen</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(() => {
                const track = OPE_TRACKS.find(t => t.id === activeTrack) || OPE_TRACKS[0];
                const allIds = [...track.commonModuleIds, ...track.specificModuleIds];
                const mods = allIds.slice(0, 5).map(id => MODULES.find(m => m.id === id)!).filter(Boolean);
                return [
                  { id: 'mezcla', label: `🎲 Todo el temario (${track.shortName})`, sub: 'Temario completo mezclado' },
                  ...mods.map((m: any) => ({
                    id: m.id,
                    label: m.shortName,
                    sub: (m.category === 'comun' || m.category === 'tec-comun') ? 'Temario Común' : 'Temario Específico'
                  }))
                ].map((m: any) => (
                  <button key={m.id}
                    onClick={() => setConfig((c: any) => ({ ...c, moduleId: m.id }))}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      config.moduleId === m.id
                        ? 'border-[#282182] bg-[#e8e7f7]'
                        : 'border-slate-200 bg-white hover:border-[#9591d0]'
                    }`}
                  >
                    <div className={`font-semibold text-sm ${config.moduleId === m.id ? 'text-[#282182]' : 'text-gray-800'}`}>
                      {m.label}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{m.sub}</div>
                  </button>
                ));
              })()}
            </div>
          </div>

          {/* Question count */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Número de preguntas</p>
            <div className="flex gap-2">
              {[10, 20, 30, 60].map((n: number) => (
                <button key={n}
                  onClick={() => setConfig((c: any) => ({ ...c, questionCount: n }))}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all border-2 ${
                    config.questionCount === n
                      ? 'border-[#282182] bg-[#282182] text-white'
                      : 'border-slate-200 bg-white text-gray-700 hover:border-[#9591d0]'
                  }`}
                >{n}</button>
              ))}
            </div>
          </div>

          {/* Time limit */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Tiempo límite</p>
            <div className="flex gap-2">
              {[
                { val: null, label: 'Sin límite' },
                { val: 30,   label: '30 min' },
                { val: 60,   label: '1 hora' },
                { val: 90,   label: '90 min' },
              ].map(({ val, label }: any) => (
                <button key={String(val)}
                  onClick={() => setConfig((c: any) => ({ ...c, timeLimitMin: val }))}
                  className={`flex-1 py-3 rounded-xl font-semibold text-xs transition-all border-2 ${
                    config.timeLimitMin === val
                      ? 'border-[#282182] bg-[#282182] text-white'
                      : 'border-slate-200 bg-white text-gray-600 hover:border-[#9591d0]'
                  }`}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Info box */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
            <p className="font-semibold mb-1">📋 Cómo funciona el simulacro</p>
            <ul className="space-y-1 text-xs text-amber-700">
              <li>• Responde todas las preguntas sin corrección inmediata</li>
              <li>• Puedes navegar libremente entre preguntas antes de entregar</li>
              <li>• Al finalizar verás tu puntuación y la corrección completa</li>
              <li>• Los resultados se integran en tu repaso espaciado automáticamente</li>
              {config.timeLimitMin && (
                <li>• ⏱️ Tiempo: {config.timeLimitMin} minutos — el examen se entrega solo si se acaba</li>
              )}
            </ul>
          </div>

          <button
            onClick={startExam}
            disabled={loading}
            className="w-full bg-[#282182] hover:bg-[#1e1965] text-white font-bold py-4 rounded-2xl transition text-base shadow-sm"
          >
            {loading ? 'Cargando preguntas...' : `Empezar simulacro — ${config.questionCount} preguntas`}
          </button>
        </div>
      <BottomNav />
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  // TAKING PHASE
  // ──────────────────────────────────────────────────────────
  if (phase === 'taking') {
    const q = questions[currentIdx];
    const selected = answers.get(currentIdx) ?? [];
    const answered = selected.length > 0;
    const baseUrl = getModuleBaseUrl(q?.module ?? config.moduleId);
    const rawImg = q?.imageUrl || (q?.image ? `${baseUrl}${q.image}` : null);
    const imgSrc = rawImg && !rawImg.includes('noimage') ? rawImg : null;

    const totalAnswered = [...answers.values()].filter(a => a.length > 0).length;
    const pct = Math.round((totalAnswered / questions.length) * 100);

    // Timer color
    const timerDanger = timeLeft !== null && timeLeft < 120;
    const timerWarn   = timeLeft !== null && timeLeft < 300;

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {showConfirm && (
          <ConfirmModal
            message="¿Entregar el examen? No podrás cambiar las respuestas."
            confirmLabel="Entregar"
            cancelLabel="Seguir"
            onConfirm={submitExam}
            onCancel={() => setShowConfirm(false)}
          />
        )}

        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-600">
                {currentIdx + 1} / {questions.length}
                <span className="text-xs text-gray-400 ml-2">({totalAnswered} respondidas)</span>
              </div>

              {timeLeft !== null && (
                <div className={`font-mono font-bold text-base px-3 py-1 rounded-lg ${
                  timerDanger ? 'bg-red-100 text-red-600 animate-pulse'
                  : timerWarn ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-100 text-slate-700'
                }`}>
                  ⏱ {formatTime(timeLeft)}
                </div>
              )}

              <button
                onClick={() => setShowConfirm(true)}
                className="bg-[#282182] hover:bg-[#1e1965] text-white text-xs font-bold px-3 py-2 rounded-lg transition"
              >
                Entregar
              </button>
            </div>

            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 flex flex-col gap-4">
          {/* Question card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  q?.type === 'I' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                }`}>
                  {q?.type === 'I' ? '🖼️ Imagen' : '✅ Test'}
                </span>
                <span className="text-xs text-gray-400">#{q?.questionNum}</span>
                {q?.multipleCorrect && (
                  <span className="text-xs text-blue-500 font-medium">· varias correctas</span>
                )}
                {answered && (
                  <span className="ml-auto text-xs text-emerald-600 font-semibold">✓ Respondida</span>
                )}
              </div>
              <h2 className="text-base font-semibold text-gray-900 leading-snug">{q?.question}</h2>
            </div>

            {q?.type === 'I' && imgSrc && (
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-100">
                <img
                  src={imgSrc}
                  alt="Imagen de la pregunta"
                  className="max-w-full mx-auto rounded-lg border border-gray-200 shadow-sm"
                  style={{ maxHeight: '200px', objectFit: 'contain', display: 'block' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            )}

            {/* Corporate-style clean option buttons */}
            <div className="p-4 grid grid-cols-1 gap-2">
              {q?.options?.map((opt: any, i: number) => {
                const letter = ['A', 'B', 'C', 'D'][i % 4];
                const isSelected = selected.includes(opt.value);

                return (
                  <button
                    key={opt.value}
                    onClick={() => toggleAnswer(opt.value)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm text-left transition-all duration-150"
                    style={{
                      background: isSelected ? '#ffffff' : '#f8f9fa',
                      color: isSelected ? '#282182' : '#374151',
                      border: isSelected ? '2px solid #282182' : '2px solid #e5e7eb',
                      transform: isSelected ? 'scale(1.01)' : 'scale(1)',
                      boxShadow: isSelected ? '0 2px 8px rgba(40,33,130,0.15)' : 'none',
                    }}
                  >
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black flex-shrink-0 transition-colors"
                      style={{
                        background: isSelected ? '#282182' : '#e8e7f7',
                        color: isSelected ? 'white' : '#282182',
                      }}
                    >
                      {letter}
                    </span>
                    <span className="flex-1 leading-snug">{opt.text}</span>
                    {isSelected && <span className="text-[#282182] font-bold flex-shrink-0">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex gap-2">
            <button
              onClick={() => goTo(currentIdx - 1)}
              disabled={currentIdx === 0}
              className="flex-1 py-3 rounded-xl border-2 border-slate-200 bg-white text-gray-700 font-semibold text-sm hover:border-slate-400 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Anterior
            </button>
            {currentIdx < questions.length - 1 ? (
              <button
                onClick={() => goTo(currentIdx + 1)}
                className="flex-1 py-3 rounded-xl bg-[#282182] hover:bg-[#1e1965] text-white font-semibold text-sm transition"
              >
                Siguiente →
              </button>
            ) : (
              <button
                onClick={() => setShowConfirm(true)}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition"
              >
                ✓ Entregar examen
              </button>
            )}
          </div>

          {/* Question grid navigator */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-gray-400 mb-3">Navegación rápida</p>
            <div className="flex flex-wrap gap-1.5">
              {questions.map((_: Question, i: number) => {
                const isAns = (answers.get(i) ?? []).length > 0;
                const isCurrent = i === currentIdx;
                return (
                  <button
                    key={i}
                    onClick={() => goTo(i)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                      isCurrent
                        ? 'bg-[#282182] text-white ring-2 ring-[#9591d0]'
                        : isAns
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  // REVIEW PHASE
  // ──────────────────────────────────────────────────────────
  const correct  = results.filter((r: ExamAnswer) => r.isCorrect).length;
  const wrong    = results.filter((r: ExamAnswer) => !r.isCorrect && !r.skipped).length;
  const skipped  = results.filter((r: ExamAnswer) => r.skipped).length;
  const total    = results.length;
  const pctScore = total > 0 ? Math.round((correct / total) * 100) : 0;
  const passed   = pctScore >= 60;

  const penalized = correct - (wrong * (1 / 3));
  const penPct    = total > 0 ? Math.max(0, Math.round((penalized / total) * 100)) : 0;

  if (reviewIdx !== null) {
    const r = results[reviewIdx];
    const q = r.question;
    const baseUrl = getModuleBaseUrl(q.module);
    const rawImg = q.imageUrl || (q.image ? `${baseUrl}${q.image}` : null);
    const imgSrc = rawImg && !rawImg.includes('noimage') ? rawImg : null;

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <button onClick={() => setReviewIdx(null)}
              className="text-gray-400 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition">←</button>
            <h1 className="font-bold text-gray-900">Pregunta {reviewIdx + 1} de {total}</h1>
            <div className="ml-auto flex gap-1">
              <button onClick={() => setReviewIdx(Math.max(0, reviewIdx - 1))} disabled={reviewIdx === 0}
                className="px-3 py-1.5 rounded-lg bg-slate-100 text-sm font-semibold disabled:opacity-40">‹</button>
              <button onClick={() => setReviewIdx(Math.min(total - 1, reviewIdx + 1))} disabled={reviewIdx === total - 1}
                className="px-3 py-1.5 rounded-lg bg-slate-100 text-sm font-semibold disabled:opacity-40">›</button>
            </div>
          </div>
        </header>
        <main className="max-w-2xl mx-auto w-full px-4 py-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 pt-5 pb-4 border-b border-slate-100">
              <div className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full mb-3 ${
                r.skipped ? 'bg-slate-100 text-slate-600'
                : r.isCorrect ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
              }`}>
                {r.skipped ? '○ Sin responder' : r.isCorrect ? '✓ Correcta' : '✗ Incorrecta'}
              </div>
              <h2 className="text-base font-semibold text-gray-900 leading-snug">{q.question}</h2>
            </div>
            {imgSrc && q.type === 'I' && (
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                <img src={imgSrc} alt="" className="max-w-full mx-auto rounded-lg border border-gray-200"
                  style={{ maxHeight: '180px', objectFit: 'contain', display: 'block' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
            )}
            <div className="p-4 grid grid-cols-1 gap-2">
              {q.options?.map((opt: any, i: number) => {
                const wasSelected = r.selected.includes(opt.value);
                const isCorrect   = q.correctAnswerNums.includes(opt.value);
                const letter = ['A', 'B', 'C', 'D'][i % 4];

                let bgColor = '#f8f9fa';
                let borderColor = '#e5e7eb';
                let textColor = '#6b7280';
                let badgeBg = '#e8e7f7';
                let badgeTextColor = '#282182';
                let badgeText: string = letter;

                if (isCorrect) {
                  bgColor = '#f0fdf4';
                  borderColor = '#22c55e';
                  textColor = '#166534';
                  badgeBg = '#22c55e';
                  badgeTextColor = '#ffffff';
                  badgeText = '✓';
                } else if (wasSelected && !isCorrect) {
                  bgColor = '#fef2f2';
                  borderColor = '#ef4444';
                  textColor = '#991b1b';
                  badgeBg = '#ef4444';
                  badgeTextColor = '#ffffff';
                  badgeText = '✗';
                }

                return (
                  <div
                    key={opt.value}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
                    style={{ background: bgColor, border: `2px solid ${borderColor}`, color: textColor }}
                  >
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black flex-shrink-0"
                      style={{ background: badgeBg, color: badgeTextColor }}
                    >
                      {badgeText}
                    </span>
                    <span className={`flex-1 leading-snug font-medium ${isCorrect ? 'text-green-800' : wasSelected ? 'line-through text-red-700' : 'text-gray-500'}`}>
                      {opt.text}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <>
    {showLevelUp && levelUpLevel && (
      <LevelUpModal level={levelUpLevel} onClose={() => setShowLevelUp(false)} />
    )}
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')}
            className="text-gray-400 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition">←</button>
          <h1 className="font-bold text-gray-900">Resultado del simulacro</h1>
          {examXP > 0 && (
            <span className="ml-auto text-sm font-bold text-[#282182]">+{examXP} XP ⚡</span>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
        {/* Score card */}
        <div className={`rounded-2xl p-6 text-center ${passed
          ? 'bg-gradient-to-b from-green-50 to-white border-green-200'
          : 'bg-gradient-to-b from-red-50 to-white border-red-200'
        } border-2`}>
          <div className="text-6xl mb-3 animate-bounce-slow">
            {pctScore >= 80 ? '🏆' : pctScore >= 60 ? '✅' : pctScore >= 40 ? '📚' : '🔄'}
          </div>
          <div className={`text-5xl font-black mb-1 ${passed ? 'text-green-600' : 'text-red-500'}`}>{pctScore}%</div>
          <div className={`text-base font-bold mb-1 ${passed ? 'text-green-700' : 'text-red-600'}`}>
            {passed ? '✓ APROBADO' : '✗ SUSPENSO'}
          </div>
          <div className="text-xs text-gray-400">(umbral: 60%)</div>
          {timeTaken > 0 && (
            <div className="text-xs text-gray-400 mt-1">⏱ {formatTime(timeTaken)}</div>
          )}
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 rounded-xl p-4 text-center border border-green-100">
            <div className="text-3xl font-bold text-green-600">{correct}</div>
            <div className="text-xs text-green-700 mt-0.5">Correctas</div>
          </div>
          <div className="bg-red-50 rounded-xl p-4 text-center border border-red-100">
            <div className="text-3xl font-bold text-red-500">{wrong}</div>
            <div className="text-xs text-red-600 mt-0.5">Incorrectas</div>
          </div>
          <div className="bg-slate-100 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-slate-500">{skipped}</div>
            <div className="text-xs text-slate-500 mt-0.5">Sin responder</div>
          </div>
        </div>

        {/* Penalized score */}
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-800">Nota con penalización (−⅓)</p>
            <p className="text-xs text-amber-600 mt-0.5">Como en el examen Osakidetza</p>
          </div>
          <div className={`text-2xl font-bold ${penPct >= 60 ? 'text-green-600' : 'text-red-500'}`}>
            {penPct}%
          </div>
        </div>

        {/* XP earned */}
        <div className="bg-[#e8e7f7] border border-[#d4d3f0] rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#282182]">XP ganado en este simulacro</p>
            <p className="text-xs text-[#4a4a8a] mt-0.5">+{correct * XP_EXAM_CORRECT + wrong * XP_EXAM_WRONG} XP por tus respuestas</p>
          </div>
          <div className="text-2xl font-bold text-[#282182]">⚡</div>
        </div>

        {/* Per-question review */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <p className="font-semibold text-gray-800 text-sm">Revisión pregunta a pregunta</p>
            <span className="text-xs text-gray-400">{total} preguntas</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {results.map((r: ExamAnswer, i: number) => (
              <button
                key={i}
                onClick={() => setReviewIdx(i)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition text-left"
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  r.skipped ? 'bg-slate-200 text-slate-500'
                  : r.isCorrect ? 'bg-green-500 text-white'
                  : 'bg-red-500 text-white'
                }`}>
                  {r.skipped ? '○' : r.isCorrect ? '✓' : '✗'}
                </span>
                <span className="text-xs text-gray-700 truncate flex-1">{r.question.question}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">ver →</span>
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2 pb-6">
          <button onClick={() => setPhase('config')}
            className="w-full bg-[#282182] hover:bg-[#1e1965] text-white font-bold py-3.5 rounded-xl transition text-sm">
            Nuevo simulacro
          </button>
          <button
            onClick={async () => {
              const text = `🎯 Simulacro Osakidetza OPE — ${pctScore}% (${passed ? '✅ Aprobado' : '❌ Suspenso'})\n✔ ${correct} correctas · ✘ ${wrong} incorrectas · — ${skipped} sin respuesta\nCon penalización: ${penPct}%`;
              if (navigator.share) {
                try {
                  await navigator.share({ title: 'Mi resultado — Osakidetza OPE', text });
                } catch { /* cancelado */ }
              } else {
                await navigator.clipboard.writeText(text);
                alert('Resultado copiado al portapapeles 📋');
              }
            }}
            className="w-full py-3.5 rounded-xl transition text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: '#f0f9ff', color: '#0284c7', border: '1.5px solid #bae6fd' }}
          >
            <IconShare size={15} /> Compartir resultado
          </button>
          <button onClick={() => router.push('/dashboard')}
            className="w-full bg-slate-100 hover:bg-slate-200 text-gray-700 font-semibold py-3.5 rounded-xl transition text-sm">
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
