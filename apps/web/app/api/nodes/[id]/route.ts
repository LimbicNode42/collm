import { NextRequest, NextResponse } from 'next/server';

const CORE_SERVICE_URL = process.env.CORE_SERVICE_URL || 'http://localhost:3003';

/** Proxy any method for /api/nodes/:id → core-service /nodes/:id */
async function proxyNodeRequest(
  request: NextRequest,
  method: string,
  nodeId: string
) {
  const url = new URL(request.url);
  const targetUrl = `${CORE_SERVICE_URL}/nodes/${nodeId}${url.search}`;
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const body = hasBody ? await request.blob() : null;

  console.log(`[API] ${method} /nodes/${nodeId}`);
  try {
    const response = await fetch(targetUrl, { method, headers: request.headers, body });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(data ?? { error: `Core service error: ${response.status}` }, { status: response.status });
    }
    // GET returns { success: true, node: {...} } — unwrap for convenience
    return NextResponse.json(method === 'GET' && data?.success ? data.node : data, { status: response.status });
  } catch (error) {
    console.error(`[API] Failed to proxy ${method} /nodes/${nodeId}:`, error);
    return NextResponse.json({ error: 'Failed to reach core service' }, { status: 502 });
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyNodeRequest(request, 'GET', id);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyNodeRequest(request, 'DELETE', id);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyNodeRequest(request, 'PATCH', id);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyNodeRequest(request, 'PUT', id);
}
