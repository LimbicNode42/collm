import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { QueueMessage } from '@collm/types';

export interface IMessageQueue {
  enqueue(message: QueueMessage): Promise<void>;
  dequeue(): Promise<QueueMessage | null>;
}

/**
 * A simple in-memory queue implementation for development and testing.
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

export class SQSQueueService implements IMessageQueue {
  private client: SQSClient;
  private queueUrl: string;

  constructor(queueUrl: string, region: string = 'us-east-1') {
    this.client = new SQSClient({ region });
    this.queueUrl = queueUrl;
  }

  async enqueue(message: QueueMessage): Promise<void> {
    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(message),
      MessageGroupId: message.nodeId, // Ensure ordering per node
      MessageDeduplicationId: message.messageId, // Ensure exactly-once processing
    });

    try {
      await this.client.send(command);
      console.log(`[SQSQueueService] Enqueued message ${message.messageId} to ${this.queueUrl}`);
    } catch (error) {
      console.error('[SQSQueueService] Error enqueuing message:', error);
      throw error;
    }
  }

  async dequeue(): Promise<QueueMessage | null> {
    const command = new ReceiveMessageCommand({
      QueueUrl: this.queueUrl,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 10, // Long polling
    });

    try {
      const response = await this.client.send(command);
      
      if (response.Messages && response.Messages.length > 0) {
        const sqsMessage = response.Messages[0];
        const body = JSON.parse(sqsMessage.Body || '{}') as QueueMessage;
        
        // Delete immediately to simulate "pop" behavior (at-most-once)
        // In a real app, we'd wait until processing is done to delete.
        await this.client.send(new DeleteMessageCommand({
          QueueUrl: this.queueUrl,
          ReceiptHandle: sqsMessage.ReceiptHandle,
        }));

        console.log(`[SQSQueueService] Dequeued message ${body.messageId}`);
        return body;
      }
      
      return null;
    } catch (error) {
      console.error('[SQSQueueService] Error dequeuing message:', error);
      return null;
    }
  }
}

// Export SQS service if URL is present, otherwise InMemory
const queueUrl = process.env.SQS_QUEUE_URL;
export const messageQueue = queueUrl 
  ? new SQSQueueService(queueUrl, process.env.AWS_REGION) 
  : new InMemoryQueue();

