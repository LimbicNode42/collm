import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
// import { messageQueue } from './services/queue';
// import { adjudicationEngine } from './services/adjudication';
import { coreEngine } from './services/core';
import { llmService } from './services/llm';
import { memoryManager } from './services/memory';
import { prismaCore } from '@collm/database';
import { MessageStatus } from './types/domain';
import { CoreService } from '@collm/contracts';
// import { parseKeyFactsFromDb } from './utils/factConversion';

const fastify = Fastify({ logger: true });

// Register CORS
fastify.register(cors, {
  origin: true, // Allow all origins for dev
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
});

// Register JWT
fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'supersecret',
});

// Health check
fastify.get('/health', async () => {
  return { status: 'ok' };
});

// Node management endpoints
fastify.post<{
  Body: CoreService.CreateNodeRequest;
  Reply: CoreService.NodeResponse | { error: string };
}>('/nodes', async (request, reply) => {
  const { topic, description, model } = request.body;

  if (!topic) {
    return reply.code(400).send({ error: 'Topic is required' });
  }

  try {
    // Check if a node with this topic already exists — topics must be unique
    const existing = await prismaCore.node.findUnique({ where: { topic } });
    if (existing) {
      const nodeResponse: CoreService.NodeResponse = {
        id: existing.id,
        topic: existing.topic,
        description: existing.description || '',
        model: existing.model,
        memory: {
          coreContext: existing.coreContext || '',
          workingMemory: existing.workingMemory || '',
          keyFacts: Array.isArray(existing.keyFacts)
            ? (existing.keyFacts as any[]).map((f: any) => f?.content || String(f))
            : [],
          messageCount: existing.messageCount || 0,
          lastSummaryAt: existing.lastSummaryAt ? new Date(existing.lastSummaryAt).toISOString() : null,
        },
        createdAt: existing.createdAt.toISOString(),
        updatedAt: existing.updatedAt.toISOString(),
      };
      // 200 with existingNode flag so the UI can redirect
      return reply.code(200).send({ ...nodeResponse, existingNode: true } as any);
    }

    const node = await coreEngine.createNode(
      topic,
      description || 'Node created via API',
      model || 'claude-sonnet-4-5-20250929'
    );
    
    // Convert to OpenAPI contract format
    const nodeResponse: CoreService.NodeResponse = {
      id: node.id,
      topic: node.topic,
      description: node.description || '',
      model: node.model,
      memory: {
        coreContext: node.memory?.coreContext || '',
        workingMemory: node.memory?.workingMemory || '',
        keyFacts: node.memory?.keyFacts?.map(fact => fact.content) || [],
        messageCount: node.memory?.messageCount || 0,
        lastSummaryAt: node.memory?.lastSummaryAt ? new Date(node.memory.lastSummaryAt).toISOString() : null,
      },
      createdAt: node.createdAt.toISOString(),
      updatedAt: node.updatedAt.toISOString(),
    };
    
    return reply.code(201).send(nodeResponse);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
});

fastify.get<{
  Querystring: { limit?: number; offset?: number };
  Reply: { nodes: CoreService.NodeResponse[]; total: number; limit: number; offset: number };
}>('/nodes', async (request, reply) => {
  try {
    const { limit = 10, offset = 0 } = request.query;
    const dbNodes = await coreEngine.listNodes();
    
    // Convert to OpenAPI contract format
    const nodes: CoreService.NodeResponse[] = dbNodes.map(node => ({
      id: node.id,
      topic: node.topic,
      description: node.description || '',
      model: node.model,
      memory: {
        coreContext: node.memory?.coreContext || '',
        workingMemory: node.memory?.workingMemory || '',
        keyFacts: node.memory?.keyFacts?.map(fact => fact.content) || [],
        messageCount: node.memory?.messageCount || 0,
        lastSummaryAt: node.memory?.lastSummaryAt ? new Date(node.memory.lastSummaryAt).toISOString() : null,
      },
      createdAt: node.createdAt.toISOString(),
      updatedAt: node.updatedAt.toISOString(),
    }));
    
    return reply.send({ 
      nodes, 
      total: nodes.length, 
      limit, 
      offset 
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ 
      error: 'Internal Server Error',
      code: 'INTERNAL_ERROR'
    } as any);
  }
});

// Find an existing node by semantic similarity to a question, or create a new one
fastify.post('/nodes/find-or-create', async (request, reply) => {
  const { question, model } = request.body as { question: string; model?: string };

  if (!question?.trim()) {
    return reply.code(400).send({ error: 'Question is required' });
  }

  try {
    const existingNodes = await coreEngine.listNodes();

    if (existingNodes.length > 0) {
      const { embeddingService } = await import('./services/embedding');
      await embeddingService.initialize();

      const qEmbedding = await embeddingService.embed(question);
      let bestNode = existingNodes[0];
      let bestSim = -1;

      for (const n of existingNodes) {
        const tEmbedding = await embeddingService.embed(n.topic);
        const sim = embeddingService.cosineSimilarity(qEmbedding, tEmbedding);
        if (sim > bestSim) { bestSim = sim; bestNode = n; }
      }

      if (bestSim >= 0.55) {
        return reply.send({
          id: bestNode.id,
          topic: bestNode.topic,
          existingNode: true,
          similarity: bestSim,
        });
      }
    }

    // No match — create new node using the question as topic
    const node = await coreEngine.createNode(
      question.length > 120 ? question.slice(0, 117) + '…' : question,
      question,
      model || 'claude-sonnet-4-5-20250929'
    );

    return reply.code(201).send({
      id: node.id,
      topic: node.topic,
      existingNode: false,
    });
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

// Messages for a node
fastify.get('/nodes/:id/messages', async (request, reply) => {
  const { id } = request.params as { id: string };
  const query = request.query as { limit?: string; before?: string };
  const limit = Math.min(parseInt(query.limit || '100', 10), 200);

  try {
    const messages = await prismaCore.message.findMany({
      where: { nodeId: id },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return reply.send({
      messages: messages.map(m => ({
        id: m.id,
        content: m.content,
        userId: m.userId,
        isLlm: m.userId === 'llm',
        status: m.status,
        createdAt: m.createdAt.toISOString(),
      }))
    });
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

// Conversational memory testing endpoint
fastify.post('/llm/chat', async (request, reply) => {
  const body = request.body as any;
  const { nodeId, message, model, userId = 'anonymous', userName } = body;

  if (!nodeId || !message) {
    return reply.code(400).send({ error: 'nodeId and message are required' });
  }

  try {
    // 1. Get the node with its memory
    const node = await coreEngine.getNode(nodeId);
    if (!node) {
      return reply.code(404).send({ error: 'Node not found' });
    }

    // 2. Build context from node's memory
    const systemPrompt = `You are an AI assistant having a focused conversation about the following topic.

${node.memory?.coreContext || ''}

CURRENT CONTEXT:
${node.memory?.workingMemory || 'Starting conversation'}

KEY FACTS TO REMEMBER:
${node.memory?.keyFacts?.join('\n- ') || 'None yet'}

Stay focused on the core topic while being helpful and engaging. Build upon previous context naturally.`;

    // 3. Generate LLM response
    const startTime = Date.now();
    const llmResponse = await llmService.generateCompletion(
      message,
      systemPrompt,
      model || node.model || 'claude-sonnet-4-5-20250929'
    );
    const duration = Date.now() - startTime;

    // 4. Persist the user message to the database
    const userMessage = await prismaCore.message.create({
      data: {
        content: message,
        userId: userName || userId,
        nodeId: nodeId,
        targetNodeVersion: node.version,
        status: MessageStatus.ACCEPTED,
      }
    });

    // 5. Persist the LLM response to the database
    await prismaCore.message.create({
      data: {
        content: llmResponse.content,
        userId: 'llm',
        nodeId: nodeId,
        targetNodeVersion: node.version,
        status: MessageStatus.ACCEPTED,
      }
    });

    // 6. Update node memory with this conversation turn
    const tempMessage = {
      id: userMessage.id,
      content: message,
      userId: userName || userId,
      nodeId: nodeId,
      targetNodeVersion: node.version,
      status: MessageStatus.ACCEPTED,
      createdAt: userMessage.createdAt
    };

    const updatedMemory = await memoryManager.addMessage(node, tempMessage, llmResponse.content);

    // 7. Save the updated memory to database
    const updatedNode = await coreEngine.updateNodeMemory(nodeId, updatedMemory);

    return reply.send({
      success: true,
      response: llmResponse.content,
      node: {
        id: updatedNode.id,
        topic: updatedNode.topic,
        memory: updatedNode.memory,
        messageCount: updatedMemory.messageCount
      },
      usage: llmResponse.usage,
      model: model || node.model,
      duration,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    request.log.error('LLM chat error:', error);
    return reply.code(500).send({ 
      error: 'Failed to process chat message',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// async function processMessage() {
//   const queueMessage = await messageQueue.dequeue();
  
//   if (!queueMessage) {
//     return false; // No message processed
//   }

//   console.log(`[Worker] Processing message ${queueMessage.messageId}`);

//   try {
//     // 1. Fetch the message and node from DB to ensure they exist and get current state
//     const message = await prismaCore.message.findUnique({
//       where: { id: queueMessage.messageId },
//       include: { node: true },
//     });

//     if (!message) {
//       console.error(`[Worker] Message ${queueMessage.messageId} not found in DB`);
//       return true;
//     }

//     const node = message.node;

//     // Map Prisma types to Domain types
//     const domainMessage = {
//       id: message.id,
//       content: message.content,
//       userId: message.userId,
//       nodeId: message.nodeId,
//       targetNodeVersion: message.targetNodeVersion,
//       status: message.status as MessageStatus, // Cast string to enum
//       createdAt: message.createdAt,
//     };

//     const domainNode = {
//       id: node.id,
//       topic: node.topic,
//       description: node.description || undefined,
//       memory: {
//         coreContext: node.coreContext,
//         workingMemory: node.workingMemory,
//         keyFacts: parseKeyFactsFromDb(node.keyFacts),
//         messageCount: node.messageCount,
//         lastSummaryAt: node.lastSummaryAt,
//       },
//       version: node.version,
//       model: node.model,
//       createdAt: node.createdAt,
//       updatedAt: node.updatedAt,
//     };

//     // 2. Adjudicate
//     const verdict = await adjudicationEngine.adjudicate(domainMessage, domainNode);

//     console.log(`[Worker] Verdict for ${message.id}:`, verdict);

//     // 3. Update Message Status
//     let newStatus = MessageStatus.PENDING;
//     if (verdict.isStale) {
//       newStatus = MessageStatus.STALE;
//     } else if (verdict.isRelevant) {
//       newStatus = MessageStatus.ACCEPTED;
//     } else {
//       newStatus = MessageStatus.REJECTED;
//     }

//     await prismaCore.message.update({
//       where: { id: message.id },
//       data: { status: newStatus },
//     });

//     // 4. If Accepted, Update Node State
//     if (newStatus === MessageStatus.ACCEPTED) {
//       // We need to convert the Prisma message to the domain Message type if they differ, 
//       // or just pass what coreEngine expects.
//       // coreEngine expects Message[]
//       // Let's cast or map it.
//       const domainMessage = {
//         id: message.id,
//         content: message.content,
//         userId: message.userId,
//         nodeId: message.nodeId,
//         targetNodeVersion: message.targetNodeVersion,
//         status: MessageStatus.ACCEPTED,
//         createdAt: message.createdAt,
//       };

//       await coreEngine.updateNodeState(node.id, [domainMessage]);
//     }

//   } catch (error) {
//     console.error(`[Worker] Error processing message ${queueMessage.messageId}:`, error);
//     // In a real app, we might want to DLQ this or retry.
//     // SQS handles retries if we didn't delete the message, but we deleted it in dequeue (at-most-once).
//     // To fix this, we should move delete to after processing.
//     // But for now, we log and move on.
//   }

//   return true;
// }

// async function startMessageProcessor() {
//   console.log('[CoreService] Starting core processor...');
  
//   let running = true;
  
//   // Handle graceful shutdown
//   process.on('SIGINT', () => {
//     console.log('[CoreService] Shutting down...');
//     running = false;
//   });

//   while (running) {
//     const processed = await processMessage();
    
//     if (!processed) {
//       // If no message, sleep for a bit (if using InMemory, SQS has long polling built-in but returns empty)
//       // SQS dequeue waits 10s. If it returns null, it means timeout.
//       // So we can loop immediately.
//       // But for InMemory, we need a sleep.
//       if (process.env.SQS_QUEUE_URL) {
//         // SQS long polling already waited.
//       } else {
//         await new Promise(resolve => setTimeout(resolve, 1000));
//       }
//     }
//   }
// }

const start = async () => {
  try {
    await fastify.listen({ port: 3003, host: '0.0.0.0' });
    // await startMessageProcessor();
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
