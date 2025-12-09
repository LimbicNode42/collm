import { Node, Message, NodeMemory } from '../types/domain';
import { llmService } from './llm';
import { vectorStore } from './vectorStore';
import { memoryManager } from './memory';
import { prismaCore, CoreTypes } from '@collm/database';
import { parseKeyFactsFromDb, serializeKeyFactsForDb } from '../utils/factConversion';

export interface ICoreEngine {
  /**
   * Creates a new conversation node (thread).
   */
  createNode(topic: string, initialDescription: string, model?: string): Promise<Node>;

  /**
   * Updates the state of a node based on new accepted messages.
   * This is where the LLM would summarize the conversation or evolve the state.
   */
  updateNodeState(nodeId: string, newMessages: Message[]): Promise<Node>;
  
  /**
   * Retrieves a node by ID.
   */
  getNode(nodeId: string): Promise<Node | null>;

  /**
   * Lists all available nodes.
   */
  listNodes(): Promise<Node[]>;
  
  /**
   * Updates the memory of a node directly.
   */
  updateNodeMemory(nodeId: string, memory: NodeMemory): Promise<Node>;
}

export class LLMCoreEngine implements ICoreEngine {
  async createNode(topic: string, initialDescription: string, model: string = 'claude-sonnet-4-5-20250929'): Promise<Node> {
    // Initialize hierarchical memory
    const initialMemory = memoryManager.initializeMemory(topic, initialDescription);
    
    const node = await prismaCore.node.create({
      data: {
        topic,
        description: initialDescription,
        coreContext: initialMemory.coreContext,
        workingMemory: initialMemory.workingMemory,
        keyFacts: serializeKeyFactsForDb(initialMemory.keyFacts),
        messageCount: initialMemory.messageCount,
        lastSummaryAt: initialMemory.lastSummaryAt,
        model,
        version: 1,
      }
    });

    const domainNode: Node = {
      id: node.id,
      topic: node.topic,
      description: node.description || undefined,
      memory: {
        coreContext: node.coreContext,
        workingMemory: node.workingMemory,
        keyFacts: parseKeyFactsFromDb(node.keyFacts),
        messageCount: node.messageCount,
        lastSummaryAt: node.lastSummaryAt,
      },
      model: node.model,
      version: node.version,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
    };
    
    // Add to vector store for discovery
    await vectorStore.addNode(node.id, `${topic}: ${initialDescription}`);
    
    console.log(`[CoreEngine] Created node ${node.id} for topic "${topic}" using model "${model}"`);
    return domainNode;
  }

  async updateNodeState(nodeId: string, newMessages: Message[]): Promise<Node> {
    const node = await prismaCore.node.findUnique({
      where: { id: nodeId }
    }) as CoreTypes.Node | null;

    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    console.log(`[CoreEngine] Updating memory for node ${nodeId} with ${newMessages.length} new messages using model "${node.model}"`);
    
    // Convert database node to domain node for memory operations
    const currentNode: Node = {
      id: node.id,
      topic: node.topic,
      description: node.description || undefined,
      memory: {
        coreContext: node.coreContext,
        workingMemory: node.workingMemory,
        keyFacts: parseKeyFactsFromDb(node.keyFacts),
        messageCount: node.messageCount,
        lastSummaryAt: node.lastSummaryAt,
      },
      model: node.model,
      version: node.version,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
    };

    // Process each new message through memory manager
    let updatedMemory = currentNode.memory;
    for (const message of newMessages) {
      // Get context and generate response
      const context = await memoryManager.getContext(currentNode, []);
      const prompt = `${context}\n\nNew message: ${message.content}\n\nRespond thoughtfully based on the conversation context.`;
      const response = await llmService.generateCompletion(prompt, '', node.model);
      
      // Update memory with the new message and response
      updatedMemory = await memoryManager.addMessage(
        { ...currentNode, memory: updatedMemory }, 
        message, 
        response.content
      );
    }
    
    // Update database with new memory state
    const updatedNode = await prismaCore.node.update({
      where: { id: nodeId },
      data: {
        coreContext: updatedMemory.coreContext,
        workingMemory: updatedMemory.workingMemory,
        keyFacts: serializeKeyFactsForDb(updatedMemory.keyFacts),
        messageCount: updatedMemory.messageCount,
        lastSummaryAt: updatedMemory.lastSummaryAt,
        version: { increment: 1 },
      }
    }) as CoreTypes.Node;
    
    const domainNode: Node = {
      id: updatedNode.id,
      topic: updatedNode.topic,
      description: updatedNode.description || undefined,
      memory: {
        coreContext: updatedNode.coreContext,
        workingMemory: updatedNode.workingMemory,
        keyFacts: parseKeyFactsFromDb(updatedNode.keyFacts),
        messageCount: updatedNode.messageCount,
        lastSummaryAt: updatedNode.lastSummaryAt,
      },
      model: updatedNode.model,
      version: updatedNode.version,
      createdAt: updatedNode.createdAt,
      updatedAt: updatedNode.updatedAt,
    };

    return domainNode;
  }

  async getNode(nodeId: string): Promise<Node | null> {
    const node = await prismaCore.node.findUnique({
      where: { id: nodeId }
    }) as CoreTypes.Node | null;

    if (!node) return null;

    return {
      id: node.id,
      topic: node.topic,
      description: node.description || undefined,
      memory: {
        coreContext: node.coreContext,
        workingMemory: node.workingMemory,
        keyFacts: parseKeyFactsFromDb(node.keyFacts),
        messageCount: node.messageCount,
        lastSummaryAt: node.lastSummaryAt,
      },
      model: node.model,
      version: node.version,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
    };
  }

  async listNodes(): Promise<Node[]> {
    const nodes = await prismaCore.node.findMany({
      orderBy: { updatedAt: 'desc' }
    }) as CoreTypes.Node[];

    return nodes.map(node => ({
      id: node.id,
      topic: node.topic,
      description: node.description || undefined,
      memory: {
        coreContext: node.coreContext,
        workingMemory: node.workingMemory,
        keyFacts: parseKeyFactsFromDb(node.keyFacts),
        messageCount: node.messageCount,
        lastSummaryAt: node.lastSummaryAt,
      },
      model: node.model,
      version: node.version,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
    }));
  }

  async updateNodeMemory(nodeId: string, memory: NodeMemory): Promise<Node> {
    const updatedNode = await prismaCore.node.update({
      where: { id: nodeId },
      data: {
        coreContext: memory.coreContext,
        workingMemory: memory.workingMemory,
        keyFacts: serializeKeyFactsForDb(memory.keyFacts),
        messageCount: memory.messageCount,
        lastSummaryAt: memory.lastSummaryAt,
        updatedAt: new Date(),
      }
    }) as CoreTypes.Node;

    return {
      id: updatedNode.id,
      topic: updatedNode.topic,
      description: updatedNode.description || undefined,
      memory: {
        coreContext: updatedNode.coreContext,
        workingMemory: updatedNode.workingMemory,
        keyFacts: parseKeyFactsFromDb(updatedNode.keyFacts),
        messageCount: updatedNode.messageCount,
        lastSummaryAt: updatedNode.lastSummaryAt,
      },
      model: updatedNode.model,
      version: updatedNode.version,
      createdAt: updatedNode.createdAt,
      updatedAt: updatedNode.updatedAt,
    };
  }
}

export const coreEngine = new LLMCoreEngine();
