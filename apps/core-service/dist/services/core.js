"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coreEngine = exports.LLMCoreEngine = void 0;
const llm_1 = require("./llm");
const vectorStore_1 = require("./vectorStore");
const memory_1 = require("./memory");
const database_1 = require("@collm/database");
class LLMCoreEngine {
    async createNode(topic, initialDescription, model = 'claude-sonnet-4-5-20250929') {
        const initialMemory = memory_1.memoryManager.initializeMemory(topic, initialDescription);
        const node = await database_1.prismaCore.node.create({
            data: {
                topic,
                description: initialDescription,
                coreContext: initialMemory.coreContext,
                workingMemory: initialMemory.workingMemory,
                keyFacts: initialMemory.keyFacts,
                messageCount: initialMemory.messageCount,
                lastSummaryAt: initialMemory.lastSummaryAt,
                model,
                version: 1,
            }
        });
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
            model: node.model,
            version: node.version,
            createdAt: node.createdAt,
            updatedAt: node.updatedAt,
        };
        await vectorStore_1.vectorStore.addNode(node.id, `${topic}: ${initialDescription}`);
        console.log(`[CoreEngine] Created node ${node.id} for topic "${topic}" using model "${model}"`);
        return domainNode;
    }
    async updateNodeState(nodeId, newMessages) {
        const node = await database_1.prismaCore.node.findUnique({
            where: { id: nodeId }
        });
        if (!node) {
            throw new Error(`Node ${nodeId} not found`);
        }
        console.log(`[CoreEngine] Updating memory for node ${nodeId} with ${newMessages.length} new messages using model "${node.model}"`);
        const currentNode = {
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
            model: node.model,
            version: node.version,
            createdAt: node.createdAt,
            updatedAt: node.updatedAt,
        };
        let updatedMemory = currentNode.memory;
        for (const message of newMessages) {
            const context = await memory_1.memoryManager.getContext(currentNode, []);
            const prompt = `${context}\n\nNew message: ${message.content}\n\nRespond thoughtfully based on the conversation context.`;
            const response = await llm_1.llmService.generateCompletion(prompt, '', node.model);
            updatedMemory = await memory_1.memoryManager.addMessage(Object.assign(Object.assign({}, currentNode), { memory: updatedMemory }), message, response.content);
        }
        const updatedNode = await database_1.prismaCore.node.update({
            where: { id: nodeId },
            data: {
                coreContext: updatedMemory.coreContext,
                workingMemory: updatedMemory.workingMemory,
                keyFacts: updatedMemory.keyFacts,
                messageCount: updatedMemory.messageCount,
                lastSummaryAt: updatedMemory.lastSummaryAt,
                version: { increment: 1 },
            }
        });
        const domainNode = {
            id: updatedNode.id,
            topic: updatedNode.topic,
            description: updatedNode.description || undefined,
            memory: {
                coreContext: updatedNode.coreContext,
                workingMemory: updatedNode.workingMemory,
                keyFacts: updatedNode.keyFacts,
                messageCount: updatedNode.messageCount,
                lastSummaryAt: updatedNode.lastSummaryAt,
            },
            model: updatedNode.model,
            version: updatedNode.version,
            createdAt: updatedNode.createdAt,
            updatedAt: updatedNode.updatedAt,
        };
        return domainNode;
    }
    async getNode(nodeId) {
        const node = await database_1.prismaCore.node.findUnique({
            where: { id: nodeId }
        });
        if (!node)
            return null;
        return {
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
            model: node.model,
            version: node.version,
            createdAt: node.createdAt,
            updatedAt: node.updatedAt,
        };
    }
    async listNodes() {
        const nodes = await database_1.prismaCore.node.findMany({
            orderBy: { updatedAt: 'desc' }
        });
        return nodes.map(node => ({
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
            model: node.model,
            version: node.version,
            createdAt: node.createdAt,
            updatedAt: node.updatedAt,
        }));
    }
}
exports.LLMCoreEngine = LLMCoreEngine;
exports.coreEngine = new LLMCoreEngine();
//# sourceMappingURL=core.js.map