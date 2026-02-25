import { NextRequest, NextResponse } from 'next/server';

const CORE_SERVICE_URL = process.env.CORE_SERVICE_URL || 'http://localhost:3003';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: nodeId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '100';
    const before = searchParams.get('before') || '';

    const url = new URL(`${CORE_SERVICE_URL}/nodes/${nodeId}/messages`);
    url.searchParams.set('limit', limit);
    if (before) url.searchParams.set('before', before);

    const response = await fetch(url.toString());

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] Core service error:', response.status, errorText);
      return NextResponse.json(
        { error: `Core service error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] Failed to get messages:', error);
    return NextResponse.json({ error: 'Failed to get messages' }, { status: 500 });
  }
}
