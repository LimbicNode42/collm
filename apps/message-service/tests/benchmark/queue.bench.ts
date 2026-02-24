/**
 * Queue Performance Benchmarks
 *
 * Measures raw throughput of the InMemoryQueue (our dev/test implementation).
 * Results are saved as CI artifacts for trend comparison across commits.
 *
 * Run: npm run bench:run
 */
import { bench, describe, beforeEach } from 'vitest';
import { InMemoryQueue } from '../../src/services/queue';
import { mockQueueMessage } from '../fixtures/test-data';

describe('InMemoryQueue throughput', () => {
  let queue: InMemoryQueue;

  beforeEach(() => {
    queue = new InMemoryQueue();
  });

  bench('single enqueue', async () => {
    await queue.enqueue({ ...mockQueueMessage, messageId: `msg-${Math.random()}` });
  });

  bench('single dequeue (empty → null)', async () => {
    await queue.dequeue();
  });

  bench('enqueue then dequeue (round-trip)', async () => {
    await queue.enqueue({ ...mockQueueMessage, messageId: `msg-${Math.random()}` });
    await queue.dequeue();
  });
});

describe('InMemoryQueue batch throughput', () => {
  bench('10 enqueues + 10 dequeues', async () => {
    const q = new InMemoryQueue();
    for (let i = 0; i < 10; i++) {
      await q.enqueue({ ...mockQueueMessage, messageId: `msg-${i}` });
    }
    for (let i = 0; i < 10; i++) {
      await q.dequeue();
    }
  });

  bench('100 enqueues + 100 dequeues', async () => {
    const q = new InMemoryQueue();
    for (let i = 0; i < 100; i++) {
      await q.enqueue({ ...mockQueueMessage, messageId: `msg-${i}` });
    }
    for (let i = 0; i < 100; i++) {
      await q.dequeue();
    }
  });
});
