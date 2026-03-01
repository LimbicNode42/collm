import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { coreEngine } from './services/core';
import { llmService } from './services/llm';
import { memoryManager } from './services/memory';
import { prismaCore } from '@collm/database';
import { MessageStatus } from './types/domain';
import { CoreService } from '@collm/contracts';

const OUTPUT_RESERVE_TOKENS = 8192;
const CONTEXT_BUDGET_TOKENS  = 150_000;
const MAX_USER_MESSAGE_CHARS = 20_000;

function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / 4);
}

function buildBudgetedSystemPrompt(
  coreContext: string,
  workingMemory: string,
  keyFacts: string[],
  userMessageChars: number
): { systemPrompt: string; wasTrimmed: boolean } {
  const userTokens      = Math.ceil(userMessageChars / 4);
  const availableTokens = CONTEXT_BUDGET_TOKENS - OUTPUT_RESERVE_TOKENS - userTokens - 200;

  const preamble = `You are an AI assistant having a focused conversation about the following topic.\n\n`;
  const footer   = `\n\nStay focused on the core topic while being helpful and engaging. Build upon previous context naturally. Keep responses concise — aim for 2–4 short paragraphs unless the user specifically asks for a longer or more detailed answer.`;
  const fixedTokens = estimateTokens(preamble + footer);

  let wasTrimmed   = false;
  let factsText    = keyFacts.length > 0 ? `KEY FACTS TO REMEMBER:\n- ${keyFacts.join('\n- ')}\n\n` : '';
  let contextBlock = `${coreContext}\n\nCURRENT CONTEXT:\n${workingMemory}`;

  let remainingFacts = [...keyFacts];
  while (
    remainingFacts.length > 0 &&
    estimateTokens(preamble + contextBlock + factsText + footer) + fixedTokens > availableTokens
  ) {
    remainingFacts.pop();
    factsText = remainingFacts.length > 0
      ? `KEY FACTS TO REMEMBER:\n- ${remainingFacts.join('\n- ')}\n\n`
      : '';
    wasTrimmed = true;
  }

  let trimmedWorking = workingMemory;
  while (
    estimateTokens(preamble + contextBlock + factsText + footer) + fixedTokens > availableTokens &&
    trimmedWorking.length > 200
  ) {
    trimmedWorking = trimmedWorking.slice(Math.ceil(trimmedWorking.length * 0.1));
    contextBlock = `${coreContext}\n\nCURRENT CONTEXT:\n${trimmedWorking}`;
    wasTrimmed = true;
  }

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

const fastify = Fastify({ logger: true });

fastify.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
});

fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'supersecret',
});

fastify.get('/health', async () => ({ status: 'ok' }));

