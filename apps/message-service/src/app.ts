/**
 * Fastify app factory — separate from server startup so tests can call
 * buildApp() and use fastify.inject() without binding to a port.
 */
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { prismaCore } from '@collm/database';
import { messageQueue } from './services/queue';
import { QueueMessage } from './types/domain';
import { MessageService } from '@collm/contracts';

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: false });

  await fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  });

  fastify.get('/health', async () => {
    return { status: 'ok' };
  });

  fastify.get('/queue/pop', async (_request, reply) => {
    try {
      const message = await messageQueue.dequeue();
      if (message) {
        return reply.send({ success: true, message });
      } else {
        return reply.code(404).send({ success: false, error: 'Queue is empty' });
      }
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.get('/message/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const message = await prismaCore.message.findUnique({ where: { id } });
      if (!message) {
        return reply.code(404).send({ error: 'Message not found' });
      }
      return reply.send({ success: true, message });
    } catch (error) {
      fastify.log.error(error);
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
      const message = await prismaCore.message.create({
        data: { content, userId, nodeId, targetNodeVersion, status: 'PENDING' },
      });

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
        data: { messageId: message.id },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  return fastify;
}
