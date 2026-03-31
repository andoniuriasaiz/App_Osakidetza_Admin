'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { OPE_TRACKS } from '@/lib/tracks';
import { MODULES } from '@/lib/modules';
import { fetchStudyProgram, generateProgram, resetStudyProgram, completeStudyDay, StudyProgram, StudyDay } from '@/lib/study-program';
import BottomNav from '@/components/BottomNav';

/* ── DayCard ─────────────────────────────────────────────────────────────── */
interface DayCardProps {
  day: StudyDay;
  todayStr: string;
  router: ReturnType<typeof useRouter>;
  onComplete: () => Promise<void>;
  getTypeColor: (t: string) => string;
  getTypeLabel: (t: string) => string;
  modules: typeof MODULES;
}

function DayCard({ day, todayStr, router, onComplete, getTypeColor, getTypeLabel, modules }: DayCardProps) {
  const isToday = day.date === todayStr;
  const isPast = new Date(day.date) < new Date(todayStr);
  const dateObj = new Date(day.date);
  const dayName = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(dateObj);
  const dayNum = dateObj.getDate();
  const monthName = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(dateObj);

  return (
    <div
      className={`bg-white rounded-2xl border-2 p-4 transition-all relative overflow-hidden ${
        isToday ? 'border-[#282182] ring-2 ring-[#282182] ring-offset-2 shadow-md' : 'border-slate-100 hover:border-slate-300'
      } ${isPast && !isToday ? 'opacity-60' : ''}`}
    >
      <div className="flex gap-4">
        <div className="flex flex-col items-center justify-center min-w-[3.5rem]">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{dayName}</span>
          <span className={`text-3xl font-black leading-none my-1 ${isToday ? 'text-[#282182]' : 'text-slate-800'}`}>{dayNum}</span>
          <span className="text-xs font-bold text-slate-400 capitalize">{monthName}</span>
        </div>
        <div className="w-px bg-slate-100 shrink-0" />
        <div className="flex-1 py-1">
          <div className="flex items-start justify-between mb-2 gap-2">
            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${getTypeColor(day.type)}`}>
              {getTypeLabel(day.type)}
            </span>
            <div className="flex gap-1.5 shrink-0">
              {isToday && (
                <span className="text-[10px] font-black uppercase tracking-wider text-white bg-[#282182] px-2 py-0.5 rounded-full">HOY</span>
              )}
              {day.completed && (
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full">✓ HECHO</span>
              )}
            </div>
          </div>
          <p className="text-sm text-slate-600 font-medium leading-snug mb-3">{day.description}</p>
          {day.assignedModules && day.assignedModules.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {day.assignedModules.map(modId => {
                const m = modules.find(x => x.id === modId);
                return m ? (
                  <span key={modId} className={`text-[10px] font-bold px-2 py-1 rounded ${m.bgColor} ${m.color} border ${m.borderColor}`}>
                    {m.shortName}
                  </span>
                ) : null;
              })}
            </div>
          )}
          {isToday && day.type !== 'rest' && (
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => router.push(
                  day.type === 'simulacro' ? '/exam'
                  : day.type === 'weaks' ? '/errores'
                  : '/dashboard'
                )}
                className={`flex-1 font-bold py-2 rounded-lg text-xs transition ${
                  day.completed
                    ? 'bg-slate-200 hover:bg-slate-300 text-slate-600'
                    : 'bg-amber-400 hover:bg-amber-500 text-amber-900'
                }`}
              >
                {day.completed ? '↩ Repetir' : 'Ir a estudiar'}
              </button>
              {!day.completed && (
                <button
                  onClick={onComplete}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-3 py-2 rounded-lg text-xs transition"
                >
                  ✓ Marcar hecho
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProgramaPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [program, setProgram] = useState<StudyProgram | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'week' | 'all'>('week');

  // Formulario para crear plan
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [track, setTrack] = useState<string>('aux');

  useEffect(() => {
    const session = getSession();
    if (!session) { router.push('/login'); return; }
    setUsername(session.username);

    // Cargar track seleccionado del dashboard si existe
    const savedTrack = localStorage.getItem('osakidetza_active_track');
    if (savedTrack) setTrack(savedTrack);

    fetchStudyProgram().then(p => {
      setProgram(p);
      setIsLoading(false);
    });
  }, [router]);

  const handleGenerate = async () => {
    try {
      setIsLoading(true);
      const p = await generateProgram(startDate, track, '2026-06-21');
      setProgram(p);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error al generar el programa');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    if (confirm('¿Estás seguro de que quieres borrar el calendario de estudio actual y generar uno nuevo?')) {
      setIsLoading(true);
      await resetStudyProgram();
      setProgram(null);
      setIsLoading(false);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 font-medium">Cargando programa...</div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col pb-24">
        <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10 shadow-sm">
          <h1 className="font-bold text-gray-900 text-base mb-0.5">Programa de Estudio</h1>
          <p className="text-[10px] font-bold text-[#7070a0] uppercase tracking-wider">Genera tu hoja de ruta</p>
        </header>
        <main className="flex-1 max-w-2xl mx-auto px-4 py-8 w-full space-y-6">
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 text-indigo-900">
            <div className="text-3xl mb-3">📅</div>
            <h2 className="text-xl font-bold mb-2">Crea tu programa de estudio</h2>
            <p className="text-sm opacity-80 mb-6">
              Te guiaremos día a día hasta la fecha del examen (21 Junio 2026). Generaremos un plan espaciando temas nuevos, repasos semanales y simulacros para que llegues preparad@ al 100%.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Fecha de inicio</label>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-white px-4 py-3 rounded-xl border border-indigo-200 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Oposición</label>
                <select 
                  value={track} 
                  onChange={e => setTrack(e.target.value)}
                  className="w-full bg-white px-4 py-3 rounded-xl border border-indigo-200 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {OPE_TRACKS.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <button 
              onClick={handleGenerate}
              className="mt-8 w-full bg-[#282182] hover:bg-[#1e1965] text-white font-bold py-4 rounded-xl transition text-sm shadow-md"
            >
              Generar mi programa
            </button>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  // Vista de plan ya generado
  const currentDayIdx = program.days.findIndex(d => d.date === todayStr);
  const completedDays = program.days.filter(d => d.completed).length;
  const totalDays = program.days.length;
  const progressPct = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

  // Vista semana: 7 días centrados en hoy
  const startIndex = Math.max(0, (currentDayIdx !== -1 ? currentDayIdx : 0) - 1);
  const visibleDays = viewMode === 'week'
    ? program.days.slice(startIndex, startIndex + 7)
    : program.days;

  // Agrupar por fase cuando se ve el programa completo
  const phases = [
    { id: 1, label: 'Vuelta 1 — Temario nuevo', color: '#282182' },
    { id: 2, label: 'Vuelta 2 — Consolidación', color: '#1368ce' },
    { id: 3, label: 'Sprint Final', color: '#e6820e' },
  ];

  const getTypeColor = (type: string) => {
    switch(type) {
      case 'new': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'review': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'simulacro': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'weaks': return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'rest': return 'bg-slate-100 text-slate-500 border-slate-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getTypeLabel = (type: string) => {
    switch(type) {
      case 'new': return '⭐ Temas Nuevos';
      case 'review': return '🔄 Repaso';
      case 'simulacro': return '🎯 Simulacro';
      case 'weaks': return '🔥 Puntos Débiles';
      case 'rest': return '😴 Descanso';
      default: return type;
    }
  };

  return (
    <div className="min-h-screen pb-24" style={{ background: '#f4f4fb' }}>
      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10 shadow-sm flex justify-between items-center">
        <div>
          <h1 className="font-bold text-gray-900 text-base mb-0.5">Programa de Estudio</h1>
          <p className="text-[10px] font-bold text-[#7070a0] uppercase tracking-wider">
            {OPE_TRACKS.find(t => t.id === program.trackId)?.shortName} · Examen 21 jun.
          </p>
        </div>
        <button 
          onClick={handleReset}
          className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 transition"
        >
          Re-generar
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Resumen de progreso */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avance del programa</span>
            <span className="text-xs font-bold text-[#282182]">{completedDays} / {totalDays} días</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mb-1">
            <div className="h-2 bg-[#282182] rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="text-[10px] text-slate-400 font-medium">{progressPct}% completado</div>
        </div>

        {/* Toggle vista */}
        <div className="flex bg-slate-200/50 p-1 rounded-xl w-fit gap-0.5">
          {(['week', 'all'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                viewMode === mode ? 'bg-[#282182] text-white shadow' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {mode === 'week' ? '📅 Esta semana' : '📋 Todo el programa'}
            </button>
          ))}
        </div>

        {/* Días */}
        {viewMode === 'week' ? (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-6 bg-[#282182] rounded-full" />
            <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Tu semana</h2>
          </div>
          <div className="space-y-3">
            {visibleDays.map((day) => <DayCard key={day.date} day={day} todayStr={todayStr} router={router} onComplete={async () => { setIsLoading(true); await completeStudyDay(day.date); const p = await fetchStudyProgram(); setProgram(p); setIsLoading(false); }} getTypeColor={getTypeColor} getTypeLabel={getTypeLabel} modules={MODULES} />)}
          </div>
        </section>
        ) : (
        <section className="space-y-8">
          {phases.map(phase => {
            const phaseDays = program.days.filter(d => d.phase === phase.id);
            const phaseCompleted = phaseDays.filter(d => d.completed).length;
            return (
              <div key={phase.id}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-1 h-6 rounded-full" style={{ background: phase.color }} />
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">{phase.label}</h2>
                  <span className="ml-auto text-xs font-bold text-slate-400">{phaseCompleted}/{phaseDays.length}</span>
                </div>
                <div className="space-y-3">
                  {phaseDays.map(day => <DayCard key={day.date} day={day} todayStr={todayStr} router={router} onComplete={async () => { setIsLoading(true); await completeStudyDay(day.date); const p = await fetchStudyProgram(); setProgram(p); setIsLoading(false); }} getTypeColor={getTypeColor} getTypeLabel={getTypeLabel} modules={MODULES} />)}
                </div>
              </div>
            );
          })}
        </section>
        )}

      </main>

      <BottomNav />
    </div>
  );
}
