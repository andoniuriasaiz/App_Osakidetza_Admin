'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { MODULES } from '@/lib/modules';
import { loadQuestions } from '@/lib/questions';
import { getModuleStats, getAllProgress, getStreak, getStudyDates, getMostWrong } from '@/lib/progress';
import { getLocalXP, getLevelProgress } from '@/lib/xp';
import { getRecentSessions, getSessionSummary, syncSessionsFromDB, SessionEntry } from '@/lib/session-history';
import BottomNav from '@/components/BottomNav';
import XPBar from '@/components/XPBar';
import {
  ModuleIcon, IconFlame, IconSeedling, IconStarSm, IconSparkle, IconTrophySm, IconXCircle,
  IconBolt, IconSignal, IconLightbulb, IconClipboard, IconTimer, IconTrendingUp,
  IconCheckCircle, IconClock, IconCalendar, IconDifficulty,
} from '@/components/AppIcons';

interface ModStats {
  total: number; new: number; learning: number; review: number; mastered: number;
  accuracy: number; dueNow: number;
}

// ─── SVG Radar / Spider chart ─────────────────────────────────────────────────
function RadarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const size = 200;
  const center = size / 2;
  const radius = 72;
  const n = data.length;

  function polar(angle: number, r: number) {
    const a = (angle - Math.PI / 2);
    return { x: center + r * Math.cos(a), y: center + r * Math.sin(a) };
  }

  const rings = [0.25, 0.5, 0.75, 1];
  const axes = data.map((_, i) => polar((2 * Math.PI * i) / n, radius));
  const dataPoints = data.map((d, i) => polar((2 * Math.PI * i) / n, (d.value / 100) * radius));
  const polygonPts = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      {rings.map(r => (
        <polygon
          key={r}
          points={data.map((_, i) => {
            const p = polar((2 * Math.PI * i) / n, radius * r);
            return `${p.x},${p.y}`;
          }).join(' ')}
          fill="none" stroke="#e2e8f0" strokeWidth="1"
        />
      ))}
      {axes.map((pt, i) => (
        <line key={i} x1={center} y1={center} x2={pt.x} y2={pt.y} stroke="#e2e8f0" strokeWidth="1" />
      ))}
      <polygon points={polygonPts} fill="rgba(40,33,130,0.15)" stroke="#282182" strokeWidth="2" strokeLinejoin="round" />
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} fill={data[i].color} stroke="white" strokeWidth="1.5" />
      ))}
      {axes.map((pt, i) => {
        const label = data[i].label;
        const offset = 14;
        const angle = (2 * Math.PI * i) / n - Math.PI / 2;
        const lx = center + (radius + offset) * Math.cos(angle);
        const ly = center + (radius + offset) * Math.sin(angle);
        return (
          <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
            fontSize="9" fontWeight="600" fill="#4a4a6a">{label}</text>
        );
      })}
    </svg>
  );
}

