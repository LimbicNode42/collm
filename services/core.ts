import { Node, Message } from '../types';

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

export class MockCoreEngine implements ICoreEngine {
  // In-memory store for mock purposes
  private nodes: Map<string, Node> = new Map();

  async createNode(topic: string, initialDescription: string): Promise<Node> {
    const id = Math.random().toString(36).substring(7);
    const newNode: Node = {
      id,
      topic,
      description: initialDescription,
      state: `Initial state for topic: ${topic}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.nodes.set(id, newNode);
    console.log(`[CoreEngine] Created node ${id} for topic "${topic}"`);
    return newNode;
  }

  async updateNodeState(nodeId: string, newMessages: Message[]): Promise<Node> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    // Simulate LLM processing to update state
    console.log(`[CoreEngine] Updating state for node ${nodeId} with ${newMessages.length} new messages`);
    
    const updatedState = `${node.state}\n[Updated with ${newMessages.length} messages at ${new Date().toISOString()}]`;
    
    const updatedNode = {
      ...node,
      state: updatedState,
      updatedAt: new Date(),
    };
    this.nodes.set(nodeId, updatedNode);
    
    return updatedNode;
  }

  async getNode(nodeId: string): Promise<Node | null> {
    return this.nodes.get(nodeId) || null;
  }
}

export const coreEngine = new MockCoreEngine();
