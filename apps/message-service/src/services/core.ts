import { Node, Message } from '@collm/types';
import { llmService } from './llm';
import { vectorStore } from './vectorStore';

export interface ICoreEngine {
  /**
   * Creates a new conversation node (thread).
   */
  createNode(topic: string, initialDescription: string): Promise<Node>;

  /**
   * Updates the state of a node based on new accepted messages.
   * This is where the LLM would summarize the conversation or evolve the state.
   */
  updateNodeState(nodeId: string, newMessages: Message[]): Promise<Node>;
  
  /**
   * Retrieves a node by ID.
   */
  getNode(nodeId: string): Promise<Node | null>;
}

export class LLMCoreEngine implements ICoreEngine {
  // In-memory store for mock purposes (replace with DB calls in production)
  private nodes: Map<string, Node> = new Map();

  async createNode(topic: string, initialDescription: string): Promise<Node> {
    const id = Math.random().toString(36).substring(7);
    
    // Generate initial state using LLM
    const prompt = `Initialize a conversation state for the topic: "${topic}". Description: "${initialDescription}". Provide a concise summary of the starting point.`;
    const response = await llmService.generateCompletion(prompt);
    
    const newNode: Node = {
      id,
      topic,
      description: initialDescription,
      state: response.content,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.nodes.set(id, newNode);
    
    // Add to vector store for discovery
    await vectorStore.addNode(id, `${topic}: ${initialDescription}`);
    
    console.log(`[CoreEngine] Created node ${id} for topic "${topic}"`);
    return newNode;
  }

  async updateNodeState(nodeId: string, newMessages: Message[]): Promise<Node> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    console.log(`[CoreEngine] Updating state for node ${nodeId} with ${newMessages.length} new messages`);
    
    const messagesText = newMessages.map(m => `- ${m.content}`).join('\n');
    const prompt = `
Current Conversation State:
${node.state}

New Accepted Messages:
${messagesText}

Task: Update the conversation state to incorporate the new information. Keep the summary concise but comprehensive.
    `;

    const response = await llmService.generateCompletion(prompt);
    
    const updatedNode = {
      ...node,
      state: response.content,
      version: node.version + 1,
      updatedAt: new Date(),
    };
    this.nodes.set(nodeId, updatedNode);
    
    return updatedNode;
  }

  async getNode(nodeId: string): Promise<Node | null> {
    return this.nodes.get(nodeId) || null;
  }
}

export const coreEngine = new LLMCoreEngine();
