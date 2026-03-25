import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/session';

// POST /api/progress/touch-day — registra un día de estudio (hoy por defecto)
// Body opcional: { date: "2026-03-20" } para insertar una fecha específica (uso del escudo)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { userId } = session;

  let date: string;
  try {
    const body = await req.json().catch(() => ({}));
    date = (body as Record<string, string>).date ?? new Date().toISOString().split('T')[0];
    // Validate YYYY-MM-DD format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      date = new Date().toISOString().split('T')[0];
    }
  } catch {
    date = new Date().toISOString().split('T')[0];
  }

  await db`
    INSERT INTO study_dates (user_id, study_date)
    VALUES (${userId}, ${date})
    ON CONFLICT (user_id, study_date) DO NOTHING
  `;

  return NextResponse.json({ ok: true, date });
}
