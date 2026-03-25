import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';

// POST /api/admin/create-user
// Header: Authorization: Bearer <ADMIN_SECRET>
// Body: { username, password }
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  if (token !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { username, password } = await req.json();

  if (!username || !password) {
    return NextResponse.json({ error: 'Faltan username o password' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const result = await db`
      INSERT INTO users (username, password_hash)
      VALUES (${username}, ${passwordHash})
      RETURNING id, username, created_at
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
