#!/usr/bin/env node
/**
 * setup-db.mjs
 * Crea todas las tablas y los usuarios iniciales en la nueva base de datos.
 * Uso: node scripts/setup-db.mjs
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Leer .env.local
try {
  const envPath = resolve(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* ok */ }

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL no está definida. Comprueba .env.local');
  process.exit(1);
}

const { default: postgres } = await import('postgres');
const bcrypt = await import('bcryptjs');

const db = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 });

console.log('🔧 Conectando a la base de datos...\n');

try {
  // ── MIGRACIÓN ─────────────────────────────────────────────────────────────

  console.log('📦 Creando tablas...');

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
  console.log('  ✅ users');

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
  await db`CREATE INDEX IF NOT EXISTS idx_user_sessions_user_ts ON user_sessions(user_id, ts DESC)`;
  console.log('  ✅ user_sessions');

  await db`
    CREATE TABLE IF NOT EXISTS study_dates (
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      study_date DATE    NOT NULL,
      PRIMARY KEY (user_id, study_date)
    )
  `;
  console.log('  ✅ study_dates');

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
  console.log('  ✅ card_states');

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
  console.log('  ✅ daily_quests');

  await db`
    CREATE TABLE IF NOT EXISTS daily_answers (
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      answer_date DATE    NOT NULL,
      count       INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, answer_date)
    )
  `;
  console.log('  ✅ daily_answers');

  await db`
    CREATE TABLE IF NOT EXISTS user_shields (
      user_id           INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      count             INTEGER NOT NULL DEFAULT 0,
      last_granted_week TEXT    NOT NULL DEFAULT ''
    )
  `;
  console.log('  ✅ user_shields');

  await db`
    CREATE TABLE IF NOT EXISTS user_tracks (
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      track_id   TEXT    NOT NULL CHECK (track_id IN ('aux', 'admin', 'tec')),
      PRIMARY KEY (user_id, track_id)
    )
  `;
  console.log('  ✅ user_tracks');

  console.log('\n👥 Creando usuarios...');

  // ── USUARIOS ──────────────────────────────────────────────────────────────
  const users = [
    { username: 'andoni', password: 'andoni2026', role: 'admin',  tracks: ['aux', 'admin', 'tec'] },
    { username: 'ander',  password: 'ander2026',  role: 'user',   tracks: ['aux', 'admin'] },
  ];

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 12);
    let userId;
    const existing = await db`SELECT id FROM users WHERE username = ${u.username}`;
    if (existing.length > 0) {
      userId = existing[0].id;
      console.log(`  ⚠️  ${u.username} ya existe (id=${userId}) — no se sobreescribe`);
    } else {
      const [created] = await db`
        INSERT INTO users (username, password_hash, role)
        VALUES (${u.username}, ${hash}, ${u.role})
        RETURNING id, username, role
      `;
      userId = created.id;
      console.log(`  ✅ ${created.username} (id=${created.id}, rol=${created.role})`);
    }
    // Asignar OPEs al usuario
    for (const trackId of u.tracks) {
      await db`
        INSERT INTO user_tracks (user_id, track_id)
        VALUES (${userId}, ${trackId})
        ON CONFLICT DO NOTHING
      `;
    }
    console.log(`     🏷️  OPEs: ${u.tracks.join(', ')}`);
  }

  console.log('\n🎉 Setup completado. La base de datos está lista.\n');
  console.log('📝 Contraseñas iniciales:');
  console.log('   andoni → andoni2026  (admin) — OPEs: aux, admin, tec');
  console.log('   ander  → ander2026   (user)  — OPEs: aux, admin');
  console.log('\n⚠️  Cambia las contraseñas en el primer uso si es posible.\n');

} catch (err) {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
} finally {
  await db.end();
}
