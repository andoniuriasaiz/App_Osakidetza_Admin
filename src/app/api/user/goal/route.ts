import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/session';

// POST /api/user/goal — actualiza objetivo diario del usuario
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { userId } = session;
  const { dailyGoal } = await req.json();

  if (typeof dailyGoal !== 'number' || dailyGoal < 1 || dailyGoal > 200) {
    return NextResponse.json({ error: 'Objetivo inválido' }, { status: 400 });
  }

  await db`
    UPDATE users SET daily_goal = ${dailyGoal} WHERE id = ${userId}
  `;

  return NextResponse.json({ ok: true, dailyGoal });
}
