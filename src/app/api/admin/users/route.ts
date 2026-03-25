import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/session';

// GET /api/admin/users — lista todos los usuarios con estadísticas agregadas
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const users = await db`
    SELECT
      u.id,
      u.username,
      u.role,
      u.created_at,
      u.xp,
      u.daily_goal,
      COUNT(DISTINCT us.id)::int          AS session_count,
      MAX(us.ts)                           AS last_session_ts,
      COALESCE(SUM(us.total), 0)::int      AS total_answers,
      COALESCE(SUM(us.correct), 0)::int    AS total_correct,
      COUNT(DISTINCT sd.study_date)::int   AS study_days
    FROM users u
    LEFT JOIN user_sessions us ON us.user_id = u.id
    LEFT JOIN study_dates   sd ON sd.user_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `;

  return NextResponse.json({ users });
}
