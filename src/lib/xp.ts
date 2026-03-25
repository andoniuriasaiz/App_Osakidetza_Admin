// ─── XP & Level System ────────────────────────────────────────────────────────
// XP awarded per quality rating in study sessions
// Quality: 0=No sé, 1=Difícil, 2=Bien, 3=Fácil

export const XP_PER_QUALITY: Record<number, number> = {
  0: 2,   // No sé — still gives a little for trying
  1: 5,   // Difícil
  2: 10,  // Bien
  3: 15,  // Fácil
};

// XP for exam answers
export const XP_EXAM_CORRECT = 8;
export const XP_EXAM_WRONG   = 1;

export interface Level {
  level: number;
  name: string;
  minXp: number;
  maxXp: number;
  color: string;
  emoji: string;
}

export const LEVELS: Level[] = [
  { level: 1, name: 'Novato',      minXp: 0,    maxXp: 100,  color: '#94a3b8', emoji: '🌱' },
  { level: 2, name: 'Aprendiz',    minXp: 100,  maxXp: 300,  color: '#60a5fa', emoji: '📘' },
  { level: 3, name: 'Practicante', minXp: 300,  maxXp: 600,  color: '#34d399', emoji: '⚡' },
  { level: 4, name: 'Competente',  minXp: 600,  maxXp: 1000, color: '#f59e0b', emoji: '🔥' },
  { level: 5, name: 'Experto',     minXp: 1000, maxXp: 1500, color: '#f97316', emoji: '🎯' },
  { level: 6, name: 'Maestro',     minXp: 1500, maxXp: 9999, color: '#282182', emoji: '🏆' },
];

export function getLevel(xp: number): Level {
  return LEVELS.slice().reverse().find(l => xp >= l.minXp) ?? LEVELS[0];
}

export function getLevelProgress(xp: number): { level: Level; pct: number; xpInLevel: number; xpNeeded: number } {
  const level = getLevel(xp);
  const xpInLevel = xp - level.minXp;
  const xpNeeded = level.maxXp - level.minXp;
  const pct = level.level === 6 ? 100 : Math.min(100, Math.round((xpInLevel / xpNeeded) * 100));
  return { level, pct, xpInLevel, xpNeeded };
}

// ─── Combo multiplier ─────────────────────────────────────────────────────────
// Racha de aciertos consecutivos → multiplicador de XP
export function getComboMultiplier(streak: number): number {
  if (streak >= 10) return 3;
  if (streak >= 6)  return 2;
  if (streak >= 3)  return 1.5;
  return 1;
}

export function getComboLabel(streak: number): string | null {
  if (streak >= 10) return '×3 🚀';
  if (streak >= 6)  return '×2 🔥🔥';
  if (streak >= 3)  return '×1.5 🔥';
  return null;
}

export function applyCombo(baseXP: number, streak: number): number {
  return Math.round(baseXP * getComboMultiplier(streak));
}

// ─── localStorage XP cache ─────────────────────────────────────────────────────
const XP_KEY = 'osakidetza_xp';
const GOAL_KEY = 'osakidetza_daily_goal';
const GOAL_PROGRESS_KEY = 'osakidetza_goal_progress';

export function getLocalXP(): number {
  if (typeof window === 'undefined') return 0;
  return parseInt(localStorage.getItem(XP_KEY) ?? '0', 10);
}

export function setLocalXP(xp: number) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(XP_KEY, String(xp));
}

export function addLocalXP(amount: number): number {
  const current = getLocalXP();
  const next = current + amount;
  setLocalXP(next);
  return next;
}

export function getDailyGoal(): number {
  if (typeof window === 'undefined') return 20;
  return parseInt(localStorage.getItem(GOAL_KEY) ?? '20', 10);
}

export function setDailyGoal(goal: number) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(GOAL_KEY, String(goal));
  // Reset progress when goal changes
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
  const raw = localStorage.getItem(GOAL_PROGRESS_KEY);
  const data = raw ? JSON.parse(raw) : {};
  if (data.date !== today) {
    localStorage.setItem(GOAL_PROGRESS_KEY, JSON.stringify({ date: today, count: 0 }));
  }
}

export function getTodayAnswerCount(): number {
  if (typeof window === 'undefined') return 0;
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
  const raw = localStorage.getItem(GOAL_PROGRESS_KEY);
  if (!raw) return 0;
  const data = JSON.parse(raw);
  return data.date === today ? (data.count ?? 0) : 0;
}

export function incrementTodayAnswerCount(): number {
  if (typeof window === 'undefined') return 0;
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
  const raw = localStorage.getItem(GOAL_PROGRESS_KEY);
  const data = raw ? JSON.parse(raw) : {};
  const currentCount = data.date === today ? (data.count ?? 0) : 0;
  const next = currentCount + 1;
  localStorage.setItem(GOAL_PROGRESS_KEY, JSON.stringify({ date: today, count: next }));
  return next;
}

// Sync XP from DB on login
export async function syncXPFromDB() {
  if (typeof window === 'undefined') return;
  try {
    const res = await fetch('/api/user/xp');
    if (res.ok) {
      const data = await res.json();
      if (typeof data.xp === 'number') setLocalXP(data.xp);
      if (typeof data.dailyGoal === 'number') {
        localStorage.setItem(GOAL_KEY, String(data.dailyGoal));
      }
    }
  } catch { /* offline fallback */ }
}

// ─── Daily progress DB sync ───────────────────────────────────────────────────

/** Envía el contador de respuestas de hoy a la BD (fire-and-forget). */
export function saveDailyProgressToDB(): void {
  if (typeof window === 'undefined') return;
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
  const count = getTodayAnswerCount();
  fetch('/api/user/daily-progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: today, count }),
  }).catch(() => {});
}

/** Descarga el contador de hoy desde la BD y actualiza localStorage si es mayor. */
export async function syncDailyProgressFromDB(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const res = await fetch('/api/user/daily-progress');
    if (!res.ok) return;
    const data = await res.json() as { date: string; count: number };
    const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
    if (data.date !== today) return;
    const local = getTodayAnswerCount();
    if (data.count > local) {
      localStorage.setItem(GOAL_PROGRESS_KEY, JSON.stringify({ date: today, count: data.count }));
    }
  } catch { /* offline fallback */ }
}

// Fire-and-forget: persist XP delta to DB
export function persistXP(xp: number) {
  if (typeof window === 'undefined') return;
  fetch('/api/user/xp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ xp }),
  }).catch(() => {});
}
