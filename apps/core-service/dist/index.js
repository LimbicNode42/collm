"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const queue_1 = require("./services/queue");
const adjudication_1 = require("./services/adjudication");
const core_1 = require("./services/core");
const database_1 = require("@collm/database");
const types_1 = require("@collm/types");
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
            state: node.state,
            version: node.version,
            createdAt: node.createdAt,
            updatedAt: node.updatedAt,
        };
        const verdict = await adjudication_1.adjudicationEngine.adjudicate(domainMessage, domainNode);
        console.log(`[Worker] Verdict for ${message.id}:`, verdict);
        let newStatus = types_1.MessageStatus.PENDING;
        if (verdict.isStale) {
            newStatus = types_1.MessageStatus.STALE;
        }
        else if (verdict.isRelevant) {
            newStatus = types_1.MessageStatus.ACCEPTED;
        }
        else {
            newStatus = types_1.MessageStatus.REJECTED;
        }
        await database_1.prismaCore.message.update({
            where: { id: message.id },
            data: { status: newStatus },
        });
        if (newStatus === types_1.MessageStatus.ACCEPTED) {
            const domainMessage = {
                id: message.id,
                content: message.content,
                userId: message.userId,
                nodeId: message.nodeId,
                targetNodeVersion: message.targetNodeVersion,
                status: types_1.MessageStatus.ACCEPTED,
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
async function main() {
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
if (require.main === module) {
    main().catch(console.error);
}
//# sourceMappingURL=index.js.map