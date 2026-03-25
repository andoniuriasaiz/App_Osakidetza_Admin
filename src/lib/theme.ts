// ─── Theme (dark/light mode) ──────────────────────────────────────────────────
// Persiste en localStorage y aplica data-theme al elemento <html>.

const KEY = 'osakidetza_theme';

export type Theme = 'light' | 'dark';

export function getTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return (localStorage.getItem(KEY) as Theme) ?? 'light';
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
}

export function setTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, theme);
  applyTheme(theme);
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

/** Llamar una sola vez en el layout (o en el primer useEffect global) para evitar FOUC */
export function initTheme(): void {
  applyTheme(getTheme());
}
