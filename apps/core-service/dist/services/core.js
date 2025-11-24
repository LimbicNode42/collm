"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coreEngine = exports.LLMCoreEngine = void 0;
const llm_1 = require("./llm");
const vectorStore_1 = require("./vectorStore");
class LLMCoreEngine {
    constructor() {
        this.nodes = new Map();
    }
    async createNode(topic, initialDescription) {
        const id = Math.random().toString(36).substring(7);
        const prompt = `Initialize a conversation state for the topic: "${topic}". Description: "${initialDescription}". Provide a concise summary of the starting point.`;
        const response = await llm_1.llmService.generateCompletion(prompt);
        const newNode = {
            id,
            topic,
            description: initialDescription,
            state: response.content,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.nodes.set(id, newNode);
        await vectorStore_1.vectorStore.addNode(id, `${topic}: ${initialDescription}`);
        console.log(`[CoreEngine] Created node ${id} for topic "${topic}"`);
        return newNode;
    }
    async updateNodeState(nodeId, newMessages) {
        const node = this.nodes.get(nodeId);
        if (!node) {
            throw new Error(`Node ${nodeId} not found`);
        }
        console.log(`[CoreEngine] Updating state for node ${nodeId} with ${newMessages.length} new messages`);
        const messagesText = newMessages.map(m => `- ${m.content}`).join('\n');
        const prompt = `
Current Conversation State:
${node.state}

New Accepted Messages:
${messagesText}

Task: Update the conversation state to incorporate the new information. Keep the summary concise but comprehensive.
    `;
        const response = await llm_1.llmService.generateCompletion(prompt);
        const updatedNode = Object.assign(Object.assign({}, node), { state: response.content, version: node.version + 1, updatedAt: new Date() });
        this.nodes.set(nodeId, updatedNode);
        return updatedNode;
    }
    async getNode(nodeId) {
        return this.nodes.get(nodeId) || null;
    }
}
exports.LLMCoreEngine = LLMCoreEngine;
exports.coreEngine = new LLMCoreEngine();
//# sourceMappingURL=core.js.map