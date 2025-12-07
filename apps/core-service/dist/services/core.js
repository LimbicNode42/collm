"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coreEngine = exports.LLMCoreEngine = void 0;
const llm_1 = require("./llm");
const vectorStore_1 = require("./vectorStore");
const database_1 = require("@collm/database");
class LLMCoreEngine {
    async createNode(topic, initialDescription, model = 'claude-sonnet-4-5-20250929') {
        const prompt = `Initialize a conversation state for the topic: "${topic}". Description: "${initialDescription}". Provide a concise summary of the starting point.`;
        const response = await llm_1.llmService.generateCompletion(prompt, '', model);
        const node = await database_1.prismaCore.node.create({
            data: {
                topic,
                description: initialDescription,
                state: response.content,
                model,
                version: 1,
            }
        });
        const domainNode = {
            id: node.id,
            topic: node.topic,
            description: node.description || undefined,
            state: node.state,
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
        console.log(`[CoreEngine] Updating state for node ${nodeId} with ${newMessages.length} new messages using model "${node.model}"`);
        const messagesText = newMessages.map(m => `- ${m.content}`).join('\n');
        const prompt = `
Current Conversation State:
${node.state}

New Accepted Messages:
${messagesText}

Task: Update the conversation state to incorporate the new information. Keep the summary concise but comprehensive.
    `;
        const response = await llm_1.llmService.generateCompletion(prompt, '', node.model);
        const updatedNode = await database_1.prismaCore.node.update({
            where: { id: nodeId },
            data: {
                state: response.content,
                version: { increment: 1 },
            }
        });
        const domainNode = {
            id: updatedNode.id,
            topic: updatedNode.topic,
            description: updatedNode.description || undefined,
            state: updatedNode.state,
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
            state: node.state,
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
            state: node.state,
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