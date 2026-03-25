import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/session';

// GET /api/user/bookmarks — devuelve la lista de IDs marcados como favoritos
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { userId } = session;

  const rows = await db`
    SELECT bookmarks FROM users WHERE id = ${userId}
  `;

  let ids: string[] = [];
  try {
    ids = JSON.parse(rows[0]?.bookmarks ?? '[]') as string[];
  } catch {
    ids = [];
  }

  return NextResponse.json({ bookmarks: ids });
}

// POST /api/user/bookmarks — guarda la lista completa de IDs favoritos
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { userId } = session;
  const { bookmarks } = await req.json() as { bookmarks: string[] };

  if (!Array.isArray(bookmarks)) {
    return NextResponse.json({ error: 'bookmarks debe ser un array' }, { status: 400 });
  }

  const encoded = JSON.stringify(bookmarks);

  await db`
    UPDATE users SET bookmarks = ${encoded} WHERE id = ${userId}
  `;

  return NextResponse.json({ ok: true, count: bookmarks.length });
}
