import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/session';

// GET /api/admin/stats — métricas globales del panel de administración
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const [
    activeToday,
    activeWeek,
    newUsersWeek,
    levelDist,
    moduleSummary,
    recentSessions,
    globalTime,
    dailyActivity,
  ] = await Promise.all([

    // Usuarios activos hoy
    db`SELECT COUNT(DISTINCT user_id)::int AS count
       FROM study_dates
       WHERE study_date = CURRENT_DATE`,

    // Usuarios activos esta semana
    db`SELECT COUNT(DISTINCT user_id)::int AS count
       FROM study_dates
       WHERE study_date >= CURRENT_DATE - 6`,

    // Nuevos usuarios esta semana (sin admins)
    db`SELECT COUNT(*)::int AS count
       FROM users
       WHERE role != 'admin' AND created_at >= NOW() - INTERVAL '7 days'`,

    // Distribución de niveles
    db`SELECT
         SUM(CASE WHEN xp >= 1500 THEN 1 ELSE 0 END)::int AS maestro,
         SUM(CASE WHEN xp >= 1000 AND xp < 1500 THEN 1 ELSE 0 END)::int AS experto,
         SUM(CASE WHEN xp >= 600  AND xp < 1000 THEN 1 ELSE 0 END)::int AS competente,
         SUM(CASE WHEN xp >= 300  AND xp < 600  THEN 1 ELSE 0 END)::int AS practicante,
         SUM(CASE WHEN xp >= 100  AND xp < 300  THEN 1 ELSE 0 END)::int AS aprendiz,
         SUM(CASE WHEN xp < 100 THEN 1 ELSE 0 END)::int AS novato
       FROM users WHERE role != 'admin'`,

    // Módulos más usados
    db`SELECT
         module_id,
         module_name,
         COUNT(*)::int                                      AS sessions,
         COALESCE(SUM(total), 0)::int                       AS answers,
         COALESCE(SUM(correct), 0)::int                     AS correct_total,
         COALESCE(SUM(duration_sec), 0)::int                AS total_time,
         ROUND(AVG(correct::float / NULLIF(total, 0) * 100))::int AS avg_accuracy
       FROM user_sessions
       GROUP BY module_id, module_name
       ORDER BY sessions DESC
       LIMIT 8`,

    // Últimas 12 sesiones de todos los usuarios
    db`SELECT
         us.id, us.date::text, us.ts, us.module_id, us.module_name,
         us.mode, us.correct, us.wrong, us.total, us.xp, us.duration_sec,
         u.username, u.id AS user_id
       FROM user_sessions us
       JOIN users u ON u.id = us.user_id
       ORDER BY us.ts DESC
       LIMIT 12`,

    // Tiempo total de estudio y respuestas
    db`SELECT
         COALESCE(SUM(duration_sec), 0)::int  AS total_time_sec,
         COALESCE(SUM(total), 0)::int          AS total_answers,
         COALESCE(SUM(correct), 0)::int        AS total_correct,
         COUNT(*)::int                         AS total_sessions
       FROM user_sessions`,

    // Actividad diaria últimos 14 días (respuestas por día, todos los usuarios)
    db`SELECT
         answer_date::text AS date,
         SUM(count)::int   AS answers
       FROM daily_answers
       WHERE answer_date >= CURRENT_DATE - 13
       GROUP BY answer_date
       ORDER BY answer_date`,
  ]);

  return NextResponse.json({
    activeToday:    activeToday[0]?.count   ?? 0,
    activeWeek:     activeWeek[0]?.count    ?? 0,
    newUsersWeek:   newUsersWeek[0]?.count  ?? 0,
    levelDist:      levelDist[0] ?? {},
    moduleSummary,
    recentSessions,
    globalTime:     globalTime[0] ?? {},
    dailyActivity,
  });
}
