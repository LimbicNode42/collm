import { NextRequest, NextResponse } from 'next/server';

const CORE_SERVICE_URL = process.env.CORE_SERVICE_URL || 'http://localhost:3003';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topic, description, model } = body;

    if (!topic) {
      return NextResponse.json(
        { error: 'Topic is required' },
        { status: 400 }
      );
    }

    console.log('[API] Creating node:', { topic, description, model });

    const response = await fetch(`${CORE_SERVICE_URL}/nodes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic,
        description: description || `Conversation about ${topic}`,
        model: model || 'claude-sonnet-4-5-20250929'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] Core service error:', response.status, errorText);
      return NextResponse.json(
        { error: `Core service error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[API] Node created successfully:', data);

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] Failed to create node:', error);
    return NextResponse.json(
      { error: 'Failed to create node' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('[API] Listing nodes');

    const response = await fetch(`${CORE_SERVICE_URL}/nodes`, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] Core service error:', response.status, errorText);
      return NextResponse.json(
        { error: `Core service error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[API] Nodes retrieved successfully:', data.length, 'nodes');

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] Failed to list nodes:', error);
    return NextResponse.json(
      { error: 'Failed to list nodes' },
      { status: 500 }
    );
  }
}