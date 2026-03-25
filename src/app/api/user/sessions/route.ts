import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/session';

// GET /api/user/sessions — últimas 30 sesiones del usuario
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { userId } = session;

  const rows = await db`
    SELECT id, date::text, ts, module_id, module_name, mode,
           correct, wrong, total, xp, max_streak, duration_sec
    FROM user_sessions
    WHERE user_id = ${userId}
    ORDER BY ts DESC
    LIMIT 30
  `;

  return NextResponse.json({ sessions: rows });
}

// POST /api/user/sessions — inserta una sesión (idempotente por id)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { userId } = session;

  const body = await req.json() as {
    id: string; date: string; ts: number; moduleId: string; moduleName: string;
    mode: string; correct: number; wrong: number; total: number;
    xp: number; maxStreak: number; durationSec: number;
  };

  if (!body.id || !body.moduleId) {
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
  }

  await db`
    INSERT INTO user_sessions (
      id, user_id, date, ts, module_id, module_name, mode,
      correct, wrong, total, xp, max_streak, duration_sec
    ) VALUES (
      ${body.id}, ${userId}, ${body.date}, ${body.ts},
      ${body.moduleId}, ${body.moduleName}, ${body.mode},
      ${body.correct}, ${body.wrong}, ${body.total},
      ${body.xp}, ${body.maxStreak}, ${body.durationSec}
    )
    ON CONFLICT (id) DO NOTHING
  `;

  return NextResponse.json({ ok: true });
}
