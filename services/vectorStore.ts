export interface VectorSearchResult {
  nodeId: string;
  score: number;
  metadata?: Record<string, any>;
}

export interface IVectorStore {
  /**
   * Adds a node's topic/description to the vector store for similarity search.
   * @param nodeId The ID of the node
   * @param text The text content to embed and store (e.g., topic + description)
   */
  addNode(nodeId: string, text: string): Promise<void>;

  /**
   * Searches for nodes similar to the given query text.
   * @param query The query text
   * @param limit Max number of results
   */
  search(query: string, limit?: number): Promise<VectorSearchResult[]>;
}

export class MockVectorStore implements IVectorStore {
  private store: Map<string, string> = new Map();

  async addNode(nodeId: string, text: string): Promise<void> {
    console.log(`[VectorStore] Adding node ${nodeId} with text: "${text}"`);
    this.store.set(nodeId, text);
  }

  async search(query: string, limit: number = 5): Promise<VectorSearchResult[]> {
    console.log(`[VectorStore] Searching for: "${query}"`);
    
    // Mock implementation: just return random results from stored nodes
    const results: VectorSearchResult[] = [];
    const keys = Array.from(this.store.keys());
    
    for (let i = 0; i < Math.min(limit, keys.length); i++) {
      // Randomly pick a node
      const randomId = keys[Math.floor(Math.random() * keys.length)];
      results.push({
        nodeId: randomId,
        score: Math.random(), // Random similarity score
        metadata: { text: this.store.get(randomId) }
      });
    }
    
    return results.sort((a, b) => b.score - a.score);
  }
}

export const vectorStore = new MockVectorStore();
