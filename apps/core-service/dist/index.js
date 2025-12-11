"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const queue_1 = require("./services/queue");
const adjudication_1 = require("./services/adjudication");
const core_1 = require("./services/core");
const llm_1 = require("./services/llm");
const memory_1 = require("./services/memory");
const database_1 = require("@collm/database");
const domain_1 = require("./types/domain");
const factConversion_1 = require("./utils/factConversion");
const fastify = (0, fastify_1.default)({
    logger: true
});
fastify.register(require('@fastify/cors'), {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
});
fastify.post('/nodes', async (request, reply) => {
    var _a, _b, _c, _d, _e, _f;
    const { topic, description, model } = request.body;
    if (!topic) {
        return reply.code(400).send({ error: 'Topic is required' });
    }
    try {
        const node = await core_1.coreEngine.createNode(topic, description || 'Node created via API', model || 'claude-sonnet-4-5-20250929');
        const nodeResponse = {
            id: node.id,
            topic: node.topic,
            description: node.description || '',
            model: node.model,
            memory: {
                coreContext: ((_a = node.memory) === null || _a === void 0 ? void 0 : _a.coreContext) || '',
                workingMemory: ((_b = node.memory) === null || _b === void 0 ? void 0 : _b.workingMemory) || '',
                keyFacts: ((_d = (_c = node.memory) === null || _c === void 0 ? void 0 : _c.keyFacts) === null || _d === void 0 ? void 0 : _d.map(fact => fact.content)) || [],
                messageCount: ((_e = node.memory) === null || _e === void 0 ? void 0 : _e.messageCount) || 0,
                lastSummaryAt: ((_f = node.memory) === null || _f === void 0 ? void 0 : _f.lastSummaryAt) ? new Date(node.memory.lastSummaryAt).toISOString() : null,
            },
            createdAt: node.createdAt.toISOString(),
            updatedAt: node.updatedAt.toISOString(),
        };
        return reply.code(201).send(nodeResponse);
    }
    catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal Server Error' });
    }
});
fastify.get('/nodes', async (request, reply) => {
    try {
        const { limit = 10, offset = 0 } = request.query;
        const dbNodes = await core_1.coreEngine.listNodes();
        const nodes = dbNodes.map(node => {
            var _a, _b, _c, _d, _e, _f;
            return ({
                id: node.id,
                topic: node.topic,
                description: node.description || '',
                model: node.model,
                memory: {
                    coreContext: ((_a = node.memory) === null || _a === void 0 ? void 0 : _a.coreContext) || '',
                    workingMemory: ((_b = node.memory) === null || _b === void 0 ? void 0 : _b.workingMemory) || '',
                    keyFacts: ((_d = (_c = node.memory) === null || _c === void 0 ? void 0 : _c.keyFacts) === null || _d === void 0 ? void 0 : _d.map(fact => fact.content)) || [],
                    messageCount: ((_e = node.memory) === null || _e === void 0 ? void 0 : _e.messageCount) || 0,
                    lastSummaryAt: ((_f = node.memory) === null || _f === void 0 ? void 0 : _f.lastSummaryAt) ? new Date(node.memory.lastSummaryAt).toISOString() : null,
                },
                createdAt: node.createdAt.toISOString(),
                updatedAt: node.updatedAt.toISOString(),
            });
        });
        return reply.send({
            nodes,
            total: nodes.length,
            limit,
            offset
        });
    }
    catch (error) {
        request.log.error(error);
        return reply.code(500).send({
            error: 'Internal Server Error',
            code: 'INTERNAL_ERROR'
        });
    }
});
fastify.get('/nodes/:id', async (request, reply) => {
    const { id } = request.params;
    try {
        const node = await core_1.coreEngine.getNode(id);
        if (!node) {
            return reply.code(404).send({ error: 'Node not found' });
        }
        return reply.send({ success: true, node });
    }
    catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal Server Error' });
    }
});
fastify.post('/llm/test', async (request, reply) => {
    const body = request.body;
    const { prompt, systemPrompt, model } = body;
    if (!prompt) {
        return reply.code(400).send({ error: 'Prompt is required' });
    }
    try {
        const startTime = Date.now();
        const response = await llm_1.llmService.generateCompletion(prompt, systemPrompt, model || 'claude-sonnet-4-5-20250929');
        const duration = Date.now() - startTime;
        return reply.send({
            success: true,
            content: response.content,
            usage: response.usage,
            model: model || 'claude-sonnet-4-5-20250929',
            duration,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        request.log.error('LLM test error:', error);
        return reply.code(500).send({
            error: 'Failed to generate LLM response',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
fastify.post('/llm/chat', async (request, reply) => {
    var _a, _b, _c, _d;
    const body = request.body;
    const { nodeId, message, model } = body;
    if (!nodeId || !message) {
        return reply.code(400).send({ error: 'nodeId and message are required' });
    }
    try {
        const node = await core_1.coreEngine.getNode(nodeId);
        if (!node) {
            return reply.code(404).send({ error: 'Node not found' });
        }
        const systemPrompt = `You are an AI assistant having a focused conversation about the following topic.

${((_a = node.memory) === null || _a === void 0 ? void 0 : _a.coreContext) || ''}

CURRENT CONTEXT:
${((_b = node.memory) === null || _b === void 0 ? void 0 : _b.workingMemory) || 'Starting conversation'}

KEY FACTS TO REMEMBER:
${((_d = (_c = node.memory) === null || _c === void 0 ? void 0 : _c.keyFacts) === null || _d === void 0 ? void 0 : _d.join('\n- ')) || 'None yet'}

Stay focused on the core topic while being helpful and engaging. Build upon previous context naturally.`;
        const startTime = Date.now();
        const llmResponse = await llm_1.llmService.generateCompletion(message, systemPrompt, model || node.model || 'claude-sonnet-4-5-20250929');
        const duration = Date.now() - startTime;
        const tempMessage = {
            id: `temp-${Date.now()}`,
            content: message,
            userId: 'memory-test-user',
            nodeId: nodeId,
            targetNodeVersion: node.version,
            status: domain_1.MessageStatus.ACCEPTED,
            createdAt: new Date()
        };
        const updatedMemory = await memory_1.memoryManager.addMessage(node, tempMessage, llmResponse.content);
        const updatedNode = await core_1.coreEngine.updateNodeMemory(nodeId, updatedMemory);
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
    }
    catch (error) {
        request.log.error('LLM chat error:', error);
        return reply.code(500).send({
            error: 'Failed to process chat message',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
const startHttpServer = async () => {
    const fastify = (0, fastify_1.default)({ logger: true });
    fastify.log.info('Registering routes...');
    fastify.get('/health', async function () {
        fastify.log.info('Health check endpoint hit');
        return { status: 'ok' };
    });
    fastify.log.info('Routes registered. Checking Fastify readiness...');
    try {
        await fastify.ready();
        fastify.log.info('Fastify is ready. Registered routes:');
        fastify.printRoutes();
    }
    catch (err) {
        fastify.log.error('Error during fastify.ready:', err);
        throw err;
    }
    try {
        await fastify.listen({ port: 3001, host: '0.0.0.0' });
        fastify.log.info('Server started on port 3001, host 0.0.0.0');
    }
    catch (err) {
        fastify.log.error('Error starting server:', err);
        process.exit(1);
    }
};
async function processMessage() {
    const queueMessage = await queue_1.messageQueue.dequeue();
    if (!queueMessage) {
        return false;
    }
    console.log(`[Worker] Processing message ${queueMessage.messageId}`);
    try {
        const message = await database_1.prismaCore.message.findUnique({
            where: { id: queueMessage.messageId },
            include: { node: true },
        });
        if (!message) {
            console.error(`[Worker] Message ${queueMessage.messageId} not found in DB`);
            return true;
        }
        const node = message.node;
        const domainMessage = {
            id: message.id,
            content: message.content,
            userId: message.userId,
            nodeId: message.nodeId,
            targetNodeVersion: message.targetNodeVersion,
            status: message.status,
            createdAt: message.createdAt,
        };
        const domainNode = {
            id: node.id,
            topic: node.topic,
            description: node.description || undefined,
            memory: {
                coreContext: node.coreContext,
                workingMemory: node.workingMemory,
                keyFacts: (0, factConversion_1.parseKeyFactsFromDb)(node.keyFacts),
                messageCount: node.messageCount,
                lastSummaryAt: node.lastSummaryAt,
            },
            version: node.version,
            model: node.model,
            createdAt: node.createdAt,
            updatedAt: node.updatedAt,
        };
        const verdict = await adjudication_1.adjudicationEngine.adjudicate(domainMessage, domainNode);
        console.log(`[Worker] Verdict for ${message.id}:`, verdict);
        let newStatus = domain_1.MessageStatus.PENDING;
        if (verdict.isStale) {
            newStatus = domain_1.MessageStatus.STALE;
        }
        else if (verdict.isRelevant) {
            newStatus = domain_1.MessageStatus.ACCEPTED;
        }
        else {
            newStatus = domain_1.MessageStatus.REJECTED;
        }
        await database_1.prismaCore.message.update({
            where: { id: message.id },
            data: { status: newStatus },
        });
        if (newStatus === domain_1.MessageStatus.ACCEPTED) {
            const domainMessage = {
                id: message.id,
                content: message.content,
                userId: message.userId,
                nodeId: message.nodeId,
                targetNodeVersion: message.targetNodeVersion,
                status: domain_1.MessageStatus.ACCEPTED,
                createdAt: message.createdAt,
            };
            await core_1.coreEngine.updateNodeState(node.id, [domainMessage]);
        }
    }
    catch (error) {
        console.error(`[Worker] Error processing message ${queueMessage.messageId}:`, error);
    }
    return true;
}
async function startMessageProcessor() {
    console.log('[CoreService] Starting message processor...');
    let running = true;
    process.on('SIGINT', () => {
        console.log('[CoreService] Shutting down...');
        running = false;
    });
    while (running) {
        const processed = await processMessage();
        if (!processed) {
            if (process.env.SQS_QUEUE_URL) {
            }
            else {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
}
async function main() {
    console.log('[CoreService] Starting core service...');
    await startHttpServer();
    await startMessageProcessor();
}
if (require.main === module) {
    main().catch(console.error);
}
//# sourceMappingURL=index.js.map