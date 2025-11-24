export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ILLMService {
  /**
   * Generates a completion for the given prompt.
   */
  generateCompletion(prompt: string, systemPrompt?: string): Promise<LLMResponse>;

  /**
   * Generates an embedding for the given text.
   */
  generateEmbedding(text: string): Promise<number[]>;
}

export class MockLLMService implements ILLMService {
  async generateCompletion(prompt: string, _systemPrompt?: string): Promise<LLMResponse> {
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

  async generateEmbedding(text: string): Promise<number[]> {
    console.log(`[LLMService] Generating embedding for text: "${text.substring(0, 50)}..."`);
    // Return a random vector of dimension 1536 (OpenAI standard)
    return new Array(1536).fill(0).map(() => Math.random());
  }
}

export const llmService = new MockLLMService();
