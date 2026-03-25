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
  const [role, setRole] = useState<'administrativo' | 'auxiliar'>('administrativo');

  useEffect(() => {
    const savedRole = localStorage.getItem('osakidetza_role') as 'administrativo' | 'auxiliar';
    if (savedRole) setRole(savedRole);
  }, []);

  const handleRoleChange = (newRole: 'administrativo' | 'auxiliar') => {
    setRole(newRole);
    localStorage.setItem('osakidetza_role', newRole);
    // Refresh stats for the new role perspective
    loadStats();
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
    setQuests(getQuests());
    setShields(getShieldCount());

    syncFromDB().then(() => {
      setStreak(getStreak());
      loadStats();
    });
    syncXPFromDB().then(() => {
      setXp(getLocalXP());
      setDailyGoal(getDailyGoal());
    });
    syncBookmarksFromDB();
    syncQuestsFromDB().then(() => setQuests(getQuests()));
    syncSessionsFromDB();
    syncShieldsFromDB().then(() => setShields(getShieldCount()));
    syncDailyProgressFromDB().then(() => setTodayCount(getTodayAnswerCount()));
  }, [router]);

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
          simCount:  questions.filter(q => q.type === 'B' || q.type === 'D').length,
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

  // Filter modules mapping
  const filteredModules = MODULES.filter(m => 
    m.category === 'comun' || m.category === role || m.category === 'virtual'
  );
  const realModules = filteredModules.filter(m => m.id !== 'mezcla');
  const comModules = realModules.filter(m => m.category === 'comun');
  const specModules = realModules.filter(m => m.category === role);
  const mezclaModule = filteredModules.find(m => m.id === 'mezcla');

  // Stats for banner
  const realModuleStats = realModules.map(m => moduleStats[m.id] || { total: 0, new: 0, mastered: 0, dueNow: 0 });
  const totalDue = realModuleStats.reduce((s, m) => s + m.dueNow, 0);
  const totalQuestions = realModuleStats.reduce((s, m) => s + m.total, 0);
  const totalStudied = realModuleStats.reduce((s, m) => s + (m.total - m.new), 0);
  const totalMastered = realModuleStats.reduce((s, m) => s + m.mastered, 0);

  const renderModuleCard = (mod: typeof MODULES[0]) => {
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
            <span className="bg-green-100 text-green-600 text-xs font-bold px-1.5 py-0.5 rounded-full">✓</span>
          )}
        </div>
        <h3 className="font-semibold text-gray-900 text-sm mb-1 leading-snug">{mod.shortName}</h3>
        {hasQuestions ? (
          <>
            <div className="flex gap-1 mb-2 flex-wrap text-[10px] font-bold">
              <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{stats.total}Q</span>
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
      <header className="bg-white sticky top-0 z-10 border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#282182]">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-base leading-none mb-1">Osakidetza OPE</h1>
              <p className="text-[10px] font-bold text-[#7070a0] uppercase tracking-wider">Módulo {role}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {streak > 0 && <div className="flex items-center gap-1 text-sm font-bold text-orange-600 bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100"><IconFlame size={16} />{streak}</div>}
            <button onClick={() => router.push('/stats')} className="p-2 text-slate-400 hover:text-[#282182] transition"><IconBarChart size={20} /></button>
            <button onClick={handleLogout} className="text-xs font-bold text-slate-400 hover:text-red-600 transition ml-2">SALIR</button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="rounded-2xl p-6 mb-8 text-white bg-gradient-to-br from-[#282182] to-[#170f55] shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-1">¡Hola, {username}!</h2>
            <p className="text-sm opacity-80 mb-6">{totalDue > 0 ? `Tienes ${totalDue} preguntas para repasar hoy` : '¡Estás al día con el temario! ✓'}</p>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                <div className="text-xl font-bold">{totalDue}</div>
              </div>
              <div className="bg-white/10 rounded-xl p-3 border border-white/10">
                <div className="text-[10px] uppercase font-bold opacity-60 mb-1">Total</div>
                <div className="text-xl font-bold">{totalQuestions}</div>
              </div>
            </div>
          </div>
          {/* Decorative circles */}
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full" />
          <div className="absolute -right-5 -top-5 w-20 h-20 bg-white/5 rounded-full" />
        </div>

        {/* Role Switcher */}
        <div className="flex bg-slate-200/50 p-1 rounded-xl mb-10 w-fit mx-auto sm:mx-0 shadow-inner">
          <button
            onClick={() => handleRoleChange('administrativo')}
            className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${role === 'administrativo' ? 'bg-[#282182] text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Administrativo
          </button>
          <button
            onClick={() => handleRoleChange('auxiliar')}
            className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${role === 'auxiliar' ? 'bg-[#282182] text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Auxiliar Adm.
          </button>
        </div>

        {/* Featured Mixed practice */}
        {mezclaModule && (
          <div className="mb-12">
            <button
               onClick={() => router.push(`/study/${mezclaModule.id}`)}
               className="group w-full bg-white rounded-3xl p-8 text-left border-2 border-slate-100 hover:border-[#282182]/20 transition-all hover:shadow-xl relative overflow-hidden"
            >
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-[#282182] group-hover:scale-110 transition-transform">
                      <IconShuffle size={32} />
                    </div>
                    <div>
                      <h3 className="font-bold text-2xl text-slate-900">Entrenamiento Mixto</h3>
                      <p className="text-slate-500 font-medium">Combina todo el temario ({role})</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
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
                <div className="bg-[#282182] text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-lg group-hover:bg-[#1e1965] transition-colors text-center cursor-pointer">
                  EMPEZAR AHORA
                </div>
              </div>
              {/* Subtle pattern background */}
              <div className="absolute right-0 top-0 w-64 h-full bg-slate-50/50 -skew-x-12 translate-x-32" />
            </button>
          </div>
        )}

        {/* Modules Categories */}
        <div className="space-y-16">
          <section>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-1 h-8 bg-[#282182] rounded-full" />
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Temario Común</h2>
              <span className="ml-auto text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">{comModules.length} Temas</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {comModules.map(mod => renderModuleCard(mod))}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-1 h-8 bg-emerald-500 rounded-full" />
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Temario Específico</h2>
              <span className="ml-auto text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">{specModules.length} Temas</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {specModules.map(mod => renderModuleCard(mod))}
            </div>
          </section>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
