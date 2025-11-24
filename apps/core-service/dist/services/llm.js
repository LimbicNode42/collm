"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.llmService = exports.MockLLMService = void 0;
class MockLLMService {
    async generateCompletion(prompt, _systemPrompt) {
        console.log(`[LLMService] Generating completion for prompt: "${prompt.substring(0, 50)}..."`);
        return {
            content: "This is a mock LLM response. In a real implementation, this would be the output from OpenAI or Anthropic.",
            usage: {
                promptTokens: 10,
                completionTokens: 20,
                totalTokens: 30,
            },
        };
    }
    async generateEmbedding(text) {
        console.log(`[LLMService] Generating embedding for text: "${text.substring(0, 50)}..."`);
        return new Array(1536).fill(0).map(() => Math.random());
    }
}
exports.MockLLMService = MockLLMService;
exports.llmService = new MockLLMService();
//# sourceMappingURL=llm.js.map