import postgres from 'postgres';

// Singleton para no crear conexiones de más en desarrollo
const globalForDb = globalThis as unknown as { db: ReturnType<typeof postgres> | undefined };

export const db = globalForDb.db ?? postgres(process.env.DATABASE_URL!, {
  ssl: 'require',
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

if (process.env.NODE_ENV !== 'production') {
  globalForDb.db = db;
}

export default db;
