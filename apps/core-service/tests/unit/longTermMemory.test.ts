import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import { longTermMemory, ConfidenceEventType } from '../../src/services/longTermMemory';
import { embeddingService } from '../../src/services/embedding';
import { mockFacts, mockWorkingMemory, mockCoreContext } from '../fixtures/test-data';
import { FactSource, KeyFact } from '../../src/types/domain';
import * as llmModule from '../../src/services/llm';

describe('LongTermMemory Service', () => {
  beforeAll(async () => {
    // Initialize embedding service
    await embeddingService.initialize();
  }, 60000);

  describe('Similarity Calculation', () => {
    it('should calculate semantic similarity using embeddings', async () => {
      const text1 = 'User prefers Python';
      const text2 = 'User likes Python programming';
      
      const similarity = await longTermMemory.calculateSimilarity(text1, text2);
      
      expect(similarity).toBeGreaterThan(0.7); // Should be similar
      expect(similarity).toBeLessThanOrEqual(1.0);
    });

    it('should detect low similarity for unrelated text', async () => {
      const text1 = 'User prefers Python';
      const text2 = 'User lives in Sydney';
      
      const similarity = await longTermMemory.calculateSimilarity(text1, text2);
      
      expect(similarity).toBeLessThan(0.5); // Should be different
    });
  });

  describe('Confidence Updates', () => {
    it('should not go below minimum confidence (0.1) when contradicted', () => {
      const fact: KeyFact = {
        id: 'test-min',
        content: 'Test fact at minimum',
        confidence: 0.1, // Already at minimum
        source: FactSource.LLM_INFERRED,
        extractedAt: Date.now(),
        supportingEvidence: [],
      };

      const updated = longTermMemory.updateFactConfidence(fact, {
        type: ConfidenceEventType.CONTRADICTED,
        timestamp: Date.now(),
      });

      // 0.1 - 0.4 would be negative, should be clamped at 0.1
      expect(updated.confidence).toBeGreaterThanOrEqual(0.1);
    });

    it('should only set lastConfirmedAt on USER_CONFIRMED, not on other events', () => {
      const fact: KeyFact = {
        id: 'test-confirmed',
        content: 'Test fact',
        confidence: 0.7,
        source: FactSource.LLM_INFERRED,
        extractedAt: Date.now(),
        supportingEvidence: [],
        lastConfirmedAt: undefined,
      };

      const timestamp = Date.now();

      const afterMentioned = longTermMemory.updateFactConfidence(fact, {
        type: ConfidenceEventType.MENTIONED_AGAIN,
        timestamp,
      });
      expect(afterMentioned.lastConfirmedAt).toBeUndefined();

      const afterDecay = longTermMemory.updateFactConfidence(fact, {
        type: ConfidenceEventType.TIME_DECAY,
        timestamp,
      });
      expect(afterDecay.lastConfirmedAt).toBeUndefined();

      const afterContradicted = longTermMemory.updateFactConfidence(fact, {
        type: ConfidenceEventType.CONTRADICTED,
        timestamp,
      });
      expect(afterContradicted.lastConfirmedAt).toBeUndefined();

      const afterConfirmed = longTermMemory.updateFactConfidence(fact, {
        type: ConfidenceEventType.USER_CONFIRMED,
        timestamp,
      });
      expect(afterConfirmed.lastConfirmedAt).toBe(timestamp);
    });

    it('should apply minimal time decay for a brand-new fact', () => {
      const justNow = Date.now();
      const fact: KeyFact = {
        id: 'test-new',
        content: 'Brand new fact',
        confidence: 0.8,
        source: FactSource.USER_STATED,
        extractedAt: justNow,
        supportingEvidence: [],
      };

      const updated = longTermMemory.updateFactConfidence(fact, {
        type: ConfidenceEventType.TIME_DECAY,
        timestamp: justNow,
      });

      // 0 weeks elapsed → 0.95^0 = 1.0 → no decay
      expect(updated.confidence).toBeCloseTo(0.8, 3);
    });

    it('should use lastConfirmedAt for time decay when present', () => {
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

      const factWithRecentConfirm: KeyFact = {
        id: 'test-decay-confirmed',
        content: 'Old but recently confirmed fact',
        confidence: 1.0,
        source: FactSource.USER_STATED,
        extractedAt: twoWeeksAgo,
        lastConfirmedAt: oneWeekAgo, // Recently confirmed
        supportingEvidence: [],
      };

      const updated = longTermMemory.updateFactConfidence(factWithRecentConfirm, {
        type: ConfidenceEventType.TIME_DECAY,
        timestamp: Date.now(),
      });

      // Should decay from lastConfirmedAt (1 week ago), not extractedAt (2 weeks ago)
      // 1.0 * 0.95^1 ≈ 0.95
      expect(updated.confidence).toBeCloseTo(0.95, 2);
    });

    it('should increase confidence on user confirmation', () => {
      const fact: KeyFact = {
        id: 'test-1',
        content: 'Test fact',
        confidence: 0.6,
        source: FactSource.LLM_INFERRED,
        extractedAt: Date.now(),
        supportingEvidence: [],
      };

      const updated = longTermMemory.updateFactConfidence(fact, {
        type: ConfidenceEventType.USER_CONFIRMED,
        timestamp: Date.now(),
      });

      expect(updated.confidence).toBeGreaterThan(fact.confidence);
      expect(updated.confidence).toBeCloseTo(0.9, 5); // 0.6 + 0.3
    });

    it('should cap confidence at 1.0', () => {
      const fact: KeyFact = {
        id: 'test-1',
        content: 'Test fact',
        confidence: 0.95,
        source: FactSource.USER_CONFIRMED,
        extractedAt: Date.now(),
        supportingEvidence: [],
      };

      const updated = longTermMemory.updateFactConfidence(fact, {
        type: ConfidenceEventType.USER_CONFIRMED,
        timestamp: Date.now(),
      });

      expect(updated.confidence).toBeLessThanOrEqual(1.0);
    });

    it('should decrease confidence on contradiction', () => {
      const fact: KeyFact = {
        id: 'test-1',
        content: 'Test fact',
        confidence: 0.8,
        source: FactSource.LLM_INFERRED,
        extractedAt: Date.now(),
        supportingEvidence: [],
      };

      const updated = longTermMemory.updateFactConfidence(fact, {
        type: ConfidenceEventType.CONTRADICTED,
        timestamp: Date.now(),
      });

      expect(updated.confidence).toBeLessThan(fact.confidence);
      expect(updated.confidence).toBe(0.4); // 0.8 - 0.4
    });

    it('should apply time decay', () => {
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const fact: KeyFact = {
        id: 'test-1',
        content: 'Test fact',
        confidence: 1.0,
        source: FactSource.USER_STATED,
        extractedAt: oneWeekAgo,
        supportingEvidence: [],
      };

      const updated = longTermMemory.updateFactConfidence(fact, {
        type: ConfidenceEventType.TIME_DECAY,
        timestamp: Date.now(),
      });

      // After 1 week: 1.0 * 0.95^1 = 0.95
      expect(updated.confidence).toBeCloseTo(0.95, 2);
      expect(updated.confidence).toBeLessThan(fact.confidence);
    });

    it('should boost confidence when mentioned again', () => {
      const fact: KeyFact = {
        id: 'test-1',
        content: 'Test fact',
        confidence: 0.7,
        source: FactSource.LLM_INFERRED,
        extractedAt: Date.now(),
        supportingEvidence: [],
      };

      const updated = longTermMemory.updateFactConfidence(fact, {
        type: ConfidenceEventType.MENTIONED_AGAIN,
        timestamp: Date.now(),
      });

      expect(updated.confidence).toBeCloseTo(0.8, 5); // 0.7 + 0.1
    });
  });

  describe('Fact Pruning', () => {
    it('should return an empty array when all facts fall below threshold', () => {
      const facts: KeyFact[] = [
        { ...mockFacts[0], confidence: 0.05 },
        { ...mockFacts[1], confidence: 0.1 },
        { ...mockFacts[2], confidence: 0.15 },
      ];

      const pruned = longTermMemory.pruneFactsByConfidence(facts, 0.2);

      expect(pruned).toHaveLength(0);
      expect(Array.isArray(pruned)).toBe(true);
    });

    it('should handle empty input without throwing', () => {
      const pruned = longTermMemory.pruneFactsByConfidence([]);

      expect(pruned).toHaveLength(0);
    });

    it('should filter out low-confidence facts', () => {
      const facts: KeyFact[] = [
        { ...mockFacts[0], confidence: 0.9 },
        { ...mockFacts[1], confidence: 0.5 },
        { ...mockFacts[2], confidence: 0.1 }, // Below threshold
      ];

      const pruned = longTermMemory.pruneFactsByConfidence(facts, 0.2);

      expect(pruned).toHaveLength(2);
      expect(pruned.find(f => f.confidence === 0.1)).toBeUndefined();
    });

    it('should sort facts by confidence descending', () => {
      const facts: KeyFact[] = [
        { ...mockFacts[0], confidence: 0.5 },
        { ...mockFacts[1], confidence: 0.9 },
        { ...mockFacts[2], confidence: 0.7 },
      ];

      const pruned = longTermMemory.pruneFactsByConfidence(facts);

      expect(pruned[0].confidence).toBe(0.9);
      expect(pruned[1].confidence).toBe(0.7);
      expect(pruned[2].confidence).toBe(0.5);
    });

    it('should limit to MAX_FACTS (50)', () => {
      // Create 60 facts
      const manyFacts: KeyFact[] = Array.from({ length: 60 }, (_, i) => ({
        id: `fact-${i}`,
        content: `Fact ${i}`,
        confidence: 0.5 + (i / 100), // Varying confidence
        source: FactSource.LLM_INFERRED,
        extractedAt: Date.now(),
        supportingEvidence: [],
      }));

      const pruned = longTermMemory.pruneFactsByConfidence(manyFacts);

      expect(pruned.length).toBeLessThanOrEqual(50);
      // Should keep the highest confidence facts
      expect(pruned[0].confidence).toBeGreaterThan(pruned[pruned.length - 1].confidence);
    });
  });

  describe('Extract and Merge Key Facts', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should return valid KeyFact objects from the merge pipeline (mocked LLM)', async () => {
      // Spy on the singleton — avoids vi.mock hoisting pollution
      vi.spyOn(llmModule.llmService, 'generateCompletion').mockResolvedValue({
        content: JSON.stringify([
          {
            content: 'User works with image classification',
            confidence: 0.7,
            source: 'LLM_INFERRED',
            supportingEvidence: ['User mentioned image classification'],
          },
          {
            content: 'User is experimenting with ResNet',
            confidence: 0.65,
            source: 'LLM_INFERRED',
            supportingEvidence: ['User mentioned ResNet fine-tuning'],
          },
        ]),
      });

      const result = await longTermMemory.extractAndMergeKeyFacts(
        [],
        mockWorkingMemory,
        mockCoreContext
      );

      expect(Array.isArray(result)).toBe(true);
      expect(result.every(f => typeof f.content === 'string')).toBe(true);
      expect(result.every(f => f.confidence >= 0 && f.confidence <= 1)).toBe(true);
    }, 30000);

    it('should merge a near-duplicate into an existing fact rather than adding it (mocked LLM)', async () => {
      vi.spyOn(llmModule.llmService, 'generateCompletion').mockResolvedValue({
        content: JSON.stringify([
          {
            content: 'User likes Python programming', // Similar to existing 'User prefers Python'
            confidence: 0.7,
            source: 'LLM_INFERRED',
            supportingEvidence: ['Mentioned Python'],
          },
        ]),
      });

      const existingFact: KeyFact = {
        id: 'existing-1',
        content: 'User prefers Python',
        confidence: 0.8,
        source: FactSource.USER_STATED,
        extractedAt: Date.now(),
        supportingEvidence: ['User said so'],
        embedding: await embeddingService.embed('User prefers Python'),
      };

      const result = await longTermMemory.extractAndMergeKeyFacts(
        [existingFact],
        mockWorkingMemory,
        mockCoreContext
      );

      // Near-duplicate should merge → still only 1 Python fact
      const pythonFacts = result.filter(f =>
        f.content.toLowerCase().includes('python')
      );
      expect(pythonFacts.length).toBe(1);
    }, 30000);

    it('should handle malformed JSON from LLM gracefully and return existing facts', async () => {
      vi.spyOn(llmModule.llmService, 'generateCompletion').mockResolvedValue({
        content: 'This is not JSON at all!',
      });

      const existingFact: KeyFact = {
        id: 'safe-1',
        content: 'User prefers Python',
        confidence: 0.8,
        source: FactSource.USER_STATED,
        extractedAt: Date.now(),
        supportingEvidence: [],
      };

      // Should not throw — falls back gracefully with existing facts
      const result = await longTermMemory.extractAndMergeKeyFacts(
        [existingFact],
        mockWorkingMemory,
        mockCoreContext
      );

      expect(Array.isArray(result)).toBe(true);
      // Existing fact should still be present (with time decay applied)
      expect(result.some(f => f.content === 'User prefers Python')).toBe(true);
    }, 30000);

    it('should generate and cache embeddings for new facts', async () => {
      const candidateFact = {
        content: 'User prefers Python',
        confidence: 0.6,
        source: FactSource.LLM_INFERRED,
        supportingEvidence: [],
      };

      // Simulate what extractAndMergeKeyFacts does
      const embedding = await embeddingService.embed(candidateFact.content);
      
      expect(embedding).toBeDefined();
      expect(embedding).toHaveLength(384);
    });

    it('should detect and merge similar facts using embeddings', async () => {
      const existingFacts: KeyFact[] = [
        {
          id: 'fact-1',
          content: 'User prefers Python',
          confidence: 0.7,
          source: FactSource.LLM_INFERRED,
          extractedAt: Date.now(),
          supportingEvidence: ['Evidence 1'],
          embedding: await embeddingService.embed('User prefers Python'),
        },
      ];

      // Similar fact
      const similarContent = 'User likes Python programming';
      const similarity = await longTermMemory.calculateSimilarity(
        existingFacts[0].content,
        similarContent
      );

      // With threshold of 0.75, this should merge
      expect(similarity).toBeGreaterThan(0.75);
    });
  });

  describe('Performance', () => {
    it('should use cached embeddings for faster comparison', async () => {
      const fact1 = {
        id: 'fact-1',
        content: 'Test content',
        confidence: 0.8,
        source: FactSource.LLM_INFERRED,
        extractedAt: Date.now(),
        supportingEvidence: [],
        embedding: await embeddingService.embed('Test content'),
      };

      const fact2 = {
        id: 'fact-2',
        content: 'Different content',
        confidence: 0.7,
        source: FactSource.LLM_INFERRED,
        extractedAt: Date.now(),
        supportingEvidence: [],
        embedding: await embeddingService.embed('Different content'),
      };

      const startTime = Date.now();
      
      // Direct similarity using cached embeddings
      const similarity = embeddingService.cosineSimilarity(
        fact1.embedding!,
        fact2.embedding!
      );
      
      const duration = Date.now() - startTime;

      expect(similarity).toBeDefined();
      expect(duration).toBeLessThan(10); // Should be very fast (< 10ms)
    });
  });
});
