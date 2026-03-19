// LangChain integration for future enhancement
import { Node, NodeMemory, Message, KeyFact, FactSource } from '../types/domain';
import { longTermMemory } from './longTermMemory';

export interface IMemoryManager {
  /**
   * Adds a new message to node memory and handles compression if needed.
   * NOTE: prefer addMessageFast() + background compressMemory() for better UX.
   */
  addMessage(node: Node, message: Message, response?: string): Promise<NodeMemory>;

  /**
   * Fast message add: appends to working memory WITHOUT triggering compression.
   * Compression should be triggered separately in the background.
   */
  addMessageFast(node: Node, message: Message, response?: string): Promise<NodeMemory>;
  
  /**
   * Gets the full context for LLM generation (core + working memory + recent messages)
   */
  getContext(node: Node, recentMessages: Message[]): Promise<string>;
  
  /**
   * Determines if memory should be compressed based on message count and token limits
   */
  shouldCompress(memory: NodeMemory): boolean;
  
  /**
   * Compresses working memory while preserving core context and key facts.
   * Uses a local rolling-window approach for working memory (no LLM call) plus
   * one LLM call to extract/merge key facts.
   */
  compressMemory(node: Node, recentMessages: Message[]): Promise<NodeMemory>;
  
  /**
   * Initializes memory for a new node
   */
  initializeMemory(topic: string, initialDescription: string): NodeMemory;
}

export class HierarchicalMemoryManager implements IMemoryManager {
  // Increased from 3 → 8 to reduce compression frequency
  private readonly WORKING_MEMORY_LIMIT = 8;
  private readonly MAX_TOKEN_ESTIMATE = 4000;
  // Hard character cap; once exceeded we trim inline during addMessageFast
  private readonly MAX_WORKING_MEMORY_CHARS = 8000;
  // How much of the working memory to keep after a rolling-window compress
  private readonly ROLLING_WINDOW_KEEP_RATIO = 0.6;

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

  /**
   * Legacy helper kept for compatibility with core.ts updateNodeState().
   * For the main chat path, use addMessageFast() + background compressMemory().
   */
  async addMessage(node: Node, message: Message, response?: string): Promise<NodeMemory> {
    const updatedMemory = await this.addMessageFast(node, message, response);

    if (this.shouldCompress(updatedMemory)) {
      return await this.compressMemory(
        { ...node, memory: updatedMemory }, 
        []
      );
    }

    return updatedMemory;
  }

  /**
   * Fast path: append message to working memory without running compression.
   * Applies a simple character-based trim if working memory grows too large.
   * Compression should be triggered separately in the background.
   */
  async addMessageFast(node: Node, message: Message, response?: string): Promise<NodeMemory> {
    const updatedMemory = { ...node.memory };
    updatedMemory.messageCount += 1;

    const messageText = `User: ${message.content}`;
    const responseText = response ? `\nAssistant: ${response}` : '';
    
    if (updatedMemory.workingMemory) {
      updatedMemory.workingMemory += `\n\n${messageText}${responseText}`;
    } else {
      updatedMemory.workingMemory = `${messageText}${responseText}`;
    }

    // Inline trim if working memory exceeds hard cap (no LLM call needed)
    if (updatedMemory.workingMemory.length > this.MAX_WORKING_MEMORY_CHARS) {
      updatedMemory.workingMemory = this.rollingWindowCompress(updatedMemory.workingMemory);
    }

    return updatedMemory;
  }

  shouldCompress(memory: NodeMemory): boolean {
    const messagesSinceLastSummary = memory.messageCount - memory.lastSummaryAt;
    const estimatedTokens = this.estimateTokens(memory.workingMemory);
    
    return messagesSinceLastSummary >= this.WORKING_MEMORY_LIMIT || 
           estimatedTokens > this.MAX_TOKEN_ESTIMATE;
  }

  /**
   * Compresses memory using:
   * - One LLM call to extract/merge key facts (via longTermMemory service)
   * - Rolling-window trim for working memory (no LLM call — free & instant)
   *
   * This is designed to run in the background so it never blocks the user response.
   */
  async compressMemory(node: Node, _recentMessages: Message[]): Promise<NodeMemory> {
    const memory = node.memory;
    
    console.log(`[Memory] Compressing memory for node ${node.id}. Current facts: ${memory.keyFacts.length}`);
    
    // Step 1: Extract & merge key facts (1 LLM call, runs in background)
    const updatedKeyFacts = await longTermMemory.extractAndMergeKeyFacts(
      memory.keyFacts,
      memory.workingMemory,
      memory.coreContext
    );

    // Step 2: Rolling-window compress working memory (no LLM call — fast & free)
    // Key facts already capture the important insights from older context.
    const compressedWorking = this.rollingWindowCompress(memory.workingMemory);
    
    console.log(`[Memory] Compression complete. Facts: ${memory.keyFacts.length} → ${updatedKeyFacts.length}`);
    
    return {
      coreContext: memory.coreContext,
      workingMemory: compressedWorking,
      keyFacts: updatedKeyFacts,
      messageCount: memory.messageCount,
      lastSummaryAt: memory.messageCount
    };
  }

  async getContext(node: Node, recentMessages: Message[]): Promise<string> {
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

  /**
   * Keeps the most recent portion of working memory.
   * Much faster than LLM summarization and costs nothing.
   */
  private rollingWindowCompress(workingMemory: string): string {
    const lines = workingMemory.split('\n');
    const keepLines = Math.ceil(lines.length * this.ROLLING_WINDOW_KEEP_RATIO);
    return lines.slice(-keepLines).join('\n');
  }

  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}

export const memoryManager = new HierarchicalMemoryManager();
