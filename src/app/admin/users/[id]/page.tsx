'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { LEVELS } from '@/lib/xp';
import { MODULES } from '@/lib/modules';

/* ── helpers ──────────────────────────────────────────────────────────────── */
function getLevel(xp: number) {
  return LEVELS.slice().reverse().find(l => xp >= l.minXp) ?? LEVELS[0];
}
function fmtTime(secs: number): string {
  if (!secs) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ── types ────────────────────────────────────────────────────────────────── */
interface UserDetail {
  id: number; username: string; role: string; created_at: string;
  xp: number; daily_goal: number;
}
interface Session {
  id: string; date: string; ts: number;
  module_id: string; module_name: string; mode: string;
  correct: number; wrong: number; total: number;
  xp: number; max_streak: number; duration_sec: number;
}
interface CardStats {
  total_seen: number; mastered: number; review: number; learning: number;
  total_reviews: number; total_wrong: number;
  avg_ease_factor: number; avg_interval: number;
}
interface QuestRow {
  quest_id: string; progress: number; completed: boolean; reward_claimed: boolean;
}
interface ModuleBreakdown {
  module_id: string; module_name: string; sessions: number; answers: number;
  correct_total: number; total_time: number; avg_accuracy: number; last_date: string;
}
interface DowActivity {
  dow: number; sessions: number; answers: number;
}
interface DailyAnswer {
  date: string; count: number;
}
interface XpPoint {
  date: string; xp: number; correct: number; wrong: number; total: number; cumulative_xp: number;
}
interface DifficultyDist {
  muy_dificil: number; dificil: number; normal: number; facil: number;
}

/* ── micro SVG charts ─────────────────────────────────────────────────────── */

function XpCurve({ points }: { points: XpPoint[] }) {
  if (!points.length) return <p className="text-xs text-gray-400 py-4 text-center">Sin datos</p>;
  const W = 560; const H = 72;
  const vals = points.map(p => p.cumulative_xp);
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals);
  const range = max - min || 1;
  const pts = points.map((p, i) => {
    const x = (i / Math.max(points.length - 1, 1)) * W;
    const y = H - ((p.cumulative_xp - min) / range) * (H - 8) - 4;
    return `${x},${y}`;
  }).join(' ');
  const areaBottom = points.map((_, i) => `${(i / Math.max(points.length - 1, 1)) * W},${H}`).reverse().join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16" preserveAspectRatio="none">
      <defs>
        <linearGradient id="xpGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#282182" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#282182" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={`${pts} ${areaBottom}`} fill="url(#xpGrad)" />
      <polyline points={pts} fill="none" stroke="#282182" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {/* last point dot */}
      {points.length > 0 && (() => {
        const last = points[points.length - 1];
        const x = W;
        const y = H - ((last.cumulative_xp - min) / range) * (H - 8) - 4;
        return <circle cx={x} cy={y} r="3" fill="#282182" />;
      })()}
    </svg>
  );
}

