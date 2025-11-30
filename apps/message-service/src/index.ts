import Fastify from 'fastify';
import { prismaCore } from '@collm/database';
import { messageQueue } from './services/queue';
import { QueueMessage } from '@collm/types';

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

fastify.post('/queue/create-node', async (request, reply) => {
  const body = request.body as any;
  const { topic, description, state, model } = body;

  try {
    const node = await prismaCore.node.create({
      data: {
        topic: topic || 'Test Topic',
        description: description || 'Created via debug endpoint',
        state: state || 'Initial State',
        model: model || 'claude-sonnet-4-5-20250929',
        version: 1
      }
    });
    return reply.send({ success: true, node });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
});

fastify.get('/nodes', async (request, reply) => {
  try {
    const nodes = await prismaCore.node.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        topic: true,
        description: true,
        model: true,
        version: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { messages: true }
        }
      }
    });
    return reply.send({ success: true, nodes });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
});

fastify.get('/node/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  try {
    const node = await prismaCore.node.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 50
        }
      }
    });
    if (!node) {
      return reply.code(404).send({ error: 'Node not found' });
    }
    return reply.send({ success: true, node });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
});

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

fastify.post('/message', async (request, reply) => {
  const body = request.body as any;
  const { userId, nodeId, content, targetNodeVersion } = body;

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
