-- ─────────────────────────────────────────────────────────────────────────────
--  Migración v3.0 — tablas para multidispositivo
--  Ejecutar vía: POST /api/admin/migrate  (requiere Authorization: Bearer $ADMIN_SECRET)
-- ─────────────────────────────────────────────────────────────────────────────

-- Historial de sesiones de estudio
CREATE TABLE IF NOT EXISTS user_sessions (
  id              TEXT        PRIMARY KEY,
  user_id         INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date            DATE        NOT NULL,
  ts              BIGINT      NOT NULL,
  module_id       TEXT        NOT NULL,
  module_name     TEXT        NOT NULL,
  mode            TEXT        NOT NULL,
  correct         INTEGER     NOT NULL DEFAULT 0,
  wrong           INTEGER     NOT NULL DEFAULT 0,
  total           INTEGER     NOT NULL DEFAULT 0,
  xp              INTEGER     NOT NULL DEFAULT 0,
  max_streak      INTEGER     NOT NULL DEFAULT 0,
  duration_sec    INTEGER     NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_ts ON user_sessions(user_id, ts DESC);

-- Progreso de misiones diarias (quests)
CREATE TABLE IF NOT EXISTS daily_quests (
  user_id         INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quest_date      DATE        NOT NULL,
  quest_id        TEXT        NOT NULL,
  progress        INTEGER     NOT NULL DEFAULT 0,
  completed       BOOLEAN     NOT NULL DEFAULT FALSE,
  reward_claimed  BOOLEAN     NOT NULL DEFAULT FALSE,
  PRIMARY KEY (user_id, quest_date, quest_id)
);

-- Contador de respuestas diarias (objetivo diario)
CREATE TABLE IF NOT EXISTS daily_answers (
  user_id         INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answer_date     DATE        NOT NULL,
  count           INTEGER     NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, answer_date)
);

-- Escudos de racha
CREATE TABLE IF NOT EXISTS user_shields (
  user_id             INTEGER     PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  count               INTEGER     NOT NULL DEFAULT 0,
  last_granted_week   TEXT        NOT NULL DEFAULT ''
);

-- Programas de estudio generados
CREATE TABLE IF NOT EXISTS study_programs (
  user_id         INTEGER     PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  track_id        TEXT        NOT NULL,
  start_date      DATE        NOT NULL,
  exam_date       DATE        NOT NULL,
  program_data    JSONB       NOT NULL,
  updated_ts      BIGINT      NOT NULL
);
