import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/session';

// GET /api/user/daily-progress — contador de respuestas de hoy
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { userId } = session;

  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  const rows = await db`
    SELECT count FROM daily_answers
    WHERE user_id = ${userId} AND answer_date = ${dateStr}
  `;

  return NextResponse.json({ date: dateStr, count: rows[0]?.count ?? 0 });
}

// POST /api/user/daily-progress — actualiza contador del día (toma el máximo)
// Body: { date: "2026-03-21", count: 15 }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { userId } = session;

  const { date, count } = await req.json() as { date: string; count: number };

  if (!date || typeof count !== 'number') {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
  }

  await db`
    INSERT INTO daily_answers (user_id, answer_date, count)
    VALUES (${userId}, ${date}, ${count})
    ON CONFLICT (user_id, answer_date) DO UPDATE SET
      count = GREATEST(daily_answers.count, EXCLUDED.count)
  `;

  return NextResponse.json({ ok: true, count });
}
