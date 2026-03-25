import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

// POST /api/admin/migrate
// Header: Authorization: Bearer <ADMIN_SECRET>
// Runs all CREATE TABLE IF NOT EXISTS for v3.0 tables
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  if (token !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    // 1. Crear el schema si no existe
    await db`CREATE SCHEMA IF NOT EXISTS osakidetza`;
    // 2. Cambiar el search_path para esta sesión de migración
    await db`SET search_path TO osakidetza`;

    await db`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id            TEXT    PRIMARY KEY,
        user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date          DATE    NOT NULL,
        ts            BIGINT  NOT NULL,
        module_id     TEXT    NOT NULL,
        module_name   TEXT    NOT NULL,
        mode          TEXT    NOT NULL,
        correct       INTEGER NOT NULL DEFAULT 0,
        wrong         INTEGER NOT NULL DEFAULT 0,
        total         INTEGER NOT NULL DEFAULT 0,
        xp            INTEGER NOT NULL DEFAULT 0,
        max_streak    INTEGER NOT NULL DEFAULT 0,
        duration_sec  INTEGER NOT NULL DEFAULT 0
      )
    `;

    await db`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_ts
      ON user_sessions(user_id, ts DESC)
    `;

    await db`
      CREATE TABLE IF NOT EXISTS daily_quests (
        user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        quest_date     DATE    NOT NULL,
        quest_id       TEXT    NOT NULL,
        progress       INTEGER NOT NULL DEFAULT 0,
        completed      BOOLEAN NOT NULL DEFAULT FALSE,
        reward_claimed BOOLEAN NOT NULL DEFAULT FALSE,
        PRIMARY KEY (user_id, quest_date, quest_id)
      )
    `;

    await db`
      CREATE TABLE IF NOT EXISTS daily_answers (
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        answer_date DATE    NOT NULL,
        count       INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, answer_date)
      )
    `;

    await db`
      CREATE TABLE IF NOT EXISTS user_shields (
        user_id           INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        count             INTEGER NOT NULL DEFAULT 0,
        last_granted_week TEXT    NOT NULL DEFAULT ''
      )
    `;

    return NextResponse.json({ ok: true, message: 'Migración v3.0 completada' });
  } catch (err) {
    console.error('[migrate]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
