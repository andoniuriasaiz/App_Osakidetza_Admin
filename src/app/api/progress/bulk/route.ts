import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/session';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { userId } = session;
  const { results, sessionData } = await req.json();

  if (!results || !Array.isArray(results)) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
  }

  try {
    // 1. Bulk insert/update card_states
    for (const item of results) {
      const { cardId, cardState } = item;
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
    }

    // 2. Insert into user_sessions if sessionData is provided
    if (sessionData) {
      const sessionId = Math.random().toString(36).substring(2, 10);
      await db`
        INSERT INTO user_sessions (
          id, user_id, date, ts, module_id, module_name, mode,
          correct, wrong, total, xp, max_streak, duration_sec
        ) VALUES (
          ${sessionId}, ${userId}, CURRENT_DATE, ${Date.now()},
          ${sessionData.moduleId}, ${sessionData.moduleName}, 'exam',
          ${sessionData.correct}, ${sessionData.wrong}, ${sessionData.total},
          ${sessionData.xp}, 0, ${sessionData.durationSec}
        )
      `;
      
      // Update User XP
      await db`
        UPDATE users SET xp = xp + ${sessionData.xp} WHERE id = ${userId}
      `;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error inserting bulk exam results:', error);
    return NextResponse.json({ error: 'DB Error' }, { status: 500 });
  }
}