function DowChart({ data }: { data: DowActivity[] }) {
  const DOW_LABELS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  const maxAnswers = Math.max(...data.map(d => d.answers), 1);
  const byDow: Record<number, DowActivity> = {};
  data.forEach(d => { byDow[d.dow] = d; });
  return (
    <div className="flex items-end gap-1.5 h-14">
      {DOW_LABELS.map((label, i) => {
        const d = byDow[i];
        const pct = d ? (d.answers / maxAnswers) : 0;
        return (
          <div key={i} className="flex flex-col items-center gap-1 flex-1">
            <div className="w-full rounded-t-sm transition-all" style={{
              height: `${Math.max(pct * 44, 2)}px`,
              background: pct > 0.6 ? '#282182' : pct > 0.3 ? '#6366f1' : pct > 0 ? '#a5b4fc' : '#e2e8f0',
            }} title={d ? `${d.answers} resp.` : ''} />
            <span className="text-[10px] text-gray-400 font-medium">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function DailyHeatmap({ data }: { data: DailyAnswer[] }) {
  // Build 30-day grid
  const today = new Date();
  const cells: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const found = data.find(r => r.date === key);
    cells.push({ date: key, count: found?.count ?? 0 });
  }
  const maxCount = Math.max(...cells.map(c => c.count), 1);
  function shade(count: number): string {
    if (count === 0) return '#e2e8f0';
    const ratio = count / maxCount;
    if (ratio > 0.75) return '#282182';
    if (ratio > 0.5) return '#4f46e5';
    if (ratio > 0.25) return '#818cf8';
    return '#c7d2fe';
  }
  // Split into weeks
  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return (
    <div className="flex gap-1 flex-wrap">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-1">
          {week.map(cell => (
            <div key={cell.date}
              className="w-5 h-5 rounded-sm cursor-default"
              style={{ background: shade(cell.count) }}
              title={`${cell.date}: ${cell.count} resp.`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function DifficultyBar({ dist }: { dist: DifficultyDist }) {
  const segments = [
    { key: 'muy_dificil', label: 'Muy difícil', color: '#ef4444' },
    { key: 'dificil',     label: 'Difícil',      color: '#f97316' },
    { key: 'normal',      label: 'Normal',        color: '#f59e0b' },
    { key: 'facil',       label: 'Fácil',         color: '#22c55e' },
  ] as const;
  const total = (dist.muy_dificil + dist.dificil + dist.normal + dist.facil) || 1;
  return (
    <div className="space-y-3">
      {/* stacked bar */}
      <div className="flex rounded-lg overflow-hidden h-5">
        {segments.map(s => {
          const pct = (dist[s.key] / total) * 100;
          if (pct < 0.5) return null;
          return (
            <div key={s.key} style={{ width: `${pct}%`, background: s.color }}
              title={`${s.label}: ${dist[s.key]} (${Math.round(pct)}%)`} />
          );
        })}
      </div>
      {/* legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map(s => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs text-gray-600">
            <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
            <span>{s.label}: <strong>{dist[s.key]}</strong></span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Change password modal ───────────────────────────────────────────────── */
function ChangePwModal({ userId, onClose }: { userId: number; onClose: () => void }) {
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    if (res.ok) { setDone(true); setTimeout(onClose, 1200); }
    else { setError('Error al cambiar contraseña'); setLoading(false); }
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 className="font-bold text-gray-900 text-lg mb-4">Cambiar contraseña</h2>
        {done ? (
          <p className="text-green-600 text-sm text-center py-4">✓ Contraseña actualizada</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input type="password" value={pw} onChange={e => setPw(e.target.value)}
              placeholder="Nueva contraseña" required autoFocus
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#282182]"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={onClose}
                className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-gray-600 hover:bg-slate-50 transition">Cancelar</button>
              <button type="submit" disabled={loading}
                className="flex-1 py-2 rounded-lg bg-[#282182] text-white text-sm font-semibold hover:bg-[#1e1965] transition disabled:opacity-50">
                {loading ? '…' : 'Guardar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function AdminUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [cardStats, setCardStats] = useState<CardStats | null>(null);
  const [difficultyDist, setDifficultyDist] = useState<DifficultyDist | null>(null);
  const [studyDates, setStudyDates] = useState<string[]>([]);
  const [streak, setStreak] = useState(0);
  const [daysSinceActive, setDaysSinceActive] = useState<number | null>(null);
  const [quests, setQuests] = useState<QuestRow[]>([]);
  const [moduleBreakdown, setModuleBreakdown] = useState<ModuleBreakdown[]>([]);
  const [dowActivity, setDowActivity] = useState<DowActivity[]>([]);
  const [dailyAnswers30, setDailyAnswers30] = useState<DailyAnswer[]>([]);
  const [xpCurve, setXpCurve] = useState<XpPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showChangePw, setShowChangePw] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tab, setTab] = useState<'sessions' | 'modules'>('sessions');

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(data => {
      if (!data.user || data.user.role !== 'admin') { router.replace('/dashboard'); return; }
      loadData();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`);
      if (!res.ok) { router.replace('/admin'); return; }
      const d = await res.json();
      setUser(d.user);
      setSessions(d.sessions ?? []);
      setCardStats(d.cardStats ?? null);
      setDifficultyDist(d.difficultyDist ?? null);
      setStudyDates(d.studyDates ?? []);
      setStreak(d.streak ?? 0);
      setDaysSinceActive(d.daysSinceActive ?? null);
      setQuests(d.quests ?? []);
      setModuleBreakdown(d.moduleBreakdown ?? []);
      setDowActivity(d.dowActivity ?? []);
      setDailyAnswers30(d.dailyAnswers30 ?? []);
      setXpCurve(d.xpCurve ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar al usuario "${user?.username}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    if (res.ok) router.replace('/admin');
    else { alert('Error al eliminar'); setDeleting(false); }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f4f4fb' }}>
        <div className="text-gray-400 text-sm animate-pulse">Cargando…</div>
      </div>
    );
  }
  if (!user) return null;

  const level = getLevel(user.xp);
  const totalAnswers = sessions.reduce((s, ses) => s + ses.total, 0);
  const totalCorrect = sessions.reduce((s, ses) => s + ses.correct, 0);
  const accuracy = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0;
  const totalTime = sessions.reduce((s, ses) => s + (ses.duration_sec ?? 0), 0);
  const totalSessionXP = sessions.reduce((s, ses) => s + ses.xp, 0);

  const modeLabel: Record<string, string> = {
    due: 'Repaso', all: 'Libre', new: 'Nuevas', errors: 'Errores',
    bookmarks: 'Favoritas', survival: 'Superv.',
  };
  const questTitles: Record<string, string> = {
    q1: 'Sesión del día (20 resp.)', q2: 'Racha de aciertos (×5)', q3: 'Dominar el error (×3)',
  };

  return (
    <div className="min-h-screen pb-16" style={{ background: '#f4f4fb' }}>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <button onClick={() => router.push('/admin')}
            className="text-gray-500 hover:text-gray-800 p-2 rounded-lg hover:bg-gray-100 transition text-sm">
            ← Admin
          </button>
          <h1 className="font-bold text-gray-900">{user.username}</h1>
          {user.role === 'admin' && (
            <span className="text-[10px] px-2 py-0.5 bg-[#282182] text-white rounded-full font-bold">admin</span>
          )}
          {daysSinceActive !== null && daysSinceActive > 3 && (
            <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-semibold ml-auto">
              Inactivo {daysSinceActive}d
            </span>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* ── Hero banner ───────────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-[#282182] to-[#1e1965] rounded-2xl p-5 text-white">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-black shrink-0">
              {user.username[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-lg">{user.username}</div>
              <div className="text-blue-200 text-xs">Registrado el {fmtDate(user.created_at)}</div>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold" style={{ color: level.color + 'cc' }}>
                  Nv.{level.level} {level.name}
                </span>
                <span className="text-white/70 text-xs">{user.xp.toLocaleString()} XP acumulado</span>
                {user.daily_goal > 0 && (
                  <span className="text-white/50 text-xs">Meta diaria: {user.daily_goal} resp.</span>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-2xl font-black">{streak}</div>
              <div className="text-blue-200 text-[10px]">días racha</div>
            </div>
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {[
              { label: 'Sesiones',   value: sessions.length },
              { label: 'Respuestas', value: totalAnswers.toLocaleString() },
              { label: 'Precisión',  value: `${accuracy}%` },
              { label: 'Días est.',  value: studyDates.length },
              { label: 'XP sesiones',value: totalSessionXP.toLocaleString() },
              { label: 'Tiempo',     value: fmtTime(totalTime) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/10 rounded-xl p-2.5 text-center">
                <div className="font-bold text-sm">{value}</div>
                <div className="text-blue-200 text-[10px]">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── XP Curve + DOW Activity ───────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900 text-sm">Curva de XP</h3>
              {xpCurve.length > 0 && (
                <span className="text-xs text-gray-400">
                  {xpCurve[xpCurve.length - 1]?.cumulative_xp?.toLocaleString()} XP total
                </span>
              )}
            </div>
            <XpCurve points={xpCurve} />
            {xpCurve.length > 0 && (
              <p className="text-[10px] text-gray-400 mt-1">Últimas {xpCurve.length} sesiones</p>
            )}
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900 text-sm">Actividad por día</h3>
              {dowActivity.length > 0 && (
                <span className="text-xs text-gray-400">
                  {(() => {
                    const maxDow = dowActivity.reduce((a, b) => a.answers > b.answers ? a : b, dowActivity[0]);
                    const labels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                    return `Más activo: ${labels[maxDow.dow]}`;
                  })()}
                </span>
              )}
            </div>
            {dowActivity.length > 0
              ? <DowChart data={dowActivity} />
              : <p className="text-xs text-gray-400 py-4 text-center">Sin datos</p>}
          </div>
        </div>

        {/* ── 30-day heatmap ────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 text-sm">Actividad (últimos 30 días)</h3>
            <div className="flex items-center gap-1 text-[10px] text-gray-400">
              <div className="w-3 h-3 rounded-sm bg-slate-200" /> Ninguna
              <div className="w-3 h-3 rounded-sm bg-indigo-200 ml-2" />
              <div className="w-3 h-3 rounded-sm bg-indigo-400" />
              <div className="w-3 h-3 rounded-sm bg-[#282182]" /> Mucha
            </div>
          </div>
          <DailyHeatmap data={dailyAnswers30} />
        </div>

        {/* ── Card stats + Difficulty ───────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cardStats && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-4">
              <h3 className="font-bold text-gray-900 text-sm">Progreso de tarjetas (SM-2)</h3>
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                {[
                  { label: 'Vistas',      value: cardStats.total_seen,   color: 'text-[#282182]', bg: 'bg-[#e8e7f7]' },
                  { label: 'Dominadas',   value: cardStats.mastered,     color: 'text-green-700', bg: 'bg-green-50' },
                  { label: 'En repaso',   value: cardStats.review,       color: 'text-blue-700',  bg: 'bg-blue-50' },
                  { label: 'Aprendiendo', value: cardStats.learning,     color: 'text-amber-700', bg: 'bg-amber-50' },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className={`${bg} rounded-xl p-3`}>
                    <div className={`font-bold text-lg ${color}`}>{(value ?? 0).toLocaleString()}</div>
                    <div className="text-gray-500">{label}</div>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-100 pt-3 grid grid-cols-2 gap-3 text-xs text-center">
                <div>
                  <div className="font-bold text-gray-800">{cardStats.total_reviews?.toLocaleString()}</div>
                  <div className="text-gray-400">Total repasos</div>
                </div>
                <div>
                  <div className="font-bold text-red-600">{cardStats.total_wrong?.toLocaleString()}</div>
                  <div className="text-gray-400">Total fallos</div>
                </div>
                <div>
                  <div className="font-bold text-gray-800">{cardStats.avg_ease_factor?.toFixed(2) ?? '—'}</div>
                  <div className="text-gray-400">Ease factor medio</div>
                </div>
                <div>
                  <div className="font-bold text-gray-800">{cardStats.avg_interval ? `${cardStats.avg_interval}d` : '—'}</div>
                  <div className="text-gray-400">Intervalo medio</div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-4">
            {difficultyDist && (difficultyDist.muy_dificil + difficultyDist.dificil + difficultyDist.normal + difficultyDist.facil) > 0 && (
              <div>
                <h3 className="font-bold text-gray-900 text-sm mb-3">Mapa de dificultad</h3>
                <DifficultyBar dist={difficultyDist} />
              </div>
            )}

            {/* Quests today */}
            <div className="border-t border-slate-100 pt-4">
              <h3 className="font-bold text-gray-900 text-sm mb-3">Misiones hoy</h3>
              {quests.length === 0 ? (
                <p className="text-xs text-gray-400">Sin actividad de misiones hoy</p>
              ) : (
                <div className="space-y-2">
                  {quests.map(q => (
                    <div key={q.quest_id} className="flex items-center gap-2 text-xs">
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0
                        ${q.completed ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-gray-400'}`}>
                        {q.completed ? '✓' : '○'}
                      </span>
                      <span className="flex-1 text-gray-700">{questTitles[q.quest_id] ?? q.quest_id}</span>
                      <span className="text-gray-400 font-medium">{q.progress}</span>
                      {q.reward_claimed && <span className="text-[9px] text-amber-600 font-semibold">✦</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="border-t border-slate-100 pt-4 space-y-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Acciones</h3>
              <button onClick={() => setShowChangePw(true)}
                className="w-full text-xs py-2 rounded-lg border border-slate-200 text-gray-700 hover:bg-slate-50 transition font-medium">
                Cambiar contraseña
              </button>
              {user.role !== 'admin' && (
                <button onClick={handleDelete} disabled={deleting}
                  className="w-full text-xs py-2 rounded-lg bg-red-50 border border-red-100 text-red-600 hover:bg-red-100 transition font-medium disabled:opacity-50">
                  {deleting ? 'Eliminando…' : 'Eliminar usuario'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Sessions / Module breakdown tabs ──────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-1">
            {(['sessions', 'modules'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${tab === t ? 'bg-[#282182] text-white' : 'text-gray-500 hover:bg-slate-100'}`}>
                {t === 'sessions' ? `Sesiones (${sessions.length})` : `Módulos (${moduleBreakdown.length})`}
              </button>
            ))}
            <span className="ml-auto text-xs text-gray-400">{fmtTime(totalTime)} total · {totalSessionXP.toLocaleString()} XP</span>
          </div>

          {tab === 'sessions' ? (
            sessions.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">Sin sesiones registradas</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-gray-400 font-medium">
                      <th className="px-5 py-2.5 text-left">Módulo</th>
                      <th className="px-4 py-2.5 text-left">Modo</th>
                      <th className="px-4 py-2.5 text-right">Resp.</th>
                      <th className="px-4 py-2.5 text-right">Precisión</th>
                      <th className="px-4 py-2.5 text-right">XP</th>
                      <th className="px-4 py-2.5 text-right">Duración</th>
                      <th className="px-4 py-2.5 text-right">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sessions.map(s => {
                      const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
                      const mod = MODULES.find(m => m.id === s.module_id);
                      return (
                        <tr key={s.id} className="hover:bg-slate-50 transition">
                          <td className="px-5 py-2.5 font-medium text-gray-800">{mod?.shortName ?? s.module_name}</td>
                          <td className="px-4 py-2.5 text-gray-500">{modeLabel[s.mode] ?? s.mode}</td>
                          <td className="px-4 py-2.5 text-right text-gray-600">{s.total}</td>
                          <td className="px-4 py-2.5 text-right font-semibold" style={{
                            color: pct >= 80 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626'
                          }}>{pct}%</td>
                          <td className="px-4 py-2.5 text-right text-[#282182] font-semibold">+{s.xp}</td>
                          <td className="px-4 py-2.5 text-right text-gray-400">{fmtTime(s.duration_sec)}</td>
                          <td className="px-4 py-2.5 text-right text-gray-400">{s.date}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            moduleBreakdown.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">Sin datos de módulos</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-gray-400 font-medium">
                      <th className="px-5 py-2.5 text-left">Módulo</th>
                      <th className="px-4 py-2.5 text-right">Sesiones</th>
                      <th className="px-4 py-2.5 text-right">Respuestas</th>
                      <th className="px-4 py-2.5 text-right">Precisión</th>
                      <th className="px-4 py-2.5 text-right">Tiempo</th>
                      <th className="px-4 py-2.5 text-right">Última</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {moduleBreakdown.map(m => {
                      const mod = MODULES.find(mo => mo.id === m.module_id);
                      return (
                        <tr key={m.module_id} className="hover:bg-slate-50 transition">
                          <td className="px-5 py-2.5">
                            <div className="font-medium text-gray-800">{mod?.shortName ?? m.module_name}</div>
                            {mod && <div className="text-gray-400 text-[10px]">{mod.name}</div>}
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-600">{m.sessions}</td>
                          <td className="px-4 py-2.5 text-right text-gray-600">{m.answers.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right font-semibold" style={{
                            color: m.avg_accuracy >= 80 ? '#16a34a' : m.avg_accuracy >= 60 ? '#d97706' : '#dc2626'
                          }}>{m.avg_accuracy ?? 0}%</td>
                          <td className="px-4 py-2.5 text-right text-gray-400">{fmtTime(m.total_time)}</td>
                          <td className="px-4 py-2.5 text-right text-gray-400">{m.last_date}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </main>

      {showChangePw && <ChangePwModal userId={user.id} onClose={() => setShowChangePw(false)} />}
    </div>
  );
}
