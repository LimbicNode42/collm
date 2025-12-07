import Fastify from 'fastify';
import { messageQueue } from './services/queue';
import { adjudicationEngine } from './services/adjudication';
import { coreEngine } from './services/core';
import { llmService } from './services/llm';
import { prismaCore } from '@collm/database';
import { MessageStatus } from '@collm/types';

// HTTP Server for Node Management
const fastify = Fastify({
  logger: true
});

// Add CORS support
fastify.register(require('@fastify/cors'), {
  origin: true, // Allow all origins for now
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
});

// Health check
fastify.get('/health', async (request, reply) => {
  try {
    // Test database connectivity
    await prismaCore.$queryRaw`SELECT 1 as health`;
    return { status: 'ok', service: 'core-service', database: 'connected' };
  } catch (error) {
    request.log.error('Health check failed:', error);
    return reply.code(503).send({ 
      status: 'error', 
      service: 'core-service', 
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Node management endpoints
fastify.post('/nodes', async (request, reply) => {
  const body = request.body as any;
  const { topic, description, model } = body;

  if (!topic) {
    return reply.code(400).send({ error: 'Topic is required' });
  }

  try {
    const node = await coreEngine.createNode(
      topic,
      description || 'Node created via API',
      model || 'claude-sonnet-4-5-20250929'
    );
    return reply.send({ success: true, node });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
});

fastify.get('/nodes', async (request, reply) => {
  try {
    const nodes = await coreEngine.listNodes();
    return reply.send({ success: true, nodes });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
});

fastify.get('/nodes/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  try {
    const node = await coreEngine.getNode(id);
    if (!node) {
      return reply.code(404).send({ error: 'Node not found' });
    }
    return reply.send({ success: true, node });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
});

// LLM testing endpoint
fastify.post('/llm/test', async (request, reply) => {
  const body = request.body as any;
  const { prompt, systemPrompt, model } = body;

  if (!prompt) {
    return reply.code(400).send({ error: 'Prompt is required' });
  }

  try {
    const startTime = Date.now();
    const response = await llmService.generateCompletion(
      prompt,
      systemPrompt,
      model || 'claude-sonnet-4-5-20250929'
    );
    const duration = Date.now() - startTime;

    return reply.send({ 
      success: true, 
      content: response.content,
      usage: response.usage,
      model: model || 'claude-sonnet-4-5-20250929',
      duration,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    request.log.error('LLM test error:', error);
    return reply.code(500).send({ 
      error: 'Failed to generate LLM response',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test database connection
const testDatabaseConnection = async () => {
  console.log('[CoreService] Testing database connection...');
  try {
    await prismaCore.$connect();
    console.log('[CoreService] Database connection successful');
    await prismaCore.$disconnect();
  } catch (error) {
    console.error('[CoreService] Database connection failed:', error);
    console.error('[CoreService] DATABASE_URL_CORE:', process.env.DATABASE_URL_CORE ? 'Set (length: ' + process.env.DATABASE_URL_CORE.length + ')' : 'Not set');
    throw error;
  }
};

// Start HTTP server
const startHttpServer = async () => {
  try {
    console.log('[CoreService] Environment check:');
    console.log('[CoreService] DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
    console.log('[CoreService] DATABASE_URL_CORE:', process.env.DATABASE_URL_CORE ? 'Set' : 'Not set');
    console.log('[CoreService] SQS_QUEUE_URL:', process.env.SQS_QUEUE_URL ? 'Set' : 'Not set');
    
    // Test database connection before starting server
    await testDatabaseConnection();
    
    await fastify.listen({ port: 3003, host: '0.0.0.0' });
    console.log('[CoreService] HTTP server started on port 3003');
    
    // Log all registered routes for debugging
    console.log('[CoreService] Registered routes:');
    fastify.printRoutes();
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

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

async function startMessageProcessor() {
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

async function main() {
  console.log('[CoreService] Starting core service...');
  
  // Start HTTP server for node management
  await startHttpServer();
  
  // Start message processor
  await startMessageProcessor();
}

if (require.main === module) {
  main().catch(console.error);
}
