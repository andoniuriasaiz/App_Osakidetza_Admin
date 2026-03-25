// ─── Bookmarks / Favoritas ───────────────────────────────────────────────────
// localStorage como caché inmediata + Neon como fuente de verdad.
// Patrón: lectura/escritura en localStorage siempre (rápido),
//          persist() → BD en segundo plano (fire-and-forget).

const KEY = 'osakidetza_bookmarks';

function load(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch { return new Set(); }
}

function save(set: Set<string>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify([...set]));
}

// ─── DB sync ──────────────────────────────────────────────────────────────────

/** Carga los bookmarks desde la BD y los fusiona con localStorage (la BD gana). */
export async function syncBookmarksFromDB(): Promise<void> {
  try {
    const res = await fetch('/api/user/bookmarks');
    if (!res.ok) return;
    const { bookmarks } = await res.json() as { bookmarks: string[] };
    // La BD es la fuente de verdad: sobreescribe localStorage
    save(new Set(bookmarks));
  } catch {
    // Sin conexión — localStorage sigue siendo válido
  }
}

/** Persiste el estado actual de localStorage en la BD (fire-and-forget). */
function persistBookmarks(set: Set<string>): void {
  fetch('/api/user/bookmarks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookmarks: [...set] }),
  }).catch(() => {/* silencioso */});
}

// ─── API pública ──────────────────────────────────────────────────────────────

export function isBookmarked(questionId: string): boolean {
  return load().has(questionId);
}

/**
 * Alterna el bookmark de una pregunta.
 * Actualiza localStorage inmediatamente y sincroniza con la BD en segundo plano.
 * @returns true si se añadió, false si se eliminó
 */
export function toggleBookmark(questionId: string): boolean {
  const set = load();
  if (set.has(questionId)) {
    set.delete(questionId);
    save(set);
    persistBookmarks(set);
    return false;
  } else {
    set.add(questionId);
    save(set);
    persistBookmarks(set);
    return true;
  }
}

export function getBookmarkedIds(): string[] {
  return [...load()];
}

export function getBookmarkCount(): number {
  return load().size;
}