// ─── Intensity heatmap calendar (last 10 weeks) ──────────────────────────────
function ActivityCalendar({
  studyDates, sessionsByDate,
}: {
  studyDates: string[];
  sessionsByDate: Record<string, number>; // date → total answers that day
}) {
  const dateSet = new Set(studyDates);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = (today.getDay() + 6) % 7;
  const gridEnd   = new Date(today);
  const gridStart = new Date(today);
  gridStart.setDate(today.getDate() - dayOfWeek - 69);

  const cells: { date: string; inFuture: boolean; studied: boolean; intensity: number }[] = [];
  const cursor = new Date(gridStart);

  // Determine max answers in a day for intensity scaling
  const allCounts = Object.values(sessionsByDate);
  const maxAnswers = allCounts.length > 0 ? Math.max(...allCounts) : 1;

  while (cursor <= gridEnd) {
    const iso = `${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}-${String(cursor.getDate()).padStart(2,'0')}`;
    const inFuture = cursor > today;
    const answers = sessionsByDate[iso] ?? 0;
    // 4 intensity levels: 0 = none, 1-4 = quartiles
    let intensity = 0;
    if (dateSet.has(iso) && answers > 0) {
      const pct = answers / maxAnswers;
      intensity = pct <= 0.25 ? 1 : pct <= 0.5 ? 2 : pct <= 0.75 ? 3 : 4;
    } else if (dateSet.has(iso)) {
      intensity = 1;
    }
    cells.push({ date: iso, inFuture, studied: dateSet.has(iso), intensity });
    cursor.setDate(cursor.getDate() + 1);
  }

  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const intensityColors = [
    'bg-slate-100',         // 0 = no activity
    'bg-[#b3b0e0]',         // 1 = light
    'bg-[#7b78cc]',         // 2 = medium
    'bg-[#4a46a8]',         // 3 = strong
    'bg-[#282182]',         // 4 = max
  ];

  const dayLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  return (
    <div className="select-none">
      <div className="flex gap-1">
        <div className="flex flex-col gap-1 mr-0.5">
          {dayLabels.map(d => (
            <div key={d} className="w-3 h-3 flex items-center justify-center text-[8px] text-gray-400 font-medium">{d}</div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((cell, di) => (
              <div
                key={di}
                title={cell.date + (cell.studied ? ` · ${sessionsByDate[cell.date] ?? 0} resp.` : '')}
                className={`w-3 h-3 rounded-sm transition-colors ${
                  cell.inFuture ? 'bg-transparent' : intensityColors[cell.intensity]
                }`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-400">
        <span>Menos</span>
        {intensityColors.map((c, i) => (
          <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
        ))}
        <span>Más</span>
      </div>
    </div>
  );
}

// ─── Accuracy sparkline (last N sessions) ─────────────────────────────────────
function AccuracySparkline({ sessions }: { sessions: SessionEntry[] }) {
  if (sessions.length < 2) return null;
  const last = sessions.slice(0, 10).reverse(); // oldest first for chart
  const vals = last.map(s => s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0);
  const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  const W = 160, H = 36, barW = Math.floor((W - (vals.length - 1) * 2) / vals.length);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-gray-500">Precisión últimas sesiones</span>
        <span className="text-xs font-bold text-[#282182]">Ø {avg}%</span>
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
        {vals.map((v, i) => {
          const bh = Math.max(2, Math.round((v / 100) * H));
          const x = i * (barW + 2);
          const y = H - bh;
          const color = v >= 80 ? '#22c55e' : v >= 60 ? '#f59e0b' : '#ef4444';
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={bh} rx="1.5" fill={color} opacity="0.8" />
              {i === vals.length - 1 && (
                <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize="7" fill={color} fontWeight="700">
                  {v}%
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── 7-day forecast chart ─────────────────────────────────────────────────────
function ForecastChart({ allQuestionIds }: { allQuestionIds: string[] }) {
  const progress = getAllProgress();
  const DAY = 86_400_000;
  const now = Date.now();

  // Count questions due per day for the next 7 days
  const counts = Array(7).fill(0);
  for (const id of allQuestionIds) {
    const card = progress.cards[id];
    if (!card || card.lastReview === 0) {
      // New card: counts as due today
      counts[0]++;
    } else {
      const daysAhead = Math.floor((card.nextReview - now) / DAY);
      if (daysAhead < 0) counts[0]++;
      else if (daysAhead < 7) counts[daysAhead]++;
    }
  }

  const maxVal = Math.max(...counts, 1);
  const days = ['Hoy', 'Mañ.', '+2', '+3', '+4', '+5', '+6'];
  const W = 220, H = 50, barW = 24, gap = 7;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[#282182]"><IconCalendar size={14} /></span>
        <span className="text-xs font-semibold text-gray-700">Previsión 7 días (preguntas pendientes)</span>
      </div>
      <svg width={W} height={H + 14} viewBox={`0 0 ${W} ${H + 14}`}>
        {counts.map((v, i) => {
          const bh = Math.max(2, Math.round((v / maxVal) * H));
          const x = i * (barW + gap);
          const y = H - bh;
          const isToday = i === 0;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={bh} rx="3"
                fill={isToday ? '#282182' : '#b3b0e0'} />
              <text x={x + barW / 2} y={H + 10} textAnchor="middle" fontSize="8"
                fill={isToday ? '#282182' : '#94a3b8'} fontWeight={isToday ? '700' : '400'}>
                {days[i]}
              </text>
              {v > 0 && (
                <text x={x + barW / 2} y={y - 2} textAnchor="middle" fontSize="8"
                  fill={isToday ? '#282182' : '#7b78cc'} fontWeight="600">
                  {v}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Difficulty map (ease factor distribution) ────────────────────────────────
function DifficultyMap({ allQuestionIds }: { allQuestionIds: string[] }) {
  const progress = getAllProgress();

  let veryHard = 0, hard = 0, normal = 0, easy = 0, unseen = 0;

  for (const id of allQuestionIds) {
    const card = progress.cards[id];
    if (!card || card.lastReview === 0) { unseen++; continue; }
    const ef = card.easeFactor;
    if (ef < 1.6) veryHard++;
    else if (ef < 2.0) hard++;
    else if (ef < 2.6) normal++;
    else easy++;
  }

  const total = allQuestionIds.length;
  const buckets = [
    { label: 'Muy difícil', count: veryHard, color: '#ef4444' },
    { label: 'Difícil',     count: hard,     color: '#f97316' },
    { label: 'Normal',      count: normal,   color: '#f59e0b' },
    { label: 'Fácil',       count: easy,     color: '#22c55e' },
    { label: 'Sin ver',     count: unseen,   color: '#e2e8f0' },
  ];

  const seen = total - unseen;
  if (seen === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[#282182]"><IconDifficulty size={14} /></span>
        <span className="text-xs font-semibold text-gray-700">Distribución de dificultad (factor SM-2)</span>
      </div>
      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden mb-3 gap-px">
        {buckets.filter(b => b.count > 0).map((b) => (
          <div key={b.label} style={{ width: `${(b.count / total) * 100}%`, background: b.color }} title={`${b.label}: ${b.count}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {buckets.filter(b => b.count > 0).map(b => (
          <div key={b.label} className="flex items-center gap-1.5 text-xs">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: b.color }} />
            <span className="text-gray-600">{b.label}</span>
            <span className="font-semibold text-gray-800">{b.count}</span>
            <span className="text-gray-400">({Math.round((b.count / total) * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function StatsPage() {
  const router = useRouter();
  const [moduleStats, setModuleStats] = useState<Record<string, ModStats>>({});
  const [allQuestionIds, setAllQuestionIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalAccuracy, setGlobalAccuracy] = useState(0);
  const [streak, setStreak] = useState(0);
  const [studyDates, setStudyDates] = useState<string[]>([]);
  const [topErrors, setTopErrors] = useState<{ id: string; count: number; text: string }[]>([]);
  const [xp, setXp] = useState(0);
  const [recentSessions, setRecentSessions] = useState<SessionEntry[]>([]);
  const [sessionSummary, setSessionSummary] = useState<ReturnType<typeof getSessionSummary> | null>(null);

  // Build sessionsByDate for heatmap (total answers per day from session history)
  const sessionsByDate: Record<string, number> = {};
  for (const s of recentSessions) {
    sessionsByDate[s.date] = (sessionsByDate[s.date] ?? 0) + s.total;
  }

  useEffect(() => {
    const session = getSession();
    if (!session) { router.push('/login'); return; }
    setStreak(getStreak());
    setStudyDates(getStudyDates());
    setXp(getLocalXP());
    // Sync sessions from DB first so history is up to date
    syncSessionsFromDB().then(() => {
      setRecentSessions(getRecentSessions(30));
      setSessionSummary(getSessionSummary(7));
    });
    setRecentSessions(getRecentSessions(30));
    setSessionSummary(getSessionSummary(7));
    loadAllStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadAllStats() {
    setLoading(true);
    const stats: Record<string, ModStats> = {};
    const allIds: string[] = [];
    const allQuestionsMap: Record<string, string> = {};

    for (const mod of MODULES) {
      if (mod.id === 'mezcla') continue;
      const qs = await loadQuestions(mod.id);
      if (qs.length > 0) {
        stats[mod.id] = getModuleStats(qs.map(q => q.id));
        for (const q of qs) {
          allIds.push(q.id);
          allQuestionsMap[q.id] = q.question?.slice(0, 80) ?? q.id;
        }
      } else {
        stats[mod.id] = { total: 0, new: 0, learning: 0, review: 0, mastered: 0, accuracy: 0, dueNow: 0 };
      }
    }

    setModuleStats(stats);
    setAllQuestionIds(allIds);

    // Global accuracy
    const progress = getAllProgress();
    let totalRight = 0, totalWrong = 0;
    Object.values(progress.cards).forEach(c => {
      totalRight += c.totalReviews - c.totalWrong;
      totalWrong += c.totalWrong;
    });
    const tot = totalRight + totalWrong;
    setGlobalAccuracy(tot > 0 ? Math.round((totalRight / tot) * 100) : 0);

    // Top errors (global)
    const mostWrongIds = getMostWrong(allIds, 10);
    const wc = progress.wrongCounts || {};
    setTopErrors(mostWrongIds.map(id => ({
      id,
      count: wc[id] || 0,
      text: allQuestionsMap[id] || id,
    })));

    setLoading(false);
  }

  // Exclude mezcla from totals
  const realStats = Object.entries(moduleStats)
    .filter(([id]) => id !== 'mezcla')
    .map(([, s]) => s);

  const totals = {
    questions: realStats.reduce((s, m) => s + m.total, 0),
    studied:   realStats.reduce((s, m) => s + (m.total - m.new), 0), // seen at least once
    mastered:  realStats.reduce((s, m) => s + m.mastered, 0),
    due:       realStats.reduce((s, m) => s + m.dueNow, 0),
    new:       realStats.reduce((s, m) => s + m.new, 0),
    learning:  realStats.reduce((s, m) => s + m.learning, 0),
    review:    realStats.reduce((s, m) => s + m.review, 0),
  };
  // Primary progress = studied (seen at least once)
  const pct = totals.questions > 0 ? Math.round((totals.studied / totals.questions) * 100) : 0;
  const totalDays = studyDates.length;

  return (
    <div className="min-h-screen pb-24" style={{ background: '#f4f4fb' }}>
      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="text-gray-500 hover:text-gray-800 p-2 rounded-lg hover:bg-gray-100 transition">←</button>
          <h1 className="font-bold text-gray-900">Estadísticas</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* ── Streak + activity ──────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                <span className="text-orange-500"><IconFlame size={18} /></span> Racha
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">{totalDays} días de estudio en total</p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-black text-orange-500">{streak}</div>
              <div className="text-xs text-gray-400">{streak === 1 ? 'día' : 'días'} consecutivos</div>
            </div>
          </div>

          {streak > 0 && (
            <div className="flex gap-2 mb-4 flex-wrap">
              {[
                { days: 3,  label: '3 días',    Icon: IconSeedling },
                { days: 7,  label: '1 semana',  Icon: IconStarSm  },
                { days: 14, label: '2 semanas', Icon: IconSparkle  },
                { days: 30, label: '1 mes',     Icon: IconTrophySm },
              ].map(({ days, label, Icon }) => (
                <div
                  key={days}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold ${
                    streak >= days
                      ? 'bg-orange-100 text-orange-700 border border-orange-200'
                      : 'bg-gray-100 text-gray-300 border border-gray-100'
                  }`}
                >
                  <Icon size={13} />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          )}

          <ActivityCalendar studyDates={studyDates} sessionsByDate={sessionsByDate} />
        </div>

        {/* ── Esta semana ────────────────────────────────────────────────── */}
        {sessionSummary && sessionSummary.totalSessions > 0 && (
          <div className="bg-gradient-to-r from-[#282182] to-[#1e1965] rounded-2xl p-5 text-white">
            <h2 className="font-semibold text-blue-100 mb-4 text-sm flex items-center gap-2">
              <IconTimer size={14} /> Esta semana
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold">{sessionSummary.totalAnswers}</div>
                <div className="text-xs text-blue-200">Respuestas</div>
              </div>
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold">{sessionSummary.avgAccuracy}%</div>
                <div className="text-xs text-blue-200">Precisión</div>
              </div>
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold">+{sessionSummary.totalXP}</div>
                <div className="text-xs text-blue-200">XP ganado</div>
              </div>
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold">{fmtTime(sessionSummary.totalTimeSec)}</div>
                <div className="text-xs text-blue-200">Tiempo total</div>
              </div>
            </div>
            {/* Accuracy sparkline */}
            {recentSessions.length >= 2 && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <AccuracySparkline sessions={recentSessions} />
              </div>
            )}
          </div>
        )}

        {/* ── Global summary ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200">
          <h2 className="font-semibold text-gray-800 mb-4 text-sm">Resumen global</h2>
          <div className="grid grid-cols-4 gap-3 mb-4 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">{totals.questions}</div>
              <div className="text-xs text-gray-400">Total</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[#282182]">{totals.studied}</div>
              <div className="text-xs text-gray-400">Vistas</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{totals.mastered}</div>
              <div className="text-xs text-gray-400">Dominadas</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-500">{globalAccuracy}%</div>
              <div className="text-xs text-gray-400">Precisión</div>
            </div>
          </div>
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Preguntas vistas</span><span>{pct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3">
              <div className="bg-[#282182] rounded-full h-3 transition-all" style={{ width: `${pct}%` }}/>
            </div>
            {totals.mastered > 0 && (
              <div className="text-xs text-gray-400 mt-1">
                {totals.mastered} dominadas (≥21 días intervalo) · {totals.studied - totals.mastered} en progreso
              </div>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="bg-slate-50 rounded-lg p-2">
              <div className="font-bold text-gray-700">{totals.new}</div>
              <div className="text-gray-400">Nuevas</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-2">
              <div className="font-bold text-orange-600">{totals.learning}</div>
              <div className="text-gray-400">Aprend.</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-2">
              <div className="font-bold text-blue-600">{totals.review}</div>
              <div className="text-gray-400">Repaso</div>
            </div>
            <div className="bg-green-50 rounded-lg p-2">
              <div className="font-bold text-green-600">{totals.mastered}</div>
              <div className="text-gray-400">Domin.</div>
            </div>
          </div>
        </div>

        {/* ── XP & Nivel ──────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200">
          <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <span className="text-[#282182]"><IconBolt size={16} /></span> Tu nivel de dominio
          </h2>
          <XPBar xp={xp} className="mb-0" />
          <p className="text-xs text-gray-400 mt-3">{xp} XP acumulado en todas las sesiones</p>
        </div>

        {/* ── 7-day forecast ──────────────────────────────────────────────── */}
        {!loading && allQuestionIds.length > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-slate-200">
            <ForecastChart allQuestionIds={allQuestionIds} />
          </div>
        )}

        {/* ── Radar chart por módulo ──────────────────────────────────────── */}
        {!loading && (
          <div className="bg-white rounded-2xl p-5 border border-slate-200">
            <h2 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
              <span className="text-[#282182]"><IconSignal size={16} /></span> Radar de dominio
            </h2>
            <p className="text-xs text-gray-400 mb-4">Porcentaje de preguntas vistas por módulo</p>
            {(() => {
              const radarModules = MODULES.filter(m => m.id !== 'mezcla');
              const radarData = radarModules.map(mod => {
                const s = moduleStats[mod.id];
                const studied = s ? s.total - s.new : 0;
                const val = s && s.total > 0 ? Math.round((studied / s.total) * 100) : 0;
                const colors: Record<string, string> = {
                  'access-basico':  '#e21b3c',
                  'excel-avanzado': '#26890c',
                  'powerpoint':     '#e6820e',
                  'word-avanzado':  '#1368ce',
                };
                return { label: mod.shortName ?? mod.name, value: val, color: colors[mod.id] ?? '#282182' };
              });

              const studiedDays = studyDates.length;
              const avgStudiedPerDay = studiedDays > 0 ? totals.studied / studiedDays : 0;
              const remaining = totals.questions - totals.studied;
              const weeksNeeded = avgStudiedPerDay > 0
                ? Math.ceil((remaining / avgStudiedPerDay) / 7)
                : null;

              return (
                <>
                  <RadarChart data={radarData} />
                  <div className="flex flex-wrap gap-3 justify-center mt-2">
                    {radarData.map(d => (
                      <div key={d.label} className="flex items-center gap-1.5 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                        <span className="text-gray-600">{d.label} <strong>{d.value}%</strong></span>
                      </div>
                    ))}
                  </div>

                  {weeksNeeded !== null && remaining > 0 && (
                    <div className="mt-4 bg-[#e8e7f7] rounded-xl p-4 text-center">
                      <p className="text-xs text-[#4a4a6a] mb-1">Predictor de preparación</p>
                      <p className="text-sm font-bold text-[#282182]">
                        A este ritmo, listo en ~{weeksNeeded} {weeksNeeded === 1 ? 'semana' : 'semanas'}
                      </p>
                      <p className="text-xs text-[#7070a0] mt-1">
                        {remaining} preguntas por ver · {avgStudiedPerDay.toFixed(1)}/día de media
                      </p>
                    </div>
                  )}
                  {remaining === 0 && totals.questions > 0 && (
                    <div className="mt-4 bg-green-50 rounded-xl p-4 text-center">
                      <p className="text-sm font-bold text-green-700 flex items-center justify-center gap-1">
                        <IconCheckCircle size={16} /> ¡Has visto todas las preguntas!
                      </p>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* ── Difficulty map ──────────────────────────────────────────────── */}
        {!loading && allQuestionIds.length > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-slate-200">
            <DifficultyMap allQuestionIds={allQuestionIds} />
          </div>
        )}

        {/* ── Recomendación del día ──────────────────────────────────────── */}
        {!loading && (() => {
          const realMods = MODULES.filter(m => m.id !== 'mezcla');
          const mostDue = realMods
            .map(m => ({ mod: m, s: moduleStats[m.id] }))
            .filter(x => x.s && x.s.dueNow > 0)
            .sort((a, b) => (b.s?.dueNow ?? 0) - (a.s?.dueNow ?? 0))[0];
          const lowestAcc = realMods
            .map(m => ({ mod: m, s: moduleStats[m.id] }))
            .filter(x => x.s && x.s.accuracy > 0 && (x.s.mastered + (x.s.total - x.s.new)) >= 10)
            .sort((a, b) => (a.s?.accuracy ?? 100) - (b.s?.accuracy ?? 100))[0];
          const weakest = realMods
            .map(m => ({ mod: m, s: moduleStats[m.id] }))
            .filter(x => x.s && x.s.total > 0)
            .sort((a, b) => {
              const aStudied = (a.s?.total ?? 1) - (a.s?.new ?? 0);
              const bStudied = (b.s?.total ?? 1) - (b.s?.new ?? 0);
              return (aStudied / (a.s?.total ?? 1)) - (bStudied / (b.s?.total ?? 1));
            })[0];

          const recs: { Icon: typeof IconClock; text: string; link?: string; color: string }[] = [];

          if (mostDue) {
            recs.push({
              Icon: IconClock,
              text: `Hoy toca ${mostDue.mod.shortName ?? mostDue.mod.name} — tienes ${mostDue.s.dueNow} preguntas pendientes`,
              link: `/study/${mostDue.mod.id}`,
              color: '#282182',
            });
          }
          if (lowestAcc && lowestAcc.mod.id !== mostDue?.mod.id) {
            recs.push({
              Icon: IconTrendingUp,
              text: `Refuerza ${lowestAcc.mod.shortName ?? lowestAcc.mod.name} — tu precisión es del ${lowestAcc.s?.accuracy ?? 0}%`,
              link: `/study/${lowestAcc.mod.id}`,
              color: '#e6820e',
            });
          }
          if (weakest && weakest.mod.id !== mostDue?.mod.id && weakest.mod.id !== lowestAcc?.mod.id) {
            const studied = (weakest.s?.total ?? 0) - (weakest.s?.new ?? 0);
            const mp = weakest.s ? Math.round((studied / weakest.s.total) * 100) : 0;
            recs.push({
              Icon: IconTrendingUp,
              text: `${weakest.mod.shortName ?? weakest.mod.name} solo está al ${mp}% — es tu módulo más débil`,
              link: `/study/${weakest.mod.id}`,
              color: '#e21b3c',
            });
          }
          if (totals.due === 0 && totals.questions > 0) {
            recs.push({ Icon: IconCheckCircle, text: '¡Todo al día! Aprovecha para repasar errores o hacer un simulacro.', color: '#22c55e' });
          }

          if (recs.length === 0) return null;

          return (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 pt-4 pb-3 border-b border-slate-100 flex items-center gap-2">
                <span className="text-[#282182]"><IconLightbulb size={16} /></span>
                <h2 className="font-bold text-gray-900 text-sm">Recomendación de hoy</h2>
              </div>
              <div className="divide-y divide-slate-50">
                {recs.map((rec, i) => (
                  <div
                    key={i}
                    className={`px-5 py-3.5 flex items-center gap-3 ${rec.link ? 'cursor-pointer hover:bg-slate-50 transition' : ''}`}
                    onClick={() => rec.link && router.push(rec.link)}
                  >
                    <span style={{ color: rec.color }} className="flex-shrink-0"><rec.Icon size={16} /></span>
                    <p className="text-sm text-gray-700 flex-1 leading-snug">{rec.text}</p>
                    {rec.link && <span className="text-gray-300 text-sm flex-shrink-0">→</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── Historial de sesiones ───────────────────────────────────────── */}
        {recentSessions.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[#282182]"><IconClipboard size={16} /></span>
                <h2 className="font-bold text-gray-900 text-sm">Últimas sesiones</h2>
              </div>
              {sessionSummary && (
                <span className="text-xs text-gray-400">{sessionSummary.totalAnswers} resp. · {sessionSummary.avgAccuracy}% esta semana</span>
              )}
            </div>
            <div className="divide-y divide-slate-50">
              {recentSessions.slice(0, 10).map(s => {
                const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
                const mod = MODULES.find(m => m.id === s.moduleId);
                const modeLabel: Record<string, string> = {
                  due: 'Repaso', all: 'Libre', new: 'Nuevas', errors: 'Errores',
                  bookmarks: 'Favoritas', survival: 'Superv.',
                };
                const dur = s.durationSec ? fmtTime(s.durationSec) : null;
                return (
                  <div key={s.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {mod && <ModuleIcon id={mod.id} size={30} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-800 truncate">{mod?.shortName ?? s.moduleName}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-gray-500 font-medium flex-shrink-0">
                          {modeLabel[s.mode] ?? s.mode}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                        <span>{s.date}</span>
                        <span>{s.total} resp. · {s.correct}✓ {s.wrong}✗</span>
                        {dur && (
                          <span className="flex items-center gap-0.5 text-gray-300">
                            <IconTimer size={10} /> {dur}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`text-sm font-bold ${pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-amber-500' : 'text-red-500'}`}>
                        {pct}%
                      </div>
                      <div className="text-[10px] text-[#282182] font-semibold">+{s.xp} XP</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Top errores ────────────────────────────────────────────────── */}
        {topErrors.length > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-slate-200">
            <h2 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
              <span className="text-red-500"><IconXCircle size={16} /></span> Preguntas más falladas
            </h2>
            <p className="text-xs text-gray-400 mb-4">Las que más veces has contestado mal — enfócate en estas</p>
            <div className="space-y-2">
              {topErrors.map((e, i) => (
                <div key={e.id} className="flex items-start gap-3 p-2.5 bg-red-50 rounded-xl">
                  <span className="text-xs font-black text-red-400 w-5 text-center mt-0.5">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 leading-snug truncate">{e.text}{e.text.length >= 80 ? '…' : ''}</p>
                  </div>
                  <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                    ✗ ×{e.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Per module ─────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800">Por módulo</h2>
          {loading ? (
            <div className="space-y-3">
              {MODULES.filter(m => m.id !== 'mezcla').map(m => (
                <div key={m.id} className="bg-white rounded-2xl p-5 animate-pulse h-28"/>
              ))}
            </div>
          ) : MODULES.filter(m => m.id !== 'mezcla').map(mod => {
            const s = moduleStats[mod.id] || { total: 0, new: 0, learning: 0, review: 0, mastered: 0, accuracy: 0, dueNow: 0 };
            const studied = s.total - s.new;
            const mp = s.total > 0 ? Math.round((studied / s.total) * 100) : 0;
            return (
              <div key={mod.id} className="bg-white rounded-2xl p-5 border border-slate-200">
                <div className="flex items-center gap-3 mb-3">
                  <ModuleIcon id={mod.id} size={40} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-gray-900 text-sm truncate">{mod.name}</h3>
                      <span className="text-sm font-bold text-gray-500 shrink-0">{mp}% vistas</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1.5">
                      <div
                        className="bg-[#282182] rounded-full h-1.5 transition-all"
                        style={{ width: `${mp}%` }}
                      />
                    </div>
                  </div>
                </div>
                {s.total > 0 ? (
                  <div className="grid grid-cols-5 gap-2 text-center text-xs">
                    {[
                      { label: 'Total',    val: s.total,    bg: 'bg-slate-50',  text: 'text-gray-700'   },
                      { label: 'Nuevas',   val: s.new,      bg: 'bg-slate-50',  text: 'text-slate-500'  },
                      { label: 'Aprend.',  val: s.learning, bg: 'bg-orange-50', text: 'text-orange-600' },
                      { label: 'Repaso',   val: s.review,   bg: 'bg-blue-50',   text: 'text-blue-600'   },
                      { label: 'Domin.',   val: s.mastered, bg: 'bg-green-50',  text: 'text-green-600'  },
                    ].map(({ label, val, bg, text }) => (
                      <div key={label} className={`${bg} rounded-lg p-2`}>
                        <div className={`font-bold ${text}`}>{val}</div>
                        <div className="text-gray-400">{label}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg text-center">Preguntas próximamente</div>
                )}
                {s.dueNow > 0 && (
                  <button onClick={() => router.push(`/study/${mod.id}`)} className="mt-3 w-full text-xs bg-[#282182] hover:bg-[#1e1965] text-white py-2 rounded-lg font-semibold transition">
                    Practicar {s.dueNow} pendientes →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
