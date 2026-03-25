#!/usr/bin/env node
/**
 * Crea un usuario en la base de datos.
 * Uso: node scripts/create-user.mjs <username> <password>
 *
 * Necesita DATABASE_URL en .env.local
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createHash } from 'crypto';

// Leer .env.local manualmente
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
} catch { /* .env.local puede no existir en producción */ }

const [,, username, password] = process.argv;

if (!username || !password) {
  console.error('Uso: node scripts/create-user.mjs <username> <password>');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL no está definida. Comprueba .env.local');
  process.exit(1);
}

// Importar dependencias dinámicamente
const { default: postgres } = await import('postgres');
const bcrypt = await import('bcryptjs');

const db = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 });

try {
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await db`
    INSERT INTO users (username, password_hash)
    VALUES (${username}, ${passwordHash})
    RETURNING id, username, created_at
  `;
  const user = result[0];
  console.log(`✅ Usuario creado:`);
  console.log(`   ID:       ${user.id}`);
  console.log(`   Username: ${user.username}`);
  console.log(`   Creado:   ${user.created_at}`);
} catch (err) {
  if (err.code === '23505') {
    console.error(`❌ El usuario "${username}" ya existe.`);
  } else {
    console.error('❌ Error:', err.message);
  }
  process.exit(1);
} finally {
  await db.end();
}
