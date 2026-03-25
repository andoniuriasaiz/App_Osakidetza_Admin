import { CardState, createCard, updateCard, Quality } from './spaced-repetition';

const PROGRESS_KEY = 'chatelac_progress';

export interface Progress {
  cards: Record<string, CardState>;
  lastStudied: number;
  totalSessions: number;
  wrongCounts: Record<string, number>;
  studyDates: string[];
  streak: number;
}

function emptyProgress(): Progress {
  return { cards: {}, lastStudied: 0, totalSessions: 0, wrongCounts: {}, studyDates: [], streak: 0 };
}

function loadProgress(): Progress {
  if (typeof window === 'undefined') return emptyProgress();
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return emptyProgress();
    const p = JSON.parse(raw);
    if (!p.wrongCounts) p.wrongCounts = {};
    if (!p.studyDates)  p.studyDates  = [];
    if (!p.streak)      p.streak      = 0;
    return p;
  } catch {
    return emptyProgress();
  }
}

function saveProgress(progress: Progress): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

// ─── Sincronización con BD ────────────────────────────────
/** Carga el progreso desde la BD y reemplaza localStorage. Llamar al hacer login. */
export async function syncFromDB(): Promise<void> {
  try {
    const res = await fetch('/api/progress');
    if (!res.ok) return;
    const data = await res.json();

    const progress = loadProgress();
    progress.cards = data.cards || {};
    progress.wrongCounts = data.wrongCounts || {};
    progress.studyDates = data.studyDates || [];

    // Recalcular racha
    const dateSet = new Set(progress.studyDates);
    let streak = 0;
    const d = new Date();
    for (let i = 0; i < 366; i++) {
      const key = toDateStr(d.getTime());
      if (dateSet.has(key)) { streak++; d.setDate(d.getDate() - 1); }
      else break;
    }
    progress.streak = streak;

    saveProgress(progress);
  } catch {
    // Fallo silencioso — seguimos con localStorage
  }
}

/** Envía el estado de una carta a la BD en background (fire-and-forget) */
function syncCardToDB(cardId: string, cardState: CardState): void {
  fetch('/api/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardId, cardState }),
  }).catch(() => { /* silencioso */ });
}

/** Registra el día de estudio en la BD en background */
function syncStudyDayToDB(): void {
  fetch('/api/progress/touch-day', { method: 'POST' }).catch(() => { /* silencioso */ });
}

// ─── Card state ──────────────────────────────────────────
export function getCardState(questionId: string): CardState {
  const progress = loadProgress();
  return progress.cards[questionId] || createCard();
}

export function recordAnswer(questionId: string, quality: Quality): CardState {
  const progress = loadProgress();
  const card = progress.cards[questionId] || createCard();
  const updated = updateCard(card, quality);
  progress.cards[questionId] = updated;
  progress.lastStudied = Date.now();
  if (quality === 0) {
    progress.wrongCounts[questionId] = (progress.wrongCounts[questionId] || 0) + 1;
  }
  saveProgress(progress);
  // Sync en background
  syncCardToDB(questionId, updated);
  return updated;
}

// ─── Wrong counts ────────────────────────────────────────
export function getWrongCount(questionId: string): number {
  return (loadProgress().wrongCounts || {})[questionId] || 0;
}

export function getMostWrong(questionIds: string[], limit = 50): string[] {
  const wc = loadProgress().wrongCounts || {};
  return questionIds
    .filter(id => (wc[id] || 0) > 0)
    .sort((a, b) => (wc[b] || 0) - (wc[a] || 0))
    .slice(0, limit);
}

// ─── Daily streak ────────────────────────────────────────
function toDateStr(ts: number = Date.now()): string {
  return new Date(ts).toISOString().split('T')[0];
}

export function touchStudyDay(): void {
  const progress = loadProgress();
  const today = toDateStr();
  if (!progress.studyDates.includes(today)) {
    progress.studyDates.push(today);
    progress.studyDates = progress.studyDates.slice(-366);
  }
  const dateSet = new Set(progress.studyDates);
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 366; i++) {
    const key = toDateStr(d.getTime());
    if (dateSet.has(key)) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  progress.streak = streak;
  saveProgress(progress);
  // Sync en background
  syncStudyDayToDB();
}

export function getStreak(): number {
  return loadProgress().streak;
}

export function getStudyDates(): string[] {
  return loadProgress().studyDates;
}

// ─── Module stats ────────────────────────────────────────
export function getModuleStats(questionIds: string[]): {
  total: number; new: number; learning: number;
  review: number; mastered: number; accuracy: number; dueNow: number;
} {
  const progress = loadProgress();
  const now = Date.now();
  let newCards = 0, learning = 0, review = 0, mastered = 0;
  let totalReviews = 0, totalWrong = 0, dueNow = 0;

  for (const id of questionIds) {
    const card = progress.cards[id];
    if (!card || card.lastReview === 0) {
      newCards++; dueNow++;
    } else {
      totalReviews += card.totalReviews;
      totalWrong   += card.totalWrong;
      if (now >= card.nextReview) dueNow++;
      if (card.repetitions === 0) learning++;
      else if (card.interval >= 21) mastered++;
      else review++;
    }
  }

  return {
    total: questionIds.length, new: newCards, learning, review, mastered,
    accuracy: totalReviews > 0 ? Math.round(((totalReviews - totalWrong) / totalReviews) * 100) : 0,
    dueNow,
  };
}

// ─── Due questions ───────────────────────────────────────
export function getDueQuestions(questionIds: string[]): string[] {
  const progress = loadProgress();
  const now = Date.now();
  const due: string[] = [];
  const notStarted: string[] = [];

  for (const id of questionIds) {
    const card = progress.cards[id];
    if (!card || card.lastReview === 0) notStarted.push(id);
    else if (now >= card.nextReview) due.push(id);
  }

  due.sort((a, b) => {
    const ca = progress.cards[a];
    const cb = progress.cards[b];
    return (ca?.nextReview || 0) - (cb?.nextReview || 0);
  });

  return [...due, ...notStarted];
}

// ─── Misc ────────────────────────────────────────────────
export function getAllProgress(): Progress {
  return loadProgress();
}

export function resetProgress(questionIds?: string[]): void {
  const progress = loadProgress();
  if (questionIds) {
    for (const id of questionIds) {
      delete progress.cards[id];
      delete progress.wrongCounts[id];
    }
  } else {
    progress.cards = {};
    progress.wrongCounts = {};
  }
  saveProgress(progress);
}

export function incrementSession(): void {
  const progress = loadProgress();
  progress.totalSessions = (progress.totalSessions || 0) + 1;
  progress.lastStudied = Date.now();
  saveProgress(progress);
  touchStudyDay();
}
