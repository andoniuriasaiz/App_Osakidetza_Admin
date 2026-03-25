import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/session';

// GET /api/user/shields — número de escudos y semana del último otorgamiento
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { userId } = session;

  const rows = await db`
    SELECT count, last_granted_week FROM user_shields WHERE user_id = ${userId}
  `;

  return NextResponse.json({
    count:            rows[0]?.count            ?? 0,
    lastGrantedWeek:  rows[0]?.last_granted_week ?? '',
  });
}

// POST /api/user/shields — guarda estado de escudos
// Body: { count: 1, lastGrantedWeek: "2026-W12" }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { userId } = session;

  const { count, lastGrantedWeek } = await req.json() as {
    count: number;
    lastGrantedWeek: string;
  };

  if (typeof count !== 'number') {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
  }

  await db`
    INSERT INTO user_shields (user_id, count, last_granted_week)
    VALUES (${userId}, ${count}, ${lastGrantedWeek ?? ''})
    ON CONFLICT (user_id) DO UPDATE SET
      count             = EXCLUDED.count,
      last_granted_week = EXCLUDED.last_granted_week
  `;

  return NextResponse.json({ ok: true });
}
