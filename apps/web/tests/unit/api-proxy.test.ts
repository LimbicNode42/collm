/**
 * API Proxy Utility Tests
 *
 * getServiceForPath() is a pure function — tested exhaustively.
 * proxyToService() uses global fetch — mocked with vi.stubGlobal.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getServiceForPath, proxyToService } from '../../lib/api-proxy';

// ─── getServiceForPath ────────────────────────────────────────────────────────

describe('getServiceForPath', () => {
  describe('core-service paths', () => {
    it.each(['/api/nodes', '/api/nodes/abc', '/api/health', '/api/llm', '/api/adjudication'])(
      'should route %s to core-service',
      (path) => {
        const service = getServiceForPath(path);
        expect(service?.name).toBe('core-service');
      }
    );
  });

  describe('message-service paths', () => {
    it.each(['/api/messages', '/api/message/123', '/api/queue/pop'])(
      'should route %s to message-service',
      (path) => {
        const service = getServiceForPath(path);
        expect(service?.name).toBe('message-service');
      }
    );
  });

  describe('user-service paths', () => {
    it.each(['/api/users', '/api/users/abc', '/api/auth', '/api/register', '/api/login'])(
      'should route %s to user-service',
      (path) => {
        const service = getServiceForPath(path);
        expect(service?.name).toBe('user-service');
      }
    );
  });

  describe('unknown paths', () => {
    it('should return null for unknown paths', () => {
      expect(getServiceForPath('/api/unknown')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(getServiceForPath('')).toBeNull();
    });

    it('should return null for paths without /api prefix that do not match', () => {
      expect(getServiceForPath('/other/thing')).toBeNull();
    });
  });

  describe('path stripping', () => {
    it('should strip /api prefix before matching', () => {
      // /api/nodes → strips to /nodes → matches core-service /nodes pattern
      const service = getServiceForPath('/api/nodes');
      expect(service?.name).toBe('core-service');
    });
  });
});

// ─── proxyToService ───────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('proxyToService', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should return 404 for an unknown path', async () => {
    const req = new Request('http://localhost/api/unknown', { method: 'GET' });
    const res = await proxyToService(req, '/api/unknown');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/service not found/i);
  });

  it('should forward a successful response from the downstream service', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const req = new Request('http://localhost/api/nodes', { method: 'GET' });
    const res = await proxyToService(req, '/api/nodes');

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('should strip the /api prefix when constructing the target URL', async () => {
    mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

    const req = new Request('http://localhost/api/nodes', { method: 'GET' });
    await proxyToService(req, '/api/nodes');

    const calledUrl = (mockFetch.mock.calls[0][0] as Request).url;
    expect(calledUrl).toContain('/nodes');
    expect(calledUrl).not.toContain('/api/nodes');
  });

  it('should return 502 when the downstream fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const req = new Request('http://localhost/api/nodes', { method: 'GET' });
    const res = await proxyToService(req, '/api/nodes');

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toMatch(/service unavailable/i);
  });

  it('should forward a non-GET request body to the downstream service', async () => {
    mockFetch.mockResolvedValueOnce(new Response('{}', { status: 201 }));

    const req = new Request('http://localhost/api/nodes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic: 'hello' }),
    });
    const res = await proxyToService(req, '/api/nodes');

    expect(res.status).toBe(201);
    expect(mockFetch).toHaveBeenCalledOnce();
  });
});
