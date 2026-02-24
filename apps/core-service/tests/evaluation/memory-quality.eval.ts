/**
 * Memory Quality Evaluation Tests
 *
 * Two sections:
 *
 * 1. Unit-level evaluator tests (always run, no LLM needed)
 *    - Verifies the evaluator itself scores correctly against known facts
 *    - Uses local embeddings only
 *
 * 2. Integration-level quality gates (runs when LLM API key present)
 *    - Runs the full extraction pipeline against conversationScenarios
 *    - Scores quality with the evaluator and enforces minimum thresholds
 *    - These are the "did compression hurt quality?" regression tests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { memoryEvaluator } from './memoryEvaluator';
import { embeddingService } from '../../src/services/embedding';
import { mockWorkingMemory, mockCoreContext } from '../fixtures/test-data';
import { FactSource, KeyFact } from '../../src/types/domain';

// ─── Evaluator unit tests — no LLM needed, always run ─────────────────────────

describe('MemoryEvaluator — unit tests', () => {
  beforeAll(async () => {
    await embeddingService.initialize();
  }, 60000);

  describe('Retention scoring', () => {
    it('should score 1.0 when extracted facts match all expected facts closely', async () => {
      const facts: KeyFact[] = [
        {
          id: '1',
          content: 'User prefers Python for data science',
          confidence: 0.9,
          source: FactSource.USER_STATED,
          extractedAt: Date.now(),
          supportingEvidence: [],
        },
        {
          id: '2',
          content: 'User has 5 years of programming experience',
          confidence: 0.8,
          source: FactSource.USER_STATED,
          extractedAt: Date.now(),
          supportingEvidence: [],
        },
      ];

      const expected = [
        'User prefers Python',
        'User has years of experience',
      ];

      const evaluation = await memoryEvaluator.evaluate(
        facts, expected, mockCoreContext, mockWorkingMemory, 100
      );

      // Both expected facts have close matches — retention should be high
      expect(evaluation.retention).toBeGreaterThan(0.7);
    });

    it('should score 0.0 when no facts are extracted but expected facts exist', async () => {
      const evaluation = await memoryEvaluator.evaluate(
        [], ['User prefers Python', 'User is a data scientist'],
        mockCoreContext, mockWorkingMemory, 0
      );

      expect(evaluation.retention).toBe(0.0);
    });

    it('should score 1.0 when expected facts list is empty', async () => {
      const evaluation = await memoryEvaluator.evaluate(
        [], [], mockCoreContext, mockWorkingMemory, 0
      );

      expect(evaluation.retention).toBe(1.0);
    });
  });

  describe('Relevance scoring', () => {
    it('should score higher for on-topic facts than off-topic facts', async () => {
      const onTopicFacts: KeyFact[] = [
        {
          id: 'on-1',
          content: 'User works with TensorFlow for machine learning',
          confidence: 0.8,
          source: FactSource.LLM_INFERRED,
          extractedAt: Date.now(),
          supportingEvidence: [],
        },
      ];

      const offTopicFacts: KeyFact[] = [
        {
          id: 'off-1',
          content: 'User enjoys surfing at the beach on weekends',
          confidence: 0.8,
          source: FactSource.LLM_INFERRED,
          extractedAt: Date.now(),
          supportingEvidence: [],
        },
      ];

      const mlContext = 'Topic: Machine Learning\nUser is interested in ML and data science';

      const [onTopicEval, offTopicEval] = await Promise.all([
        memoryEvaluator.evaluate(onTopicFacts, [], mlContext, mockWorkingMemory, 0),
        memoryEvaluator.evaluate(offTopicFacts, [], mlContext, mockWorkingMemory, 0),
      ]);

      expect(onTopicEval.relevance).toBeGreaterThan(offTopicEval.relevance);
    });

    it('should score 0.0 when no facts are extracted', async () => {
      const evaluation = await memoryEvaluator.evaluate(
        [], [], mockCoreContext, mockWorkingMemory, 0
      );

      expect(evaluation.relevance).toBe(0.0);
    });
  });

  describe('Consistency scoring', () => {
    it('should score 1.0 for a single fact (no pairs to compare)', async () => {
      const facts: KeyFact[] = [
        {
          id: '1',
          content: 'User prefers Python',
          confidence: 0.9,
          source: FactSource.USER_STATED,
          extractedAt: Date.now(),
          supportingEvidence: [],
        },
      ];

      const evaluation = await memoryEvaluator.evaluate(
        facts, [], mockCoreContext, mockWorkingMemory, 0
      );

      expect(evaluation.consistency).toBe(1.0);
    });

    it('should score 1.0 when all facts are distinct', async () => {
      const distinctFacts: KeyFact[] = [
        {
          id: '1', content: 'User prefers Python', confidence: 0.9,
          source: FactSource.USER_STATED, extractedAt: Date.now(), supportingEvidence: [],
        },
        {
          id: '2', content: 'User lives in Sydney', confidence: 0.8,
          source: FactSource.USER_STATED, extractedAt: Date.now(), supportingEvidence: [],
        },
        {
          id: '3', content: 'User works with TensorFlow', confidence: 0.7,
          source: FactSource.LLM_INFERRED, extractedAt: Date.now(), supportingEvidence: [],
        },
      ];

      const evaluation = await memoryEvaluator.evaluate(
        distinctFacts, [], mockCoreContext, mockWorkingMemory, 0
      );

      expect(evaluation.consistency).toBe(1.0);
    });

    it('should score below 1.0 when near-identical facts exist', async () => {
      const duplicateFacts: KeyFact[] = [
        {
          id: '1', content: 'User prefers Python programming language', confidence: 0.9,
          source: FactSource.USER_STATED, extractedAt: Date.now(), supportingEvidence: [],
        },
        {
          id: '2', content: 'User prefers Python programming language', confidence: 0.8,
          source: FactSource.USER_STATED, extractedAt: Date.now(), supportingEvidence: [],
        },
      ];

      const evaluation = await memoryEvaluator.evaluate(
        duplicateFacts, [], mockCoreContext, mockWorkingMemory, 0
      );

      expect(evaluation.consistency).toBeLessThan(1.0);
    });
  });

  describe('Compression ratio', () => {
    it('should return higher ratio when facts are much shorter than working memory', async () => {
      const shortFacts: KeyFact[] = [
        {
          id: '1', content: 'User uses Python', confidence: 0.9,
          source: FactSource.USER_STATED, extractedAt: Date.now(), supportingEvidence: [],
        },
      ];

      const evaluation = await memoryEvaluator.evaluate(
        shortFacts, [], mockCoreContext, mockWorkingMemory, 0
      );

      // mockWorkingMemory is ~350 chars, 'User uses Python' is ~16 chars → ratio ~21
      expect(evaluation.compressionRatio).toBeGreaterThan(5);
    });

    it('should return 1.0 when no facts are extracted', async () => {
      const evaluation = await memoryEvaluator.evaluate(
        [], [], mockCoreContext, mockWorkingMemory, 0
      );

      expect(evaluation.compressionRatio).toBe(1.0);
    });
  });

  describe('checkThresholds', () => {
    it('should return no failures when all thresholds are met', () => {
      const good = { retention: 0.8, relevance: 0.7, consistency: 0.9, compressionRatio: 10, performance: 1000, factCount: 3 };
      const failures = memoryEvaluator.checkThresholds(good);

      expect(failures).toHaveLength(0);
    });

    it('should report each failed threshold with a descriptive message', () => {
      const bad = { retention: 0.3, relevance: 0.2, consistency: 0.5, compressionRatio: 1, performance: 8000, factCount: 0 };
      const failures = memoryEvaluator.checkThresholds(bad);

      expect(failures.length).toBe(4);
      expect(failures.some(f => f.includes('Retention'))).toBe(true);
      expect(failures.some(f => f.includes('Relevance'))).toBe(true);
      expect(failures.some(f => f.includes('Consistency'))).toBe(true);
      expect(failures.some(f => f.includes('Performance'))).toBe(true);
    });

    it('should allow custom threshold overrides', () => {
      const evaluation = { retention: 0.4, relevance: 0.5, consistency: 0.9, compressionRatio: 5, performance: 500, factCount: 2 };
      // Only retention is checked (strict) — others are relaxed
      const failures = memoryEvaluator.checkThresholds(evaluation, {
        minRetention: 0.6,
        minRelevance: 0.3,   // relaxed
        minConsistency: 0.7, // relaxed
      });

      expect(failures.length).toBe(1);
      expect(failures[0]).toContain('Retention');
    });
  });
});

// Integration quality gates live in tests/integration/memory-quality.integration.test.ts
// They require a live LLM API key and are excluded from the main test:run.
