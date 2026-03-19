import { NextRequest } from 'next/server';

const CORE_SERVICE_URL = process.env.CORE_SERVICE_URL || 'http://localhost:3003';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  let upstream: Response;
  try {
    upstream = await fetch(`${CORE_SERVICE_URL}/nodes/${id}/evolve/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Could not reach core service' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => 'Unknown error');
    return new Response(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Pipe the SSE stream straight through to the browser
  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
