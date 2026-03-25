// ─── Streak Shield ────────────────────────────────────────────────────────────
// Un escudo protege la racha si el usuario falla un día.
// Se otorga 1 escudo por semana automáticamente (máx. 2 en reserva).
// Patrón: localStorage. No necesita BD (los escudos son generosos, no premium).

const KEY = 'osakidetza_streak_shield';
const MAX_SHIELDS = 2;

interface ShieldState {
  shields: number;
  lastGrantedWeek: string; // "2026-W12"
}

function isoWeek(date: Date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const wn = Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7) + 1;
  return `${d.getFullYear()}-W${String(wn).padStart(2, '0')}`;
}

function load(): ShieldState {
  if (typeof window === 'undefined') return { shields: 0, lastGrantedWeek: '' };
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ShieldState) : { shields: 0, lastGrantedWeek: '' };
  } catch { return { shields: 0, lastGrantedWeek: '' }; }
}

function save(state: ShieldState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(state));
}

/**
 * Comprueba si toca otorgar un escudo esta semana y lo añade.
 * Lllamar en el mount del dashboard.
 * @returns true si se acaba de otorgar un escudo nuevo
 */
export function grantWeeklyShield(): boolean {
  const state = load();
  const thisWeek = isoWeek();
  if (state.lastGrantedWeek === thisWeek) return false;
  if (state.shields >= MAX_SHIELDS) {
    const next = { ...state, lastGrantedWeek: thisWeek };
    save(next);
    saveShieldsToDB(next);
    return false;
  }
  const next = { shields: state.shields + 1, lastGrantedWeek: thisWeek };
  save(next);
  saveShieldsToDB(next);
  return true;
}

/** Número de escudos disponibles. */
export function getShieldCount(): number {
  return load().shields;
}

/**
 * Consume un escudo para proteger la racha rota.
 * @returns true si había escudo y se usó, false si no había.
 */
export function useShield(): boolean {
  const state = load();
  if (state.shields <= 0) return false;
  const next = { ...state, shields: state.shields - 1 };
  save(next);
  saveShieldsToDB(next);
  return true;
}

// ─── BD sync ─────────────────────────────────────────────────────────────────

function saveShieldsToDB(state?: ShieldState): void {
  if (typeof window === 'undefined') return;
  const s = state ?? load();
  fetch('/api/user/shields', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count: s.shields, lastGrantedWeek: s.lastGrantedWeek }),
  }).catch(() => {});
}

export async function syncShieldsFromDB(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const res = await fetch('/api/user/shields');
    if (!res.ok) return;
    const data = await res.json() as { count: number; lastGrantedWeek: string };
    if (typeof data.count !== 'number') return;
    const local = load();
    const merged: ShieldState = {
      shields: Math.max(local.shields, data.count),
      lastGrantedWeek: (local.lastGrantedWeek ?? '') > (data.lastGrantedWeek ?? '')
        ? local.lastGrantedWeek
        : (data.lastGrantedWeek ?? ''),
    };
    save(merged);
  } catch { /* ignore */ }
}
