"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const database_1 = require("@collm/database");
const queue_1 = require("./services/queue");
const fastify = (0, fastify_1.default)({
    logger: true
});
fastify.post('/message', async (request, reply) => {
    const body = request.body;
    const { userId, nodeId, content, targetNodeVersion } = body;
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