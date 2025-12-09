// LangChain integration for future enhancement
import { Node, NodeMemory, Message, KeyFact, FactSource } from '../types/domain';
import { llmService } from './llm';
import { longTermMemory } from './longTermMemory';

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
  private readonly WORKING_MEMORY_LIMIT = 3; // Messages before compression
  private readonly MAX_TOKEN_ESTIMATE = 4000; // Rough token limit

  initializeMemory(topic: string, initialDescription: string): NodeMemory {
    const initialFacts: KeyFact[] = [];
    
    // Create an initial fact from the description if provided
    if (initialDescription && initialDescription.trim().length > 0) {
      initialFacts.push({
        id: `init-${Date.now()}`,
        content: initialDescription,
        confidence: this.CONFIDENCE_WEIGHTS[FactSource.USER_STATED],
        source: FactSource.USER_STATED,
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

  private readonly CONFIDENCE_WEIGHTS = {
    [FactSource.USER_STATED]: 0.9,
    [FactSource.USER_CONFIRMED]: 1.0,
    [FactSource.LLM_INFERRED]: 0.6,
    [FactSource.IMPLICIT]: 0.4
  };

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
    
    console.log(`[Memory] Compressing memory for node ${node.id}. Current facts: ${memory.keyFacts.length}`);
    
    // Step 1: Use long-term memory service to extract and merge key facts
    const updatedKeyFacts = await longTermMemory.extractAndMergeKeyFacts(
      memory.keyFacts,
      memory.workingMemory,
      memory.coreContext
    );

    // Step 2: Create compressed summary of working memory
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
      const response = await llmService.generateCompletion(
        compressionPrompt,
        "You are a memory compression system. Create concise, informative summaries.",
        node.model
      );

      const compressedSummary = response.content.trim();
      
      console.log(`[Memory] Compression complete. Facts: ${memory.keyFacts.length} → ${updatedKeyFacts.length}`);
      
      return {
        coreContext: memory.coreContext,
        workingMemory: compressedSummary,
        keyFacts: updatedKeyFacts,
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
      context += `Key Facts:\n${memory.keyFacts
        .filter(fact => fact.confidence > 0.3) // Only include facts with reasonable confidence
        .sort((a, b) => b.confidence - a.confidence) // Sort by confidence
        .slice(0, 10) // Limit to top 10 facts
        .map(fact => `- ${fact.content} (confidence: ${fact.confidence.toFixed(2)})`)
        .join('\n')}\n\n`;
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