import { NextRequest, NextResponse } from 'next/server';

const CORE_SERVICE_URL = process.env.CORE_SERVICE_URL || 'http://localhost:3003';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nodeId, message, model, userId, userName } = body;

    if (!nodeId || !message) {
      return NextResponse.json(
        { error: 'nodeId and message are required' },
        { status: 400 }
      );
    }

    const response = await fetch(`${CORE_SERVICE_URL}/llm/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId, message, model, userId, userName }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] Failed to chat:', error);
    return NextResponse.json({ error: 'Failed to send chat message' }, { status: 500 });
  }
}
