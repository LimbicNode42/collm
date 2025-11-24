"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vectorStore = exports.PrismaVectorStore = void 0;
const database_1 = require("@collm/database");
class PrismaVectorStore {
    async addNode(nodeId, text) {
        const embedding = await this.generateEmbedding(text);
        const vectorString = `[${embedding.join(',')}]`;
        await database_1.prisma.$executeRaw `
      UPDATE "Node"
      SET embedding = ${vectorString}::vector
      WHERE id = ${nodeId}
    `;
        console.log(`[VectorStore] Updated embedding for node ${nodeId}`);
    }
    async search(query, limit = 5) {
        const embedding = await this.generateEmbedding(query);
        const vectorString = `[${embedding.join(',')}]`;
        const results = await database_1.prisma.$queryRaw `
      SELECT id, topic, description, embedding <=> ${vectorString}::vector as "_distance"
      FROM "Node"
      ORDER BY "_distance" ASC
      LIMIT ${limit}
    `;
        return results.map((r) => ({
            nodeId: r.id,
            score: 1 - (r._distance || 0),
            metadata: { topic: r.topic, description: r.description }
        }));
    }
    async generateEmbedding(text) {
        console.log(`[VectorStore] Generating mock embedding for: "${text.substring(0, 20)}..."`);
        return new Array(1536).fill(0).map(() => Math.random());
    }
}
exports.PrismaVectorStore = PrismaVectorStore;
exports.vectorStore = new PrismaVectorStore();
//# sourceMappingURL=vectorStore.js.map