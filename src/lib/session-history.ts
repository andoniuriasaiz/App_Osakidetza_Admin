// ─── Session History ─────────────────────────────────────────────────────────
// Historial de sesiones de estudio.
// Patrón write-through: localStorage (lectura rápida) + BD (multidispositivo).

const KEY = 'chatelac_session_log';
const MAX_ENTRIES = 30;

export interface SessionEntry {
  id: string;
  date: string;        // ISO date "2026-03-21"
  ts: number;          // timestamp ms (for ordering)
  moduleId: string;
  moduleName: string;
  mode: string;        // 'due' | 'all' | 'new' | 'errors' | 'bookmarks' | 'survival'
  correct: number;
  wrong: number;
  total: number;
  xp: number;
  maxStreak: number;
  durationSec: number; // seconds
}

function load(): SessionEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SessionEntry[]) : [];
  } catch { return []; }
}

function save(entries: SessionEntry[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(entries));
}

/** Añade una nueva sesión al historial (localStorage) y la sincroniza con la BD. */
export function logSession(entry: Omit<SessionEntry, 'id' | 'date' | 'ts'>): SessionEntry {
  const entries = load();
  const now = new Date();
  const d = now;
  const localDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const newEntry: SessionEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: localDate,
    ts: now.getTime(),
  };
  const updated = [newEntry, ...entries].slice(0, MAX_ENTRIES);
  save(updated);
  // Write-through a BD en background (fire-and-forget)
  saveSessionToDB(newEntry);
  return newEntry;
}

/** Devuelve todas las sesiones ordenadas de más reciente a más antigua. */
export function getSessions(): SessionEntry[] {
  return load().sort((a, b) => b.ts - a.ts);
}

/** Devuelve las sesiones de los últimos N días. */
export function getRecentSessions(days = 7): SessionEntry[] {
  const cutoff = Date.now() - days * 86_400_000;
  return load().filter(s => s.ts >= cutoff).sort((a, b) => b.ts - a.ts);
}

/** Estadísticas agregadas de sesiones recientes. */
export function getSessionSummary(days = 7): {
  totalSessions: number;
  totalAnswers: number;
  totalXP: number;
  avgAccuracy: number;
  totalTimeSec: number;
} {
  const sessions = getRecentSessions(days);
  if (sessions.length === 0) return { totalSessions: 0, totalAnswers: 0, totalXP: 0, avgAccuracy: 0, totalTimeSec: 0 };
  const totalAnswers = sessions.reduce((s, e) => s + e.total, 0);
  const totalCorrect = sessions.reduce((s, e) => s + e.correct, 0);
  const totalXP = sessions.reduce((s, e) => s + e.xp, 0);
  const totalTimeSec = sessions.reduce((s, e) => s + (e.durationSec || 0), 0);
  return {
    totalSessions: sessions.length,
    totalAnswers,
    totalXP,
    avgAccuracy: totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0,
    totalTimeSec,
  };
}

// ─── BD sync ─────────────────────────────────────────────────────────────────

/** Guarda una sesión en la BD (fire-and-forget). */
export function saveSessionToDB(entry: SessionEntry): void {
  if (typeof window === 'undefined') return;
  fetch('/api/user/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id:          entry.id,
      date:        entry.date,
      ts:          entry.ts,
      moduleId:    entry.moduleId,
      moduleName:  entry.moduleName,
      mode:        entry.mode,
      correct:     entry.correct,
      wrong:       entry.wrong,
      total:       entry.total,
      xp:          entry.xp,
      maxStreak:   entry.maxStreak,
      durationSec: entry.durationSec,
    }),
  }).catch(() => { /* ignore network errors */ });
}

/** Descarga el historial de sesiones desde la BD y actualiza localStorage. */
export async function syncSessionsFromDB(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const res = await fetch('/api/user/sessions');
    if (!res.ok) return;
    const data = await res.json() as { sessions: Array<Record<string, unknown>> };
    if (!Array.isArray(data.sessions)) return;

    const remote: SessionEntry[] = data.sessions.map(r => ({
      id:          String(r.id),
      date:        String(r.date),
      ts:          Number(r.ts),
      moduleId:    String(r.module_id),
      moduleName:  String(r.module_name),
      mode:        String(r.mode),
      correct:     Number(r.correct),
      wrong:       Number(r.wrong),
      total:       Number(r.total),
      xp:          Number(r.xp),
      maxStreak:   Number(r.max_streak),
      durationSec: Number(r.duration_sec),
    }));

    // Merge: union of local + remote, deduplicated by id, capped at MAX_ENTRIES
    const local = load();
    const byId = new Map<string, SessionEntry>();
    for (const s of [...local, ...remote]) byId.set(s.id, s);
    const merged = Array.from(byId.values())
      .sort((a, b) => b.ts - a.ts)
      .slice(0, MAX_ENTRIES);
    save(merged);
  } catch { /* ignore */ }
}