// ---------------------------------------------------------------------------
// Node endpoints
// ---------------------------------------------------------------------------
fastify.post<{
  Body: CoreService.CreateNodeRequest;
  Reply: CoreService.NodeResponse | { error: string };
}>('/nodes', async (request, reply) => {
  const { topic, description, model, tags } = request.body as any;
  if (!topic) return reply.code(400).send({ error: 'Topic is required' });

  try {
    const existing = await prismaCore.node.findUnique({ where: { topic } });
    if (existing) {
      const nodeResponse: CoreService.NodeResponse = {
        id: existing.id, topic: existing.topic, description: existing.description || '',
        model: existing.model,
        memory: {
          coreContext: existing.coreContext || '', workingMemory: existing.workingMemory || '',
          keyFacts: Array.isArray(existing.keyFacts)
            ? (existing.keyFacts as any[]).map((f: any) => f?.content || String(f)) : [],
          messageCount: existing.messageCount || 0,
          lastSummaryAt: existing.lastSummaryAt ? new Date(existing.lastSummaryAt).toISOString() : null,
        },
        createdAt: existing.createdAt.toISOString(), updatedAt: existing.updatedAt.toISOString(),
      };
      return reply.code(200).send({ ...nodeResponse, tags: existing.tags, existingNode: true } as any);
    }

    const node = await coreEngine.createNode(
      topic, description || 'Node created via API', model || 'claude-sonnet-4-5-20250929'
    );

    // Apply tags if provided
    if (Array.isArray(tags) && tags.length > 0) {
      await prismaCore.node.update({ where: { id: node.id }, data: { tags } });
    }

    const nodeResponse: CoreService.NodeResponse = {
      id: node.id, topic: node.topic, description: node.description || '', model: node.model,
      memory: {
        coreContext: node.memory?.coreContext || '', workingMemory: node.memory?.workingMemory || '',
        keyFacts: node.memory?.keyFacts?.map(fact => fact.content) || [],
        messageCount: node.memory?.messageCount || 0,
        lastSummaryAt: node.memory?.lastSummaryAt ? new Date(node.memory.lastSummaryAt).toISOString() : null,
      },
      createdAt: node.createdAt.toISOString(), updatedAt: node.updatedAt.toISOString(),
    };
    return reply.code(201).send({ ...nodeResponse, tags: Array.isArray(tags) ? tags : [] } as any);
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
    // Use raw prisma to include tags + nodeState word count
    const dbNodes = await prismaCore.node.findMany({ orderBy: { updatedAt: 'desc' } });

    const nodes = dbNodes.map(node => ({
      id: node.id, topic: node.topic, description: node.description || '',
      model: node.model, tags: node.tags,
      memory: {
        coreContext: node.coreContext || '', workingMemory: node.workingMemory || '',
        keyFacts: Array.isArray(node.keyFacts)
          ? (node.keyFacts as any[]).map((f: any) => f?.content || String(f)) : [],
        messageCount: node.messageCount || 0,
        lastSummaryAt: node.lastSummaryAt ? new Date(node.lastSummaryAt).toISOString() : null,
      },
      nodeState: node.nodeState || '',
      version: node.version,
      createdAt: node.createdAt.toISOString(), updatedAt: node.updatedAt.toISOString(),
    }));

    return reply.send({ nodes, total: nodes.length, limit, offset });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', code: 'INTERNAL_ERROR' } as any);
  }
});

fastify.post('/nodes/find-or-create', async (request, reply) => {
  const { question, model } = request.body as { question: string; model?: string };
  if (!question?.trim()) return reply.code(400).send({ error: 'Question is required' });
  try {
    const existingNodes = await coreEngine.listNodes();
    if (existingNodes.length > 0) {
      const { embeddingService } = await import('./services/embedding');
      await embeddingService.initialize();
      const qEmbedding = await embeddingService.embed(question);
      let bestNode = existingNodes[0], bestSim = -1;
      for (const n of existingNodes) {
        const sim = embeddingService.cosineSimilarity(qEmbedding, await embeddingService.embed(n.topic));
        if (sim > bestSim) { bestSim = sim; bestNode = n; }
      }
      if (bestSim >= 0.55) return reply.send({ id: bestNode.id, topic: bestNode.topic, existingNode: true, similarity: bestSim });
    }
    const node = await coreEngine.createNode(
      question.length > 120 ? question.slice(0, 117) + '…' : question,
      question, model || 'claude-sonnet-4-5-20250929'
    );
    return reply.code(201).send({ id: node.id, topic: node.topic, existingNode: false });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
});

fastify.get('/nodes/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  try {
    const node = await coreEngine.getNode(id);
    if (!node) return reply.code(404).send({ error: 'Node not found' });
    const dbRaw = await prismaCore.node.findUnique({ where: { id } });
    return reply.send({ ...node, nodeState: dbRaw?.nodeState || '', tags: dbRaw?.tags ?? [] });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
});

