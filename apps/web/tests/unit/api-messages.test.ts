/**
 * POST /api/messages Route Handler Tests
 *
 * Imports the handler directly and calls it with a NextRequest.
 * Global fetch is mocked — no real network calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../../app/api/messages/route';
import { mockMessageResponse } from '../fixtures/test-data';

const mockFetch = vi.hoisted(() => vi.fn());
vi.stubGlobal('fetch', mockFetch);

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/messages', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should return 200 with downstream response when all fields are present', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockMessageResponse), { status: 200 })
    );

    const res = await POST(makeRequest({ content: 'Hello', nodeId: 'n1', userId: 'u1' }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('should forward the targetNodeVersion defaulting to 1', async () => {
    mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

    await POST(makeRequest({ content: 'Hello', nodeId: 'n1', userId: 'u1' }));

    const sentBody = JSON.parse(await (mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(sentBody.targetNodeVersion).toBe(1);
  });

  it('should return 400 when content is missing', async () => {
    const res = await POST(makeRequest({ nodeId: 'n1', userId: 'u1' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should return 400 when nodeId is missing', async () => {
    const res = await POST(makeRequest({ content: 'Hello', userId: 'u1' }));
    expect(res.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should return 400 when userId is missing', async () => {
    const res = await POST(makeRequest({ content: 'Hello', nodeId: 'n1' }));
    expect(res.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should proxy the downstream error status code', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('downstream error', { status: 503 })
    );

    const res = await POST(makeRequest({ content: 'Hello', nodeId: 'n1', userId: 'u1' }));
    expect(res.status).toBe(503);
  });

  it('should return 500 when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'));

    const res = await POST(makeRequest({ content: 'Hello', nodeId: 'n1', userId: 'u1' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/failed to send message/i);
  });
});
