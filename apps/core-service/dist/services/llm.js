"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.llmService = exports.MockLLMService = exports.RealLLMService = void 0;
class RealLLMService {
    getProviderFromModel(model) {
        if (model.startsWith('gpt-'))
            return 'openai';
        if (model.startsWith('claude-'))
            return 'anthropic';
        if (model.startsWith('gemini-'))
            return 'google';
        throw new Error(`Unknown model provider for model: ${model}`);
    }
    async callOpenAI(prompt, systemPrompt = '', model) {
        var _a, _b, _c;
        const apiKey = process.env.OPENAI_API_KEY;
        const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
        if (!apiKey)
            throw new Error('OPENAI_API_KEY environment variable is required');
        const messages = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: 0.7,
                max_tokens: 2000,
            }),
        });
        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return {
            content: data.choices[0].message.content,
            usage: {
                promptTokens: ((_a = data.usage) === null || _a === void 0 ? void 0 : _a.prompt_tokens) || 0,
                completionTokens: ((_b = data.usage) === null || _b === void 0 ? void 0 : _b.completion_tokens) || 0,
                totalTokens: ((_c = data.usage) === null || _c === void 0 ? void 0 : _c.total_tokens) || 0,
            },
        };
    }
    async callAnthropic(prompt, systemPrompt = '', model) {
        var _a, _b, _c, _d;
        const apiKey = process.env.ANTHROPIC_API_KEY;
        const baseUrl = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
        if (!apiKey)
            throw new Error('ANTHROPIC_API_KEY environment variable is required');
        const messages = [{ role: 'user', content: prompt }];
        const response = await fetch(`${baseUrl}/v1/messages`, {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                max_tokens: 2000,
                messages,
                system: systemPrompt || undefined,
            }),
        });
        if (!response.ok) {
            throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return {
            content: data.content[0].text,
            usage: {
                promptTokens: ((_a = data.usage) === null || _a === void 0 ? void 0 : _a.input_tokens) || 0,
                completionTokens: ((_b = data.usage) === null || _b === void 0 ? void 0 : _b.output_tokens) || 0,
                totalTokens: (((_c = data.usage) === null || _c === void 0 ? void 0 : _c.input_tokens) || 0) + (((_d = data.usage) === null || _d === void 0 ? void 0 : _d.output_tokens) || 0),
            },
        };
    }
    async callGoogle(prompt, systemPrompt = '', model) {
        var _a, _b, _c;
        const apiKey = process.env.GOOGLE_API_KEY;
        const baseUrl = process.env.GOOGLE_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';
        if (!apiKey)
            throw new Error('GOOGLE_API_KEY environment variable is required');
        const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
        const response = await fetch(`${baseUrl}/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                        parts: [{ text: fullPrompt }]
                    }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2000,
                },
            }),
        });
        if (!response.ok) {
            throw new Error(`Google API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            throw new Error('Invalid response from Google API');
        }
        return {
            content: data.candidates[0].content.parts[0].text,
            usage: {
                promptTokens: ((_a = data.usageMetadata) === null || _a === void 0 ? void 0 : _a.promptTokenCount) || 0,
                completionTokens: ((_b = data.usageMetadata) === null || _b === void 0 ? void 0 : _b.candidatesTokenCount) || 0,
                totalTokens: ((_c = data.usageMetadata) === null || _c === void 0 ? void 0 : _c.totalTokenCount) || 0,
            },
        };
    }
    async generateCompletion(prompt, systemPrompt = '', model = 'claude-sonnet-4-5-20250929') {
        console.log(`[LLMService] Generating completion with model: ${model}`);
        const provider = this.getProviderFromModel(model);
        try {
            switch (provider) {
                case 'openai':
                    return await this.callOpenAI(prompt, systemPrompt, model);
                case 'anthropic':
                    return await this.callAnthropic(prompt, systemPrompt, model);
                case 'google':
                    return await this.callGoogle(prompt, systemPrompt, model);
                default:
                    throw new Error(`Unsupported provider: ${provider}`);
            }
        }
        catch (error) {
            console.error(`[LLMService] Error generating completion:`, error);
            throw error;
        }
    }
    async generateEmbedding(text) {
        const apiKey = process.env.OPENAI_API_KEY;
        const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
        if (!apiKey)
            throw new Error('OPENAI_API_KEY environment variable is required');
        console.log(`[LLMService] Generating embedding for text: "${text.substring(0, 50)}..."`);
        const response = await fetch(`${baseUrl}/embeddings`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'text-embedding-ada-002',
                input: text,
            }),
        });
        if (!response.ok) {
            throw new Error(`OpenAI Embeddings API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return data.data[0].embedding;
    }
}
exports.RealLLMService = RealLLMService;
class MockLLMService {
    async generateCompletion(prompt, _systemPrompt, _model) {
        console.log(`[LLMService] Generating completion for prompt: "${prompt.substring(0, 50)}..."`);
        if (prompt.includes("isRelevant")) {
            return {
                content: JSON.stringify({
                    isRelevant: true,
                    isStale: false,
                    reason: "This is a mock response. The message is considered relevant and fresh.",
                    score: 0.95
                }),
                usage: {
                    promptTokens: 10,
                    completionTokens: 20,
                    totalTokens: 30,
                },
            };
        }
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
const hasApiKeys = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GOOGLE_API_KEY;
exports.llmService = hasApiKeys ? new RealLLMService() : new MockLLMService();
//# sourceMappingURL=llm.js.map