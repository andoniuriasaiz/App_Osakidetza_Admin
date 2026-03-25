import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/session';

// GET /api/user/xp — obtiene XP y objetivo diario del usuario
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { userId } = session;

  const rows = await db`
    SELECT xp, daily_goal FROM users WHERE id = ${userId}
  `;

  const user = rows[0];
  return NextResponse.json({
    xp:        user?.xp        ?? 0,
    dailyGoal: user?.daily_goal ?? 20,
  });
}

// POST /api/user/xp — actualiza XP (valor absoluto)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { userId } = session;
  const { xp } = await req.json();

  if (typeof xp !== 'number' || xp < 0) {
    return NextResponse.json({ error: 'XP inválido' }, { status: 400 });
  }

  await db`
    UPDATE users SET xp = ${xp} WHERE id = ${userId}
  `;

  return NextResponse.json({ ok: true, xp });
}
