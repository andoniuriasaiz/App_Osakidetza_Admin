'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getModule } from '@/lib/modules';
import { loadQuestions, Question, shuffleArray, getModuleBaseUrl } from '@/lib/questions';
import { getDueQuestions, recordAnswer, getCardState, incrementSession, getMostWrong, getWrongCount } from '@/lib/progress';
import { Quality, CardState, getDueLabel, previewInterval, updateCard } from '@/lib/spaced-repetition';
import { addLocalXP, getLocalXP, persistXP, XP_PER_QUALITY, incrementTodayAnswerCount, applyCombo, getComboLabel, getLevel, saveDailyProgressToDB } from '@/lib/xp';
import { playCorrect, playWrong, playCombo, playStreakBroken, playSessionDone, isMuted, toggleMute } from '@/lib/sound';
import { isBookmarked, toggleBookmark, getBookmarkedIds, syncBookmarksFromDB } from '@/lib/bookmarks';
import { notifyAnswered, notifyStreak, notifyErrorFixed, saveQuestsToDB } from '@/lib/quests';
import { logSession } from '@/lib/session-history';
import CelebrationFlash from '@/components/CelebrationFlash';
import LevelUpModal from '@/components/LevelUpModal';
import ComboBanner from '@/components/ComboBanner';
import {
  ModuleIcon, IconLayers, IconCheckSquare, IconMouse, IconImage,
  IconClock, IconBolt, IconShuffle, IconBullseye, IconArrowRight,
  IconTrendingUp, IconTrophy, IconStar, IconRefresh, IconAward,
  IconCheckCircle, IconXCircle, IconCursor, IconZoomIn, IconMonitor,
  IconRepeatSm, IconCalendar, IconLightbulb, IconAlertTriangle, IconInfo,
  IconVolume, IconVolumeOff, IconBookmark, IconHeartFill, IconHeart,
} from '@/components/AppIcons';

// ─── Types ────────────────────────────────────────────────
type StudyMode = 'selecting' | 'studying' | 'finished';
type QuestionFilter = 'all' | 'test' | 'sim' | 'bookmarks';


// ─── Image Lightbox ────────────────────────────────────────
function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <img src={src} alt="Imagen ampliada" onClick={e => e.stopPropagation()} />
      <button
        className="absolute top-4 right-4 text-white bg-black/40 rounded-full w-9 h-9 flex items-center justify-center text-lg hover:bg-black/60 transition"
        onClick={onClose}
      >×</button>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────
