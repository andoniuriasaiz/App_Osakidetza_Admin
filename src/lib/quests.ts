// ─── Daily Quests System ─────────────────────────────────────────────────────
// 3 misiones fijas que se resetean a medianoche

const QUESTS_KEY = 'osakidetza_quests';

export interface Quest {
  id: string;
  title: string;
  description: string;
  emoji: string;
  xpReward: number;
  target: number;         // Número objetivo (e.g. 20 preguntas)
  progress: number;       // Progreso actual
  completed: boolean;
  rewardClaimed: boolean;
}

function today(): string {
  const d = new Date();
  // Use LOCAL date (not UTC) so quests reset at local midnight, not UTC midnight
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Definición estática de las 3 quests diarias
function buildQuests(): Quest[] {
  return [
    {
      id: 'q1',
      title: 'Sesión del día',
      description: 'Responde 20 preguntas hoy',
      emoji: '📚',
      xpReward: 50,
      target: 20,
      progress: 0,
      completed: false,
      rewardClaimed: false,
    },
    {
      id: 'q2',
      title: 'Racha de aciertos',
      description: 'Consigue 5 aciertos seguidos',
      emoji: '🔥',
      xpReward: 75,
      target: 5,
      progress: 0,
      completed: false,
      rewardClaimed: false,
    },
    {
      id: 'q3',
      title: 'Dominar el error',
      description: 'Responde bien 3 preguntas que habías fallado',
      emoji: '🎯',
      xpReward: 100,
      target: 3,
      progress: 0,
      completed: false,
      rewardClaimed: false,
    },
  ];
}

interface QuestStore {
  date: string;
  quests: Quest[];
}

function loadStore(): QuestStore {
  if (typeof window === 'undefined') return { date: today(), quests: buildQuests() };
  try {
    const raw = localStorage.getItem(QUESTS_KEY);
    if (!raw) return { date: today(), quests: buildQuests() };
    const store: QuestStore = JSON.parse(raw);
    // Reset if new day
    if (store.date !== today()) return { date: today(), quests: buildQuests() };
    return store;
  } catch {
    return { date: today(), quests: buildQuests() };
  }
}

function saveStore(store: QuestStore) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(QUESTS_KEY, JSON.stringify(store));
}

export function getQuests(): Quest[] {
  return loadStore().quests;
}

/** Actualiza el progreso de una quest por id. Devuelve si se ha completado ahora. */
export function updateQuestProgress(questId: string, progress: number): boolean {
  const store = loadStore();
  const quest = store.quests.find(q => q.id === questId);
  if (!quest || quest.completed) return false;
  quest.progress = Math.max(quest.progress, progress);
  const justCompleted = quest.progress >= quest.target && !quest.completed;
  if (justCompleted) quest.completed = true;
  saveStore(store);
  saveQuestsToDB();
  return justCompleted;
}

/** Marca una quest como recompensa reclamada y devuelve el XP */
export function claimQuestReward(questId: string): number {
  const store = loadStore();
  const quest = store.quests.find(q => q.id === questId);
  if (!quest || !quest.completed || quest.rewardClaimed) return 0;
  quest.rewardClaimed = true;
  saveStore(store);
  saveQuestsToDB();
  return quest.xpReward;
}

/** Cuenta quests completadas y totales */
export function getQuestSummary(): { done: number; total: number; unclaimed: number } {
  const quests = getQuests();
  return {
    done: quests.filter(q => q.completed).length,
    total: quests.length,
    unclaimed: quests.filter(q => q.completed && !q.rewardClaimed).length,
  };
}

// ─── Hooks de integración ────────────────────────────────────────────────────

/** Llamar cada vez que se responde una pregunta (para q1 — total de respuestas hoy) */
export function notifyAnswered(todayTotal: number): boolean {
  return updateQuestProgress('q1', todayTotal);
}

/** Llamar cuando se logra una racha de N aciertos consecutivos */
export function notifyStreak(streak: number): boolean {
  return updateQuestProgress('q2', streak);
}

/** Llamar cuando se responde bien una pregunta que tenía wrongCount > 0 */
export function notifyErrorFixed(): boolean {
  const store = loadStore();
  const quest = store.quests.find(q => q.id === 'q3');
  if (!quest || quest.completed) return false;
  quest.progress = (quest.progress || 0) + 1;
  const justCompleted = quest.progress >= quest.target;
  if (justCompleted) quest.completed = true;
  saveStore(store);
  saveQuestsToDB();
  return justCompleted;
}

// ─── BD sync ─────────────────────────────────────────────────────────────────

/** Guarda las quests de hoy en la BD (fire-and-forget). */
export function saveQuestsToDB(): void {
  if (typeof window === 'undefined') return;
  const store = loadStore();
  fetch('/api/user/quests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date: store.date,
      quests: store.quests.map(q => ({
        id: q.id,
        progress: q.progress,
        completed: q.completed,
        rewardClaimed: q.rewardClaimed,
      })),
    }),
  }).catch(() => {});
}

/** Descarga quests de la BD y fusiona con localStorage. */
export async function syncQuestsFromDB(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const res = await fetch('/api/user/quests');
    if (!res.ok) return;
    const data = await res.json() as {
      date: string;
      quests: Record<string, { progress: number; completed: boolean; rewardClaimed: boolean }>;
    };
    if (!data.quests) return;

    const store = loadStore();
    // Only merge if same day
    if (data.date !== store.date) return;

    let changed = false;
    for (const quest of store.quests) {
      const remote = data.quests[quest.id];
      if (!remote) continue;
      if (remote.progress > quest.progress) { quest.progress = remote.progress; changed = true; }
      if (remote.completed && !quest.completed) { quest.completed = true; changed = true; }
      if (remote.rewardClaimed && !quest.rewardClaimed) { quest.rewardClaimed = true; changed = true; }
    }
    if (changed) saveStore(store);
  } catch { /* ignore */ }
}
