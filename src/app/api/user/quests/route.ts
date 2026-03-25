import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/session';

// GET /api/user/quests — progreso de quests del día actual
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { userId } = session;

  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  const rows = await db`
    SELECT quest_id, progress, completed, reward_claimed
    FROM daily_quests
    WHERE user_id = ${userId} AND quest_date = ${dateStr}
  `;

  // Return as a map quest_id → { progress, completed, rewardClaimed }
  const quests: Record<string, { progress: number; completed: boolean; rewardClaimed: boolean }> = {};
  for (const row of rows) {
    quests[row.quest_id] = {
      progress: row.progress,
      completed: row.completed,
      rewardClaimed: row.reward_claimed,
    };
  }

  return NextResponse.json({ date: dateStr, quests });
}

// POST /api/user/quests — guarda el estado completo de las quests de hoy
// Body: { date: "2026-03-21", quests: [{ id, progress, completed, rewardClaimed }] }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { userId } = session;

  const { date, quests } = await req.json() as {
    date: string;
    quests: Array<{ id: string; progress: number; completed: boolean; rewardClaimed: boolean }>;
  };

  if (!date || !Array.isArray(quests)) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
  }

  for (const q of quests) {
    await db`
      INSERT INTO daily_quests (user_id, quest_date, quest_id, progress, completed, reward_claimed)
      VALUES (${userId}, ${date}, ${q.id}, ${q.progress}, ${q.completed}, ${q.rewardClaimed})
      ON CONFLICT (user_id, quest_date, quest_id) DO UPDATE SET
        progress       = GREATEST(daily_quests.progress, EXCLUDED.progress),
        completed      = daily_quests.completed OR EXCLUDED.completed,
        reward_claimed = daily_quests.reward_claimed OR EXCLUDED.reward_claimed
    `;
  }

  return NextResponse.json({ ok: true });
}
