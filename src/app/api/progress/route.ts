import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/session';

// GET /api/progress — carga todo el progreso del usuario desde la BD
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { userId } = session;

  const [cardRows, dateRows] = await Promise.all([
    db`
      SELECT card_id, interval_days, ease_factor, repetitions,
             next_review, last_review, total_reviews, total_wrong
      FROM card_states
      WHERE user_id = ${userId}
    `,
    db`
      SELECT study_date::text FROM study_dates
      WHERE user_id = ${userId}
      ORDER BY study_date DESC
      LIMIT 366
    `,
  ]);

  // Reconstruir en el formato que usa progress.ts
  const cards: Record<string, object> = {};
  const wrongCounts: Record<string, number> = {};

  for (const row of cardRows) {
    cards[row.card_id] = {
      interval: row.interval_days,
      easeFactor: row.ease_factor,
      repetitions: row.repetitions,
      nextReview: Number(row.next_review),
      lastReview: Number(row.last_review),
      totalReviews: row.total_reviews,
      totalWrong: row.total_wrong,
    };
    if (row.total_wrong > 0) wrongCounts[row.card_id] = row.total_wrong;
  }

  const studyDates = dateRows.map((r) => String(r.study_date));

  return NextResponse.json({ cards, wrongCounts, studyDates });
}

// POST /api/progress — guarda progreso de una carta concreta
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { userId } = session;
  const { cardId, cardState } = await req.json();

  if (!cardId || !cardState) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
  }

  await db`
    INSERT INTO card_states (
      user_id, card_id, interval_days, ease_factor, repetitions,
      next_review, last_review, total_reviews, total_wrong, updated_at
    ) VALUES (
      ${userId}, ${cardId}, ${cardState.interval}, ${cardState.easeFactor},
      ${cardState.repetitions}, ${cardState.nextReview}, ${cardState.lastReview},
      ${cardState.totalReviews}, ${cardState.totalWrong}, NOW()
    )
    ON CONFLICT (user_id, card_id) DO UPDATE SET
      interval_days = EXCLUDED.interval_days,
      ease_factor   = EXCLUDED.ease_factor,
      repetitions   = EXCLUDED.repetitions,
      next_review   = EXCLUDED.next_review,
      last_review   = EXCLUDED.last_review,
      total_reviews = EXCLUDED.total_reviews,
      total_wrong   = EXCLUDED.total_wrong,
      updated_at    = NOW()
  `;

  return NextResponse.json({ ok: true });
}
