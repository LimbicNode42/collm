"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
const core_1 = require("./services/core");
const llm_1 = require("./services/llm");
const memory_1 = require("./services/memory");
const domain_1 = require("./types/domain");
const fastify = (0, fastify_1.default)({ logger: true });
fastify.register(cors_1.default, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
});
fastify.register(jwt_1.default, {
    secret: process.env.JWT_SECRET || 'supersecret',
});
fastify.get('/health', async () => {
    return { status: 'ok' };
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
const start = async () => {
    try {
        await fastify.listen({ port: 3003, host: '0.0.0.0' });
    }
    catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};
start();
//# sourceMappingURL=index.js.map