import postgres from 'postgres';

// Singleton para no crear conexiones de más en desarrollo
const globalForDb = globalThis as unknown as { db: ReturnType<typeof postgres> | undefined };

export const db = globalForDb.db ?? postgres(process.env.DATABASE_URL!, {
  ssl: 'require',
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  onnotice: () => {}, // silenciar avisos
  // Al conectar, nos aseguramos de estar en el schema osakidetza
  onparameter: (name, value) => {
    if (name === 'application_name') console.log('DB connected');
  },
  // Alternativa: usar un init SQL
  prepare: false, // para neon pooler
});

// Forzamos el schema al inicio de cada conexión o mediante el pooler
// Pero lo más fiable en Next.js con el pooler de Neon es añadirlo a la URL 
// o ejecutar un SET search_path al inicio si no se puede en la URL.

if (process.env.NODE_ENV !== 'production') {
  globalForDb.db = db;
}

export default db;
