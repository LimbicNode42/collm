import { prisma } from '@collm/database';

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

export class PrismaVectorStore implements IVectorStore {
  async addNode(nodeId: string, text: string): Promise<void> {
    const embedding = await this.generateEmbedding(text);
    const vectorString = `[${embedding.join(',')}]`;
    
    // Update the node with the embedding
    await prisma.$executeRaw`
      UPDATE "Node"
      SET embedding = ${vectorString}::vector
      WHERE id = ${nodeId}
    `;
    console.log(`[VectorStore] Updated embedding for node ${nodeId}`);
  }

  async search(query: string, limit: number = 5): Promise<VectorSearchResult[]> {
    const embedding = await this.generateEmbedding(query);
    const vectorString = `[${embedding.join(',')}]`;

    // Perform similarity search using cosine distance (<=> operator)
    // Note: We select id, topic, description to return as metadata
    const results = await prisma.$queryRaw<any[]>`
      SELECT id, topic, description, embedding <=> ${vectorString}::vector as "_distance"
      FROM "Node"
      ORDER BY "_distance" ASC
      LIMIT ${limit}
    `;

    return results.map((r: any) => ({
      nodeId: r.id,
      score: 1 - (r._distance || 0), // Convert distance to similarity score (approx)
      metadata: { topic: r.topic, description: r.description }
    }));
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    // TODO: Replace with actual OpenAI call
    // For now, return a random vector of dimension 1536
    console.log(`[VectorStore] Generating mock embedding for: "${text.substring(0, 20)}..."`);
    return new Array(1536).fill(0).map(() => Math.random());
  }
}

export const vectorStore = new PrismaVectorStore();
