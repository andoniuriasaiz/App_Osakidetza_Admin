'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, logout } from '@/lib/auth';
import { MODULES } from '@/lib/modules';
import { loadQuestions } from '@/lib/questions';
import { getModuleStats, getStreak, syncFromDB } from '@/lib/progress';
import { getLocalXP, getDailyGoal, setDailyGoal as saveDailyGoal, getTodayAnswerCount, syncXPFromDB, addLocalXP, persistXP, syncDailyProgressFromDB } from '@/lib/xp';
import { getQuests, claimQuestReward, Quest, syncQuestsFromDB } from '@/lib/quests';
import { syncBookmarksFromDB } from '@/lib/bookmarks';
import { syncSessionsFromDB } from '@/lib/session-history';
import { grantWeeklyShield, getShieldCount, useShield, syncShieldsFromDB } from '@/lib/streak-shield';
import { getTheme, toggleTheme, initTheme, Theme } from '@/lib/theme';
import BottomNav from '@/components/BottomNav';
import XPBar from '@/components/XPBar';
import { ModuleIcon, IconBarChart, IconFlame, IconGraduationCap, IconShuffle, IconClock, IconShield, IconSun, IconMoon, IconPencil } from '@/components/AppIcons';

interface ModuleStats {
  total: number;
  new: number;
  learning: number;
  review: number;
  mastered: number;
  accuracy: number;
  dueNow: number;
  testCount: number;
  simCount: number;
}

