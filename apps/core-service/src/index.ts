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

// ---------------------------------------------------------------------------
// Context-window budget management
// ---------------------------------------------------------------------------
const OUTPUT_RESERVE_TOKENS = 8192;   // tokens we always reserve for the response
const CONTEXT_BUDGET_TOKENS  = 150_000; // conservative limit (fits Claude 200K, GPT-4 128K)
const MAX_USER_MESSAGE_CHARS = 20_000;  // ~5 000 tokens — hard cap on a single user turn

/** Rough characters-to-tokens estimate (4 chars ≈ 1 token) */
function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / 4);
}

/**
 * Builds a system prompt that fits inside the available token budget.
 * Sections are trimmed in priority order (least important first):
 *   1. keyFacts   — drop lowest-confidence facts until within budget
 *   2. workingMemory — keep most-recent content by trimming from the front
 *   3. coreContext   — last resort, trim from the front
 */
function buildBudgetedSystemPrompt(
  coreContext: string,
  workingMemory: string,
  keyFacts: string[],
  userMessageChars: number
): { systemPrompt: string; wasTrimmed: boolean } {
  const userTokens      = Math.ceil(userMessageChars / 4);
  const availableTokens = CONTEXT_BUDGET_TOKENS - OUTPUT_RESERVE_TOKENS - userTokens - 200; // 200 overhead

  const preamble = `You are an AI assistant having a focused conversation about the following topic.\n\n`;
  const footer   = `\n\nStay focused on the core topic while being helpful and engaging. Build upon previous context naturally. Keep responses concise — aim for 2–4 short paragraphs unless the user specifically asks for a longer or more detailed answer.`;
  const fixedTokens = estimateTokens(preamble + footer);

  let wasTrimmed   = false;
  let factsText    = keyFacts.length > 0 ? `KEY FACTS TO REMEMBER:\n- ${keyFacts.join('\n- ')}\n\n` : '';
  let contextBlock = `${coreContext}\n\nCURRENT CONTEXT:\n${workingMemory}`;

  // Step 1: trim keyFacts until within budget
  let remainingFacts = [...keyFacts];
  while (
    remainingFacts.length > 0 &&
    estimateTokens(preamble + contextBlock + factsText + footer) + fixedTokens > availableTokens
  ) {
    remainingFacts.pop(); // drop from the end (lowest confidence, already sorted)
    factsText = remainingFacts.length > 0
      ? `KEY FACTS TO REMEMBER:\n- ${remainingFacts.join('\n- ')}\n\n`
      : '';
    wasTrimmed = true;
  }

  // Step 2: trim workingMemory from the front
  let trimmedWorking = workingMemory;
  while (
    estimateTokens(preamble + contextBlock + factsText + footer) + fixedTokens > availableTokens &&
    trimmedWorking.length > 200
  ) {
    // drop first 10% of working memory
    trimmedWorking = trimmedWorking.slice(Math.ceil(trimmedWorking.length * 0.1));
    contextBlock = `${coreContext}\n\nCURRENT CONTEXT:\n${trimmedWorking}`;
    wasTrimmed = true;
  }

  // Step 3: trim coreContext from the front (last resort)
  let trimmedCore = coreContext;
  while (
    estimateTokens(preamble + contextBlock + factsText + footer) + fixedTokens > availableTokens &&
    trimmedCore.length > 100
  ) {
    trimmedCore = trimmedCore.slice(Math.ceil(trimmedCore.length * 0.1));
    contextBlock = `${trimmedCore}\n\nCURRENT CONTEXT:\n${trimmedWorking}`;
    wasTrimmed = true;
  }

  const systemPrompt = `${preamble}${contextBlock}\n\n${factsText}${footer}`;
  return { systemPrompt, wasTrimmed };
}
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
    // Also return nodeState (the evolving knowledge document)
    const dbRaw = await prismaCore.node.findUnique({ where: { id } });
    return reply.send({ ...node, nodeState: dbRaw?.nodeState || '' });
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
    request.log.error({ err: error }, 'LLM test error');
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

    // 2. Guard against oversized user messages
    const safeMessage = message.length > MAX_USER_MESSAGE_CHARS
      ? message.slice(0, MAX_USER_MESSAGE_CHARS) + '\n\n[Message truncated — exceeded input limit]'
      : message;
    if (message.length > MAX_USER_MESSAGE_CHARS) {
      console.warn(`[Chat] User message truncated from ${message.length} to ${MAX_USER_MESSAGE_CHARS} chars`);
    }

    // 3. Build a context-budgeted system prompt
    const keyFactStrings = (node.memory?.keyFacts ?? []).map((f: any) =>
      typeof f === 'string' ? f : (f?.content ?? String(f))
    );
    const { systemPrompt, wasTrimmed } = buildBudgetedSystemPrompt(
      node.memory?.coreContext || '',
      node.memory?.workingMemory || 'Starting conversation',
      keyFactStrings,
      safeMessage.length
    );
    if (wasTrimmed) {
      console.warn(`[Chat] System prompt was trimmed to fit context budget for node ${nodeId}`);
    }

    // 4. Generate LLM response — cap at 2048 output tokens for chat (reduces latency & cost)
    const startTime = Date.now();
    const llmResponse = await llmService.generateCompletion(
      safeMessage,
      systemPrompt,
      model || node.model || 'claude-sonnet-4-5-20250929',
      2048
    );
    const duration = Date.now() - startTime;

    // 5. Persist the user message to the database (store original, not truncated)
    const userMessage = await prismaCore.message.create({
      data: {
        content: message,
        userId: userName || userId,
        nodeId: nodeId,
        targetNodeVersion: node.version,
        status: MessageStatus.ACCEPTED,
      }
    });

    // 6. Persist the LLM response to the database
    await prismaCore.message.create({
      data: {
        content: llmResponse.content,
        userId: 'llm',
        nodeId: nodeId,
        targetNodeVersion: node.version,
        status: MessageStatus.ACCEPTED,
      }
    });

    // 7. Update node memory with this conversation turn
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

    // 8. Save the updated memory to database
    const updatedNode = await coreEngine.updateNodeMemory(nodeId, updatedMemory);

    // 9. If compression just happened, fire background topic + description update
    if (updatedMemory.lastSummaryAt === updatedMemory.messageCount) {
      (async () => {
        try {
          const metaPrompt = `Based on this conversation summary, return a JSON object with two fields:
- "topic": a short title of 4-6 words (no quotes, no trailing punctuation)
- "description": a single sentence (max 150 chars) describing what this conversation covers

CONVERSATION SUMMARY:
${updatedMemory.workingMemory}

Return only valid JSON, nothing else.`;

          const metaResponse = await llmService.generateCompletion(
            metaPrompt,
            'You are a conversation metadata generator. Return only valid JSON with "topic" and "description" fields.',
            node.model,
            120 // enough for a short title + one sentence
          );

          let newTopic = node.topic;
          let newDescription = node.description || node.topic;

          try {
            const cleaned = metaResponse.content
              .trim()
              .replace(/^```(?:json)?\s*/, '')
              .replace(/\s*```$/, '')
              .trim();
            const parsed = JSON.parse(cleaned);
            if (parsed.topic) newTopic = String(parsed.topic).replace(/^["']|["']$/g, '').slice(0, 80);
            if (parsed.description) newDescription = String(parsed.description).slice(0, 200);
          } catch {
            // JSON parse failed — skip update
            return;
          }

          if (newTopic !== node.topic || newDescription !== node.description) {
            const newCoreContext = `Topic: ${newTopic}\nContext: ${newDescription}`;
            await prismaCore.node.update({
              where: { id: nodeId },
              data: { topic: newTopic, description: newDescription, coreContext: newCoreContext },
            });
            console.log(`[TopicEvolution] topic="${newTopic}" description="${newDescription}"`);
          }
        } catch {
          // Ignore — non-fatal
        }
      })();
    }

    const warnings: string[] = [];
    if (message.length > MAX_USER_MESSAGE_CHARS) {
      warnings.push(`Your message was truncated to ${MAX_USER_MESSAGE_CHARS.toLocaleString()} characters to fit the input limit.`);
    }
    if (wasTrimmed) {
      warnings.push('Conversation history was trimmed to fit the context window. Older context may not be visible to the AI.');
    }

    return reply.send({
      success: true,
      response: llmResponse.content,
      warnings: warnings.length > 0 ? warnings : undefined,
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
    request.log.error({ err: error }, 'LLM chat error');
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

// ---------------------------------------------------------------------------
// Evolving document helpers
// ---------------------------------------------------------------------------
const EVOLVE_SECTION_THRESHOLD = 50_000; // chars — above this we use section-based updates
const MAX_CONTRIBUTION_CHARS   = 20_000;

function parseMarkdownSections(doc: string): Array<{ heading: string; content: string }> {
  const parts = doc.split(/(?=^## )/m);
  return parts
    .map(part => {
      const nl = part.indexOf('\n');
      const heading = nl === -1 ? part.replace(/^## /, '') : part.slice(0, nl).replace(/^## /, '');
      const content = nl === -1 ? '' : part.slice(nl + 1).trimEnd();
      return { heading: heading.trim() || 'Preamble', content };
    })
    .filter(s => s.heading !== 'Preamble' || s.content);
}

function scoreSectionRelevance(section: { heading: string; content: string }, contribution: string): number {
  const contribWords = new Set(
    contribution.toLowerCase().split(/\W+/).filter(w => w.length > 3)
  );
  const text = `${section.heading} ${section.content}`.toLowerCase();
  return text.split(/\W+/).filter(w => w.length > 3 && contribWords.has(w)).length;
}

async function evolveLargeDocument(
  topic: string,
  model: string,
  currentState: string,
  contribution: string
): Promise<string> {
  const sections = parseMarkdownSections(currentState);
  const scored   = sections
    .map(s => ({ ...s, score: scoreSectionRelevance(s, contribution) }))
    .sort((a, b) => b.score - a.score);

  const topSections    = scored.slice(0, 4);
  const documentMap    = sections.map(s => `- ${s.heading}`).join('\n');
  const relevantBlocks = topSections.map(s => `## ${s.heading}\n${s.content}`).join('\n\n');

  const systemPrompt = `You maintain sections of a large knowledge document about "${topic}". Update ONLY the provided sections to integrate the contribution. Return ONLY the updated sections, each starting with "## Heading".`;
  const prompt = `DOCUMENT STRUCTURE:\n${documentMap}\n\nRELEVANT SECTIONS:\n${relevantBlocks}\n\nNEW CONTRIBUTION:\n${contribution}\n\nReturn updated sections only (## Heading format):`;

  const response = await llmService.generateCompletion(prompt, systemPrompt, model, 3000);
  const updatedSections = parseMarkdownSections(response.content.trim());

  let result = currentState;
  for (const updated of updatedSections) {
    const original = sections.find(
      s => s.heading.toLowerCase() === updated.heading.toLowerCase()
    );
    if (original) {
      result = result.replace(
        `## ${original.heading}\n${original.content}`,
        `## ${updated.heading}\n${updated.content}`
      );
    }
  }
  return result;
}

// POST /nodes/:id/evolve — integrate a contribution into the evolving document
fastify.post('/nodes/:id/evolve', async (request, reply) => {
  const { id } = request.params as { id: string };
  const { contribution, userId = 'anonymous', userName } = request.body as {
    contribution: string;
    userId?: string;
    userName?: string;
  };

  if (!contribution?.trim()) {
    return reply.code(400).send({ error: 'Contribution is required' });
  }

  try {
    const dbNode = await prismaCore.node.findUnique({ where: { id } });
    if (!dbNode) return reply.code(404).send({ error: 'Node not found' });

    const safeContribution = contribution.length > MAX_CONTRIBUTION_CHARS
      ? contribution.slice(0, MAX_CONTRIBUTION_CHARS) + '\n\n[Truncated to fit input limit]'
      : contribution;

    const currentState = dbNode.nodeState || '';
    let updatedState: string;

    // 2048 tokens keeps responses under ~30s, well within connection timeouts
    const EVOLVE_MAX_TOKENS = 2048;

    if (!currentState) {
      // First contribution — bootstrap document
      const systemPrompt = `You are creating a concise knowledge document. Based on the topic and initial contribution, produce a well-structured document in markdown with clear ## sections. Encyclopedic, accurate, neutral tone. Be concise — 400-600 words maximum.`;
      const prompt = `TOPIC: ${dbNode.topic}\n${dbNode.description ? `DESCRIPTION: ${dbNode.description}\n` : ''}\nINITIAL CONTRIBUTION:\n${safeContribution}\n\nDocument:`;
      const r = await llmService.generateCompletion(prompt, systemPrompt, dbNode.model, EVOLVE_MAX_TOKENS);
      updatedState = r.content.trim();
    } else if (currentState.length < EVOLVE_SECTION_THRESHOLD) {
      // Full-document evolution
      const systemPrompt = `You maintain a knowledge document about "${dbNode.topic}". Integrate the contribution naturally — expand detail, resolve contradictions, improve clarity. Return the COMPLETE updated document in markdown. Keep it under 600 words unless the topic demands more.`;
      const prompt = `CURRENT DOCUMENT:\n${currentState}\n\n---\nNEW CONTRIBUTION:\n${safeContribution}\n\nReturn the complete updated document:`;
      const r = await llmService.generateCompletion(prompt, systemPrompt, dbNode.model, EVOLVE_MAX_TOKENS);
      updatedState = r.content.trim();
    } else {
      // Section-based evolution for large documents
      updatedState = await evolveLargeDocument(dbNode.topic, dbNode.model, currentState, safeContribution);
    }

    // Strip accidental markdown fences
    updatedState = updatedState
      .replace(/^```(?:markdown)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    // Persist contribution as a message (contribution log)
    await prismaCore.message.create({
      data: {
        content: contribution,
        userId: userName || userId,
        nodeId: id,
        targetNodeVersion: dbNode.version,
        status: MessageStatus.ACCEPTED,
      },
    });

    // Save updated state + bump version
    const updated = await prismaCore.node.update({
      where: { id },
      data: { nodeState: updatedState, version: { increment: 1 } },
    });

    return reply.send({ success: true, nodeState: updatedState, version: updated.version });
  } catch (error) {
    request.log.error({ err: error }, 'Evolve error');
    return reply.code(500).send({
      error: 'Failed to evolve document',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

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
