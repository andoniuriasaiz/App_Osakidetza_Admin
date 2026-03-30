import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

// POST /api/admin/migrate
// Header: Authorization: Bearer <ADMIN_SECRET>
// Crea todas las tablas necesarias (idempotente — IF NOT EXISTS)
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  if (token !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    // 1. Tabla principal de usuarios (debe ir primero — el resto la referencia)
    await db`
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL      PRIMARY KEY,
        username      TEXT        NOT NULL UNIQUE,
        password_hash TEXT        NOT NULL,
        role          TEXT        NOT NULL DEFAULT 'user',
        xp            INTEGER     NOT NULL DEFAULT 0,
        daily_goal    INTEGER     NOT NULL DEFAULT 20,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    // 2. Historial de sesiones de estudio
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

    // 3. Días de estudio (heatmap y racha)
    await db`
      CREATE TABLE IF NOT EXISTS study_dates (
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        study_date DATE    NOT NULL,
        PRIMARY KEY (user_id, study_date)
      )
    `;

    // 4. Estado de tarjetas de repetición espaciada (SM-2)
    await db`
      CREATE TABLE IF NOT EXISTS card_states (
        user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        card_id        TEXT    NOT NULL,
        interval_days  REAL    NOT NULL DEFAULT 1,
        ease_factor    REAL    NOT NULL DEFAULT 2.5,
        repetitions    INTEGER NOT NULL DEFAULT 0,
        next_review    DATE    NOT NULL DEFAULT CURRENT_DATE,
        last_review    DATE,
        total_reviews  INTEGER NOT NULL DEFAULT 0,
        total_wrong    INTEGER NOT NULL DEFAULT 0,
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, card_id)
      )
    `;

    // 5. Progreso de misiones diarias
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

    // 6. Contador de respuestas diarias (objetivo diario)
    await db`
      CREATE TABLE IF NOT EXISTS daily_answers (
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        answer_date DATE    NOT NULL,
        count       INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, answer_date)
      )
    `;

    // 7. Escudos de racha
    await db`
      CREATE TABLE IF NOT EXISTS user_shields (
        user_id           INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        count             INTEGER NOT NULL DEFAULT 0,
        last_granted_week TEXT    NOT NULL DEFAULT ''
      )
    `;

    // 8. OPEs que prepara cada usuario (aux, admin, tec)
    await db`
      CREATE TABLE IF NOT EXISTS user_tracks (
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        track_id   TEXT    NOT NULL CHECK (track_id IN ('aux', 'admin', 'tec')),
        PRIMARY KEY (user_id, track_id)
      )
    `;

    // 9. Programas de estudio generados
    await db`
      CREATE TABLE IF NOT EXISTS study_programs (
        user_id         INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        track_id        TEXT    NOT NULL,
        start_date      DATE    NOT NULL,
        exam_date       DATE    NOT NULL,
        program_data    JSONB   NOT NULL,
        updated_ts      BIGINT  NOT NULL
      )
    `;

    return NextResponse.json({ ok: true, message: 'Migración completada: 9 tablas listas' });
  } catch (err) {
    console.error('[migrate]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
