// SM-2 Spaced Repetition Algorithm (like Anki)
// Quality ratings: 0=Wrong, 1=Hard, 2=Good, 3=Easy

export interface CardState {
  interval: number;       // Days until next review
  easeFactor: number;     // Difficulty factor (starts at 2.5)
  repetitions: number;    // Number of successful reviews
  nextReview: number;     // Timestamp for next review
  lastReview: number;     // Last review timestamp
  totalReviews: number;   // Total times reviewed
  totalWrong: number;     // Times answered wrong
}

export type Quality = 0 | 1 | 2 | 3; // Wrong | Hard | Good | Easy

export function createCard(): CardState {
  return {
    interval: 0,
    easeFactor: 2.5,
    repetitions: 0,
    nextReview: Date.now(),
    lastReview: 0,
    totalReviews: 0,
    totalWrong: 0,
  };
}

export function updateCard(card: CardState, quality: Quality): CardState {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  let { interval, easeFactor, repetitions } = card;

  if (quality === 0) {
    // Wrong - reset to start
    repetitions = 0;
    interval = 1;
    easeFactor = Math.max(1.3, easeFactor - 0.3);
  } else if (quality === 1) {
    // Hard
    repetitions = Math.max(0, repetitions - 1);
    interval = Math.max(1, Math.round(interval * 1.2));
    easeFactor = Math.max(1.3, easeFactor - 0.15);
  } else if (quality === 2) {
    // Good
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 3;
    else interval = Math.round(interval * easeFactor);
    repetitions += 1;
  } else {
    // Easy
    if (repetitions === 0) interval = 3;
    else interval = Math.round(interval * easeFactor * 1.3);
    repetitions += 1;
    easeFactor = Math.min(3.0, easeFactor + 0.1);
  }

  return {
    interval,
    easeFactor,
    repetitions,
    nextReview: now + interval * DAY,
    lastReview: now,
    totalReviews: card.totalReviews + 1,
    totalWrong: card.totalWrong + (quality === 0 ? 1 : 0),
  };
}

export function isDue(card: CardState): boolean {
  return Date.now() >= card.nextReview;
}

export function getDueLabel(card: CardState): string {
  if (card.lastReview === 0) return 'Nueva';
  if (isDue(card)) return 'Pendiente';
  const days = Math.ceil((card.nextReview - Date.now()) / (24 * 60 * 60 * 1000));
  if (days === 1) return 'Mañana';
  return `En ${days} días`;
}

export function getAccuracy(card: CardState): number {
  if (card.totalReviews === 0) return 0;
  return Math.round(((card.totalReviews - card.totalWrong) / card.totalReviews) * 100);
}

/** Returns a human-readable preview of the next interval if this quality is chosen */
export function previewInterval(card: CardState, quality: Quality): string {
  const next = updateCard(card, quality);
  const d = next.interval;
  if (d <= 0) return 'hoy';
  if (d === 1) return '1d';
  if (d < 7) return `${d}d`;
  if (d < 30) return `${Math.round(d / 7)}sem`;
  return `${Math.round(d / 30)}mes`;
}
