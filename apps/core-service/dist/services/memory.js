"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryManager = exports.HierarchicalMemoryManager = void 0;
const llm_1 = require("./llm");
class HierarchicalMemoryManager {
    constructor() {
        this.WORKING_MEMORY_LIMIT = 20;
        this.MAX_TOKEN_ESTIMATE = 4000;
    }
    initializeMemory(topic, initialDescription) {
        return {
            coreContext: `Topic: ${topic}\nInitial Context: ${initialDescription}`,
            workingMemory: `Starting conversation about: ${topic}`,
            keyFacts: [],
            messageCount: 0,
            lastSummaryAt: 0
        };
    }
    async addMessage(node, message, response) {
        const updatedMemory = Object.assign({}, node.memory);
        updatedMemory.messageCount += 1;
        const messageText = `User: ${message.content}`;
        const responseText = response ? `\nAssistant: ${response}` : '';
        if (updatedMemory.workingMemory) {
            updatedMemory.workingMemory += `\n\n${messageText}${responseText}`;
        }
        else {
            updatedMemory.workingMemory = `${messageText}${responseText}`;
        }
        if (this.shouldCompress(updatedMemory)) {
            return await this.compressMemory(Object.assign(Object.assign({}, node), { memory: updatedMemory }), []);
        }
        return updatedMemory;
    }
    shouldCompress(memory) {
        const messagesSinceLastSummary = memory.messageCount - memory.lastSummaryAt;
        const estimatedTokens = this.estimateTokens(memory.workingMemory);
        return messagesSinceLastSummary >= this.WORKING_MEMORY_LIMIT ||
            estimatedTokens > this.MAX_TOKEN_ESTIMATE;
    }
    async compressMemory(node, _recentMessages) {
        const memory = node.memory;
        const compressionPrompt = `
You are a memory management system. Your task is to compress conversation history while preserving essential information.

CORE CONTEXT (Never change this):
${memory.coreContext}

CURRENT KEY FACTS:
${memory.keyFacts.join('\n- ')}

WORKING MEMORY TO COMPRESS:
${memory.workingMemory}

Instructions:
1. Preserve the core context exactly as is
2. Extract any new key facts or insights 
3. Create a concise summary of the working memory
4. Focus on information that builds on the core topic

Respond with a JSON object:
{
  "keyFacts": ["fact1", "fact2", ...],
  "compressedSummary": "concise summary of working memory"
}
`;
        try {
            const response = await llm_1.llmService.generateCompletion(compressionPrompt, "You are a precise memory compression system. Always respond with valid JSON.", node.model);
            const compressionResult = JSON.parse(response.content);
            return {
                coreContext: memory.coreContext,
                workingMemory: compressionResult.compressedSummary,
                keyFacts: [
                    ...memory.keyFacts,
                    ...compressionResult.keyFacts.filter((fact) => !memory.keyFacts.includes(fact))
                ],
                messageCount: memory.messageCount,
                lastSummaryAt: memory.messageCount
            };
        }
        catch (error) {
            console.error('[MemoryManager] Compression failed:', error);
            return Object.assign(Object.assign({}, memory), { workingMemory: this.truncateWorkingMemory(memory.workingMemory), lastSummaryAt: memory.messageCount });
        }
    }
    async getContext(node, recentMessages) {
        const memory = node.memory;
        let context = `${memory.coreContext}\n\n`;
        if (memory.keyFacts.length > 0) {
            context += `Key Facts:\n${memory.keyFacts.map(fact => `- ${fact}`).join('\n')}\n\n`;
        }
        context += `Recent Context:\n${memory.workingMemory}`;
        if (recentMessages.length > 0) {
            const recentText = recentMessages
                .slice(-5)
                .map(msg => `- ${msg.content}`)
                .join('\n');
            context += `\n\nLatest Messages:\n${recentText}`;
        }
        return context;
    }
    estimateTokens(text) {
        return Math.ceil(text.length / 4);
    }
    truncateWorkingMemory(workingMemory) {
        const lines = workingMemory.split('\n');
        const keepLines = Math.floor(lines.length / 2);
        return lines.slice(-keepLines).join('\n');
    }
}
exports.HierarchicalMemoryManager = HierarchicalMemoryManager;
exports.memoryManager = new HierarchicalMemoryManager();
//# sourceMappingURL=memory.js.map