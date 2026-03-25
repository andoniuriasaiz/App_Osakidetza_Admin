import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { getSession } from '@/lib/session';

// POST /api/admin/users/create — crea un nuevo usuario (solo admin)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { username, password, role = 'user' } = await req.json() as {
    username?: string;
    password?: string;
    role?: string;
  };

  if (!username || !password) {
    return NextResponse.json({ error: 'Faltan username o password' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const result = await db`
      INSERT INTO users (username, password_hash, role)
      VALUES (${username}, ${passwordHash}, ${role})
      RETURNING id, username, role, created_at
    `;
    return NextResponse.json({ ok: true, user: result[0] });
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      return NextResponse.json({ error: 'El usuario ya existe' }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
