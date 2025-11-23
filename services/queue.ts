import { QueueMessage } from '../types';

export interface IMessageQueue {
  enqueue(message: QueueMessage): Promise<void>;
  dequeue(): Promise<QueueMessage | null>;
}

/**
 * A simple in-memory queue implementation for development and testing.
 * In production, this would be replaced by an AWS SQS implementation.
 */
export class InMemoryQueue implements IMessageQueue {
  private queue: QueueMessage[] = [];

  async enqueue(message: QueueMessage): Promise<void> {
    this.queue.push(message);
    console.log(`[InMemoryQueue] Enqueued message ${message.messageId} for node ${message.nodeId}`);
  }

  async dequeue(): Promise<QueueMessage | null> {
    const message = this.queue.shift();
    if (message) {
      console.log(`[InMemoryQueue] Dequeued message ${message.messageId}`);
    }
    return message || null;
  }
}

// Export a singleton instance for the application to use
export const messageQueue = new InMemoryQueue();
