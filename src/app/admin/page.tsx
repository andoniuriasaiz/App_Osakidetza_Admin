'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { logout } from '@/lib/auth';
import { LEVELS as XP_LEVELS } from '@/lib/xp';

/* ── helpers ─────────────────────────────────────────────────────────────── */
function getLevel(xp: number) {
  return XP_LEVELS.slice().reverse().find(l => xp >= l.minXp) ?? XP_LEVELS[0];
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtTs(ts: number | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function fmtTime(secs: number): string {
  if (!secs) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/* ── types ───────────────────────────────────────────────────────────────── */
interface AdminUser {
  id: number; username: string; role: string; created_at: string;
  xp: number; daily_goal: number;
  session_count: number; last_session_ts: number | null;
  total_answers: number; total_correct: number; study_days: number;
}
interface GlobalStats {
  activeToday: number; activeWeek: number; newUsersWeek: number;
  levelDist: Record<string, number>;
  moduleSummary: { module_id: string; module_name: string; sessions: number; answers: number; correct_total: number; total_time: number; avg_accuracy: number }[];
  recentSessions: { id: string; date: string; ts: number; module_id: string; module_name: string; mode: string; correct: number; wrong: number; total: number; xp: number; duration_sec: number; username: string; user_id: number }[];
  globalTime: { total_time_sec: number; total_answers: number; total_correct: number; total_sessions: number };
  dailyActivity: { date: string; answers: number }[];
}

/* ── mini components ─────────────────────────────────────────────────────── */

function LevelBadge({ xp }: { xp: number }) {
  const l = getLevel(xp);
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: l.color + '22', color: l.color }}>
      Nv.{l.level} {l.name}
    </span>
  );
}

function LevelDistBar({ dist }: { dist: Record<string, number> }) {
  const levels = [
    { key: 'maestro',     label: 'Maestro',     color: '#282182' },
    { key: 'experto',     label: 'Experto',      color: '#f97316' },
    { key: 'competente',  label: 'Competente',   color: '#f59e0b' },
    { key: 'practicante', label: 'Practicante',  color: '#34d399' },
    { key: 'aprendiz',    label: 'Aprendiz',     color: '#60a5fa' },
    { key: 'novato',      label: 'Novato',       color: '#94a3b8' },
  ];
  const total = Object.values(dist).reduce((a, b) => a + (b as number), 0) || 1;
  return (
    <div className="space-y-1.5">
      {levels.map(({ key, label, color }) => {
        const n = (dist[key] as number) ?? 0;
        const pct = Math.round((n / total) * 100);
        return (
          <div key={key} className="flex items-center gap-2 text-xs">
            <span className="w-20 text-gray-500 text-right shrink-0">{label}</span>
            <div className="flex-1 bg-slate-100 rounded-full h-2">
              <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="w-6 text-gray-700 font-semibold shrink-0">{n}</span>
          </div>
        );
      })}
    </div>
  );
}