export default function Dashboard() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [moduleStats, setModuleStats] = useState<Record<string, ModuleStats>>({});
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [xp, setXp] = useState(0);
  const [dailyGoal, setDailyGoal] = useState(20);
  const [todayCount, setTodayCount] = useState(0);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [shields, setShields] = useState(0);
  const [showGoalEdit, setShowGoalEdit] = useState(false);
  const [showStreakBroken, setShowStreakBroken] = useState(false);
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    const session = getSession();
    if (!session) { router.push('/login'); return; }
    setUsername(session.username);
    // Init theme
    initTheme();
    setThemeState(getTheme());
    // Cargar estado local inmediatamente
    setXp(getLocalXP());
    setDailyGoal(getDailyGoal());
    setTodayCount(getTodayAnswerCount());
    setQuests(getQuests());
    // Streak shield: grant weekly shield (1/week automáticamente)
    const granted = grantWeeklyShield();
    setShields(getShieldCount());
    if (granted) console.log('[shield] Escudo semanal otorgado');

    // Sincroniza el progreso desde la BD y luego carga stats
    syncFromDB().then(() => {
      const currentStreak = getStreak();
      setStreak(currentStreak);

      // Streak broken detection
      const today = new Date().toISOString().split('T')[0];
      const prevHadStreak = localStorage.getItem('chatelac_had_streak') === 'yes';
      const brokenShownDate = localStorage.getItem('chatelac_streak_broken_date');
      if (currentStreak > 0) {
        localStorage.setItem('chatelac_had_streak', 'yes');
      } else if (prevHadStreak && brokenShownDate !== today) {
        setShowStreakBroken(true);
      }

      loadStats();
    });
    // Sincronizar XP desde BD
    syncXPFromDB().then(() => {
      setXp(getLocalXP());
      setDailyGoal(getDailyGoal());
    });
    // Sincronizar bookmarks desde BD
    syncBookmarksFromDB();
    // Sincronizar quests, sesiones, progreso diario y escudos desde BD
    syncQuestsFromDB().then(() => setQuests(getQuests()));
    syncSessionsFromDB();
    syncShieldsFromDB().then(() => setShields(getShieldCount()));
    syncDailyProgressFromDB().then(() => setTodayCount(getTodayAnswerCount()));
  }, [router]);

  // Refresh local state whenever the page becomes visible again
  // (covers browser back-button navigation where Next.js reuses the component instance)
  useEffect(() => {
    const refreshLocal = () => {
      setQuests(getQuests());
      setXp(getLocalXP());
      setTodayCount(getTodayAnswerCount());
    };
    const onVisibilityChange = () => { if (!document.hidden) refreshLocal(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', refreshLocal);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', refreshLocal);
    };
  }, []);

  async function loadStats() {
    setLoading(true);
    const stats: Record<string, ModuleStats> = {};
    for (const mod of MODULES) {
      const questions = await loadQuestions(mod.id);
      if (questions.length > 0) {
        const base = getModuleStats(questions.map(q => q.id));
        stats[mod.id] = {
          ...base,
          testCount: questions.filter(q => q.type === 'C' || q.type === 'I').length,
          simCount:  questions.filter(q => q.type === 'B').length,
        };
      } else {
        stats[mod.id] = { total: 0, new: 0, learning: 0, review: 0, mastered: 0, accuracy: 0, dueNow: 0, testCount: 0, simCount: 0 };
      }
    }
    setModuleStats(stats);
    setLoading(false);
  }

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  function handleGoalChange(goal: number) {
    saveDailyGoal(goal);
    setDailyGoal(goal);
    setShowGoalEdit(false);
    fetch('/api/user/goal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dailyGoal: goal }),
    }).catch(() => {});
  }

  function handleUseShield() {
    if (!useShield()) return;
    setShields(getShieldCount());

    // Optimistically restore streak: add yesterday to studyDates in localStorage
    try {
      const raw = localStorage.getItem('chatelac_progress');
      const p = raw ? JSON.parse(raw) : {};
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const dates: string[] = p.studyDates ?? [];
      if (!dates.includes(yesterdayStr)) {
        dates.push(yesterdayStr);
        p.studyDates = dates;
        p.streak = 1;
        localStorage.setItem('chatelac_progress', JSON.stringify(p));
        setStreak(1);
      }
      // Persist to DB (background)
      fetch('/api/progress/touch-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: yesterdayStr }),
      }).catch(() => {});
    } catch { /* silencioso */ }

    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('chatelac_streak_broken_date', today);
    setShowStreakBroken(false);
  }

  function dismissStreakBroken() {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('chatelac_streak_broken_date', today);
    setShowStreakBroken(false);
  }

  function handleClaimQuest(questId: string) {
    const reward = claimQuestReward(questId);
    if (reward > 0) {
      const newXP = addLocalXP(reward);
      persistXP(newXP);
      setXp(newXP);
      setQuests(getQuests());
    }
  }

  // Exclude 'mezcla' from totals (it's a virtual module — would double-count)
  const realModuleStats = Object.entries(moduleStats)
    .filter(([id]) => id !== 'mezcla')
    .map(([, s]) => s);

  const totalDue       = realModuleStats.reduce((s, m) => s + m.dueNow, 0);
  const totalMastered  = realModuleStats.reduce((s, m) => s + m.mastered, 0);
  const totalQuestions = realModuleStats.reduce((s, m) => s + m.total, 0);
  // "Estudiadas" = seen at least once (not new) — the primary progress metric
  const totalStudied   = realModuleStats.reduce((s, m) => s + (m.total - m.new), 0);

  // Separate mezcla from real modules for rendering
  const realModules  = MODULES.filter(m => m.id !== 'mezcla');
  const mezclaModule = MODULES.find(m => m.id === 'mezcla');

  return (
    <div className="min-h-screen pb-20" style={{ background: '#f4f4fb' }}>
      {/* Header */}
      <header className="bg-white sticky top-0 z-10" style={{ borderBottom: '1px solid #e4e3f0' }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">

          {/* Marca Osakidetza */}
          <div className="flex items-center gap-3">
            {/* Anagrama simplificado */}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: '#282182' }}
              aria-hidden="true"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="10" y="3" width="4" height="18" rx="1.5" fill="white" />
                <rect x="3" y="10" width="18" height="4" rx="1.5" fill="white" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-gray-900 leading-tight text-base">IT Txartelak</h1>
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded hidden sm:inline"
                  style={{ background: '#e8e7f7', color: '#282182' }}
                >
                  Osakidetza
                </span>
              </div>
              <p className="text-xs" style={{ color: '#7070a0' }}>Práctica de ofimática</p>
            </div>
          </div>

          {/* Acciones derecha */}
          <div className="flex items-center gap-2">
            {shields > 0 && (
              <div
                className="flex items-center gap-1 text-sm font-bold px-2.5 py-1.5 rounded-full"
                style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1' }}
                title={`${shields} ${shields === 1 ? 'escudo' : 'escudos'} de racha disponibles`}
              >
                <IconShield size={13} /> {shields}
              </div>
            )}
            {streak > 0 && (
              <div
                className="flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-full"
                style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c' }}
                title={`Racha de ${streak} ${streak === 1 ? 'día' : 'días'}`}
              >
                <IconFlame size={14} /> {streak}
              </div>
            )}
            <button
              onClick={() => router.push('/stats')}
              className="text-sm flex items-center gap-1.5 px-3 py-2 rounded-lg transition"
              style={{ color: '#4a4a6a' }}
              aria-label="Ver estadísticas"
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#e8e7f7'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M3 3v18h18v-2H5V3H3zm4 14h2v-6H7v6zm4 0h2V7h-2v10zm4 0h2v-4h-2v4z"/>
              </svg>
              <span className="hidden sm:inline">Estadísticas</span>
            </button>
            <div
              className="flex items-center gap-2 text-sm"
              style={{ color: '#4a4a6a' }}
              title={username}
            >
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center font-semibold text-xs text-white"
                style={{ background: '#282182' }}
                aria-label={`Usuario: ${username}`}
              >
                {username.charAt(0).toUpperCase()}
              </span>
              <span className="font-medium hidden sm:inline">{username}</span>
            </div>
            <button
              onClick={() => {
                const next = toggleTheme();
                setThemeState(next);
              }}
              className="text-sm px-2.5 py-2 rounded-lg transition"
              style={{ color: '#7070a0' }}
              aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            >
              {theme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
            </button>
            <button
              onClick={handleLogout}
              className="text-sm px-3 py-2 rounded-lg transition"
              style={{ color: '#7070a0' }}
              aria-label="Cerrar sesión"
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#991b1b'; (e.currentTarget as HTMLButtonElement).style.background = '#fef2f2'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#7070a0'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Welcome banner — Azul Osakidetza corporativo */}
        <div
          className="rounded-2xl p-6 mb-6 text-white"
          style={{ background: 'linear-gradient(130deg, #282182 0%, #1e1965 60%, #170f55 100%)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold mb-1">
                ¡Hola, {username}!
              </h2>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.72)' }}>
                {totalDue > 0
                  ? `${totalDue} ${totalDue === 1 ? 'pregunta pendiente' : 'preguntas pendientes'} para hoy`
                  : '¡Al día con todas las preguntas! ✓'}
              </p>
            </div>
            {/* Right KPI: progress stats block */}
            <div className="text-right hidden sm:block">
              <div className="text-3xl font-bold">{totalStudied}</div>
              <div className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                de {totalQuestions} estudiadas
              </div>
              {totalMastered > 0 && (
                <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {totalMastered} dominadas
                </div>
              )}
            </div>
          </div>

          {/* XP Bar — dark variant */}
          <div className="mb-4">
            <XPBar xp={xp} variant="dark" className="mb-0" />
          </div>

          {/* Daily goal progress */}
          {dailyGoal > 0 && (
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
                <div className="flex items-center gap-1.5">
                  <span>Objetivo diario: {todayCount}/{dailyGoal} respuestas</span>
                  <button
                    onClick={() => setShowGoalEdit(v => !v)}
                    title="Cambiar objetivo diario"
                    style={{
                      background: 'rgba(255,255,255,0.15)',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      padding: '3px 5px',
                      color: 'rgba(255,255,255,0.75)',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <IconPencil size={11} />
                  </button>
                </div>
                <span>{todayCount >= dailyGoal ? '¡Completado!' : `${Math.round((todayCount/dailyGoal)*100)}%`}</span>
              </div>

              {showGoalEdit && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[10, 15, 20, 25, 30, 40, 50].map(g => (
                    <button
                      key={g}
                      onClick={() => handleGoalChange(g)}
                      style={{
                        padding: '2px 10px',
                        borderRadius: 20,
                        border: g === dailyGoal ? '2px solid white' : '1.5px solid rgba(255,255,255,0.3)',
                        background: g === dailyGoal ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                        color: 'white',
                        fontSize: 11,
                        fontWeight: g === dailyGoal ? 700 : 500,
                        cursor: 'pointer',
                      }}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              )}

              <div className="w-full rounded-full h-1.5" style={{ background: 'rgba(255,255,255,0.15)' }}>
                <div
                  className="rounded-full h-1.5 transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.round((todayCount/dailyGoal)*100))}%`,
                    background: todayCount >= dailyGoal ? '#4ade80' : 'rgba(255,255,255,0.9)',
                  }}
                />
              </div>
            </div>
          )}

          {/* Global progress */}
          {totalQuestions > 0 && (
            <div className="mt-3">
              <div
                className="flex items-center justify-between text-xs mb-1.5"
                style={{ color: 'rgba(255,255,255,0.5)' }}
              >
                <span>Progreso global</span>
                <span>{Math.round((totalMastered / totalQuestions) * 100)}%</span>
              </div>
              <div
                className="w-full rounded-full h-1"
                style={{ background: 'rgba(255,255,255,0.1)' }}
              >
                <div
                  className="rounded-full h-1 transition-all duration-500"
                  style={{
                    width: `${Math.round((totalMastered / totalQuestions) * 100)}%`,
                    background: 'rgba(255,255,255,0.6)',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Daily Quests ─────────────────────────────────────────────── */}
        {quests.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-6 overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-base">🎯</span>
                <h3 className="font-bold text-gray-900 text-sm">Misiones del día</h3>
              </div>
              <span className="text-xs text-gray-400">
                {quests.filter(q => q.completed).length}/{quests.length} completadas
              </span>
            </div>
            <div className="divide-y divide-slate-50">
              {quests.map(quest => {
                const pct = Math.min(100, Math.round((quest.progress / quest.target) * 100));
                return (
                  <div key={quest.id} className="px-5 py-3.5 flex items-center gap-4">
                    <span className="text-xl flex-shrink-0">{quest.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-semibold ${quest.completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                          {quest.title}
                        </span>
                        <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{quest.progress}/{quest.target}</span>
                      </div>
                      <p className="text-xs text-gray-400 mb-1.5">{quest.description}</p>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div
                          className="rounded-full h-1.5 transition-all duration-500"
                          style={{ width: `${pct}%`, background: quest.completed ? '#22c55e' : '#282182' }}
                        />
                      </div>
                    </div>
                    {quest.completed && !quest.rewardClaimed ? (
                      <button
                        onClick={() => handleClaimQuest(quest.id)}
                        className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg text-white transition"
                        style={{ background: '#22c55e' }}
                      >
                        +{quest.xpReward} XP
                      </button>
                    ) : quest.rewardClaimed ? (
                      <span className="flex-shrink-0 text-xs text-gray-300 font-semibold">✓</span>
                    ) : (
                      <span className="flex-shrink-0 text-xs text-gray-300">+{quest.xpReward}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Featured actions row ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {/* Simulacro CTA — tono cálido / alerta */}
          <button
            onClick={() => router.push('/exam')}
            className="text-white rounded-2xl p-5 text-left transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #be185d 0%, #9d174d 100%)' }}
            aria-label="Ir al simulacro de examen"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="text-white opacity-90"><IconGraduationCap size={30} /></div>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(255,255,255,0.2)' }}
              >
                Examen
              </span>
            </div>
            <h3 className="font-bold text-lg leading-tight mb-1">Simulacro de Examen</h3>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
              Cronometrado · Penalización −⅓ · Como el real
            </p>
          </button>

          {/* Mezcla — tono secundario corporativo */}
          {mezclaModule && (
            <button
              onClick={() => router.push(`/study/${mezclaModule.id}`)}
              className="text-white rounded-2xl p-5 text-left transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, #3832a0 0%, #282182 100%)' }}
              aria-label={`Práctica mezcla de módulos, ${moduleStats['mezcla']?.total ?? '—'} preguntas`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="text-white opacity-90"><IconShuffle size={28} /></div>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: 'rgba(255,255,255,0.2)' }}
                >
                  {moduleStats['mezcla']?.total ?? '—'} preguntas
                </span>
              </div>
              <h3 className="font-bold text-lg leading-tight mb-1">Mezcla de Módulos</h3>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
                Intercala los 4 módulos · Máxima retención
              </p>
            </button>
          )}
        </div>

        {/* Individual modules grid */}
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Módulos individuales</h2>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {realModules.map(m => (
              <div key={m.id} className="bg-white rounded-2xl p-6 animate-pulse">
                <div className="w-10 h-10 bg-gray-200 rounded-xl mb-3"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-100 rounded w-full mb-4"></div>
                <div className="h-8 bg-gray-200 rounded-lg"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {realModules.map(mod => {
              const stats = moduleStats[mod.id];
              const hasQuestions = stats && stats.total > 0;
              const studied = hasQuestions ? stats.total - stats.new : 0;
              const progress = hasQuestions && stats.total > 0 ? Math.round((studied / stats.total) * 100) : 0;

              return (
                <div
                  key={mod.id}
                  className={`bg-white rounded-2xl border-2 p-5 cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${mod.borderColor} ${!hasQuestions ? 'opacity-60' : ''}`}
                  onClick={() => hasQuestions && router.push(`/study/${mod.id}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <ModuleIcon id={mod.id} size={44} />
                    {hasQuestions && stats.dueNow > 0 && (
                      <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
                        {stats.dueNow}
                      </span>
                    )}
                    {hasQuestions && stats.dueNow === 0 && stats.mastered === stats.total && (
                      <span className="bg-green-100 text-green-600 text-xs font-bold px-1.5 py-0.5 rounded-full">
                        ✓
                      </span>
                    )}
                  </div>

                  <h3 className="font-semibold text-gray-900 text-sm mb-1 leading-snug">{mod.shortName}</h3>

                  {hasQuestions ? (
                    <>
                      {/* Test / Sim type badges */}
                      <div className="flex gap-1 mb-2 flex-wrap">
                        <span className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-medium">
                          {stats.testCount}T
                        </span>
                        <span className="text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-medium">
                          {stats.simCount}S
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                          <span>{studied} vistas.</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className="bg-green-500 rounded-full h-1.5 transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      <button
                        className="w-full py-2 rounded-xl text-xs font-semibold transition-all"
                        style={
                          stats.dueNow > 0
                            ? { background: '#282182', color: 'white' }
                            : { background: '#e8e7f7', color: '#282182' }
                        }
                        onMouseEnter={e => {
                          if (stats.dueNow > 0) (e.currentTarget as HTMLButtonElement).style.background = '#1e1965';
                        }}
                        onMouseLeave={e => {
                          if (stats.dueNow > 0) (e.currentTarget as HTMLButtonElement).style.background = '#282182';
                        }}
                      >
                        {stats.dueNow > 0 ? `Practicar (${stats.dueNow})` : 'Repasar'}
                      </button>
                    </>
                  ) : (
                    <div className="bg-amber-50 text-amber-700 text-xs px-2 py-1.5 rounded-lg text-center mt-2">
                      Próximamente
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom row */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200">
            <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <span className="text-[#282182]"><IconClock size={16} /></span> Cómo funciona la práctica
            </h3>
            <ul className="text-sm text-gray-600 space-y-1.5">
              <li className="flex gap-2"><span className="text-red-500">●</span> <span><strong>No sé</strong> — la pregunta vuelve hoy</span></li>
              <li className="flex gap-2"><span className="text-orange-500">●</span> <span><strong>Difícil</strong> — repaso en 1 día</span></li>
              <li className="flex gap-2"><span className="text-blue-500">●</span> <span><strong>Bien</strong> — repaso en 3+ días</span></li>
              <li className="flex gap-2"><span className="text-green-500">●</span> <span><strong>Fácil</strong> — repaso en más tiempo</span></li>
            </ul>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-slate-200">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="text-[#282182]"><IconBarChart size={16} /></span> Rendimiento global
            </h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-2xl font-bold" style={{ color: '#282182' }}>{totalDue}</div>
                <div className="text-xs text-gray-500">Pendientes</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{totalMastered}</div>
                <div className="text-xs text-gray-500">Dominadas</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-500 flex items-center justify-center gap-1">
                  {streak > 0 ? <><IconFlame size={20} />{streak}</> : '—'}
                </div>
                <div className="text-xs text-gray-500">Racha días</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <BottomNav />

      {/* ── Streak broken bottom sheet ───────────────────────────────── */}
      {showStreakBroken && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={dismissStreakBroken}
        >
          <div
            className="w-full max-w-md rounded-t-2xl p-6 pb-8"
            style={{ background: 'white' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center mb-5">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ background: '#fef2f2', color: '#ef4444' }}
              >
                <IconFlame size={28} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">¡Tu racha se ha roto!</h3>
              <p className="text-sm text-gray-500">
                Olvidaste estudiar ayer. ¡Pero no pasa nada, sigue adelante!
              </p>
            </div>

            {shields > 0 ? (
              <div className="mb-4 rounded-xl p-4 text-center" style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                <div className="text-sm font-semibold text-blue-800 mb-1">
                  🛡️ Tienes {shields} escudo{shields > 1 ? 's' : ''} disponible{shields > 1 ? 's' : ''}
                </div>
                <p className="text-xs text-blue-600">Usa un escudo para restaurar tu racha automáticamente</p>
              </div>
            ) : (
              <div className="mb-4 rounded-xl p-4 text-center" style={{ background: '#fafafa', border: '1px solid #e5e7eb' }}>
                <p className="text-xs text-gray-500">Los escudos se recargan automáticamente cada semana. ¡Sigue estudiando!</p>
              </div>
            )}

            <div className="flex gap-3">
              {shields > 0 && (
                <button
                  onClick={handleUseShield}
                  className="flex-1 py-3 rounded-xl font-bold text-sm text-white transition"
                  style={{ background: '#0284c7' }}
                >
                  🛡️ Usar escudo
                </button>
              )}
              <button
                onClick={dismissStreakBroken}
                className="flex-1 py-3 rounded-xl font-semibold text-sm transition"
                style={{ background: '#f3f4f6', color: '#374151' }}
              >
                Empezar de nuevo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
