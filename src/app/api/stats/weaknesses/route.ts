import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rows = await db`
      SELECT card_id, total_wrong, total_reviews, 
             (total_wrong::real / NULLIF(total_reviews, 0)) as fail_rate
      FROM card_states
      WHERE user_id = ${session.userId} 
        AND total_wrong > 0
      ORDER BY fail_rate DESC, total_wrong DESC
      LIMIT 100
    `;

    return NextResponse.json({ weaknesses: rows });
  } catch (error) {
    console.error('Failed to grab weaknesses', error);
    return NextResponse.json({ error: 'Failed to grab weaknesses' }, { status: 500 });
  }
}
