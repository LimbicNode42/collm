import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemoryQueue, SQSQueueService } from '../../src/services/queue';
import { mockQueueMessage, mockQueueMessage2, mockQueueMessage3 } from '../fixtures/test-data';

// ─── InMemoryQueue ────────────────────────────────────────────────────────────

describe('InMemoryQueue', () => {
  let queue: InMemoryQueue;

  beforeEach(() => {
    queue = new InMemoryQueue();
  });

  describe('enqueue', () => {
    it('should add a message to the queue', async () => {
      await queue.enqueue(mockQueueMessage);
      const result = await queue.dequeue();
      expect(result).toEqual(mockQueueMessage);
    });

    it('should accept a message without a timestamp field', async () => {
      const msg = { ...mockQueueMessage };
      delete msg.timestamp;
      await queue.enqueue(msg);
      const result = await queue.dequeue();
      expect(result).toEqual(msg);
    });
  });

  describe('dequeue', () => {
    it('should return null when queue is empty', async () => {
      const result = await queue.dequeue();
      expect(result).toBeNull();
    });

    it('should return messages in FIFO order', async () => {
      await queue.enqueue(mockQueueMessage);
      await queue.enqueue(mockQueueMessage2);
      await queue.enqueue(mockQueueMessage3);

      expect((await queue.dequeue())?.messageId).toBe('msg-001');
      expect((await queue.dequeue())?.messageId).toBe('msg-002');
      expect((await queue.dequeue())?.messageId).toBe('msg-003');
    });

    it('should remove the message once dequeued (each message consumed once)', async () => {
      await queue.enqueue(mockQueueMessage);
      await queue.dequeue(); // consume
      const second = await queue.dequeue();
      expect(second).toBeNull();
    });

    it('should handle enqueue → dequeue → enqueue correctly', async () => {
      await queue.enqueue(mockQueueMessage);
      await queue.dequeue();
      await queue.enqueue(mockQueueMessage2);
      const result = await queue.dequeue();
      expect(result?.messageId).toBe('msg-002');
    });
  });

  describe('queue length semantics', () => {
    it('should support multiple independent enqueue/dequeue cycles', async () => {
      for (let i = 0; i < 5; i++) {
        await queue.enqueue({ ...mockQueueMessage, messageId: `msg-${i}` });
      }
      for (let i = 0; i < 5; i++) {
        const msg = await queue.dequeue();
        expect(msg?.messageId).toBe(`msg-${i}`);
      }
      expect(await queue.dequeue()).toBeNull();
    });
  });
});

// ─── SQSQueueService ──────────────────────────────────────────────────────────

// vi.hoisted ensures mockSend is available when vi.mock factory runs (vi.mock is hoisted)
const mockSend = vi.hoisted(() => vi.fn());

vi.mock('@aws-sdk/client-sqs', () => ({
  // All four must be regular functions (not arrows) — they're called with `new`
  SQSClient: vi.fn().mockImplementation(function(this: Record<string, unknown>) {
    this.send = mockSend;
  }),
  SendMessageCommand: vi.fn().mockImplementation(function(this: Record<string, unknown>, input: unknown) {
    this.input = input;
  }),
  ReceiveMessageCommand: vi.fn().mockImplementation(function(this: Record<string, unknown>, input: unknown) {
    this.input = input;
  }),
  DeleteMessageCommand: vi.fn().mockImplementation(function(this: Record<string, unknown>, input: unknown) {
    this.input = input;
  }),
}));

describe('SQSQueueService', () => {
  let sqsService: SQSQueueService;

  beforeEach(() => {
    mockSend.mockReset();
    sqsService = new SQSQueueService('https://sqs.us-east-1.amazonaws.com/123/test-queue', 'us-east-1');
  });

  describe('enqueue', () => {
    it('should call SQS send once when enqueuing a message', async () => {
      mockSend.mockResolvedValueOnce({ MessageId: 'sqs-123' });
      await sqsService.enqueue(mockQueueMessage);
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it('should throw when SQS send fails', async () => {
      mockSend.mockRejectedValueOnce(new Error('SQS unavailable'));
      await expect(sqsService.enqueue(mockQueueMessage)).rejects.toThrow('SQS unavailable');
    });
  });

  describe('dequeue', () => {
    it('should return a parsed QueueMessage when SQS has a message', async () => {
      mockSend
        .mockResolvedValueOnce({
          Messages: [{ Body: JSON.stringify(mockQueueMessage), ReceiptHandle: 'rh-001' }],
        })
        .mockResolvedValueOnce({});   // delete call

      const result = await sqsService.dequeue();
      expect(result).toEqual(mockQueueMessage);
      expect(mockSend).toHaveBeenCalledTimes(2); // receive + delete
    });

    it('should return null when SQS queue is empty', async () => {
      mockSend.mockResolvedValueOnce({ Messages: [] });
      const result = await sqsService.dequeue();
      expect(result).toBeNull();
    });

    it('should return null when SQS throws (graceful error handling)', async () => {
      mockSend.mockRejectedValueOnce(new Error('Network error'));
      const result = await sqsService.dequeue();
      expect(result).toBeNull();
    });

    it('should call send twice when a message is received (receive + delete)', async () => {
      mockSend
        .mockResolvedValueOnce({
          Messages: [{ Body: JSON.stringify(mockQueueMessage), ReceiptHandle: 'rh-xyz' }],
        })
        .mockResolvedValueOnce({});

      await sqsService.dequeue();
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });
});
