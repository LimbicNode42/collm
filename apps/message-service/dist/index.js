"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
const database_1 = require("@collm/database");
const queue_1 = require("./services/queue");
const fastify = (0, fastify_1.default)({
    logger: true
});
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
fastify.get('/queue/pop', async (request, reply) => {
    try {
        const message = await queue_1.messageQueue.dequeue();
        if (message) {
            return reply.send({ success: true, message });
        }
        else {
            return reply.code(404).send({ success: false, error: 'Queue is empty' });
        }
    }
    catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal Server Error' });
    }
});
fastify.get('/message/:id', async (request, reply) => {
    const { id } = request.params;
    try {
        const message = await database_1.prismaCore.message.findUnique({
            where: { id }
        });
        if (!message) {
            return reply.code(404).send({ error: 'Message not found' });
        }
        return reply.send({ success: true, message });
    }
    catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal Server Error' });
    }
});
fastify.post('/message', async (request, reply) => {
    const { userId, nodeId, content, targetNodeVersion } = request.body;
    if (!userId || !nodeId || !content || targetNodeVersion === undefined) {
        return reply.code(400).send({ error: 'Missing required fields' });
    }
    try {
        const message = await database_1.prismaCore.message.create({
            data: {
                content,
                userId,
                nodeId,
                targetNodeVersion,
                status: 'PENDING',
            },
        });
        const queueMessage = {
            messageId: message.id,
            nodeId,
            targetNodeVersion,
            content,
            userId,
            timestamp: Date.now(),
        };
        await queue_1.messageQueue.enqueue(queueMessage);
        return reply.code(202).send({
            success: true,
            message: 'Message queued for adjudication',
            data: { messageId: message.id }
        });
    }
    catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal Server Error' });
    }
});
const start = async () => {
    try {
        await fastify.listen({ port: 3001, host: '0.0.0.0' });
    }
    catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};
start();
//# sourceMappingURL=index.js.map