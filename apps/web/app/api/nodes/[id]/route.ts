import { NextRequest, NextResponse } from 'next/server';

const CORE_SERVICE_URL = process.env.CORE_SERVICE_URL || 'http://localhost:3003';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: nodeId } = await params;
    console.log('[API] Getting node:', nodeId);

    const response = await fetch(`${CORE_SERVICE_URL}/nodes/${nodeId}`, {
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
    console.log('[API] Node retrieved successfully:', nodeId);

    // Core service returns { success: true, node: {...} }, we want just the node
    return NextResponse.json(data.success ? data.node : data);
  } catch (error) {
    console.error('[API] Failed to get node:', error);
    return NextResponse.json(
      { error: 'Failed to get node' },
      { status: 500 }
    );
  }
}