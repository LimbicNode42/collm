/**
 * HTTP Route Tests
 *
 * Uses fastify.inject() to send HTTP requests against the app without
 * binding to a real port. prismaCore and messageQueue are mocked at module
 * level so no database or SQS connection is needed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { mockDbMessage, mockQueueMessage, validSendRequest, missingSendRequests } from '../fixtures/test-data';

// ─── Module mocks (hoisted) ───────────────────────────────────────────────────

const mockFindUnique = vi.fn();
const mockCreate = vi.fn();
const mockEnqueue = vi.fn();
const mockDequeue = vi.fn();

vi.mock('@collm/database', () => ({
  prismaCore: {
    message: {
      findUnique: mockFindUnique,
      create: mockCreate,
    },
  },
}));

vi.mock('../../src/services/queue', () => ({
  messageQueue: {
    enqueue: mockEnqueue,
    dequeue: mockDequeue,
  },
}));

// ─── Test setup ───────────────────────────────────────────────────────────────

let app: FastifyInstance;

beforeEach(async () => {
  vi.clearAllMocks();
  const { buildApp } = await import('../../src/app');
  app = await buildApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
  vi.resetModules(); // Reset so buildApp always picks up fresh mocks
});

// ─── GET /health ──────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('should return 200 with status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});

// ─── GET /queue/pop ───────────────────────────────────────────────────────────

describe('GET /queue/pop', () => {
  it('should return 200 with message when queue has an item', async () => {
    mockDequeue.mockResolvedValueOnce(mockQueueMessage);
    const res = await app.inject({ method: 'GET', url: '/queue/pop' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ success: true, message: { messageId: 'msg-001' } });
  });

  it('should return 404 when queue is empty', async () => {
    mockDequeue.mockResolvedValueOnce(null);
    const res = await app.inject({ method: 'GET', url: '/queue/pop' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ success: false, error: 'Queue is empty' });
  });

  it('should return 500 when dequeue throws', async () => {
    mockDequeue.mockRejectedValueOnce(new Error('SQS down'));
    const res = await app.inject({ method: 'GET', url: '/queue/pop' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: 'Internal Server Error' });
  });
});

// ─── GET /message/:id ─────────────────────────────────────────────────────────

describe('GET /message/:id', () => {
  it('should return 200 with message when found in DB', async () => {
    mockFindUnique.mockResolvedValueOnce(mockDbMessage);
    const res = await app.inject({ method: 'GET', url: '/message/msg-001' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ success: true, message: { id: 'msg-001' } });
  });

  it('should return 404 when message is not found', async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    const res = await app.inject({ method: 'GET', url: '/message/msg-999' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: 'Message not found' });
  });

  it('should pass the id param to prisma findUnique', async () => {
    mockFindUnique.mockResolvedValueOnce(mockDbMessage);
    await app.inject({ method: 'GET', url: '/message/msg-001' });
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: 'msg-001' } });
  });

  it('should return 500 when DB throws', async () => {
    mockFindUnique.mockRejectedValueOnce(new Error('DB connection lost'));
    const res = await app.inject({ method: 'GET', url: '/message/msg-001' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: 'Internal Server Error' });
  });
});

// ─── POST /message ────────────────────────────────────────────────────────────

describe('POST /message', () => {
  it('should return 202 and enqueue when all fields are present', async () => {
    mockCreate.mockResolvedValueOnce({ ...mockDbMessage, id: 'new-msg-id' });
    mockEnqueue.mockResolvedValueOnce(undefined);

    const res = await app.inject({
      method: 'POST',
      url: '/message',
      headers: { 'content-type': 'application/json' },
      payload: validSendRequest,
    });

    expect(res.statusCode).toBe(202);
    expect(res.json()).toMatchObject({
      success: true,
      data: { messageId: 'new-msg-id' },
    });
  });

  it('should call prisma.message.create with PENDING status', async () => {
    mockCreate.mockResolvedValueOnce({ ...mockDbMessage, id: 'new-msg-id' });
    mockEnqueue.mockResolvedValueOnce(undefined);

    await app.inject({
      method: 'POST',
      url: '/message',
      headers: { 'content-type': 'application/json' },
      payload: validSendRequest,
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING' }) })
    );
  });

  it('should call messageQueue.enqueue after saving to DB', async () => {
    mockCreate.mockResolvedValueOnce({ ...mockDbMessage, id: 'new-msg-id' });
    mockEnqueue.mockResolvedValueOnce(undefined);

    await app.inject({
      method: 'POST',
      url: '/message',
      headers: { 'content-type': 'application/json' },
      payload: validSendRequest,
    });

    expect(mockEnqueue).toHaveBeenCalledOnce();
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: 'new-msg-id',
        nodeId: validSendRequest.nodeId,
        content: validSendRequest.content,
        userId: validSendRequest.userId,
      })
    );
  });

  it.each(missingSendRequests)(
    'should return 400 when required field is missing (%o)',
    async (body) => {
      const res = await app.inject({
        method: 'POST',
        url: '/message',
        headers: { 'content-type': 'application/json' },
        payload: body,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: 'Missing required fields' });
    }
  );

  it('should return 500 when DB create throws', async () => {
    mockCreate.mockRejectedValueOnce(new Error('DB error'));

    const res = await app.inject({
      method: 'POST',
      url: '/message',
      headers: { 'content-type': 'application/json' },
      payload: validSendRequest,
    });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: 'Internal Server Error' });
  });

  it('should return 500 when enqueue throws (after message saved)', async () => {
    mockCreate.mockResolvedValueOnce({ ...mockDbMessage, id: 'new-msg-id' });
    mockEnqueue.mockRejectedValueOnce(new Error('Queue unavailable'));

    const res = await app.inject({
      method: 'POST',
      url: '/message',
      headers: { 'content-type': 'application/json' },
      payload: validSendRequest,
    });

    expect(res.statusCode).toBe(500);
  });
});
