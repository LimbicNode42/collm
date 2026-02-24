import { bench, describe, beforeAll } from 'vitest';
import { embeddingService } from '../../src/services/embedding';
import { longTermMemory } from '../../src/services/longTermMemory';
import { mockFacts, mockWorkingMemory, mockCoreContext } from '../fixtures/test-data';
import { FactSource, KeyFact } from '../../src/types/domain';

describe('Memory Compression Performance Benchmarks', () => {
  beforeAll(async () => {
    // Pre-initialize embedding service
    await embeddingService.initialize();
    
    // Pre-generate embeddings for test facts to focus on comparison speed
    for (const fact of mockFacts) {
      if (!fact.embedding) {
        fact.embedding = await embeddingService.embed(fact.content);
      }
    }
  }, 60000);

  describe('Embedding Generation', () => {
    bench('generate single embedding', async () => {
      await embeddingService.embed('User prefers Python for data science');
    });

    bench('generate embeddings for 5 texts', async () => {
      await embeddingService.embedBatch([
        'User prefers Python',
        'User lives in Sydney',
        'User works with TensorFlow',
        'User enjoys machine learning',
        'User has 5 years experience',
      ]);
    });

    bench('generate embeddings for 10 texts', async () => {
      const texts = Array.from({ length: 10 }, (_, i) => `Test fact ${i}`);
      await embeddingService.embedBatch(texts);
    });
  });

  describe('Similarity Calculation', () => {
    let embedding1: number[];
    let embedding2: number[];

    beforeAll(async () => {
      embedding1 = await embeddingService.embed('User prefers Python');
      embedding2 = await embeddingService.embed('User likes Python programming');
    });

    bench('cosine similarity (cached embeddings)', () => {
      embeddingService.cosineSimilarity(embedding1, embedding2);
    });

    bench('semantic similarity (with embedding generation)', async () => {
      await embeddingService.calculateSimilarity(
        'User prefers Python',
        'User likes programming'
      );
    });
  });

  describe('Fact Comparison', () => {
    bench('compare 5 new facts with 20 existing facts (cached)', () => {
      const existingFacts: KeyFact[] = Array.from({ length: 20 }, (_, i) => ({
        id: `fact-${i}`,
        content: `Existing fact ${i}`,
        confidence: 0.7,
        source: FactSource.LLM_INFERRED,
        extractedAt: Date.now(),
        supportingEvidence: [],
        embedding: new Array(384).fill(Math.random()), // Mock embedding
      }));

      const newFactEmbeddings = Array.from({ length: 5 }, () => 
        new Array(384).fill(Math.random())
      );

      // Simulate comparison loop
      for (const newEmbed of newFactEmbeddings) {
        for (const existing of existingFacts) {
          if (existing.embedding) {
            embeddingService.cosineSimilarity(newEmbed, existing.embedding);
          }
        }
      }
    });

    bench('compare 5 new facts with 50 existing facts (cached)', () => {
      const existingFacts: KeyFact[] = Array.from({ length: 50 }, (_, i) => ({
        id: `fact-${i}`,
        content: `Existing fact ${i}`,
        confidence: 0.7,
        source: FactSource.LLM_INFERRED,
        extractedAt: Date.now(),
        supportingEvidence: [],
        embedding: new Array(384).fill(Math.random()),
      }));

      const newFactEmbeddings = Array.from({ length: 5 }, () => 
        new Array(384).fill(Math.random())
      );

      for (const newEmbed of newFactEmbeddings) {
        for (const existing of existingFacts) {
          if (existing.embedding) {
            embeddingService.cosineSimilarity(newEmbed, existing.embedding);
          }
        }
      }
    });
  });

  describe('Confidence Updates', () => {
    const testFact: KeyFact = {
      id: 'test-1',
      content: 'Test fact',
      confidence: 0.7,
      source: FactSource.LLM_INFERRED,
      extractedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
      supportingEvidence: [],
    };

    bench('apply time decay to single fact', () => {
      longTermMemory.updateFactConfidence(testFact, {
        type: 'TIME_DECAY' as any,
        timestamp: Date.now(),
      });
    });

    bench('apply time decay to 50 facts', () => {
      const facts: KeyFact[] = Array.from({ length: 50 }, (_, i) => ({
        ...testFact,
        id: `fact-${i}`,
      }));

      facts.forEach(fact => 
        longTermMemory.updateFactConfidence(fact, {
          type: 'TIME_DECAY' as any,
          timestamp: Date.now(),
        })
      );
    });
  });

  describe('Fact Pruning', () => {
    bench('prune and sort 20 facts', () => {
      const facts: KeyFact[] = Array.from({ length: 20 }, (_, i) => ({
        id: `fact-${i}`,
        content: `Fact ${i}`,
        confidence: 0.3 + (Math.random() * 0.7),
        source: FactSource.LLM_INFERRED,
        extractedAt: Date.now(),
        supportingEvidence: [],
      }));

      longTermMemory.pruneFactsByConfidence(facts);
    });

    bench('prune and sort 60 facts (exceeds MAX_FACTS)', () => {
      const facts: KeyFact[] = Array.from({ length: 60 }, (_, i) => ({
        id: `fact-${i}`,
        content: `Fact ${i}`,
        confidence: 0.3 + (Math.random() * 0.7),
        source: FactSource.LLM_INFERRED,
        extractedAt: Date.now(),
        supportingEvidence: [],
      }));

      longTermMemory.pruneFactsByConfidence(facts);
    });
  });

  describe('Full Compression Workflow (without LLM)', () => {
    bench('embed 5 new facts', async () => {
      const newFacts = [
        'User prefers Python',
        'User lives in Sydney',
        'User works with TensorFlow',
        'User enjoys machine learning',
        'User has experience with data science',
      ];

      await embeddingService.embedBatch(newFacts);
    });

    bench('compare 5 embedded facts with 20 existing (full workflow)', async () => {
      // Simulate the key expensive part of extractAndMergeKeyFacts
      const existingFacts: KeyFact[] = await Promise.all(
        Array.from({ length: 20 }, async (_, i) => ({
          id: `fact-${i}`,
          content: `Existing fact about topic ${i}`,
          confidence: 0.7,
          source: FactSource.LLM_INFERRED,
          extractedAt: Date.now(),
          supportingEvidence: [],
          embedding: await embeddingService.embed(`Existing fact about topic ${i}`),
        }))
      );

      const newFactContents = [
        'User prefers Python',
        'User lives in Sydney', 
        'User works with TensorFlow',
        'User enjoys beaches',
        'User has ML experience',
      ];

      const newEmbeddings = await embeddingService.embedBatch(newFactContents);

      // Compare each new fact with existing facts
      for (const newEmbed of newEmbeddings) {
        for (const existing of existingFacts) {
          if (existing.embedding) {
            const similarity = embeddingService.cosineSimilarity(
              newEmbed,
              existing.embedding
            );
            if (similarity >= 0.75) {
              break; // Found similar fact
            }
          }
        }
      }
    });
  });
});
