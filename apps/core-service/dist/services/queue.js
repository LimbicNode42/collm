"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageQueue = exports.SQSQueueService = exports.InMemoryQueue = void 0;
const client_sqs_1 = require("@aws-sdk/client-sqs");
class InMemoryQueue {
    constructor() {
        this.queue = [];
    }
    async enqueue(message) {
        this.queue.push(message);
        console.log(`[InMemoryQueue] Enqueued message ${message.messageId} for node ${message.nodeId}`);
    }
    async dequeue() {
        const message = this.queue.shift();
        if (message) {
            console.log(`[InMemoryQueue] Dequeued message ${message.messageId}`);
        }
        return message || null;
    }
}
exports.InMemoryQueue = InMemoryQueue;
class SQSQueueService {
    constructor(queueUrl, region = 'us-east-1') {
        this.client = new client_sqs_1.SQSClient({ region });
        this.queueUrl = queueUrl;
    }
    async enqueue(message) {
        const command = new client_sqs_1.SendMessageCommand({
            QueueUrl: this.queueUrl,
            MessageBody: JSON.stringify(message),
            MessageGroupId: message.nodeId,
            MessageDeduplicationId: message.messageId,
        });
        try {
            await this.client.send(command);
            console.log(`[SQSQueueService] Enqueued message ${message.messageId} to ${this.queueUrl}`);
        }
        catch (error) {
            console.error('[SQSQueueService] Error enqueuing message:', error);
            throw error;
        }
    }
    async dequeue() {
        const command = new client_sqs_1.ReceiveMessageCommand({
            QueueUrl: this.queueUrl,
            MaxNumberOfMessages: 1,
            WaitTimeSeconds: 10,
        });
        try {
            const response = await this.client.send(command);
            if (response.Messages && response.Messages.length > 0) {
                const sqsMessage = response.Messages[0];
                const body = JSON.parse(sqsMessage.Body || '{}');
                await this.client.send(new client_sqs_1.DeleteMessageCommand({
                    QueueUrl: this.queueUrl,
                    ReceiptHandle: sqsMessage.ReceiptHandle,
                }));
                console.log(`[SQSQueueService] Dequeued message ${body.messageId}`);
                return body;
            }
            return null;
        }
        catch (error) {
            console.error('[SQSQueueService] Error dequeuing message:', error);
            return null;
        }
    }
}
exports.SQSQueueService = SQSQueueService;
const queueUrl = process.env.SQS_QUEUE_URL;
exports.messageQueue = queueUrl
    ? new SQSQueueService(queueUrl, process.env.AWS_REGION)
    : new InMemoryQueue();
//# sourceMappingURL=queue.js.map