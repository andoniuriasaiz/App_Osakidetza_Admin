import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rows = await db`
      SELECT track_id, start_date, exam_date, program_data
      FROM study_programs
      WHERE user_id = ${session.userId}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ program: null });
    }

    const row = rows[0];
    const program = {
      startDate: row.start_date instanceof Date ? row.start_date.toISOString().split('T')[0] : row.start_date,
      examDate: row.exam_date instanceof Date ? row.exam_date.toISOString().split('T')[0] : row.exam_date,
      trackId: row.track_id,
      days: row.program_data // Since program_data is JSONB, it is returned as an object
    };

    return NextResponse.json({ program });
  } catch (err: any) {
    console.error('Study Program GET Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    if (action === 'delete') {
      await db`DELETE FROM study_programs WHERE user_id = ${session.userId}`;
      return NextResponse.json({ ok: true });
    }

    const { program } = body;
    if (!program) return NextResponse.json({ error: 'Missing program data' }, { status: 400 });

    const updatedTs = Date.now();

    await db`
      INSERT INTO study_programs (user_id, track_id, start_date, exam_date, program_data, updated_ts)
      VALUES (
        ${session.userId}, 
        ${program.trackId}, 
        ${program.startDate}, 
        ${program.examDate}, 
        ${program.days}, 
        ${updatedTs}
      )
      ON CONFLICT (user_id) DO UPDATE SET
        track_id = EXCLUDED.track_id,
        start_date = EXCLUDED.start_date,
        exam_date = EXCLUDED.exam_date,
        program_data = EXCLUDED.program_data,
        updated_ts = EXCLUDED.updated_ts
    `;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Study Program POST Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
