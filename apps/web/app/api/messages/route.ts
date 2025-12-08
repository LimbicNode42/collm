import { NextRequest, NextResponse } from 'next/server';

const MESSAGE_SERVICE_URL = process.env.MESSAGE_SERVICE_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, nodeId, userId } = body;

    if (!content || !nodeId || !userId) {
      return NextResponse.json(
        { error: 'Content, nodeId, and userId are required' },
        { status: 400 }
      );
    }

    console.log('[API] Sending message:', { content, nodeId, userId });

    const response = await fetch(`${MESSAGE_SERVICE_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        nodeId,
        userId,
        targetNodeVersion: 1 // Default for now
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] Message service error:', response.status, errorText);
      return NextResponse.json(
        { error: `Message service error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[API] Message sent successfully:', data);

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] Failed to send message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}