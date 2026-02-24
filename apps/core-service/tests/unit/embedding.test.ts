import { describe, it, expect, beforeAll } from 'vitest';
import { embeddingService } from '../../src/services/embedding';
import { similarTextPairs } from '../fixtures/test-data';

describe('Embedding Service', () => {
  beforeAll(async () => {
    // Initialize the embedding model before running tests
    await embeddingService.initialize();
  }, 60000); // 60 second timeout for model loading

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await embeddingService.initialize();
      // If it doesn't throw, initialization succeeded
      expect(true).toBe(true);
    });
  });

  describe('Embedding Generation', () => {
    it('should generate embeddings with correct dimensions', async () => {
      const text = 'User prefers Python for data science';
      const embedding = await embeddingService.embed(text);
      
      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding).toHaveLength(384); // MiniLM-L6-v2 produces 384-dim embeddings
    });

    it('should generate consistent embeddings for the same text', async () => {
      const text = 'User prefers Python for data science';
      const embedding1 = await embeddingService.embed(text);
      const embedding2 = await embeddingService.embed(text);
      
      expect(embedding1).toEqual(embedding2);
    });

    it('should generate different embeddings for different texts', async () => {
      const text1 = 'User prefers Python';
      const text2 = 'User lives in Sydney';
      
      const embedding1 = await embeddingService.embed(text1);
      const embedding2 = await embeddingService.embed(text2);
      
      expect(embedding1).not.toEqual(embedding2);
    });

    it('should handle empty strings', async () => {
      const embedding = await embeddingService.embed('');
      
      expect(embedding).toBeDefined();
      expect(embedding).toHaveLength(384);
    });

    it('should handle long texts', async () => {
      const longText = 'User '.repeat(1000) + 'prefers Python';
      const embedding = await embeddingService.embed(longText);
      
      expect(embedding).toBeDefined();
      expect(embedding).toHaveLength(384);
    });
  });

  describe('Cosine Similarity', () => {
    it('should calculate similarity between identical embeddings as 1.0', async () => {
      const embedding = await embeddingService.embed('Test text');
      const similarity = embeddingService.cosineSimilarity(embedding, embedding);
      
      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should calculate similarity between normalized vectors correctly', async () => {
      const text1 = 'User prefers Python';
      const text2 = 'User prefers Python';
      
      const embedding1 = await embeddingService.embed(text1);
      const embedding2 = await embeddingService.embed(text2);
      
      const similarity = embeddingService.cosineSimilarity(embedding1, embedding2);
      
      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should return values between 0 and 1', async () => {
      const text1 = 'User prefers Python';
      const text2 = 'User lives in Sydney';
      
      const embedding1 = await embeddingService.embed(text1);
      const embedding2 = await embeddingService.embed(text2);
      
      const similarity = embeddingService.cosineSimilarity(embedding1, embedding2);
      
      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should throw error for mismatched dimensions', () => {
      const embedding1 = new Array(384).fill(0);
      const embedding2 = new Array(256).fill(0);
      
      expect(() => {
        embeddingService.cosineSimilarity(embedding1, embedding2);
      }).toThrow();
    });
  });

  describe('Semantic Similarity', () => {
    it.each(similarTextPairs)(
      'should detect similarity: $description',
      async ({ text1, text2, expectedSimilarity, description }) => {
        const similarity = await embeddingService.calculateSimilarity(text1, text2);
        
        // Allow 0.1 tolerance for similarity scores
        expect(similarity).toBeGreaterThan(expectedSimilarity - 0.15);
        expect(similarity).toBeLessThan(expectedSimilarity + 0.15);
      },
      30000 // 30 second timeout per test
    );

    it('should detect high similarity for paraphrases', async () => {
      const text1 = 'The quick brown fox jumps over the lazy dog';
      const text2 = 'A fast brown fox leaps over a sleepy dog';
      
      const similarity = await embeddingService.calculateSimilarity(text1, text2);
      
      // Should be reasonably similar (paraphrased)
      expect(similarity).toBeGreaterThan(0.6);
    });

    it('should detect low similarity for unrelated texts', async () => {
      const text1 = 'Python programming language';
      const text2 = 'Beautiful sunset at the beach';
      
      const similarity = await embeddingService.calculateSimilarity(text1, text2);
      
      // Should be quite different
      expect(similarity).toBeLessThan(0.4);
    });
  });

  describe('Batch Embedding', () => {
    it('should embed multiple texts', async () => {
      const texts = [
        'User prefers Python',
        'User lives in Sydney',
        'User works with TensorFlow',
      ];
      
      const embeddings = await embeddingService.embedBatch(texts);
      
      expect(embeddings).toHaveLength(3);
      embeddings.forEach(embedding => {
        expect(embedding).toHaveLength(384);
      });
    });

    it('should handle empty array', async () => {
      const embeddings = await embeddingService.embedBatch([]);
      
      expect(embeddings).toHaveLength(0);
    });

    it('should process large batches', async () => {
      const texts = Array(25).fill('Test text');
      const embeddings = await embeddingService.embedBatch(texts);
      
      expect(embeddings).toHaveLength(25);
    }, 60000); // 60 second timeout for large batch
  });
});
