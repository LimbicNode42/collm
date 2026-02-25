import { NextRequest, NextResponse } from 'next/server';

const CORE_SERVICE_URL = process.env.CORE_SERVICE_URL || 'http://localhost:3003';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${CORE_SERVICE_URL}/nodes/find-or-create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[API] find-or-create error:', error);
    return NextResponse.json({ error: 'Failed to reach core-service' }, { status: 502 });
  }
}
