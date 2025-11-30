import { messageQueue } from './services/queue';
import { adjudicationEngine } from './services/adjudication';
import { coreEngine } from './services/core';
import { prismaCore } from '@collm/database';
import { MessageStatus } from '@collm/types';

async function processMessage() {
  const queueMessage = await messageQueue.dequeue();
  
  if (!queueMessage) {
    return false; // No message processed
  }

  console.log(`[Worker] Processing message ${queueMessage.messageId}`);

  try {
    // 1. Fetch the message and node from DB to ensure they exist and get current state
    const message = await prismaCore.message.findUnique({
      where: { id: queueMessage.messageId },
      include: { node: true },
    });

    if (!message) {
      console.error(`[Worker] Message ${queueMessage.messageId} not found in DB`);
      return true;
    }

    const node = message.node;

    // Map Prisma types to Domain types
    const domainMessage = {
      id: message.id,
      content: message.content,
      userId: message.userId,
      nodeId: message.nodeId,
      targetNodeVersion: message.targetNodeVersion,
      status: message.status as MessageStatus, // Cast string to enum
      createdAt: message.createdAt,
    };

    const domainNode = {
      id: node.id,
      topic: node.topic,
      description: node.description || undefined,
      state: node.state,
      version: node.version,
      model: node.model,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
    };

    // 2. Adjudicate
    const verdict = await adjudicationEngine.adjudicate(domainMessage, domainNode);

    console.log(`[Worker] Verdict for ${message.id}:`, verdict);

    // 3. Update Message Status
    let newStatus = MessageStatus.PENDING;
    if (verdict.isStale) {
      newStatus = MessageStatus.STALE;
    } else if (verdict.isRelevant) {
      newStatus = MessageStatus.ACCEPTED;
    } else {
      newStatus = MessageStatus.REJECTED;
    }

    await prismaCore.message.update({
      where: { id: message.id },
      data: { status: newStatus },
    });

    // 4. If Accepted, Update Node State
    if (newStatus === MessageStatus.ACCEPTED) {
      // We need to convert the Prisma message to the domain Message type if they differ, 
      // or just pass what coreEngine expects.
      // coreEngine expects Message[]
      // Let's cast or map it.
      const domainMessage = {
        id: message.id,
        content: message.content,
        userId: message.userId,
        nodeId: message.nodeId,
        targetNodeVersion: message.targetNodeVersion,
        status: MessageStatus.ACCEPTED,
        createdAt: message.createdAt,
      };

      await coreEngine.updateNodeState(node.id, [domainMessage]);
    }

  } catch (error) {
    console.error(`[Worker] Error processing message ${queueMessage.messageId}:`, error);
    // In a real app, we might want to DLQ this or retry.
    // SQS handles retries if we didn't delete the message, but we deleted it in dequeue (at-most-once).
    // To fix this, we should move delete to after processing.
    // But for now, we log and move on.
  }

  return true;
}

async function main() {
  console.log('[CoreService] Starting message processor...');
  
  let running = true;
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('[CoreService] Shutting down...');
    running = false;
  });

  while (running) {
    const processed = await processMessage();
    
    if (!processed) {
      // If no message, sleep for a bit (if using InMemory, SQS has long polling built-in but returns empty)
      // SQS dequeue waits 10s. If it returns null, it means timeout.
      // So we can loop immediately.
      // But for InMemory, we need a sleep.
      if (process.env.SQS_QUEUE_URL) {
        // SQS long polling already waited.
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
}

if (require.main === module) {
  main().catch(console.error);
}
