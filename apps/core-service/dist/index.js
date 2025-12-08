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
const database_1 = require("@collm/database");
const domain_1 = require("./types/domain");
const fastify = (0, fastify_1.default)({
    logger: true
});
fastify.register(require('@fastify/cors'), {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
});
fastify.get('/health', async (request, reply) => {
    try {
        await database_1.prismaCore.$queryRaw `SELECT 1 as health`;
        return { status: 'ok', service: 'core-service', database: 'connected' };
    }
    catch (error) {
        request.log.error('Health check failed:', error);
        return reply.code(503).send({
            status: 'error',
            service: 'core-service',
            database: 'disconnected',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
fastify.post('/nodes', async (request, reply) => {
    const body = request.body;
    const { topic, description, model } = body;
    if (!topic) {
        return reply.code(400).send({ error: 'Topic is required' });
    }
    try {
        const node = await core_1.coreEngine.createNode(topic, description || 'Node created via API', model || 'claude-sonnet-4-5-20250929');
        return reply.send({ success: true, node });
    }
    catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal Server Error' });
    }
});
fastify.get('/nodes', async (request, reply) => {
    try {
        const nodes = await core_1.coreEngine.listNodes();
        return reply.send({ success: true, nodes });
    }
    catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal Server Error' });
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
const testDatabaseConnection = async () => {
    console.log('[CoreService] Testing database connection...');
    try {
        await database_1.prismaCore.$connect();
        console.log('[CoreService] Database connection successful');
        await database_1.prismaCore.$disconnect();
    }
    catch (error) {
        console.error('[CoreService] Database connection failed:', error);
        console.error('[CoreService] DATABASE_URL_CORE:', process.env.DATABASE_URL_CORE ? 'Set (length: ' + process.env.DATABASE_URL_CORE.length + ')' : 'Not set');
        throw error;
    }
};
const startHttpServer = async () => {
    try {
        console.log('[CoreService] Environment check:');
        console.log('[CoreService] DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
        console.log('[CoreService] DATABASE_URL_CORE:', process.env.DATABASE_URL_CORE ? 'Set' : 'Not set');
        console.log('[CoreService] SQS_QUEUE_URL:', process.env.SQS_QUEUE_URL ? 'Set' : 'Not set');
        await testDatabaseConnection();
        await fastify.listen({ port: 3003, host: '0.0.0.0' });
        console.log('[CoreService] HTTP server started on port 3003');
        console.log('[CoreService] Registered routes:');
        fastify.printRoutes();
    }
    catch (err) {
        fastify.log.error(err);
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
                keyFacts: node.keyFacts,
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