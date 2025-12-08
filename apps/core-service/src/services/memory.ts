// LangChain integration for future enhancement
import { Node, NodeMemory, Message } from '../types/domain';
import { llmService } from './llm';

export interface IMemoryManager {
  /**
   * Adds a new message to node memory and handles compression if needed
   */
  addMessage(node: Node, message: Message, response?: string): Promise<NodeMemory>;
  
  /**
   * Gets the full context for LLM generation (core + working memory + recent messages)
   */
  getContext(node: Node, recentMessages: Message[]): Promise<string>;
  
  /**
   * Determines if memory should be compressed based on message count and token limits
   */
  shouldCompress(memory: NodeMemory): boolean;
  
  /**
   * Compresses working memory while preserving core context and key facts
   */
  compressMemory(node: Node, recentMessages: Message[]): Promise<NodeMemory>;
  
  /**
   * Initializes memory for a new node
   */
  initializeMemory(topic: string, initialDescription: string): NodeMemory;
}

export class HierarchicalMemoryManager implements IMemoryManager {
  private readonly WORKING_MEMORY_LIMIT = 20; // Messages before compression
  private readonly MAX_TOKEN_ESTIMATE = 4000; // Rough token limit

  initializeMemory(topic: string, initialDescription: string): NodeMemory {
    return {
      coreContext: `Topic: ${topic}\nInitial Context: ${initialDescription}`,
      workingMemory: `Starting conversation about: ${topic}`,
      keyFacts: [],
      messageCount: 0,
      lastSummaryAt: 0
    };
  }

  async addMessage(node: Node, message: Message, response?: string): Promise<NodeMemory> {
    const updatedMemory = { ...node.memory };
    updatedMemory.messageCount += 1;

    // Add to working memory
    const messageText = `User: ${message.content}`;
    const responseText = response ? `\nAssistant: ${response}` : '';
    
    if (updatedMemory.workingMemory) {
      updatedMemory.workingMemory += `\n\n${messageText}${responseText}`;
    } else {
      updatedMemory.workingMemory = `${messageText}${responseText}`;
    }

    // Check if we need to compress
    if (this.shouldCompress(updatedMemory)) {
      return await this.compressMemory(
        { ...node, memory: updatedMemory }, 
        [] // We'll get recent messages from the database
      );
    }

    return updatedMemory;
  }

  shouldCompress(memory: NodeMemory): boolean {
    const messagesSinceLastSummary = memory.messageCount - memory.lastSummaryAt;
    const estimatedTokens = this.estimateTokens(memory.workingMemory);
    
    return messagesSinceLastSummary >= this.WORKING_MEMORY_LIMIT || 
           estimatedTokens > this.MAX_TOKEN_ESTIMATE;
  }

  async compressMemory(node: Node, _recentMessages: Message[]): Promise<NodeMemory> {
    const memory = node.memory;
    
    // Create compression prompt
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
      const response = await llmService.generateCompletion(
        compressionPrompt,
        "You are a precise memory compression system. Always respond with valid JSON.",
        node.model
      );

      const compressionResult = JSON.parse(response.content);
      
      return {
        coreContext: memory.coreContext, // Never changes
        workingMemory: compressionResult.compressedSummary,
        keyFacts: [
          ...memory.keyFacts,
          ...compressionResult.keyFacts.filter((fact: string) => 
            !memory.keyFacts.includes(fact)
          )
        ],
        messageCount: memory.messageCount,
        lastSummaryAt: memory.messageCount
      };
    } catch (error) {
      console.error('[MemoryManager] Compression failed:', error);
      // Fallback: simple truncation
      return {
        ...memory,
        workingMemory: this.truncateWorkingMemory(memory.workingMemory),
        lastSummaryAt: memory.messageCount
      };
    }
  }

  async getContext(node: Node, recentMessages: Message[]): Promise<string> {
    const memory = node.memory;
    
    let context = `${memory.coreContext}\n\n`;
    
    if (memory.keyFacts.length > 0) {
      context += `Key Facts:\n${memory.keyFacts.map(fact => `- ${fact}`).join('\n')}\n\n`;
    }
    
    context += `Recent Context:\n${memory.workingMemory}`;
    
    // Add very recent messages if not already in working memory
    if (recentMessages.length > 0) {
      const recentText = recentMessages
        .slice(-5) // Last 5 messages
        .map(msg => `- ${msg.content}`)
        .join('\n');
      context += `\n\nLatest Messages:\n${recentText}`;
    }
    
    return context;
  }

  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private truncateWorkingMemory(workingMemory: string): string {
    const lines = workingMemory.split('\n');
    // Keep last half of the conversation
    const keepLines = Math.floor(lines.length / 2);
    return lines.slice(-keepLines).join('\n');
  }
}

export const memoryManager = new HierarchicalMemoryManager();