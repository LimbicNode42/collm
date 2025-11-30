import { Node, Message } from '@collm/types';
import { llmService } from './llm';
import { vectorStore } from './vectorStore';
import { prismaCore } from '@collm/database';

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
}

export class LLMCoreEngine implements ICoreEngine {
  async createNode(topic: string, initialDescription: string, model: string = 'claude-sonnet-4-5-20250929'): Promise<Node> {
    // Generate initial state using LLM with the specified model
    const prompt = `Initialize a conversation state for the topic: "${topic}". Description: "${initialDescription}". Provide a concise summary of the starting point.`;
    const response = await llmService.generateCompletion(prompt, '', model);
    
    const node = await prismaCore.node.create({
      data: {
        topic,
        description: initialDescription,
        state: response.content,
        model,
        version: 1,
      }
    });

    const domainNode: Node = {
      id: node.id,
      topic: node.topic,
      description: node.description || undefined,
      state: node.state,
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
    });

    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    console.log(`[CoreEngine] Updating state for node ${nodeId} with ${newMessages.length} new messages using model "${node.model}"`);
    
    const messagesText = newMessages.map(m => `- ${m.content}`).join('\n');
    const prompt = `
Current Conversation State:
${node.state}

New Accepted Messages:
${messagesText}

Task: Update the conversation state to incorporate the new information. Keep the summary concise but comprehensive.
    `;

    const response = await llmService.generateCompletion(prompt, '', node.model);
    
    const updatedNode = await prismaCore.node.update({
      where: { id: nodeId },
      data: {
        state: response.content,
        version: { increment: 1 },
      }
    });
    
    const domainNode: Node = {
      id: updatedNode.id,
      topic: updatedNode.topic,
      description: updatedNode.description || undefined,
      state: updatedNode.state,
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
    });

    if (!node) return null;

    return {
      id: node.id,
      topic: node.topic,
      description: node.description || undefined,
      state: node.state,
      model: node.model,
      version: node.version,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
    };
  }

  async listNodes(): Promise<Node[]> {
    const nodes = await prismaCore.node.findMany({
      orderBy: { updatedAt: 'desc' }
    });

    return nodes.map(node => ({
      id: node.id,
      topic: node.topic,
      description: node.description || undefined,
      state: node.state,
      model: node.model,
      version: node.version,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
    }));
  }
}

export const coreEngine = new LLMCoreEngine();
