/**
 * /api/nodes and /api/nodes/[id] Route Handler Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from '../../app/api/nodes/route';
import { GET as GET_BY_ID } from '../../app/api/nodes/[id]/route';
import { mockNode, mockNodeList } from '../fixtures/test-data';

const mockFetch = vi.hoisted(() => vi.fn());
vi.stubGlobal('fetch', mockFetch);

// ─── POST /api/nodes ──────────────────────────────────────────────────────────

describe('POST /api/nodes', () => {
  beforeEach(() => mockFetch.mockReset());

  it('should return 200 with created node when topic is provided', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockNode), { status: 200 })
    );

    const req = new NextRequest('http://localhost/api/nodes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic: 'Test Topic', description: 'Desc', model: 'claude' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('should use default description when none provided', async () => {
    mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

    const req = new NextRequest('http://localhost/api/nodes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic: 'My Topic' }),
    });
    await POST(req);

    const sentBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(sentBody.description).toContain('My Topic');
  });

  it('should return 400 when topic is missing', async () => {
    const req = new NextRequest('http://localhost/api/nodes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ description: 'No topic' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should proxy the downstream error status code', async () => {
    mockFetch.mockResolvedValueOnce(new Response('error', { status: 422 }));

    const req = new NextRequest('http://localhost/api/nodes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic: 'Test' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it('should return 500 when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const req = new NextRequest('http://localhost/api/nodes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic: 'Test' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});

// ─── GET /api/nodes ───────────────────────────────────────────────────────────

describe('GET /api/nodes', () => {
  beforeEach(() => mockFetch.mockReset());

  it('should return 200 with node list', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockNodeList), { status: 200 })
    );

    const req = new NextRequest('http://localhost/api/nodes');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('should proxy downstream errors', async () => {
    mockFetch.mockResolvedValueOnce(new Response('error', { status: 500 }));
    const req = new NextRequest('http://localhost/api/nodes');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });

  it('should return 500 when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Timeout'));
    const req = new NextRequest('http://localhost/api/nodes');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});

// ─── GET /api/nodes/[id] ──────────────────────────────────────────────────────

describe('GET /api/nodes/[id]', () => {
  beforeEach(() => mockFetch.mockReset());

  const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

  it('should return the node when found (success: true wrapper)', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, node: mockNode }), { status: 200 })
    );

    const req = new NextRequest('http://localhost/api/nodes/node-001');
    const res = await GET_BY_ID(req, makeParams('node-001'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('node-001');
  });

  it('should return raw data when no success wrapper', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockNode), { status: 200 })
    );

    const req = new NextRequest('http://localhost/api/nodes/node-001');
    const res = await GET_BY_ID(req, makeParams('node-001'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('node-001');
  });

  it('should proxy 404 from downstream', async () => {
    mockFetch.mockResolvedValueOnce(new Response('not found', { status: 404 }));

    const req = new NextRequest('http://localhost/api/nodes/unknown');
    const res = await GET_BY_ID(req, makeParams('unknown'));
    expect(res.status).toBe(404);
  });

  it('should return 500 when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection reset'));

    const req = new NextRequest('http://localhost/api/nodes/node-001');
    const res = await GET_BY_ID(req, makeParams('node-001'));
    expect(res.status).toBe(500);
  });
});
