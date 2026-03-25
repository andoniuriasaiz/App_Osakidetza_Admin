// Cliente de auth — llama a las API routes, guarda username en localStorage como caché
const SESSION_KEY = 'osakidetza_session';

// Devuelve el role si ok, null si credenciales incorrectas
export async function login(username: string, password: string): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const role = data.role ?? 'user';
    // Guardamos username y role en localStorage como caché de UI (no es la fuente de verdad)
    localStorage.setItem(SESSION_KEY, JSON.stringify({ username: data.username, role, loginTime: Date.now() }));
    return role;
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch { /* ignorar */ }
  localStorage.removeItem(SESSION_KEY);
}

export function getSession(): { username: string; loginTime: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return getSession() !== null;
}

// Verifica contra el servidor (para rutas protegidas)
export async function verifySession(): Promise<{ id: number; username: string } | null> {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) return null;
    const data = await res.json();
    return data.user;
  } catch {
    return null;
  }
}