export default function StudyPage() {
  const router = useRouter();
  const params = useParams();
  const moduleId = params.module as string;

  const [mode, setMode] = useState<StudyMode>('selecting');
  const [mod, setMod] = useState<ReturnType<typeof getModule>>(undefined);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [qFilter, setQFilter] = useState<QuestionFilter>('all');
  const [queue, setQueue] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [answered, setAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [sessionStats, setSessionStats] = useState({ correct: 0, wrong: 0, streak: 0, total: 0 });
  const [cardState, setCardState] = useState<CardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [wrongInSession, setWrongInSession] = useState<Question[]>([]);
  const [animClass, setAnimClass] = useState('animate-in');
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [studyType, setStudyType] = useState<'due' | 'new' | 'all' | 'errors'>('due');
  const [lives, setLives] = useState(3);
  const [survivalMode, setSurvivalMode] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [xpGained, setXpGained] = useState(0);
  const [sessionXP, setSessionXP] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [muted, setMuted] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpLevel, setLevelUpLevel] = useState<ReturnType<typeof getLevel> | null>(null);
  const [currentBookmarked, setCurrentBookmarked] = useState(false);
  const [showComboBanner, setShowComboBanner] = useState(false);
  const [comboStreakForBanner, setComboStreakForBanner] = useState(0);
  const startTimeRef = useRef<number>(Date.now());
  const sessionLoggedRef = useRef(false);
  const [solStep, setSolStep] = useState(0);
  const [orderedMode, setOrderedMode] = useState(false); // false = aleatorio, true = en orden
  // ── Simulation interactive state ──────────────────────────
  const [simStep, setSimStep] = useState(0);   // current image index (0 = initial state)
  const [simClickAnim, setSimClickAnim] = useState<{x: number; y: number} | null>(null);
  const [showCollage, setShowCollage] = useState(false); // review: collage vs single-step
  const [todayStudiedQueue, setTodayStudiedQueue] = useState<Question[]>([]); // questions studied in 'due' session
  const [showExplanation, setShowExplanation] = useState(false); // toggle explanation panel
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const session = getSession();
    if (!session) { router.push('/login'); return; }
    const modData = getModule(moduleId);
    if (!modData) { router.push('/dashboard'); return; }
    setMod(modData);
    loadQuestions(moduleId).then(qs => {
      setAllQuestions(qs);
      setLoading(false);
    });
    // Sync bookmarks from DB in background (actualiza localStorage si hay diferencias)
    syncBookmarksFromDB();
  }, [moduleId, router]);

  // ─── Filter questions by type ────────────────
  const filterByType = useCallback((qs: Question[], filter: QuestionFilter) => {
    if (filter === 'test') return qs.filter(q => q.type === 'C' || q.type === 'I');
    if (filter === 'sim')  return qs.filter(q => q.type === 'B');
    return qs;
  }, []);

  // ─── Start study session ─────────────────────
  function startStudy(type: 'due' | 'new' | 'all' | 'errors' | 'bookmarks', survival = false, ordered = false) {
    setStudyType(type as 'due' | 'new' | 'all' | 'errors');
    setSurvivalMode(survival);
    setLives(3);
    setSessionXP(0);
    setMaxStreak(0);
    setMuted(isMuted());
    const base = filterByType(allQuestions, qFilter === 'bookmarks' ? 'all' : qFilter);
    let qs: Question[];

    if (type === 'due') {
      const dueIds = getDueQuestions(base.map(q => q.id));
      qs = dueIds.map(id => base.find(q => q.id === id)!).filter(Boolean);
    } else if (type === 'new') {
      qs = base.filter(q => getCardState(q.id).lastReview === 0);
    } else if (type === 'errors') {
      const errIds = getMostWrong(base.map(q => q.id), 50);
      qs = errIds.map(id => base.find(q => q.id === id)!).filter(Boolean);
    } else if (type === 'bookmarks') {
      const bmIds = new Set(getBookmarkedIds());
      qs = shuffleArray(allQuestions.filter(q => bmIds.has(q.id)));
    } else {
      qs = ordered ? [...base] : shuffleArray([...base]);
    }

    if (qs.length === 0) { alert('No hay preguntas disponibles.'); return; }
    qs = qs.slice(0, 50);

    setQueue(qs);
    setCurrentIdx(0);
    setSessionStats({ correct: 0, wrong: 0, streak: 0, total: 0 });
    setWrongInSession([]);
    setShowAnswer(false);
    setAnswered(false);
    setIsCorrect(null);
    setSelectedOptions([]);
    setCardState(null);
    setSolStep(0);
    setSimStep(0);
    setSimClickAnim(null);
    setShowCollage(false);
    setShowExplanation(false);
    setAnimClass('animate-in');
    // Track today's studied questions for práctica de hoy
    if (type === 'due') setTodayStudiedQueue(qs);
    setMode('studying');
    startTimeRef.current = Date.now();
    sessionLoggedRef.current = false;
    incrementSession();
  }

  const current = queue[currentIdx];
  const isSimulation = current?.type === 'B';
  const isImageTest  = current?.type === 'I';
  const progress = queue.length > 0 ? (currentIdx / queue.length) * 100 : 0;

  const baseUrl = getModuleBaseUrl(moduleId);
  const rawImg = current?.imageUrl || (current?.image ? `${baseUrl}${current.image}` : null);
  const imgSrc = rawImg && !rawImg.includes('noimage') ? rawImg : null;

  const currentCard = current ? getCardState(current.id) : null;

  // ─── Keyboard shortcuts ──────────────────────
  useEffect(() => {
    if (mode !== 'studying') return;

    function handleKey(e: KeyboardEvent) {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (!answered && !showAnswer) {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          if (isSimulation) {
            // Space = skip interactive mode, jump directly to solution (collage if >1 step)
            setShowAnswer(true); setAnswered(true); setSolStep(0);
            if (effectiveSolImgs.length > 1) setShowCollage(true);
          }
          else if (selectedOptions.length > 0) submitAnswer();
        }
      } else {
        if (isCorrect === false && !isSimulation) {
          // Wrong answer — 3 buttons: 1=Repetir ahora, 2=Mañana, 3=Ya lo sé
          if (e.code === 'Digit1' || e.key === '1') { e.preventDefault(); repeatCurrentQuestion(); }
          if (e.code === 'Digit2' || e.key === '2') { e.preventDefault(); rateAndNext(1); }
          if (e.code === 'Digit3' || e.key === '3') { e.preventDefault(); rateAndNext(3); }
        } else {
          // Correct answer or simulation — 4 buttons (or 2 for correct)
          if (e.code === 'Digit1' || e.key === '1') { e.preventDefault(); rateAndNext(0); }
          if (e.code === 'Digit2' || e.key === '2') { e.preventDefault(); rateAndNext(1); }
          if (e.code === 'Digit3' || e.key === '3') { e.preventDefault(); rateAndNext(2); }
          if (e.code === 'Digit4' || e.key === '4') { e.preventDefault(); rateAndNext(3); }
          if ((e.code === 'Space' || e.code === 'Enter') && isCorrect === true) {
            e.preventDefault(); rateAndNext(2);
          }
        }
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, answered, showAnswer, selectedOptions, isSimulation, isCorrect, current]);

  // ─── Sync bookmark state for current question ─
  useEffect(() => {
    if (current) setCurrentBookmarked(isBookmarked(current.id));
  }, [current]);

  // ─── Log session when finished ────────────────
  useEffect(() => {
    if (mode === 'finished' && sessionStats.total > 0 && !sessionLoggedRef.current) {
      sessionLoggedRef.current = true;
      const durationSec = Math.round((Date.now() - startTimeRef.current) / 1000);
      logSession({
        moduleId,
        moduleName: mod?.name ?? moduleId,
        mode: studyType,
        correct: sessionStats.correct,
        wrong: sessionStats.wrong,
        total: sessionStats.total,
        xp: sessionXP,
        maxStreak,
        durationSec,
      });
      // Sync daily progress and quests to DB
      saveDailyProgressToDB();
      saveQuestsToDB();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ─── Toggle option ───────────────────────────
  function toggleOption(val: number) {
    if (answered) return;
    if (current?.correctAnswerNums.length === 1) {
      // Single answer — select and immediately submit
      setSelectedOptions([val]);
    } else {
      setSelectedOptions(prev =>
        prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
      );
    }
  }

  // Auto-submit for single-answer questions on click
  useEffect(() => {
    if (!answered && !isSimulation && current?.correctAnswerNums.length === 1 && selectedOptions.length === 1) {
      submitAnswer();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOptions]);

  // ─── Submit answer ───────────────────────────
  function submitAnswer() {
    if (!current || answered) return;
    const correctSet = new Set(current.correctAnswerNums);
    const selectedSet = new Set(selectedOptions);
    const correct = correctSet.size === selectedSet.size && [...correctSet].every(v => selectedSet.has(v));

    setAnswered(true);
    setIsCorrect(correct);
    setShowAnswer(true);

    const quality: Quality = correct ? 2 : 0;
    const hadWrong = getWrongCount(current.id) > 0;
    const newState = recordAnswer(current.id, quality);
    setCardState(newState);

    // Compute new streak before state update (sessionStats.streak = streak BEFORE this answer)
    const newStreak = correct ? sessionStats.streak + 1 : 0;
    const newMax = Math.max(maxStreak, newStreak);
    setMaxStreak(newMax);

    // XP with combo multiplier
    const baseXP = XP_PER_QUALITY[quality];
    const xp = applyCombo(baseXP, newStreak);
    const prevTotalXP = getLocalXP();
    const newTotalXP = addLocalXP(xp);
    persistXP(newTotalXP);
    setSessionXP(s => s + xp);

    // Daily count + quests
    const todayCount = incrementTodayAnswerCount();
    notifyAnswered(todayCount);
    notifyStreak(newStreak);
    if (correct && hadWrong) notifyErrorFixed();

    // Level-up detection
    const prevLvl = getLevel(prevTotalXP);
    const newLvl = getLevel(newTotalXP);
    if (newLvl.level > prevLvl.level) {
      setTimeout(() => { setLevelUpLevel(newLvl); setShowLevelUp(true); }, 600);
    }

    // Sounds + ComboBanner
    if (correct) {
      if (newStreak === 3 || newStreak === 6 || newStreak === 10) {
        playCombo();
        setComboStreakForBanner(newStreak);
        setShowComboBanner(true);
      } else {
        playCorrect();
      }
      setXpGained(xp);
      setShowCelebration(true);
    } else {
      playWrong();
      if (sessionStats.streak >= 3) playStreakBroken();
      if (survivalMode) {
        setLives(prev => {
          const next = prev - 1;
          if (next <= 0) setTimeout(() => { playSessionDone(); setMode('finished'); }, 800);
          return next;
        });
      }
    }

    setSessionStats(prev => ({
      correct: correct ? prev.correct + 1 : prev.correct,
      wrong: !correct ? prev.wrong + 1 : prev.wrong,
      streak: newStreak,
      total: prev.total + 1,
    }));

    if (!correct) setWrongInSession(p => [...p, current]);
  }

  // ─── Simulation interactive click handler ────
  // interactiveImages = [imgSrc (step0), ...effectiveSolImgs (steps 1..N)]
  // imgSrc and effectiveSolImgs are computed at component scope and captured by closure.
  function handleSimClick(e: React.MouseEvent<HTMLDivElement>) {
    if (showAnswer || simClickAnim) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setSimClickAnim({ x, y });
    setTimeout(() => {
      setSimClickAnim(null);
      const totalLocal = Math.max((imgSrc ? 1 : 0) + effectiveSolImgs.length, 1);
      const nextStep = simStep + 1;
      if (nextStep >= totalLocal) {
        setShowAnswer(true);
        setAnswered(true);
        setSolStep(0);
      } else {
        setSimStep(nextStep);
      }
    }, 480);
  }

  // ─── Rate and go next ────────────────────────
  // For test/image-test questions (type C/I): submitAnswer() already handled all
  // counting, XP and stats. Here we only overwrite SM-2 with the user's self-assessed
  // quality and navigate forward.
  // For simulation questions (type B): submitAnswer() is never called, so this
  // function is responsible for the full counting/XP/stats logic.
  function rateAndNext(quality: Quality) {
    if (current) {
      // Always persist the user's self-assessed SM-2 quality (overwrites auto-quality
      // recorded in submitAnswer for test questions; first recording for simulations).
      const newState = recordAnswer(current.id, quality);
      setCardState(newState);

      if (isSimulation) {
        // ── Simulation: full counting (submitAnswer was never called) ──────────
        const good = quality >= 2;

        const newStreak = good ? sessionStats.streak + 1 : 0;
        const newMax = Math.max(maxStreak, newStreak);
        setMaxStreak(newMax);

        const baseXP = XP_PER_QUALITY[quality];
        const xp = applyCombo(baseXP, newStreak);
        const prevTotalXP = getLocalXP();
        const newTotalXP = addLocalXP(xp);
        persistXP(newTotalXP);
        setSessionXP(s => s + xp);

        const todayCount = incrementTodayAnswerCount();
        notifyAnswered(todayCount);
        notifyStreak(newStreak);

        const prevLvl = getLevel(prevTotalXP);
        const newLvl = getLevel(newTotalXP);
        if (newLvl.level > prevLvl.level) {
          setTimeout(() => { setLevelUpLevel(newLvl); setShowLevelUp(true); }, 300);
        }

        if (good) {
          if (newStreak === 3 || newStreak === 6 || newStreak === 10) {
            playCombo();
            setComboStreakForBanner(newStreak);
            setShowComboBanner(true);
          } else {
            playCorrect();
          }
          setXpGained(xp);
          setShowCelebration(true);
        } else {
          playWrong();
          if (sessionStats.streak >= 3) playStreakBroken();
          if (survivalMode) {
            setLives(prev => {
              const next = prev - 1;
              if (next <= 0) setTimeout(() => { playSessionDone(); setMode('finished'); }, 800);
              return next;
            });
          }
        }

        setSessionStats(prev => ({
          correct: good ? prev.correct + 1 : prev.correct,
          wrong: !good ? prev.wrong + 1 : prev.wrong,
          streak: newStreak,
          total: prev.total + 1,
        }));
        if (!good) setWrongInSession(p => [...p, current]);
      }
      // Test/image-test: counting/XP/stats already done in submitAnswer — nothing more to do.
    }
    nextQuestion();
  }

  // ─── Next question ───────────────────────────
  function nextQuestion() {
    setAnimClass('opacity-0 -translate-x-3 transition-all duration-200');
    setTimeout(() => {
      if (currentIdx + 1 >= queue.length) {
        setMode('finished');
      } else {
        setCurrentIdx(prev => {
          const next = prev + 1;
          // Update bookmark state for next question
          const nextQ = queue[next];
          if (nextQ) setCurrentBookmarked(isBookmarked(nextQ.id));
          return next;
        });
        setShowAnswer(false);
        setAnswered(false);
        setIsCorrect(null);
        setSelectedOptions([]);
        setCardState(null);
        setSolStep(0);
        setSimStep(0);
        setSimClickAnim(null);
        setShowCollage(false);
        setShowExplanation(false);
        setAnimClass('animate-in-right');
        setTimeout(() => setAnimClass(''), 300);
      }
    }, 180);
  }

  // ─── Repeat current question (re-insert at end of queue) ─
  function repeatCurrentQuestion() {
    if (current) {
      setQueue(q => [...q, current]);
    }
    nextQuestion();
  }

  // ─── Computed stats for selecting screen ────
  const testQs = allQuestions.filter(q => q.type === 'C' || q.type === 'I');
  const simQs  = allQuestions.filter(q => q.type === 'B');
  const filteredQs = filterByType(allQuestions, qFilter === 'bookmarks' ? 'all' : qFilter);
  const dueCount      = getDueQuestions(filteredQs.map(q => q.id)).length;
  const newCount      = filteredQs.filter(q => getCardState(q.id).lastReview === 0).length;
  const errorCount    = getMostWrong(filteredQs.map(q => q.id), 50).length;
  const bookmarkCount = getBookmarkedIds().filter(id => allQuestions.some(q => q.id === id)).length;

  // ──────────────────────────────────────────────
  // LOADING
  // ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#282182] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Cargando preguntas...</p>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────
  // SELECTING MODE
  // ──────────────────────────────────────────────
  if (mode === 'selecting') {
    return (
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')}
              className="text-gray-400 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition text-lg">
              ←
            </button>
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              {mod && <ModuleIcon id={mod.id} size={32} />}
              <div className="min-w-0">
                <h1 className="font-bold text-gray-900 text-lg leading-tight truncate">{mod?.name}</h1>
                <p className="text-xs text-gray-400 mt-0.5">{allQuestions.length} preguntas en total</p>
              </div>
            </div>
            <button onClick={() => router.push('/stats')}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg transition"
              style={{ color: '#7070a0' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#e8e7f7'; (e.currentTarget as HTMLButtonElement).style.color = '#282182'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#7070a0'; }}
              aria-label="Ver estadísticas"
            >
              <IconTrendingUp size={16} />
            </button>
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

          {/* Question type selector */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Tipo de preguntas</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: 'all'  as const, label: 'Todo',       count: allQuestions.length, desc: 'Test + Simulación' },
                { key: 'test' as const, label: 'Test',        count: testQs.length,       desc: 'Tipo C e I' },
                { key: 'sim'  as const, label: 'Simulación', count: simQs.length,        desc: 'Tipo B — clic' },
              ]).map(({ key, label, count, desc }) => {
                const active = qFilter === key;
                const Icon = key === 'all' ? IconLayers : key === 'test' ? IconCheckSquare : IconMouse;
                return (
                  <button
                    key={key}
                    onClick={() => setQFilter(key)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      active
                        ? 'border-[#282182] bg-[#e8e7f7]'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className={`mb-2 ${active ? 'text-[#282182]' : 'text-gray-400'}`}>
                      <Icon size={18} />
                    </div>
                    <div className={`font-semibold text-sm ${active ? 'text-[#282182]' : 'text-gray-800'}`}>
                      {label}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{count} · {desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Study modes */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Modo de estudio</p>
            <div className="space-y-2">

              {/* Due */}
              <div className={`w-full rounded-xl border text-left transition-all ${
                dueCount > 0
                  ? 'border-2 border-[#282182] bg-[#fafafe]'
                  : 'border-slate-200 bg-slate-50'
              }`}>
                <button
                  onClick={() => startStudy('due')}
                  disabled={dueCount === 0}
                  className={`w-full text-left ${dueCount > 0 ? 'cursor-pointer' : 'cursor-not-allowed opacity-45'}`}
                  style={{ padding: '14px 16px' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        dueCount > 0 ? 'bg-[#e8e7f7] text-[#282182]' : 'bg-slate-100 text-slate-400'
                      }`}>
                        <IconClock size={18} />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                          Práctica de hoy
                          {dueCount > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-bold leading-tight"
                              style={{ background: '#282182', color: 'white' }}>
                              {dueCount}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {dueCount > 0
                            ? 'Solo las que toca hoy según tu progreso — sin repetir lo que ya sabes'
                            : '✓ Todo al día · el algoritmo decide cuándo vuelve cada una'}
                        </div>
                      </div>
                    </div>
                    {dueCount > 0 && (
                      <span style={{ color: '#282182' }}><IconArrowRight size={15} /></span>
                    )}
                  </div>
                </button>
                {/* Sub-botón: repasar igualmente si ya está al día */}
                {dueCount === 0 && todayStudiedQueue.length > 0 && (
                  <div className="px-4 pb-3">
                    <button
                      onClick={() => {
                        const qs = shuffleArray([...todayStudiedQueue]);
                        setQueue(qs); setCurrentIdx(0);
                        setSessionStats({ correct: 0, wrong: 0, streak: 0, total: 0 });
                        setSessionXP(0); setMaxStreak(0); setWrongInSession([]);
                        setShowAnswer(false); setAnswered(false); setIsCorrect(null);
                        setSelectedOptions([]); setCardState(null); setSolStep(0);
                        setSimStep(0); setSimClickAnim(null); setShowCollage(false);
                        setShowExplanation(false); setAnimClass('animate-in'); setMode('studying');
                      }}
                      className="w-full py-1.5 rounded-lg text-xs font-semibold text-[#282182] border border-[#c8c7ef] bg-[#f0f0fb] hover:bg-[#e8e7f7] transition"
                    >
                      🔁 Repasar las de hoy otra vez ({todayStudiedQueue.length})
                    </button>
                  </div>
                )}
              </div>

              {/* New */}
              <button
                onClick={() => startStudy('new')}
                disabled={newCount === 0}
                className={`w-full rounded-xl border text-left transition-all ${
                  newCount > 0
                    ? 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm cursor-pointer'
                    : 'border-slate-100 bg-gray-50 opacity-45 cursor-not-allowed'
                }`}
                style={{ padding: '14px 16px' }}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    newCount > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <IconBolt size={18} />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                      Preguntas nuevas
                      {newCount > 0 && (
                        <span className="bg-emerald-600 text-white text-xs px-2 py-0.5 rounded-full font-bold leading-tight">
                          {newCount}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {newCount > 0 ? `${newCount} que nunca has visto` : 'Has empezado todas'}
                    </div>
                  </div>
                </div>
              </button>

              {/* All — con selector de orden */}
              <div className="w-full rounded-xl border border-slate-200 bg-white" style={{ padding: '14px 16px' }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-100 text-slate-500">
                    <IconShuffle size={18} />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                      Repaso libre
                      <span className="bg-slate-600 text-white text-xs px-2 py-0.5 rounded-full font-bold leading-tight">
                        {filteredQs.length}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">Todas las preguntas — ignora el algoritmo, tú eliges</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setOrderedMode(false); startStudy('all', false, false); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border-2 border-slate-200 bg-slate-50 hover:border-[#282182] hover:bg-[#e8e7f7] text-slate-700 hover:text-[#282182] font-semibold text-xs transition-all"
                  >
                    <IconShuffle size={13} /> Aleatorio
                  </button>
                  <button
                    onClick={() => { setOrderedMode(true); startStudy('all', false, true); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border-2 border-slate-200 bg-slate-50 hover:border-emerald-500 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 font-semibold text-xs transition-all"
                  >
                    <IconArrowRight size={13} /> En orden
                  </button>
                </div>
              </div>

              {/* Mis errores */}
              <button
                onClick={() => startStudy('errors')}
                disabled={errorCount === 0}
                className={`w-full rounded-xl border text-left transition-all ${
                  errorCount > 0
                    ? 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm cursor-pointer'
                    : 'border-slate-100 bg-gray-50 opacity-45 cursor-not-allowed'
                }`}
                style={{ padding: '14px 16px' }}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    errorCount > 0 ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <IconBullseye size={18} />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                      Mis errores
                      {errorCount > 0 && (
                        <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold leading-tight">
                          {errorCount}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {errorCount > 0
                        ? 'Las preguntas que más has fallado, ordenadas por frecuencia'
                        : 'Sin errores registrados aún'}
                    </div>
                  </div>
                </div>
              </button>

              {/* Favoritas */}
              <button
                onClick={() => startStudy('bookmarks')}
                disabled={bookmarkCount === 0}
                className={`w-full rounded-xl border text-left transition-all ${
                  bookmarkCount > 0
                    ? 'border-amber-200 bg-amber-50 hover:bg-amber-100 hover:border-amber-300 cursor-pointer'
                    : 'border-slate-100 bg-gray-50 opacity-45 cursor-not-allowed'
                }`}
                style={{ padding: '14px 16px' }}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-base ${
                    bookmarkCount > 0 ? 'bg-amber-400' : 'bg-slate-100 text-slate-400'
                  }`}>
                    ⭐
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                      Mis favoritas
                      {bookmarkCount > 0 && (
                        <span className="bg-amber-400 text-white text-xs px-2 py-0.5 rounded-full font-bold leading-tight">
                          {bookmarkCount}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {bookmarkCount > 0 ? 'Preguntas marcadas con ⭐ para repasar' : 'Marca preguntas con ⭐ para guardarlas aquí'}
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Survival mode */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Modo especial</p>
            <button
              onClick={() => startStudy('all', true, false)}
              disabled={filteredQs.length === 0}
              className="w-full rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 hover:border-red-300 text-left transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ padding: '14px 16px' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-red-500 text-white">
                  <IconHeartFill size={18} />
                </div>
                <div>
                  <div className="font-semibold text-red-900 text-sm flex items-center gap-2">
                    Modo supervivencia
                    <span className="inline-flex items-center gap-1 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold leading-tight">
                      3 <IconHeartFill size={9} />
                    </span>
                  </div>
                  <div className="text-xs text-red-600 mt-0.5">3 fallos y termina la sesión · ¡A por racha!</div>
                </div>
              </div>
            </button>
          </div>

          {/* Mini legend */}
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Valoración de respuestas</p>
            <p className="text-xs text-slate-500 mb-2.5 font-medium">Si aciertas:</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-gray-500 mb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                <span><strong className="text-gray-700">★ Fácil</strong> — más tiempo</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#282182' }} />
                <span><strong className="text-gray-700">✓ Bien</strong> — varios días</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-2.5 font-medium">Si fallas:</p>
            <div className="grid grid-cols-3 gap-x-3 gap-y-2 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                <span><strong className="text-gray-700">🔁 Repetir</strong> — ahora mismo</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
                <span><strong className="text-gray-700">📅 Mañana</strong> — 1 día</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                <span><strong className="text-gray-700">💡 Ya lo sé</strong> — días</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────
  // FINISHED MODE
  // ──────────────────────────────────────────────
  if (mode === 'finished') {
    const pct = sessionStats.total > 0 ? Math.round((sessionStats.correct / sessionStats.total) * 100) : 0;
    const ResultColor = pct >= 85 ? '#f59e0b' : pct >= 65 ? '#282182' : '#64748b';
    const ResultIconColor = pct >= 85 ? 'text-amber-400' : pct >= 65 ? 'text-[#282182]' : 'text-slate-400';
    const ResultIconSize = 52;

    function retryWrongs() {
      if (wrongInSession.length === 0) return;
      const qs = shuffleArray([...wrongInSession]);
      setQueue(qs);
      setCurrentIdx(0);
      setSessionStats({ correct: 0, wrong: 0, streak: 0, total: 0 });
      setSessionXP(0);
      setMaxStreak(0);
      setWrongInSession([]);
      setShowAnswer(false);
      setAnswered(false);
      setIsCorrect(null);
      setSelectedOptions([]);
      setCardState(null);
      setSolStep(0);
      setSimStep(0);
      setSimClickAnim(null);
      setShowCollage(false);
      setAnimClass('animate-in');
      setMode('studying');
    }

    return (
      <>
        {showLevelUp && levelUpLevel && (
          <LevelUpModal level={levelUpLevel} onClose={() => setShowLevelUp(false)} />
        )}
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f4f4fb' }}>
          <div className="max-w-md w-full bounce-in">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              {/* Header */}
              <div className={`px-6 pt-8 pb-6 text-center ${pct >= 70 ? 'bg-gradient-to-b from-green-50' : 'bg-gradient-to-b from-[#e8e7f7]'}`}>
                <div className={`flex justify-center mb-3 ${ResultIconColor}`}>
                  {pct >= 85 ? <IconTrophy size={ResultIconSize} /> : pct >= 65 ? <IconStar size={ResultIconSize} /> : <IconAward size={ResultIconSize} />}
                </div>
                <h2 className="text-2xl font-bold text-gray-900">¡Sesión completada!</h2>
                <p className="text-sm text-gray-500 mt-1">{mod?.name}</p>
              </div>

              {/* Stats */}
              <div className="px-6 py-5">
                {/* XP + streak row */}
                {sessionXP > 0 && (
                  <div className="flex gap-3 mb-4">
                    <div className="flex-1 rounded-xl p-3 text-center" style={{ background: '#e8e7f7' }}>
                      <div className="text-xl font-black text-[#282182]">+{sessionXP} XP</div>
                      <div className="flex items-center justify-center gap-1 text-xs text-[#282182] opacity-70 mt-0.5"><IconBolt size={11} /> Ganados</div>
                    </div>
                    {maxStreak >= 3 && (
                      <div className="flex-1 bg-orange-50 rounded-xl p-3 text-center border border-orange-100">
                        <div className="text-xl font-black text-orange-600">🔥 {maxStreak}</div>
                        <div className="text-xs text-orange-600 mt-0.5">Mejor racha</div>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="bg-green-50 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">{sessionStats.correct}</div>
                    <div className="text-xs text-green-700 mt-0.5">Correctas</div>
                  </div>
                  <div className="bg-red-50 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-red-500">{sessionStats.wrong}</div>
                    <div className="text-xs text-red-600 mt-0.5">Incorrectas</div>
                  </div>
                  <div className="rounded-xl p-3 text-center" style={{ background: '#e8e7f7' }}>
                    <div className="text-2xl font-bold" style={{ color: ResultColor }}>{pct}%</div>
                    <div className="text-xs mt-0.5" style={{ color: ResultColor }}>Precisión</div>
                  </div>
                </div>

                {wrongInSession.length > 0 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-amber-700">
                        A repasar ({wrongInSession.length}):
                      </p>
                    </div>
                    <ul className="space-y-1 max-h-24 overflow-y-auto mb-3">
                      {wrongInSession.map(q => (
                        <li key={q.id} className="text-xs text-amber-600 truncate flex gap-1.5">
                          <span>•</span><span>{q.question}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={retryWrongs}
                      className="w-full py-2 rounded-lg font-semibold text-xs text-amber-800 bg-amber-100 hover:bg-amber-200 transition"
                    >
                      🔁 Repasar errores ahora
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                  <button
                    onClick={() => { setMode('selecting'); }}
                    className="w-full bg-[#282182] hover:bg-[#1e1965] text-white font-semibold py-3 rounded-xl transition text-sm"
                  >
                    Nueva sesión
                  </button>
                  {/* Replay today's practice — only after 'due' sessions */}
                  {studyType === 'due' && todayStudiedQueue.length > 0 && (
                    <button
                      onClick={() => {
                        const qs = shuffleArray([...todayStudiedQueue]);
                        setQueue(qs);
                        setCurrentIdx(0);
                        setSessionStats({ correct: 0, wrong: 0, streak: 0, total: 0 });
                        setSessionXP(0);
                        setMaxStreak(0);
                        setWrongInSession([]);
                        setShowAnswer(false);
                        setAnswered(false);
                        setIsCorrect(null);
                        setSelectedOptions([]);
                        setCardState(null);
                        setSolStep(0);
                        setSimStep(0);
                        setSimClickAnim(null);
                        setShowCollage(false);
                        setShowExplanation(false);
                        setAnimClass('animate-in');
                        setMode('studying');
                      }}
                      className="w-full border-2 border-[#282182] text-[#282182] font-semibold py-3 rounded-xl transition text-sm hover:bg-[#e8e7f7]"
                    >
                      🔁 Repasar lo de hoy ({todayStudiedQueue.length} preguntas)
                    </button>
                  )}
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-gray-700 font-semibold py-3 rounded-xl transition text-sm"
                  >
                    Volver al inicio
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ──────────────────────────────────────────────
  // STUDYING MODE
  // ──────────────────────────────────────────────

  // Simulation solution image state (computed here to keep JSX clean)
  //
  // solutionImages[] = all annotated solution step images (_step1, _step2, ...).
  // There is no step0 / enunciado-copy: all entries are real solution steps.
  // The enunciado is always provided separately via imageUrl (imgSrc).
  const solImgs = current?.solutionImages ?? [];
  // effectiveSolImgs = all solution steps (no slice needed — there's no duplicate enunciado)
  const effectiveSolImgs = solImgs;
  const hasSolution = effectiveSolImgs.length > 0;  // true when solution steps exist
  const totalSteps  = effectiveSolImgs.length;       // number of solution steps
  // displaySrc: enunciado before reveal; solution step after reveal (or imgSrc if no steps)
  const displaySrc = showAnswer && hasSolution ? effectiveSolImgs[solStep] : imgSrc;

  return (
    <>
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      {showComboBanner && (
        <ComboBanner
          streak={comboStreakForBanner}
          onDone={() => setShowComboBanner(false)}
        />
      )}
      {showCelebration && (
        <CelebrationFlash xpGained={xpGained} onDone={() => setShowCelebration(false)} />
      )}
      {showLevelUp && levelUpLevel && (
        <LevelUpModal level={levelUpLevel} onClose={() => setShowLevelUp(false)} />
      )}

      <div className="min-h-screen bg-slate-50 flex flex-col">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-2.5">
              <button
                onClick={() => setMode('selecting')}
                className="text-gray-400 hover:text-gray-700 text-sm px-2 py-1 rounded-lg hover:bg-gray-100 transition flex items-center gap-1"
              >
                ✕
              </button>

              {/* Center: progress counter or survival lives */}
              {survivalMode ? (
                <div className="flex items-center gap-0.5" title={`${lives} vidas restantes`}>
                  {[0,1,2].map(i => (
                    <span key={i} className={i < lives ? 'text-red-500' : 'text-slate-200'}>
                      <IconHeartFill size={17} />
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-sm font-semibold text-gray-600">
                  {currentIdx + 1} <span className="text-gray-300">/</span> {queue.length}
                </div>
              )}

              {/* Right: combo label + correct/wrong + mute */}
              <div className="flex items-center gap-2">
                {sessionStats.streak >= 3 && (
                  <span className="streak-badge text-xs px-2 py-0.5 rounded-full font-bold"
                    style={{ background: sessionStats.streak >= 10 ? '#282182' : sessionStats.streak >= 6 ? '#e6820e' : '#e21b3c', color: 'white' }}>
                    {getComboLabel(sessionStats.streak) || `🔥${sessionStats.streak}`}
                  </span>
                )}
                <span className="text-green-600 font-bold text-sm">✓{sessionStats.correct}</span>
                <span className="text-red-500 font-bold text-sm">✗{sessionStats.wrong}</span>
                <button
                  onClick={() => { toggleMute(); setMuted(m => !m); }}
                  className="ml-1 opacity-60 hover:opacity-100 transition text-gray-600"
                  title={muted ? 'Activar sonido' : 'Silenciar'}
                  aria-label={muted ? 'Activar sonido' : 'Silenciar'}
                >
                  {muted ? <IconVolumeOff size={16} /> : <IconVolume size={16} />}
                </button>
              </div>
            </div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </header>

        {/* Question card */}
        <main className={`flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 py-5 ${animClass}`}>

          {/* ── SIMULATION (Type B) ─────────────────────────────────── */}
          {isSimulation ? (() => {
            // Build the interactive image sequence:
            //   step 0  → imgSrc (imageUrl / enunciado — always available locally)
            //   step 1+ → effectiveSolImgs[step-1] (annotated solution screenshots)
            // This avoids relying on solutionImages[0] which may not exist on disk.
            const interactiveImages: string[] = [
              ...(imgSrc ? [imgSrc] : []),
              ...effectiveSolImgs,
            ];
            const totalSimImgs = Math.max(interactiveImages.length, 1);
            const isLastSimImg = simStep >= totalSimImgs - 1;
            const currentSimImg = interactiveImages[simStep] ?? null;
            return (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">

              {/* HEADER: badge · num · estado */}
              <div className="px-5 pt-4 pb-3 border-b border-slate-100 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-[#e8e7f7] text-[#282182]">
                      <IconMouse size={11} /> Simulación
                    </span>
                    <span className="text-xs text-slate-400">#{current?.questionNum}</span>
                    {!showAnswer && current && getWrongCount(current.id) > 0 && (
                      <span className="text-xs text-red-400 font-medium">✗×{getWrongCount(current.id)}</span>
                    )}
                  </div>
                  <p className="text-[15px] font-semibold text-gray-900 leading-snug">
                    {current?.question}
                  </p>
                </div>
                {/* Derecha: indicador de paso + bookmark */}
                <div className="flex-shrink-0 pt-0.5 flex items-center gap-2">
                  {showAnswer ? (
                    <span className="text-xs font-semibold text-[#282182] bg-[#e8e7f7] px-2.5 py-1 rounded-full whitespace-nowrap">
                      {totalSteps === 0 ? 'Sin imagen'
                        : showCollage ? `${totalSteps} pasos`
                        : totalSteps > 1 ? `Paso ${solStep + 1} / ${totalSteps}`
                        : 'Solución'}
                    </span>
                  ) : totalSimImgs > 1 ? (
                    <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full whitespace-nowrap">
                      {simStep + 1}/{totalSimImgs}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">{currentCard ? getDueLabel(currentCard) : ''}</span>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); if (current) { const bm = toggleBookmark(current.id); setCurrentBookmarked(bm); } }}
                    className={`transition-all active:scale-125 ${currentBookmarked ? 'text-amber-400' : 'text-slate-300 hover:text-slate-400'}`}
                    title={currentBookmarked ? 'Quitar de favoritas' : 'Guardar en favoritas'}
                    aria-label={currentBookmarked ? 'Quitar de favoritas' : 'Guardar en favoritas'}
                  >
                    <IconBookmark size={18} filled={currentBookmarked} />
                  </button>
                </div>
              </div>

              {/* MULTI-STEP NAVIGATOR — solo tras reveal para repasar */}
              {showAnswer && totalSteps > 1 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-[#f4f4fb] border-b border-[#e8e7f7]">
                  {!showCollage ? (
                    <>
                      <button
                        onClick={() => setSolStep(s => Math.max(0, s - 1))}
                        disabled={solStep === 0}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-[#282182] font-bold text-base disabled:opacity-20 hover:bg-[#e8e7f7] active:scale-95 transition"
                      >←</button>
                      <div className="flex-1 flex items-center justify-center gap-1.5">
                        {Array.from({ length: totalSteps }).map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setSolStep(i)}
                            className="rounded-full transition-all duration-200 hover:opacity-80"
                            style={{
                              width: i === solStep ? 22 : 8,
                              height: 8,
                              background: i === solStep ? '#282182' : '#c7c6e8',
                            }}
                          />
                        ))}
                      </div>
                      <button
                        onClick={() => setSolStep(s => Math.min(totalSteps - 1, s + 1))}
                        disabled={solStep === totalSteps - 1}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-[#282182] font-bold text-base disabled:opacity-20 hover:bg-[#e8e7f7] active:scale-95 transition"
                      >→</button>
                    </>
                  ) : (
                    <div className="flex-1 text-center text-xs font-semibold text-[#282182]">
                      Todos los pasos ({totalSteps})
                    </div>
                  )}
                  {/* Toggle collage / paso a paso */}
                  <button
                    onClick={() => setShowCollage(c => !c)}
                    title={showCollage ? 'Ver paso a paso' : 'Ver todos los pasos'}
                    className="ml-1 flex items-center gap-1 text-xs font-medium text-[#282182] bg-[#e8e7f7] hover:bg-[#d4d3f0] px-2.5 py-1 rounded-full transition active:scale-95"
                  >
                    {showCollage ? (
                      <>{/* single-step icon */}<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="1" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/></svg> Uno a uno</>
                    ) : (
                      <>{/* grid icon */}<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="1" width="4.5" height="4.5" rx="1" fill="currentColor"/><rect x="7.5" y="1" width="4.5" height="4.5" rx="1" fill="currentColor"/><rect x="1" y="7.5" width="4.5" height="4.5" rx="1" fill="currentColor"/><rect x="7.5" y="7.5" width="4.5" height="4.5" rx="1" fill="currentColor"/></svg> Ver todos</>
                    )}
                  </button>
                </div>
              )}

              {/* ── IMAGE ZONE ──────────────────────────────────────────── */}
              {!showAnswer ? (
                /* MODO INTERACTIVO: el usuario hace clic en cada pantalla para avanzar */
                <div
                  key={`sim-${current?.id}-${simStep}`}
                  className="relative select-none bg-slate-900 cursor-pointer active:brightness-90 transition-[filter]"
                  onClick={handleSimClick}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  {currentSimImg ? (
                    <>
                      <img
                        src={currentSimImg}
                        alt={simStep === 0 ? 'Estado inicial' : `Después del paso ${simStep}`}
                        className="w-full h-auto block"
                        style={{ maxHeight: '380px', objectFit: 'contain' }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        draggable={false}
                      />

                      {/* Ripple de clic — aparece donde hizo clic el usuario */}
                      {simClickAnim && (
                        <div
                          className="pointer-events-none absolute"
                          style={{
                            left: `${simClickAnim.x}%`,
                            top: `${simClickAnim.y}%`,
                            transform: 'translate(-50%, -50%)',
                          }}
                        >
                          <div
                            className="w-10 h-10 rounded-full border-2 border-white animate-ping"
                            style={{ opacity: 0.7 }}
                          />
                          <div
                            className="absolute top-1.5 left-1.5 w-7 h-7 rounded-full border-2 border-white"
                            style={{ background: 'rgba(255,255,255,0.5)' }}
                          />
                        </div>
                      )}

                      {/* Indicador inferior */}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/55 to-transparent pt-8 pb-2.5 pointer-events-none flex items-end justify-center">
                        <span className="text-[11px] text-white/90 font-semibold tracking-wide">
                          {isLastSimImg
                            ? '¿Lo harías así? Toca para confirmar'
                            : simStep === 0
                              ? 'Toca donde harías clic ·  Paso 1'
                              : `Sigue · Paso ${simStep + 1} de ${totalSimImgs}`}
                        </span>
                      </div>
                    </>
                  ) : (
                    /* Sin imagen disponible — mostrar placeholder */
                    <div className="px-5 py-14 text-center" onClick={handleSimClick}>
                      <div className="w-14 h-14 rounded-2xl bg-slate-700 flex items-center justify-center text-slate-400 mx-auto mb-3">
                        <IconMonitor size={28} />
                      </div>
                      <p className="text-sm text-slate-400 max-w-xs mx-auto leading-relaxed mb-2">
                        Piensa en el camino de menús o el botón correcto.
                      </p>
                      <span className="text-xs text-slate-500">Toca para continuar</span>
                    </div>
                  )}
                </div>
              ) : (
                /* MODO REVISIÓN: tras completar la simulación, navegar por las imágenes de solución */
                showAnswer && !hasSolution ? (
                  <div className="px-5 py-10 text-center bg-slate-50 border-t border-slate-100">
                    <div className="w-12 h-12 rounded-2xl bg-slate-200 flex items-center justify-center text-slate-400 mx-auto mb-3">
                      <IconMonitor size={24} />
                    </div>
                    <p className="text-sm font-medium text-slate-600 mb-1">Solución no disponible en imagen</p>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                      Consulta el material del módulo para ver el procedimiento correcto.
                    </p>
                  </div>
                ) : showCollage ? (
                  /* ── COLLAGE: todos los pasos numerados en cuadrícula ── */
                  <div className="p-3 bg-slate-50 border-t border-slate-100">
                    <div className="grid grid-cols-2 gap-2">
                      {effectiveSolImgs.map((src, i) => (
                        <div
                          key={src}
                          className="relative bg-white rounded-xl overflow-hidden border border-slate-200 cursor-zoom-in shadow-sm"
                          onClick={() => setLightboxSrc(src)}
                        >
                          <img
                            src={src}
                            alt={`Paso ${i + 1}`}
                            className="w-full h-auto block"
                            style={{ maxHeight: '160px', objectFit: 'contain' }}
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            draggable={false}
                          />
                          {/* Número de paso */}
                          <div className="absolute top-1.5 left-1.5">
                            <span className="text-[10px] font-bold text-white bg-[#282182] px-1.5 py-0.5 rounded-full leading-none">
                              {i + 1}
                            </span>
                          </div>
                          {/* Lupa */}
                          <div className="absolute bottom-1 right-1 pointer-events-none">
                            <span className="flex items-center gap-0.5 text-[9px] text-white bg-black/35 px-1.5 py-0.5 rounded-full">
                              <IconZoomIn size={8} /> ampliar
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* ── PASO A PASO: imagen individual con navegación ── */
                  <div
                    key={displaySrc}
                    className="relative select-none bg-slate-100 cursor-zoom-in"
                    onClick={() => displaySrc && setLightboxSrc(displaySrc)}
                  >
                    {displaySrc ? (
                      <>
                        <img
                          src={displaySrc}
                          alt={`Solución paso ${solStep + 1}`}
                          className="w-full h-auto block"
                          style={{ maxHeight: '380px', objectFit: 'contain' }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          draggable={false}
                        />
                        <div className="absolute bottom-2 right-2 pointer-events-none">
                          <span className="flex items-center gap-1 text-xs text-white bg-black/40 px-2 py-0.5 rounded-full">
                            <IconZoomIn size={10} /> ampliar
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="px-5 py-12 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-slate-200 flex items-center justify-center text-slate-400 mx-auto mb-3">
                          <IconMonitor size={28} />
                        </div>
                      </div>
                    )}
                  </div>
                )
              )}

              {/* ACTIONS */}
              <div className="px-5 py-4">
                {!showAnswer ? (
                  /* Botón discreto para saltar la simulación interactiva */
                  <button
                    onClick={() => {
                      setShowAnswer(true);
                      setAnswered(true);
                      setSolStep(0);
                      // Si hay varios pasos, abrir directamente en collage
                      if (effectiveSolImgs.length > 1) setShowCollage(true);
                    }}
                    className="w-full py-2 rounded-xl text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition"
                  >
                    Ver solución directamente <span className="opacity-50">· Espacio</span>
                  </button>
                ) : (
                  <div>
                    <p className="text-xs text-center text-slate-400 mb-3">
                      {totalSteps > 1 ? `¿Conocías los ${totalSteps} pasos?` : '¿Sabías hacerlo?'}
                    </p>
                    <RatingButtons card={currentCard} onRate={rateAndNext} showAll />
                  </div>
                )}
              </div>
            </div>
            );
          })() : (
            /* ── TEST / IMAGE-TEST (Type C / I) ─── */
            <div ref={cardRef} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              {/* Question header */}
              <div className="px-5 pt-5 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${
                    isImageTest ? 'bg-[#e8e7f7] text-[#282182]' : 'bg-green-100 text-green-700'
                  }`}>
                    {isImageTest ? <><IconImage size={12} /> Imagen</> : <><IconCheckSquare size={12} /> Test</>}
                  </span>
                  <span className="text-xs text-gray-400">#{current?.questionNum}</span>
                  {current?.multipleCorrect && !answered && (
                    <span className="text-xs text-[#282182] font-medium">· varias correctas</span>
                  )}
                  <span className="text-xs text-gray-400 flex items-center gap-1.5">
                    {currentCard ? getDueLabel(currentCard) : ''}
                    {current && getWrongCount(current.id) > 0 && (
                      <span className="text-red-400 font-semibold">· ✗×{getWrongCount(current.id)}</span>
                    )}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); if (current) { const bm = toggleBookmark(current.id); setCurrentBookmarked(bm); } }}
                    className={`ml-1 transition-all active:scale-125 ${currentBookmarked ? 'text-amber-400' : 'text-slate-300 hover:text-slate-400'}`}
                    title={currentBookmarked ? 'Quitar de favoritas' : 'Guardar en favoritas'}
                    aria-label={currentBookmarked ? 'Quitar de favoritas' : 'Guardar en favoritas'}
                  >
                    <IconBookmark size={18} filled={currentBookmarked} />
                  </button>
                </div>
                <h2 className="text-base font-semibold text-gray-900 leading-snug">
                  {current?.question}
                </h2>
              </div>

              {/* Image for Type I */}
              {isImageTest && imgSrc && (
                <div className="border-b border-slate-100 px-5 py-4 bg-slate-50">
                  <img
                    src={imgSrc}
                    alt="Imagen de la pregunta"
                    className="max-w-full mx-auto rounded-lg border border-gray-200 shadow-sm cursor-zoom-in hover:shadow-md transition"
                    style={{ maxHeight: '220px', objectFit: 'contain', display: 'block' }}
                    onClick={() => setLightboxSrc(imgSrc)}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <p className="text-center text-xs text-gray-400 mt-2">Pulsa la imagen para ampliar</p>
                </div>
              )}

              {/* Corporate-style clean option buttons */}
              {current?.options && (
                <div className="p-4 grid grid-cols-1 gap-2">
                  {current.options.map((opt, i) => {
                    const isSelected = selectedOptions.includes(opt.value);
                    const isCorrectOpt = current.correctAnswerNums.includes(opt.value);
                    const letter = ['A', 'B', 'C', 'D'][i % 4];

                    let bgColor = '#f8f9fa';
                    let borderColor = '#e5e7eb';
                    let textColor = '#374151';
                    let badgeBg = '#e8e7f7';
                    let badgeTextColor = '#282182';
                    let badgeText: string = letter;
                    let lineThrough = false;

                    if (answered) {
                      if (isCorrectOpt) {
                        bgColor = '#f0fdf4'; borderColor = '#22c55e'; textColor = '#166534';
                        badgeBg = '#22c55e'; badgeTextColor = '#ffffff'; badgeText = '✓';
                      } else if (isSelected && !isCorrectOpt) {
                        bgColor = '#fef2f2'; borderColor = '#ef4444'; textColor = '#991b1b';
                        badgeBg = '#ef4444'; badgeTextColor = '#ffffff'; badgeText = '✗'; lineThrough = true;
                      } else {
                        bgColor = '#f9fafb'; borderColor = '#e5e7eb'; textColor = '#9ca3af';
                        badgeBg = '#d1d5db'; badgeTextColor = '#ffffff';
                      }
                    } else if (isSelected) {
                      bgColor = '#ffffff'; borderColor = '#282182'; textColor = '#282182';
                      badgeBg = '#282182'; badgeTextColor = '#ffffff';
                    }

                    return (
                      <button
                        key={opt.value}
                        onClick={() => toggleOption(opt.value)}
                        disabled={answered}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm text-left transition-all duration-150 disabled:cursor-default"
                        style={{
                          background: bgColor,
                          border: `2px solid ${borderColor}`,
                          color: textColor,
                          transform: (!answered && isSelected) ? 'scale(1.01)' : 'scale(1)',
                          boxShadow: (!answered && isSelected) ? `0 2px 8px rgba(40,33,130,0.15)` : 'none',
                        }}
                      >
                        <span
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black flex-shrink-0"
                          style={{ background: badgeBg, color: badgeTextColor }}
                        >
                          {badgeText}
                        </span>
                        <span className={`flex-1 leading-snug ${lineThrough ? 'line-through' : ''}`}>
                          {opt.text}
                        </span>
                        {answered && isCorrectOpt && (
                          <span className="text-green-600 text-xs font-bold flex-shrink-0">✓ Correcta</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Result message + fuentes + explicación */}
              {answered && isCorrect !== null && (
                <div className="mx-5 mb-3 space-y-2 fade-in">
                  {/* Resultado principal */}
                  <div className={`px-4 py-3 rounded-xl text-sm font-medium ${
                    isCorrect
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-red-50 text-red-800 border border-red-100'
                  }`}>
                    {isCorrect ? (
                      <span className="flex items-center gap-1.5">
                        <IconCheckCircle size={14} /> ¡Correcto!
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <IconXCircle size={14} /> Respuesta correcta: {current?.correctAnswers.join(' / ')}
                      </span>
                    )}
                  </div>

                    {/* Badge de fuentes de fiabilidad */}
                    {current?.sourceStatus && (() => {
                      const sources     = current.sourceSources ?? [];
                      const status      = current.sourceStatus ?? '';
                      const confidence  = current.sourceConfidence;
                      const votes       = current.sourceVotes ?? {};
                      const count       = sources.length;

                      // Formatear lista de fuentes en español natural:
                      const fmt = (srcs: string[]) => {
                        const labels = srcs.map(s => s === 'IA' ? 'la IA' : s);
                        if (labels.length === 0) return '';
                        if (labels.length === 1) return labels[0];
                        return labels.slice(0, -1).join(', ') + ' y ' + labels[labels.length - 1];
                      };

                      if (count === 0 && !confidence) return null;

                      // Colores basados en confianza o status
                      const isHighConf = (confidence ?? 0) >= 80;
                      const isLowConf  = (confidence ?? 0) < 60;
                      const isDispute = ['DISPUTE', 'TRIPLE_DISPUTE', 'REVIEW_K_VS_UGT'].includes(status);

                      const bgClass  = isHighConf ? 'bg-emerald-50' : isDispute ? 'bg-amber-50' : 'bg-slate-50';
                      const txtClass = isHighConf ? 'text-emerald-700' : isDispute ? 'text-amber-700' : 'text-slate-500';
                      const brdClass = isHighConf ? 'border-emerald-200' : isDispute ? 'border-amber-200' : 'border-slate-200';
                      const icon     = isHighConf ? <IconCheckCircle size={11} /> : isDispute ? <IconAlertTriangle size={11} /> : <IconInfo size={11} />;

                      // 1. Badge de Confianza (si existe)
                      const confidenceBadge = confidence !== undefined && (
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${bgClass} ${txtClass} ${brdClass}`}>
                          {icon} {confidence}% credibilidad
                        </span>
                      );

                      // 2. Detalle de votos (Fantasía CSS) - Versión robusta
                      const sourceNamesMap: Record<string, string> = {
                        "IA": "IA",
                        "Kaixo": "Kaixo.com",
                        "Osasun": "Osasuntest",
                        "Osasuntest": "Osasuntest",
                        "UGT": "UGT"
                      };

                      const sourceOrder = ["UGT", "Kaixo", "Osasun", "IA"];
                      const correctAns = current?.correctAnswers?.[0] || (current?.correctAnswerNums && current.correctAnswerNums.length > 0 ? String.fromCharCode(64 + current.correctAnswerNums[0]) : '');

                      // Crear un mapa plano Fuente -> Respuesta a partir de votes (Respuesta -> [Fuentes])
                      const flatVotes: Record<string, string> = {};
                      Object.entries(votes || {}).forEach(([ans, srcs]) => {
                        // Si srcs es una lista (formato nuevo)
                        if (Array.isArray(srcs)) {
                           srcs.forEach(s => { 
                             flatVotes[s] = ans; 
                             // Alias para robustez
                             if (s === "Osasuntest") flatVotes["Osasun"] = ans;
                           });
                        } 
                        // Si srcs es un string (formato viejo/fallback)
                        else if (typeof srcs === 'string') {
                           flatVotes[ans] = srcs;
                        }
                      });

                      const voteDetails = sourceOrder.map(srcKey => {
                        const ans = flatVotes[srcKey] || flatVotes[sourceNamesMap[srcKey] || ''];
                        if (!ans || ans === "?") return null;
                        
                        const isCorrectSource = ans === correctAns;
                        const label = sourceNamesMap[srcKey] || srcKey;
                        
                        return (
                          <div key={srcKey} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border shadow-sm transition-all duration-300 ${
                            isCorrectSource 
                              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800 backdrop-blur-sm' 
                              : 'bg-red-50/80 border-red-100 text-red-700 backdrop-blur-sm opacity-90'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isCorrectSource ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'}`} />
                            <span className="text-[10px] font-bold tracking-tight uppercase">{label}:</span>
                            <span className={`text-[11px] font-black ${isCorrectSource ? 'text-emerald-900' : 'text-red-900'}`}>{ans}</span>
                          </div>
                        );
                      });

                      return (
                        <div className="flex flex-col gap-3 py-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {confidenceBadge}
                            {!confidence && (
                              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${bgClass} ${txtClass} ${brdClass}`}>
                                {icon} {count >= 2 ? `${fmt(sources)} coinciden` : `Solo ${fmt(sources)} confirma`}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap drop-shadow-sm">
                            {voteDetails}
                          </div>
                        </div>
                      );
                    })()}

                  {/* Explicación (toggle) */}
                  {current?.explanation && (
                    <div>
                      <button
                        onClick={() => setShowExplanation(v => !v)}
                        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-semibold text-[#282182] bg-[#f0f0fb] hover:bg-[#e8e7f7] border border-[#d4d3f0] transition"
                      >
                        <span>💡 ¿Por qué es correcta?</span>
                        <span className="opacity-60">{showExplanation ? '▲' : '▼'}</span>
                      </button>
                      {showExplanation && (
                        <div className="mt-1 px-4 py-3 rounded-xl bg-[#f8f8fd] border border-[#d4d3f0] text-xs text-gray-700 leading-relaxed">
                          {current.explanation}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="px-5 pb-5 pt-1">
                {!answered ? (
                  current?.correctAnswerNums.length === 1 ? (
                    <p className="text-xs text-center text-gray-400 py-1">Selecciona una opción para responder</p>
                  ) : (
                    <button
                      onClick={submitAnswer}
                      disabled={selectedOptions.length === 0}
                      className="w-full bg-[#282182] hover:bg-[#1e1965] text-white font-semibold py-3 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                    >
                      Comprobar <span className="opacity-60 text-xs ml-1">Intro</span>
                    </button>
                  )
                ) : (
                  <RatingButtons
                    card={currentCard}
                    onRate={rateAndNext}
                    showAll={isCorrect === false}
                    isWrong={isCorrect === false}
                    onRepeat={repeatCurrentQuestion}
                  />
                )}
              </div>
            </div>
          )}

          {/* Keyboard hint */}
          {answered && (
            <p className="text-center text-xs text-gray-400 mt-2 fade-in">
              {isCorrect === false && !isSimulation ? (
                <><span className="kbd">1</span> repetir &nbsp;·&nbsp; <span className="kbd">2</span> mañana &nbsp;·&nbsp; <span className="kbd">3</span> ya lo sé</>
              ) : (
                <><span className="kbd">1</span>–<span className="kbd">4</span> para valorar &nbsp;·&nbsp; <span className="kbd">Intro</span> si correcto</>
              )}
            </p>
          )}
        </main>
      </div>
    </>
  );
}

// ─── Rating Buttons component ──────────────────────────────
function RatingButtons({
  card,
  onRate,
  showAll,
  isWrong,
  onRepeat,
}: {
  card: CardState | null;
  onRate: (q: Quality) => void;
  showAll: boolean;
  isWrong?: boolean;
  onRepeat?: () => void;
}) {
  const fakeCard = card ?? { interval: 0, easeFactor: 2.5, repetitions: 0, nextReview: 0, lastReview: 0, totalReviews: 0, totalWrong: 0 };

  if (!showAll) {
    // Just answered correctly — simplified 2-button version
    return (
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => onRate(3)}
          className="rating-btn bg-green-100 text-green-800"
          style={{ padding: '12px 8px' }}>
          <span className="label">★ Fácil</span>
          <span className="interval">{previewInterval(fakeCard, 3)}</span>
        </button>
        <button onClick={() => onRate(2)}
          className="rating-btn bg-blue-100 text-blue-800"
          style={{ padding: '12px 8px' }}>
          <span className="label">✓ Bien</span>
          <span className="interval">{previewInterval(fakeCard, 2)}</span>
        </button>
      </div>
    );
  }

  if (isWrong && onRepeat) {
    // Wrong answer — 3 meaningful options instead of 4 redundant ones
    return (
      <div>
        <p className="text-xs text-center text-slate-400 mb-2">¿Cómo de bien la conocías?</p>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={onRepeat}
            className="rating-btn bg-red-50 text-red-700 border border-red-200"
            style={{ padding: '12px 6px' }}>
            <IconRepeatSm size={15} className="mx-auto" />
            <span className="label">Repetir</span>
            <span className="interval">ahora</span>
            <span className="text-xs opacity-40 font-mono">1</span>
          </button>
          <button
            onClick={() => onRate(1)}
            className="rating-btn bg-orange-50 text-orange-700 border border-orange-200"
            style={{ padding: '12px 6px' }}>
            <IconCalendar size={15} className="mx-auto" />
            <span className="label">Mañana</span>
            <span className="interval">{previewInterval(fakeCard, 1)}</span>
            <span className="text-xs opacity-40 font-mono">2</span>
          </button>
          <button
            onClick={() => onRate(3)}
            className="rating-btn bg-blue-50 text-blue-700 border border-blue-200"
            style={{ padding: '12px 6px' }}>
            <IconLightbulb size={15} className="mx-auto" />
            <span className="label">Ya lo sé</span>
            <span className="interval">{previewInterval(fakeCard, 3)}</span>
            <span className="text-xs opacity-40 font-mono">3</span>
          </button>
        </div>
      </div>
    );
  }

  // Simulation wrong / fallback — 4 buttons
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {([
        { q: 0, label: 'No sé',  emoji: '✗', cls: 'bg-red-100 text-red-800' },
        { q: 1, label: 'Difícil', emoji: '↺', cls: 'bg-orange-100 text-orange-800' },
        { q: 2, label: 'Bien',    emoji: '✓', cls: 'bg-blue-100 text-blue-800' },
        { q: 3, label: 'Fácil',   emoji: '★', cls: 'bg-green-100 text-green-800' },
      ] as const).map(({ q, label, emoji, cls }, idx) => (
        <button key={q} onClick={() => onRate(q as Quality)} className={`rating-btn ${cls}`}>
          <span className="text-base">{emoji}</span>
          <span className="label">{label}</span>
          <span className="interval">{previewInterval(fakeCard, q as Quality)}</span>
          <span className="text-xs opacity-40 font-mono">{idx + 1}</span>
        </button>
      ))}
    </div>
  );
}
