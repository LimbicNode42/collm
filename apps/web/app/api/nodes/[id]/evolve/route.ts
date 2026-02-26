import { NextRequest, NextResponse } from 'next/server';

const CORE_SERVICE_URL = process.env.CORE_SERVICE_URL || 'http://localhost:3003';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: nodeId } = await params;
    const body = await request.json();

    const response = await fetch(`${CORE_SERVICE_URL}/nodes/${nodeId}/evolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] Core service evolve error:', response.status, errorText);
      return NextResponse.json(
        { error: `Core service error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] Failed to evolve node:', error);
    return NextResponse.json({ error: 'Failed to evolve document' }, { status: 500 });
  }
}