function ActivitySparkline({ data }: { data: { date: string; answers: number }[] }) {
  if (data.length === 0) return <p className="text-xs text-gray-400">Sin datos aún</p>;
  const max = Math.max(...data.map(d => d.answers), 1);
  const W = 280, H = 40, bw = Math.floor((W - (data.length - 1) * 2) / data.length);
  return (
    <svg width={W} height={H + 14} viewBox={`0 0 ${W} ${H + 14}`} className="overflow-visible">
      {data.map((d, i) => {
        const bh = Math.max(2, Math.round((d.answers / max) * H));
        const x = i * (bw + 2);
        const y = H - bh;
        const isToday = i === data.length - 1;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={bh} rx="1.5"
              fill={isToday ? '#282182' : '#b3b0e0'} opacity={isToday ? 1 : 0.7} />
            {d.answers > 0 && isToday && (
              <text x={x + bw / 2} y={y - 3} textAnchor="middle" fontSize="8" fill="#282182" fontWeight="700">{d.answers}</text>
            )}
          </g>
        );
      })}
      <text x={0} y={H + 12} fontSize="8" fill="#94a3b8">-13d</text>
      <text x={W} y={H + 12} textAnchor="end" fontSize="8" fill="#282182" fontWeight="600">Hoy</text>
    </svg>
  );
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    const res = await fetch('/api/admin/users/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Error'); setLoading(false); return; }
    onCreated(); onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 className="font-bold text-gray-900 text-lg mb-4">Nuevo usuario</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Usuario</label>
            <input value={username} onChange={e => setUsername(e.target.value)} required autoFocus
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#282182]"
              placeholder="nombre_usuario" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#282182]"
              placeholder="••••••••" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Rol</label>
            <select value={role} onChange={e => setRole(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#282182]">
              <option value="user">Usuario</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-gray-600 hover:bg-slate-50 transition">Cancelar</button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2 rounded-lg bg-[#282182] text-white text-sm font-semibold hover:bg-[#1e1965] transition disabled:opacity-50">
              {loading ? 'Creando…' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── main ────────────────────────────────────────────────────────────────── */
export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers]       = useState<AdminUser[]>([]);
  const [stats, setStats]       = useState<GlobalStats | null>(null);
  const [loading, setLoading]   = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch]     = useState('');
  const [tab, setTab]           = useState<'users' | 'activity' | 'modules'>('users');

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(data => {
      if (!data.user || data.user.role !== 'admin') { router.replace('/dashboard'); return; }
      Promise.all([loadUsers(), loadStats()]);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadUsers() {
    const res = await fetch('/api/admin/users');
    const data = await res.json();
    setUsers(data.users ?? []);
    setLoading(false);
  }
  async function loadStats() {
    const res = await fetch('/api/admin/stats');
    const data = await res.json();
    setStats(data);
  }

  const filtered = users.filter(u => u.username.toLowerCase().includes(search.toLowerCase()));
  const regularUsers = users.filter(u => u.role !== 'admin');
  const g = stats?.globalTime;
  const accuracy = g && g.total_answers > 0 ? Math.round((g.total_correct / g.total_answers) * 100) : 0;

  const modeLabel: Record<string, string> = {
    due: 'Repaso', all: 'Libre', new: 'Nuevas', errors: 'Errores',
    bookmarks: 'Favoritas', survival: 'Superv.',
  };

  return (
    <div className="min-h-screen" style={{ background: '#f4f4fb' }}>

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#282182] flex items-center justify-center">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <span className="font-bold text-gray-900 text-sm">Admin</span>
              <span className="text-gray-300 mx-2">·</span>
              <span className="text-xs text-gray-500">Chatelac Quiz</span>
            </div>
          </div>
          <button onClick={async () => { await logout(); router.push('/login'); }}
            className="text-xs text-gray-500 hover:text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 transition font-medium">
            Salir
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">

        {/* KPI cards top */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: 'Usuarios',       value: regularUsers.length,              sub: 'registrados',   color: '#282182' },
            { label: 'Activos hoy',    value: stats?.activeToday ?? '—',        sub: 'estudiaron hoy',color: '#1368ce' },
            { label: 'Esta semana',    value: stats?.activeWeek  ?? '—',        sub: 'usuarios activos',color: '#26890c'},
            { label: 'Sesiones',       value: g?.total_sessions ?? '—',         sub: 'totales',       color: '#e6820e' },
            { label: 'Respuestas',     value: g?.total_answers?.toLocaleString() ?? '—', sub: 'totales', color: '#7c3aed' },
            { label: 'Tiempo estudio', value: fmtTime(g?.total_time_sec ?? 0),  sub: `${accuracy}% precisión`, color: '#db2777' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="bg-white rounded-2xl p-4 border border-slate-200">
              <div className="text-xl font-bold" style={{ color }}>{value}</div>
              <div className="text-xs font-semibold text-gray-700 mt-0.5">{label}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left: actividad diaria + distribución niveles */}
          <div className="space-y-4">

            {/* Actividad 14 días */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200">
              <h3 className="font-bold text-gray-900 text-sm mb-3">Actividad últimos 14 días</h3>
              <ActivitySparkline data={stats?.dailyActivity ?? []} />
            </div>

            {/* Distribución de niveles */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200">
              <h3 className="font-bold text-gray-900 text-sm mb-4">Distribución de niveles</h3>
              <LevelDistBar dist={stats?.levelDist ?? {}} />
            </div>
          </div>

          {/* Right 2/3: tabs (usuarios / módulos / actividad reciente) */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">

            {/* Tab bar */}
            <div className="flex border-b border-slate-100">
              {(['users', 'activity', 'modules'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-5 py-3 text-xs font-semibold transition ${tab === t ? 'text-[#282182] border-b-2 border-[#282182]' : 'text-gray-400 hover:text-gray-700'}`}>
                  {t === 'users' ? `Usuarios (${regularUsers.length})` : t === 'activity' ? 'Actividad reciente' : 'Módulos'}
                </button>
              ))}
              {tab === 'users' && (
                <div className="ml-auto flex items-center gap-2 px-4">
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar…"
                    className="text-xs border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-[#282182] w-28" />
                  <button onClick={() => setShowCreate(true)}
                    className="text-xs bg-[#282182] text-white px-3 py-1 rounded-lg font-semibold hover:bg-[#1e1965] transition">+ Nuevo</button>
                </div>
              )}
            </div>

            {/* Tab: Usuarios */}
            {tab === 'users' && (
              loading ? (
                <div className="p-8 text-center text-gray-400 text-sm">Cargando…</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-gray-400 font-medium">
                        <th className="px-5 py-3 text-left">Usuario</th>
                        <th className="px-4 py-3 text-left">Nivel</th>
                        <th className="px-4 py-3 text-right">XP</th>
                        <th className="px-4 py-3 text-right">Sesiones</th>
                        <th className="px-4 py-3 text-right hidden sm:table-cell">Precisión</th>
                        <th className="px-4 py-3 text-right hidden md:table-cell">Última sesión</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filtered.filter(u => u.role !== 'admin').map(u => {
                        const acc = u.total_answers > 0 ? Math.round((u.total_correct / u.total_answers) * 100) : null;
                        const level = getLevel(u.xp);
                        return (
                          <tr key={u.id} onClick={() => router.push(`/admin/users/${u.id}`)}
                            className="hover:bg-slate-50 cursor-pointer transition">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-[#e8e7f7] flex items-center justify-center text-xs font-bold text-[#282182]">
                                  {u.username[0].toUpperCase()}
                                </div>
                                <span className="font-semibold text-gray-900">{u.username}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3"><LevelBadge xp={u.xp} /></td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-700">{u.xp.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right text-gray-600">{u.session_count}</td>
                            <td className="px-4 py-3 text-right hidden sm:table-cell">
                              {acc !== null ? (
                                <span className={`font-semibold ${acc >= 80 ? 'text-green-600' : acc >= 60 ? 'text-amber-500' : 'text-red-500'}`}>{acc}%</span>
                              ) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-400 hidden md:table-cell">{fmtTs(u.last_session_ts)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* Tab: Actividad reciente */}
            {tab === 'activity' && (
              <div className="divide-y divide-slate-50">
                {(stats?.recentSessions ?? []).length === 0 && (
                  <p className="p-8 text-center text-gray-400 text-xs">Sin sesiones aún</p>
                )}
                {(stats?.recentSessions ?? []).map(s => {
                  const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
                  return (
                    <div key={s.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 cursor-pointer transition"
                      onClick={() => router.push(`/admin/users/${s.user_id}`)}>
                      <div className="w-7 h-7 rounded-full bg-[#e8e7f7] flex items-center justify-center text-xs font-bold text-[#282182] shrink-0">
                        {s.username[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-gray-900 text-xs">{s.username}</span>
                          <span className="text-gray-400 text-xs">·</span>
                          <span className="text-xs text-gray-500 truncate">{s.module_name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-gray-500 shrink-0">{modeLabel[s.mode] ?? s.mode}</span>
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{s.date} · {s.total} resp. · {fmtTime(s.duration_sec)}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-sm font-bold ${pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-amber-500' : 'text-red-500'}`}>{pct}%</div>
                        <div className="text-[10px] text-[#282182] font-semibold">+{s.xp} XP</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tab: Módulos */}
            {tab === 'modules' && (
              <div className="overflow-x-auto">
                {(stats?.moduleSummary ?? []).length === 0 ? (
                  <p className="p-8 text-center text-gray-400 text-xs">Sin sesiones aún</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-gray-400 font-medium">
                        <th className="px-5 py-3 text-left">Módulo</th>
                        <th className="px-4 py-3 text-right">Sesiones</th>
                        <th className="px-4 py-3 text-right">Respuestas</th>
                        <th className="px-4 py-3 text-right">Precisión</th>
                        <th className="px-4 py-3 text-right">Tiempo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(stats?.moduleSummary ?? []).map(m => (
                        <tr key={m.module_id}>
                          <td className="px-5 py-3 font-medium text-gray-800">{m.module_name}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{m.sessions}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{m.answers.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-semibold" style={{
                            color: (m.avg_accuracy ?? 0) >= 80 ? '#16a34a' : (m.avg_accuracy ?? 0) >= 60 ? '#d97706' : '#dc2626'
                          }}>{m.avg_accuracy != null ? `${m.avg_accuracy}%` : '—'}</td>
                          <td className="px-4 py-3 text-right text-gray-400">{fmtTime(m.total_time)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={loadUsers} />}
    </div>
  );
}
