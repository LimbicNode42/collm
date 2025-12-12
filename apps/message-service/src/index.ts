import 'dotenv/config';
import Fastify from 'fastify';
import { prismaCore } from '@collm/database';
import { messageQueue } from './services/queue';
import { QueueMessage } from './types/domain';
import { MessageService } from '@collm/contracts';

const fastify = Fastify({
  logger: true
});

fastify.get('/health', async () => {
  return { status: 'ok' };
});

fastify.get('/queue/pop', async (request, reply) => {
  try {
    const message = await messageQueue.dequeue();
    if (message) {
      return reply.send({ success: true, message });
    } else {
      return reply.code(404).send({ success: false, error: 'Queue is empty' });
    }
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
});

// Node management has been moved to core-service
// This service now only handles message operations

fastify.get('/message/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  try {
    const message = await prismaCore.message.findUnique({
      where: { id }
    });
    if (!message) {
      return reply.code(404).send({ error: 'Message not found' });
    }
    return reply.send({ success: true, message });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
});

fastify.post<{
  Body: MessageService.SendMessageRequest;
  Reply: MessageService.SendMessageResponse | { error: string };
}>('/message', async (request, reply) => {
  const { userId, nodeId, content, targetNodeVersion } = request.body;

  if (!userId || !nodeId || !content || targetNodeVersion === undefined) {
    return reply.code(400).send({ error: 'Missing required fields' });
  }

  try {
    // 1. Save message to DB as PENDING
    const message = await prismaCore.message.create({
      data: {
        content,
        userId,
        nodeId,
        targetNodeVersion,
        status: 'PENDING',
      },
    });

    // 2. Enqueue for adjudication
    const queueMessage: QueueMessage = {
      messageId: message.id,
      nodeId,
      targetNodeVersion,
      content,
      userId,
      timestamp: Date.now(),
    };

    await messageQueue.enqueue(queueMessage);

    return reply.code(202).send({ 
      success: true, 
      message: 'Message queued for adjudication',
      data: { messageId: message.id } 
    });

  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
});

const start = async () => {
  try {
    await fastify.listen({ port: 3001, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
