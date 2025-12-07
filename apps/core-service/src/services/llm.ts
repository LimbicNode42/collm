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
  generateCompletion(prompt: string, systemPrompt?: string, model?: string): Promise<LLMResponse>;

  /**
   * Generates an embedding for the given text.
   */
  generateEmbedding(text: string): Promise<number[]>;
}

export type LLMProvider = 'openai' | 'anthropic' | 'google';
export type LLMModel = 
  | 'gpt-5.1'
  | 'gpt-5-nano'
  | 'gpt-5-mini'
  | 'gpt-5'
  | 'gpt-5-pro'
  | 'claude-sonnet-4-5-20250929'
  | 'claude-haiku-4-5-20251001'
  | 'claude-opus-4-5-20251101'
  | 'claude-opus-4-1-20250805'
  | 'gemini-3-pro'
  | 'gemini-2.5-flash'
  | 'gemini-2.5-flash-lite'
  | 'gemini-2.5-pro';

export class RealLLMService implements ILLMService {
  private getProviderFromModel(model: string): LLMProvider {
    if (model.startsWith('gpt-')) return 'openai';
    if (model.startsWith('claude-')) return 'anthropic';
    if (model.startsWith('gemini-')) return 'google';
    throw new Error(`Unknown model provider for model: ${model}`);
  }

  private async callOpenAI(prompt: string, systemPrompt: string = '', model: string): Promise<LLMResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    
    if (!apiKey) throw new Error('OPENAI_API_KEY environment variable is required');

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

    const data = await response.json() as any;
    
    return {
      content: data.choices[0].message.content,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    };
  }

  private async callAnthropic(prompt: string, systemPrompt: string = '', model: string): Promise<LLMResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const baseUrl = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
    
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is required');

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

    const data = await response.json() as any;
    
    return {
      content: data.content[0].text,
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
    };
  }

  private async callGoogle(prompt: string, systemPrompt: string = '', model: string): Promise<LLMResponse> {
    const apiKey = process.env.GOOGLE_API_KEY;
    const baseUrl = process.env.GOOGLE_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';
    
    if (!apiKey) throw new Error('GOOGLE_API_KEY environment variable is required');

    // Combine system prompt and user prompt for Gemini
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

    const data = await response.json() as any;
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid response from Google API');
    }

    return {
      content: data.candidates[0].content.parts[0].text,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0,
      },
    };
  }

  async generateCompletion(prompt: string, systemPrompt: string = '', model: string = 'claude-sonnet-4-5-20250929'): Promise<LLMResponse> {
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
    } catch (error) {
      console.error(`[LLMService] Error generating completion:`, error);
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    
    if (!apiKey) throw new Error('OPENAI_API_KEY environment variable is required');

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

    const data = await response.json() as any;
    return data.data[0].embedding;
  }
}

export class MockLLMService implements ILLMService {
  async generateCompletion(prompt: string, _systemPrompt?: string, _model?: string): Promise<LLMResponse> {
    console.log(`[LLMService] Generating completion for prompt: "${prompt.substring(0, 50)}..."`);
    
    // Return a valid JSON response for the adjudication engine
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

  async generateEmbedding(text: string): Promise<number[]> {
    console.log(`[LLMService] Generating embedding for text: "${text.substring(0, 50)}..."`);
    // Return a random vector of dimension 1536 (OpenAI standard)
    return new Array(1536).fill(0).map(() => Math.random());
  }
}

// Use real LLM service if API keys are available, otherwise fall back to mock
const hasApiKeys = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GOOGLE_API_KEY;
export const llmService: ILLMService = hasApiKeys ? new RealLLMService() : new MockLLMService();
