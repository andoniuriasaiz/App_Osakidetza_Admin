'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, logout } from '@/lib/auth';
import { MODULES } from '@/lib/modules';
import { OPE_TRACKS, OpeTrack, daysUntilExam } from '@/lib/tracks';
import { loadQuestions } from '@/lib/questions';
import { getModuleStats, getStreak, syncFromDB } from '@/lib/progress';
import { getLocalXP, getDailyGoal, setDailyGoal as saveDailyGoal, getTodayAnswerCount, syncXPFromDB, syncDailyProgressFromDB } from '@/lib/xp';
import { syncQuestsFromDB } from '@/lib/quests';
import { syncBookmarksFromDB } from '@/lib/bookmarks';
import { syncSessionsFromDB } from '@/lib/session-history';
import { syncShieldsFromDB } from '@/lib/streak-shield';
import { initTheme, Theme } from '@/lib/theme';
import BottomNav from '@/components/BottomNav';
import XPBar from '@/components/XPBar';
import { ModuleIcon, IconBarChart, IconFlame, IconShuffle } from '@/components/AppIcons';

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

type TrackId = 'aux' | 'admin' | 'tec';

const TRACK_STORAGE_KEY = 'osakidetza_active_track';

/** Colores de la barra de countdown según días restantes */
function countdownColor(days: number): string {
  if (days > 60) return 'text-emerald-600';
  if (days > 30) return 'text-amber-500';
  return 'text-red-600';
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
  const [theme, setThemeState] = useState<Theme>('light');
  const [activeTrack, setActiveTrack] = useState<TrackId>('aux');
  const [daysLeft, setDaysLeft] = useState(0);

  // Load stats for all modules of the active track
  const loadStats = useCallback(async (track: OpeTrack) => {
    setLoading(true);
    const allIds = [...track.commonModuleIds, ...track.specificModuleIds];
    const stats: Record<string, ModuleStats> = {};
    for (const modId of allIds) {
      const questions = await loadQuestions(modId);
      if (questions.length > 0) {
        const base = getModuleStats(questions.map(q => q.id));
        stats[modId] = {
          ...base,
          testCount: questions.filter(q => q.type === 'C' || q.type === 'I').length,
          simCount:  questions.filter(q => q.type === 'B' || q.type === 'D').length,
        };
      } else {
        stats[modId] = { total: 0, new: 0, learning: 0, review: 0, mastered: 0, accuracy: 0, dueNow: 0, testCount: 0, simCount: 0 };
      }
    }
    setModuleStats(stats);
    setLoading(false);
  }, []);

  const handleTrackChange = (trackId: TrackId) => {
    setActiveTrack(trackId);
    localStorage.setItem(TRACK_STORAGE_KEY, trackId);
    const track = OPE_TRACKS.find(t => t.id === trackId)!;
    loadStats(track);
  };

  useEffect(() => {
    const session = getSession();
    if (!session) { router.push('/login'); return; }
    setUsername(session.username);
    initTheme();
    setThemeState(getTheme());
    setXp(getLocalXP());
    setDailyGoal(getDailyGoal());
    setTodayCount(getTodayAnswerCount());
    // Restore saved track
    const savedTrack = (localStorage.getItem(TRACK_STORAGE_KEY) as TrackId) || 'aux';
    setActiveTrack(savedTrack);
    const track = OPE_TRACKS.find(t => t.id === savedTrack) || OPE_TRACKS[0];
    setDaysLeft(daysUntilExam(track.examDate));

    syncFromDB().then(() => {
      setStreak(getStreak());
      loadStats(track);
    });
    syncXPFromDB().then(() => {
      setXp(getLocalXP());
      setDailyGoal(getDailyGoal());
    });
    syncBookmarksFromDB();
    syncQuestsFromDB();
    syncSessionsFromDB();
    syncShieldsFromDB();
    syncDailyProgressFromDB().then(() => setTodayCount(getTodayAnswerCount()));
  }, [router, loadStats]);

  // Update countdown when track changes
  useEffect(() => {
    const track = OPE_TRACKS.find(t => t.id === activeTrack);
    if (track) setDaysLeft(daysUntilExam(track.examDate));
  }, [activeTrack]);

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  const currentTrack = OPE_TRACKS.find(t => t.id === activeTrack) || OPE_TRACKS[0];
  const commonModules  = currentTrack.commonModuleIds.map(id => MODULES.find(m => m.id === id)!).filter(Boolean);
  const specificModules = currentTrack.specificModuleIds.map(id => MODULES.find(m => m.id === id)!).filter(Boolean);
  const allTrackModules = [...commonModules, ...specificModules];

  // Summary stats
  const allStats = allTrackModules.map(m => moduleStats[m.id] || { total: 0, new: 0, mastered: 0, dueNow: 0 });
  const totalDue = allStats.reduce((s, m) => s + m.dueNow, 0);
  const totalQuestions = allStats.reduce((s, m) => s + m.total, 0);
  const totalStudied = allStats.reduce((s, m) => s + (m.total - m.new), 0);
  const totalMastered = allStats.reduce((s, m) => s + m.mastered, 0);
  const overallProgress = totalQuestions > 0 ? Math.round((totalMastered / totalQuestions) * 100) : 0;

  const renderModuleCard = (mod: typeof MODULES[0]) => {
    const stats = moduleStats[mod.id];
    const hasQuestions = stats && stats.total > 0;
    const studied = hasQuestions ? stats.total - stats.new : 0;
    const progress = hasQuestions && stats.total > 0 ? Math.round((studied / stats.total) * 100) : 0;

    return (
      <div
        key={mod.id}
        className={`bg-white rounded-2xl border-2 p-4 cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${mod.borderColor} ${!hasQuestions ? 'opacity-50' : ''}`}
        onClick={() => hasQuestions && router.push(`/study/${mod.id}`)}
      >
        <div className="flex items-start justify-between mb-3">
          <ModuleIcon id={mod.id} size={40} />
          {hasQuestions && stats.dueNow > 0 && (
            <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
              {stats.dueNow}
            </span>
          )}
          {hasQuestions && stats.dueNow === 0 && stats.mastered === stats.total && stats.total > 0 && (
            <span className="bg-green-100 text-green-600 text-xs font-bold px-1.5 py-0.5 rounded-full">✓</span>
          )}
        </div>
        <h3 className="font-semibold text-gray-900 text-xs mb-1 leading-snug">{mod.shortName}</h3>
        {hasQuestions ? (
          <>
            <div className="flex gap-1 mb-2 flex-wrap text-[10px] font-bold">
              <span className={`${mod.bgColor} ${mod.color} px-1.5 py-0.5 rounded`}>{stats.total}Q</span>
              {stats.dueNow > 0 && <span className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded">{stats.dueNow}P</span>}
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1">
              <div className="bg-green-500 rounded-full h-1.5 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 font-medium">
              <span>{progress}% visto</span>
              <span>{stats.mastered} dom.</span>
            </div>
          </>
        ) : (
          <div className="text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded font-bold mt-2">PRÓXIMAMENTE</div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-20" style={{ background: '#f4f4fb' }}>
      {/* ── Header ── */}
      <header className="bg-white sticky top-0 z-10 border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#282182]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-base leading-none mb-0.5">Osakidetza OPE</h1>
              <p className="text-[10px] font-bold text-[#7070a0] uppercase tracking-wider">{currentTrack.shortName} · Examen 21 jun. 2026</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {streak > 0 && (
              <div className="flex items-center gap-1 text-sm font-bold text-orange-600 bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100">
                <IconFlame size={16} />{streak}
              </div>
            )}
            <button onClick={() => router.push('/stats')} className="p-2 text-slate-400 hover:text-[#282182] transition">
              <IconBarChart size={20} />
            </button>
            <button onClick={handleLogout} className="text-xs font-bold text-slate-400 hover:text-red-600 transition ml-1">SALIR</button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">

        {/* ── Banner bienvenida + countdown ── */}
        <div className="rounded-2xl p-6 mb-6 text-white bg-gradient-to-br from-[#282182] to-[#170f55] shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold mb-1">¡Hola, {username}!</h2>
                <p className="text-sm opacity-75">
                  {totalDue > 0 ? `Tienes ${totalDue} preguntas para repasar hoy` : '¡Estás al día con el temario! ✓'}
                </p>
              </div>
              {/* Countdown */}
              <div className="text-right bg-white/10 rounded-xl px-4 py-3 border border-white/15 flex-shrink-0 ml-4">
                <div className="text-[10px] uppercase font-bold opacity-60 mb-0.5">Examen en</div>
                <div className="text-2xl font-black leading-none">{daysLeft}</div>
                <div className="text-[10px] opacity-60">días</div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white/10 rounded-xl p-3 border border-white/10">
                <div className="text-[10px] uppercase font-bold opacity-60 mb-1">Vistas</div>
                <div className="text-xl font-bold">{totalStudied}</div>
              </div>
              <div className="bg-white/10 rounded-xl p-3 border border-white/10">
                <div className="text-[10px] uppercase font-bold opacity-60 mb-1">Dominadas</div>
                <div className="text-xl font-bold">{totalMastered}</div>
              </div>
              <div className="bg-white/10 rounded-xl p-3 border border-white/10">
                <div className="text-[10px] uppercase font-bold opacity-60 mb-1">Pendientes</div>
                <div className="text-xl font-bold text-red-300">{totalDue}</div>
              </div>
              <div className="bg-white/10 rounded-xl p-3 border border-white/10">
                <div className="text-[10px] uppercase font-bold opacity-60 mb-1">Progreso</div>
                <div className="text-xl font-bold">{overallProgress}%</div>
              </div>
            </div>
          </div>
          {/* Decorative */}
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full" />
          <div className="absolute -right-5 -top-5 w-20 h-20 bg-white/5 rounded-full" />
        </div>

        {/* ── OPE Track Selector ── */}
        <div className="flex bg-slate-200/50 p-1 rounded-xl mb-8 shadow-inner w-fit mx-auto sm:mx-0 gap-0.5">
          {OPE_TRACKS.map(track => (
            <button
              key={track.id}
              onClick={() => handleTrackChange(track.id)}
              className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                activeTrack === track.id
                  ? 'bg-[#282182] text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="mr-1.5">{track.icon}</span>{track.shortName}
            </button>
          ))}
        </div>

        {/* ── Entrenamiento Mixto ── */}
        <div className="mb-10">
          <button
            onClick={() => router.push(`/study/mezcla`)}
            className="group w-full bg-white rounded-3xl p-7 text-left border-2 border-slate-100 hover:border-[#282182]/20 transition-all hover:shadow-xl relative overflow-hidden"
          >
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-[#282182] group-hover:scale-110 transition-transform">
                    <IconShuffle size={28} />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl text-slate-900">Entrenamiento Mixto</h3>
                    <p className="text-slate-500 text-sm font-medium">{currentTrack.name} — todo el temario intercalado</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                    <span className="text-xs font-bold text-slate-400 uppercase block mb-0.5">Pendiente</span>
                    <span className="text-lg font-black text-[#282182]">{totalDue}</span>
                  </div>
                  <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                    <span className="text-xs font-bold text-slate-400 uppercase block mb-0.5">Total</span>
                    <span className="text-lg font-black text-slate-700">{totalQuestions}</span>
                  </div>
                </div>
              </div>
              <div className="bg-[#282182] text-white px-7 py-4 rounded-2xl font-bold text-base shadow-lg group-hover:bg-[#1e1965] transition-colors text-center cursor-pointer shrink-0">
                EMPEZAR AHORA
              </div>
            </div>
            <div className="absolute right-0 top-0 w-64 h-full bg-slate-50/50 -skew-x-12 translate-x-32" />
          </button>
        </div>

        {/* ── Módulos del track ── */}
        <div className="space-y-14">
          {/* Temario Común */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-8 bg-[#282182] rounded-full" />
              <div>
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                  Temario Común
                </h2>
                <p className="text-xs text-slate-400 font-medium">
                  {activeTrack === 'tec' ? 'ABC1 — exclusivo TEC' : 'COM_C2 — común AUX + ADM'}
                </p>
              </div>
              <span className="ml-auto text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                {commonModules.length} temas
              </span>
            </div>
            {loading ? (
              <div className="text-sm text-slate-400 animate-pulse">Cargando módulos…</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {commonModules.map(mod => renderModuleCard(mod))}
              </div>
            )}
          </section>

          {/* Temario Específico */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-1 h-8 rounded-full"
                style={{
                  background: activeTrack === 'aux' ? '#10b981'
                            : activeTrack === 'admin' ? '#6366f1'
                            : '#f59e0b'
                }}
              />
              <div>
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                  Temario Específico
                </h2>
                <p className="text-xs text-slate-400 font-medium">
                  {currentTrack.name}
                </p>
              </div>
              <span
                className={`ml-auto text-xs font-bold px-3 py-1 rounded-full ${currentTrack.badgeColor}`}
              >
                {specificModules.length} temas
              </span>
            </div>
            {loading ? (
              <div className="text-sm text-slate-400 animate-pulse">Cargando módulos…</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {specificModules.map(mod => renderModuleCard(mod))}
              </div>
            )}
          </section>
        </div>

        {/* ── XP Bar ── */}
        <div className="mt-12 mb-4 bg-white rounded-2xl p-5 border border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Progreso XP</span>
            <span className="text-xs text-slate-400">{todayCount} / {dailyGoal} hoy</span>
          </div>
          <XPBar xp={xp} />
          {/* Daily goal bar */}
          <div className="mt-3">
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className="bg-[#282182] h-1.5 rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.round((todayCount / Math.max(1, dailyGoal)) * 100))}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-medium">Objetivo diario: {Math.min(100, Math.round((todayCount / Math.max(1, dailyGoal)) * 100))}%</div>
          </div>
        </div>

      </main>

      <BottomNav />
    </div>
  );
}
