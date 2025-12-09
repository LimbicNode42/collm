"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryManager = exports.HierarchicalMemoryManager = void 0;
const domain_1 = require("../types/domain");
const llm_1 = require("./llm");
const longTermMemory_1 = require("./longTermMemory");
class HierarchicalMemoryManager {
    constructor() {
        this.WORKING_MEMORY_LIMIT = 20;
        this.MAX_TOKEN_ESTIMATE = 4000;
        this.CONFIDENCE_WEIGHTS = {
            [domain_1.FactSource.USER_STATED]: 0.9,
            [domain_1.FactSource.USER_CONFIRMED]: 1.0,
            [domain_1.FactSource.LLM_INFERRED]: 0.6,
            [domain_1.FactSource.IMPLICIT]: 0.4
        };
    }
    initializeMemory(topic, initialDescription) {
        const initialFacts = [];
        if (initialDescription && initialDescription.trim().length > 0) {
            initialFacts.push({
                id: `init-${Date.now()}`,
                content: initialDescription,
                confidence: this.CONFIDENCE_WEIGHTS[domain_1.FactSource.USER_STATED],
                source: domain_1.FactSource.USER_STATED,
                extractedAt: Date.now(),
                supportingEvidence: ['Initial node description'],
                embedding: undefined
            });
        }
        return {
            coreContext: `Topic: ${topic}\nInitial Context: ${initialDescription}`,
            workingMemory: `Starting conversation about: ${topic}`,
            keyFacts: initialFacts,
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
        console.log(`[Memory] Compressing memory for node ${node.id}. Current facts: ${memory.keyFacts.length}`);
        const updatedKeyFacts = await longTermMemory_1.longTermMemory.extractAndMergeKeyFacts(memory.keyFacts, memory.workingMemory, memory.coreContext);
        const compressionPrompt = `
Compress the following working memory into a concise summary, preserving key insights and context:

CORE CONTEXT (for reference):
${memory.coreContext}

WORKING MEMORY TO COMPRESS:
${memory.workingMemory}

Create a summary that:
1. Captures the main themes and insights
2. Preserves important context for future conversations
3. Is concise but informative
4. Builds upon the core context

Compressed Summary:`;
        try {
            const response = await llm_1.llmService.generateCompletion(compressionPrompt, "You are a memory compression system. Create concise, informative summaries.", node.model);
            const compressedSummary = response.content.trim();
            console.log(`[Memory] Compression complete. Facts: ${memory.keyFacts.length} → ${updatedKeyFacts.length}`);
            return {
                coreContext: memory.coreContext,
                workingMemory: compressedSummary,
                keyFacts: updatedKeyFacts,
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
            context += `Key Facts:\n${memory.keyFacts
                .filter(fact => fact.confidence > 0.3)
                .sort((a, b) => b.confidence - a.confidence)
                .slice(0, 10)
                .map(fact => `- ${fact.content} (confidence: ${fact.confidence.toFixed(2)})`)
                .join('\n')}\n\n`;
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