// Update node tags
fastify.patch('/nodes/:id/tags', async (request, reply) => {
  const { id } = request.params as { id: string };
  const { tags } = request.body as { tags: string[] };
  if (!Array.isArray(tags)) return reply.code(400).send({ error: 'tags must be an array' });
  try {
    const updated = await prismaCore.node.update({ where: { id }, data: { tags } });
    return reply.send({ id: updated.id, tags: updated.tags });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
});

// Messages for a node — includes vote counts and sourceUrl
fastify.get('/nodes/:id/messages', async (request, reply) => {
  const { id } = request.params as { id: string };
  const query = request.query as { limit?: string };
  const limit = Math.min(parseInt(query.limit || '100', 10), 200);
  try {
    const messages = await prismaCore.message.findMany({
      where: { nodeId: id },
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: { votes: true },
    });
    return reply.send({
      messages: messages.map(m => ({
        id: m.id, content: m.content, userId: m.userId,
        isLlm: m.userId === 'llm', status: m.status,
        createdAt: m.createdAt.toISOString(),
        nodeStateBefore: m.nodeStateBefore ?? null,
        sourceUrl: m.sourceUrl ?? null,
        upvotes:   m.votes.filter((v: any) => v.value === 1).length,
        downvotes: m.votes.filter((v: any) => v.value === -1).length,
      }))
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
});

// Vote on a contribution (+1 / -1 / 0 to remove)
fastify.post('/nodes/:nodeId/messages/:messageId/vote', async (request, reply) => {
  const { messageId } = request.params as { nodeId: string; messageId: string };
  const { userId, value } = request.body as { userId: string; value: number };
  if (!userId || (value !== 1 && value !== -1 && value !== 0)) {
    return reply.code(400).send({ error: 'userId and value (1, -1, or 0) required' });
  }
  try {
    const voteTable = (prismaCore as any).vote;
    if (value === 0) {
      await voteTable.deleteMany({ where: { userId, messageId } });
    } else {
      await voteTable.upsert({
        where: { userId_messageId: { userId, messageId } },
        create: { userId, messageId, value },
        update: { value },
      });
    }
    const votes = await voteTable.findMany({ where: { messageId } });
    return reply.send({
      upvotes:   votes.filter((v: any) => v.value === 1).length,
      downvotes: votes.filter((v: any) => v.value === -1).length,
      userVote:  votes.find((v: any) => v.userId === userId)?.value ?? 0,
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
});

// ---------------------------------------------------------------------------
// LLM endpoints
// ---------------------------------------------------------------------------
fastify.post('/llm/test', async (request, reply) => {
  const { prompt, systemPrompt, model } = request.body as any;
  if (!prompt) return reply.code(400).send({ error: 'Prompt is required' });
  try {
    const startTime = Date.now();
    const response = await llmService.generateCompletion(prompt, systemPrompt, model || 'claude-sonnet-4-5-20250929');
    return reply.send({ success: true, content: response.content, usage: response.usage, model, duration: Date.now() - startTime, timestamp: new Date().toISOString() });
  } catch (error) {
    request.log.error({ err: error }, 'LLM test error');
    return reply.code(500).send({ error: 'Failed to generate LLM response', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

fastify.post('/llm/chat', async (request, reply) => {
  const { nodeId, message, model, userId = 'anonymous', userName } = request.body as any;
  if (!nodeId || !message) return reply.code(400).send({ error: 'nodeId and message are required' });
  try {
    const node = await coreEngine.getNode(nodeId);
    if (!node) return reply.code(404).send({ error: 'Node not found' });

    const safeMessage = message.length > MAX_USER_MESSAGE_CHARS
      ? message.slice(0, MAX_USER_MESSAGE_CHARS) + '\n\n[Message truncated]'
      : message;

    const keyFactStrings = (node.memory?.keyFacts ?? []).map((f: any) =>
      typeof f === 'string' ? f : (f?.content ?? String(f))
    );
    const { systemPrompt, wasTrimmed } = buildBudgetedSystemPrompt(
      node.memory?.coreContext || '', node.memory?.workingMemory || 'Starting conversation',
      keyFactStrings, safeMessage.length
    );

    const startTime = Date.now();
    const llmResponse = await llmService.generateCompletion(safeMessage, systemPrompt, model || node.model || 'claude-sonnet-4-5-20250929', 2048);
    const duration = Date.now() - startTime;

    const userMessage = await prismaCore.message.create({
      data: { content: message, userId: userName || userId, nodeId, targetNodeVersion: node.version, status: MessageStatus.ACCEPTED }
    });
    await prismaCore.message.create({
      data: { content: llmResponse.content, userId: 'llm', nodeId, targetNodeVersion: node.version, status: MessageStatus.ACCEPTED }
    });

    const updatedMemory = await memoryManager.addMessage(node, {
      id: userMessage.id, content: message, userId: userName || userId,
      nodeId, targetNodeVersion: node.version, status: MessageStatus.ACCEPTED, createdAt: userMessage.createdAt
    }, llmResponse.content);
    const updatedNode = await coreEngine.updateNodeMemory(nodeId, updatedMemory);

    if (updatedMemory.lastSummaryAt === updatedMemory.messageCount) {
      (async () => {
        try {
          const metaPrompt = `Based on this conversation summary, return a JSON object with "topic" (4-6 word title) and "description" (single sentence, max 150 chars).\n\nSUMMARY:\n${updatedMemory.workingMemory}\n\nReturn only valid JSON.`;
          const metaResponse = await llmService.generateCompletion(metaPrompt, 'Return only valid JSON with "topic" and "description".', node.model, 120);
          const cleaned = metaResponse.content.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim();
          const parsed = JSON.parse(cleaned);
          const newTopic = parsed.topic ? String(parsed.topic).replace(/^["']|["']$/g, '').slice(0, 80) : node.topic;
          const newDescription = parsed.description ? String(parsed.description).slice(0, 200) : node.description;
          if (newTopic !== node.topic || newDescription !== node.description) {
            await prismaCore.node.update({ where: { id: nodeId }, data: { topic: newTopic, description: newDescription, coreContext: `Topic: ${newTopic}\nContext: ${newDescription}` } });
          }
        } catch { /* non-fatal */ }
      })();
    }

    const warnings: string[] = [];
    if (message.length > MAX_USER_MESSAGE_CHARS) warnings.push(`Message truncated to ${MAX_USER_MESSAGE_CHARS.toLocaleString()} characters.`);
    if (wasTrimmed) warnings.push('Conversation history trimmed to fit context window.');

    return reply.send({ success: true, response: llmResponse.content, warnings: warnings.length ? warnings : undefined, node: { id: updatedNode.id, topic: updatedNode.topic, memory: updatedNode.memory, messageCount: updatedMemory.messageCount }, usage: llmResponse.usage, model: model || node.model, duration, timestamp: new Date().toISOString() });
  } catch (error) {
    request.log.error({ err: error }, 'LLM chat error');
    return reply.code(500).send({ error: 'Failed to process chat message', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ---------------------------------------------------------------------------
// Evolving document helpers
// ---------------------------------------------------------------------------
const EVOLVE_SECTION_THRESHOLD = 50_000;
const MAX_CONTRIBUTION_CHARS   = 20_000;

function parseMarkdownSections(doc: string): Array<{ heading: string; content: string }> {
  return doc.split(/(?=^## )/m)
    .map(part => {
      const nl = part.indexOf('\n');
      const heading = (nl === -1 ? part : part.slice(0, nl)).replace(/^## /, '').trim() || 'Preamble';
      const content = nl === -1 ? '' : part.slice(nl + 1).trimEnd();
      return { heading, content };
    })
    .filter(s => s.heading !== 'Preamble' || s.content);
}

function scoreSectionRelevance(section: { heading: string; content: string }, contribution: string): number {
  const words = new Set(contribution.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  return `${section.heading} ${section.content}`.toLowerCase().split(/\W+/).filter(w => w.length > 3 && words.has(w)).length;
}

async function evolveLargeDocument(topic: string, model: string, currentState: string, contribution: string): Promise<string> {
  const sections = parseMarkdownSections(currentState);
  const scored   = sections.map(s => ({ ...s, score: scoreSectionRelevance(s, contribution) })).sort((a, b) => b.score - a.score);
  const topSections    = scored.slice(0, 4);
  const documentMap    = sections.map(s => `- ${s.heading}`).join('\n');
  const relevantBlocks = topSections.map(s => `## ${s.heading}\n${s.content}`).join('\n\n');

  const systemPrompt = `You maintain sections of a large knowledge document about "${topic}" in the style of Wikipedia or StackExchange. Update ONLY the provided sections to integrate the contribution.\n\nGuidelines:\n- Prefer quantitative data: add specific numbers, percentages, or figures from the contribution where relevant\n- Cite sources inline using [Source: Author/Publication, Year] when the contributor provides them\n- Neutral, encyclopedic tone\n- Return ONLY the updated sections, each starting with "## Heading"`;
  const prompt = `DOCUMENT STRUCTURE:\n${documentMap}\n\nRELEVANT SECTIONS:\n${relevantBlocks}\n\nNEW CONTRIBUTION:\n${contribution}\n\nReturn updated sections only (## Heading format):`;

  const response = await llmService.generateCompletion(prompt, systemPrompt, model, 3000);
  const updatedSections = parseMarkdownSections(response.content.trim());
  let result = currentState;
  for (const updated of updatedSections) {
    const original = sections.find(s => s.heading.toLowerCase() === updated.heading.toLowerCase());
    if (original) result = result.replace(`## ${original.heading}\n${original.content}`, `## ${updated.heading}\n${updated.content}`);
  }
  return result;
}

// POST /nodes/:id/evolve
fastify.post('/nodes/:id/evolve', async (request, reply) => {
  const { id } = request.params as { id: string };
  const { contribution, userId = 'anonymous', userName, sourceUrl, defer } = request.body as {
    contribution: string; userId?: string; userName?: string; sourceUrl?: string; defer?: boolean;
  };
  if (!contribution?.trim()) return reply.code(400).send({ error: 'Contribution is required' });

  try {
    const dbNode = await prismaCore.node.findUnique({ where: { id } });
    if (!dbNode) return reply.code(404).send({ error: 'Node not found' });

    // Deferred mode: store as PENDING without synthesizing immediately
    if (defer) {
      await prismaCore.message.create({
        data: { content: contribution, userId: userName || userId, nodeId: id, targetNodeVersion: dbNode.version, status: MessageStatus.PENDING, nodeStateBefore: dbNode.nodeState || null, sourceUrl: sourceUrl || null }
      });
      return reply.code(202).send({ deferred: true, message: 'Contribution queued for review' });
    }

    const safeContribution = contribution.length > MAX_CONTRIBUTION_CHARS
      ? contribution.slice(0, MAX_CONTRIBUTION_CHARS) + '\n\n[Truncated]'
      : contribution;

    const currentState = dbNode.nodeState || '';
    const EVOLVE_MAX_TOKENS = 2048;
    let updatedState: string;

    if (!currentState) {
      const systemPrompt = `You are creating a concise knowledge document in the style of Wikipedia or StackExchange. Based on the topic and initial contribution, produce a well-structured document in markdown.\n\nGuidelines:\n- Encyclopedic, accurate, neutral point-of-view\n- Prefer quantitative data: include specific statistics, percentages, figures, dates, and measurements wherever the contribution provides them\n- Cite sources inline using [Source: Author/Publication, Year] or [Source: URL] notation when the contributor references them\n- Structure with clear ## sections (e.g. ## Overview, ## Key Statistics, ## Details)\n- Be concise — 400-600 words for the initial document`;
      const prompt = `TOPIC: ${dbNode.topic}\n${dbNode.description ? `DESCRIPTION: ${dbNode.description}\n` : ''}\nINITIAL CONTRIBUTION:\n${safeContribution}\n\nDocument:`;
      const r = await llmService.generateCompletion(prompt, systemPrompt, dbNode.model, EVOLVE_MAX_TOKENS);
      updatedState = r.content.trim();
    } else if (currentState.length < EVOLVE_SECTION_THRESHOLD) {
      const systemPrompt = `You maintain a knowledge document about "${dbNode.topic}" in the style of Wikipedia or StackExchange. Integrate the contribution naturally — expand detail, resolve contradictions, improve clarity.\n\nGuidelines:\n- Prefer quantitative data over vague claims: replace or supplement general statements with specific numbers, percentages, figures, or dates from the contribution\n- Cite sources inline using [Source: Author/Publication, Year] when the contributor provides them\n- Neutral, encyclopedic tone — present multiple perspectives for contested claims\n- Return the COMPLETE updated document in markdown\n- Keep it under 600 words unless the topic genuinely demands more depth`;
      const prompt = `CURRENT DOCUMENT:\n${currentState}\n\n---\nNEW CONTRIBUTION:\n${safeContribution}\n\nReturn the complete updated document:`;
      const r = await llmService.generateCompletion(prompt, systemPrompt, dbNode.model, EVOLVE_MAX_TOKENS);
      updatedState = r.content.trim();
    } else {
      updatedState = await evolveLargeDocument(dbNode.topic, dbNode.model, currentState, safeContribution);
    }

    updatedState = updatedState.replace(/^```(?:markdown)?\s*/i, '').replace(/\s*```$/, '').trim();

    await prismaCore.message.create({
      data: {
        content: contribution, userId: userName || userId, nodeId: id,
        targetNodeVersion: dbNode.version, status: MessageStatus.ACCEPTED,
        nodeStateBefore: currentState || null, sourceUrl: sourceUrl || null,
      },
    });

    const updated = await prismaCore.node.update({
      where: { id },
      data: { nodeState: updatedState, version: { increment: 1 } },
    });

    return reply.send({ success: true, nodeState: updatedState, version: updated.version });
  } catch (error) {
    request.log.error({ err: error }, 'Evolve error');
    return reply.code(500).send({ error: 'Failed to evolve document', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ---------------------------------------------------------------------------
// Item 10: Presence — in-memory viewer tracking (30-second TTL)
// ---------------------------------------------------------------------------
const presenceStore = new Map<string, Map<string, number>>(); // nodeId → userId → timestamp
const PRESENCE_TTL_MS = 30_000;

fastify.post('/nodes/:id/presence', async (request, reply) => {
  const { id } = request.params as { id: string };
  const { userId } = request.body as { userId: string };
  if (!id || !userId) return reply.code(400).send({ error: 'id and userId required' });
  if (!presenceStore.has(id)) presenceStore.set(id, new Map());
  presenceStore.get(id)!.set(userId, Date.now());
  const now = Date.now();
  const viewers = Array.from(presenceStore.get(id)!.entries())
    .filter(([, ts]) => now - ts < PRESENCE_TTL_MS)
    .map(([uid]) => uid);
  return reply.send({ viewers });
});

// ---------------------------------------------------------------------------
// Item 9: Related nodes — embedding cosine similarity
// ---------------------------------------------------------------------------
fastify.get('/nodes/:id/related', async (request, reply) => {
  const { id } = request.params as { id: string };
  try {
    const { embeddingService } = await import('./services/embedding');
    await embeddingService.initialize();
    const [node, allNodes] = await Promise.all([
      prismaCore.node.findUnique({ where: { id }, select: { topic: true } }),
      prismaCore.node.findMany({ where: { id: { not: id } }, select: { id: true, topic: true, description: true, tags: true } })
    ]);
    if (!node) return reply.code(404).send({ error: 'Node not found' });
    const targetEmb = await embeddingService.embed(node.topic);
    const scored = await Promise.all(allNodes.map(async (n) => {
      const emb = await embeddingService.embed(n.topic);
      return { ...n, score: embeddingService.cosineSimilarity(targetEmb, emb) };
    }));
    const related = scored.sort((a, b) => b.score - a.score).slice(0, 5).filter(n => n.score > 0.35);
    return reply.send({ related });
  } catch (error) {
    return reply.code(500).send({ error: 'Related nodes failed', details: String(error) });
  }
});

// ---------------------------------------------------------------------------
// Item 7: Moderation queue — list and batch-synthesize pending contributions
// ---------------------------------------------------------------------------
fastify.get('/nodes/:id/pending', async (request, reply) => {
  const { id } = request.params as { id: string };
  const pending = await prismaCore.message.findMany({
    where: { nodeId: id, status: MessageStatus.PENDING },
    orderBy: { createdAt: 'asc' }
  });
  return reply.send({ pending: pending.map(m => ({ id: m.id, content: m.content, userId: m.userId, createdAt: m.createdAt.toISOString(), sourceUrl: m.sourceUrl ?? null })) });
});

fastify.post('/nodes/:id/pending/synthesize', async (request, reply) => {
  const { id } = request.params as { id: string };
  const node = await prismaCore.node.findUnique({ where: { id } });
  if (!node) return reply.code(404).send({ error: 'Node not found' });
  const pending = await prismaCore.message.findMany({ where: { nodeId: id, status: MessageStatus.PENDING }, orderBy: { createdAt: 'asc' } });
  if (pending.length === 0) return reply.send({ message: 'No pending contributions', nodeState: node.nodeState });
  const combined = pending.map((m, i) => `[Contribution ${i + 1} by ${m.userId}]\n${m.content}`).join('\n\n---\n\n');
  const systemPrompt = `You maintain a knowledge document about "${node.topic}" in encyclopedic style. Integrate all contributions, resolve contradictions, stay neutral.`;
  const prompt = `CURRENT DOCUMENT:\n${node.nodeState || '(empty)'}\n\n---\nPENDING CONTRIBUTIONS:\n${combined}\n\nReturn the complete updated document in markdown:`;
  try {
    const r = await llmService.generateCompletion(prompt, systemPrompt, node.model, 2048);
    const updatedState = r.content.trim().replace(/^```(?:markdown)?\s*/i, '').replace(/\s*```$/, '').trim();
    await Promise.all([
      prismaCore.message.updateMany({ where: { nodeId: id, status: MessageStatus.PENDING }, data: { status: MessageStatus.ACCEPTED } }),
      prismaCore.node.update({ where: { id }, data: { nodeState: updatedState, version: { increment: 1 } } })
    ]);
    return reply.send({ success: true, nodeState: updatedState, synthesized: pending.length });
  } catch (error) {
    return reply.code(500).send({ error: 'Synthesis failed', details: String(error) });
  }
});

// ---------------------------------------------------------------------------
// Item 8: Milestones — named snapshots with restore
// ---------------------------------------------------------------------------
fastify.post('/nodes/:id/milestones', async (request, reply) => {
  const { id } = request.params as { id: string };
  const { name } = request.body as { name?: string };
  const node = await prismaCore.node.findUnique({ where: { id } });
  if (!node) return reply.code(404).send({ error: 'Node not found' });
  if (!node.nodeState) return reply.code(400).send({ error: 'No document content to snapshot' });
  const milestone = await (prismaCore as any).milestone.create({
    data: { name: name?.trim() || `v${node.version} – ${new Date().toLocaleDateString()}`, nodeId: id, nodeState: node.nodeState, version: node.version }
  });
  return reply.code(201).send({ id: milestone.id, name: milestone.name, version: milestone.version, createdAt: milestone.createdAt.toISOString() });
});

fastify.get('/nodes/:id/milestones', async (request, reply) => {
  const { id } = request.params as { id: string };
  const milestones = await (prismaCore as any).milestone.findMany({ where: { nodeId: id }, orderBy: { createdAt: 'desc' } });
  return reply.send({ milestones: milestones.map((m: any) => ({ id: m.id, name: m.name, version: m.version, createdAt: m.createdAt.toISOString() })) });
});

fastify.post('/nodes/:id/milestones/:milestoneId/restore', async (request, reply) => {
  const { id, milestoneId } = request.params as { id: string; milestoneId: string };
  const milestone = await (prismaCore as any).milestone.findFirst({ where: { id: milestoneId, nodeId: id } });
  if (!milestone) return reply.code(404).send({ error: 'Milestone not found' });
  const updated = await prismaCore.node.update({ where: { id }, data: { nodeState: milestone.nodeState, version: { increment: 1 } } });
  return reply.send({ success: true, nodeState: milestone.nodeState, version: updated.version });
});

const start = async () => {
  try {
    await fastify.listen({ port: 3003, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
