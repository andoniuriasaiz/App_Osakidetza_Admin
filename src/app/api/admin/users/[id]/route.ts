import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { getSession } from '@/lib/session';

// GET /api/admin/users/[id] — estadísticas detalladas de un usuario
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  const userId = parseInt(id, 10);
  if (isNaN(userId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  // User base info
  const users = await db`
    SELECT id, username, role, created_at, xp, daily_goal FROM users WHERE id = ${userId}
  `;
  if (users.length === 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  const user = users[0];

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  const [
    sessions,
    cardStats,
    studyDatesRows,
    quests,
    moduleBreakdown,
    dowActivity,
    dailyAnswers30,
    xpCurve,
    difficultyDist,
  ] = await Promise.all([

    // Últimas 20 sesiones
    db`SELECT id, date::text, ts, module_id, module_name, mode,
              correct, wrong, total, xp, max_streak, duration_sec
       FROM user_sessions WHERE user_id = ${userId}
       ORDER BY ts DESC LIMIT 20`,

    // Stats SM-2 globales
    db`SELECT
         COUNT(*)::int                                                     AS total_seen,
         COUNT(*) FILTER (WHERE interval_days >= 21)::int                  AS mastered,
         COUNT(*) FILTER (WHERE interval_days >= 7 AND interval_days < 21)::int AS review,
         COUNT(*) FILTER (WHERE interval_days > 0 AND interval_days < 7)::int  AS learning,
         COALESCE(SUM(total_reviews), 0)::int                               AS total_reviews,
         COALESCE(SUM(total_wrong), 0)::int                                 AS total_wrong,
         ROUND(AVG(ease_factor)::numeric, 2)::float                        AS avg_ease_factor,
         ROUND(AVG(interval_days)::numeric, 1)::float                      AS avg_interval
       FROM card_states WHERE user_id = ${userId}`,

    // Días de estudio para racha y heatmap
    db`SELECT study_date::text FROM study_dates
       WHERE user_id = ${userId} ORDER BY study_date DESC`,

    // Quests hoy
    db`SELECT quest_id, progress, completed, reward_claimed
       FROM daily_quests WHERE user_id = ${userId} AND quest_date = ${todayStr}`,

    // Desglose por módulo
    db`SELECT
         module_id, module_name,
         COUNT(*)::int                                                    AS sessions,
         COALESCE(SUM(total), 0)::int                                     AS answers,
         COALESCE(SUM(correct), 0)::int                                   AS correct_total,
         COALESCE(SUM(duration_sec), 0)::int                              AS total_time,
         ROUND(AVG(correct::float / NULLIF(total,0) * 100))::int          AS avg_accuracy,
         MAX(date)::text                                                   AS last_date
       FROM user_sessions WHERE user_id = ${userId}
       GROUP BY module_id, module_name ORDER BY sessions DESC`,

    // Actividad por día de la semana (0=dom … 6=sáb)
    db`SELECT
         EXTRACT(DOW FROM date)::int AS dow,
         COUNT(*)::int               AS sessions,
         COALESCE(SUM(total), 0)::int AS answers
       FROM user_sessions WHERE user_id = ${userId}
       GROUP BY dow ORDER BY dow`,

    // Respuestas diarias últimos 30 días (para heatmap)
    db`SELECT answer_date::text AS date, count::int
       FROM daily_answers
       WHERE user_id = ${userId} AND answer_date >= CURRENT_DATE - 29
       ORDER BY answer_date`,

    // Curva de XP: últimas 30 sesiones con XP acumulado
    db`SELECT date::text, xp, correct, wrong, total,
              SUM(xp) OVER (ORDER BY ts ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)::int AS cumulative_xp
       FROM user_sessions WHERE user_id = ${userId}
       ORDER BY ts DESC LIMIT 30`,

    // Distribución de dificultad por ease_factor
    db`SELECT
         COUNT(*) FILTER (WHERE ease_factor < 1.6)::int  AS muy_dificil,
         COUNT(*) FILTER (WHERE ease_factor >= 1.6 AND ease_factor < 2.0)::int AS dificil,
         COUNT(*) FILTER (WHERE ease_factor >= 2.0 AND ease_factor < 2.6)::int AS normal,
         COUNT(*) FILTER (WHERE ease_factor >= 2.6)::int AS facil
       FROM card_states WHERE user_id = ${userId}`,
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const studyDates = studyDatesRows.map((r: any) => r.study_date as string);

  // Calcular racha desde fechas de estudio
  const dateSet = new Set(studyDates);
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 366; i++) {
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (dateSet.has(key)) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }

  // Días inactivos desde última sesión
  const lastStudy = studyDates[0] ?? null;
  let daysSinceActive = null;
  if (lastStudy) {
    const ms = Date.now() - new Date(lastStudy).getTime();
    daysSinceActive = Math.floor(ms / 86_400_000);
  }

  return NextResponse.json({
    user,
    sessions,
    cardStats:      cardStats[0] ?? {},
    difficultyDist: difficultyDist[0] ?? {},
    studyDates,
    streak,
    daysSinceActive,
    quests,
    moduleBreakdown,
    dowActivity,
    dailyAnswers30,
    xpCurve: xpCurve.reverse(), // oldest first for chart
  });
}

// PATCH /api/admin/users/[id] — cambiar contraseña o rol
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  const userId = parseInt(id, 10);
  if (isNaN(userId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  const body = await req.json() as { password?: string; role?: string };

  if (body.password) {
    const hash = await bcrypt.hash(body.password, 12);
    await db`UPDATE users SET password_hash = ${hash} WHERE id = ${userId}`;
  }
  if (body.role) {
    await db`UPDATE users SET role = ${body.role} WHERE id = ${userId}`;
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/users/[id] — eliminar usuario
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  const userId = parseInt(id, 10);
  if (isNaN(userId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  if (userId === session.userId) {
    return NextResponse.json({ error: 'No puedes eliminarte a ti mismo' }, { status: 400 });
  }

  await db`DELETE FROM users WHERE id = ${userId}`;
  return NextResponse.json({ ok: true });
}
