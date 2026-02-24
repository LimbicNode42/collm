/**
 * Integration tests for LongTermMemory — require a live LLM API key.
 *
 * These run automatically in CI when OPENAI_API_KEY, ANTHROPIC_API_KEY,
 * or GOOGLE_API_KEY is present as a GitHub Actions secret.
 * Without any key they are skipped – CI does not fail.
 *
 * Run locally:
 *   ANTHROPIC_API_KEY=sk-... npm run test:integration
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { longTermMemory } from '../../src/services/longTermMemory';
import { embeddingService } from '../../src/services/embedding';
import { mockWorkingMemory, mockCoreContext } from '../fixtures/test-data';
import { KeyFact } from '../../src/types/domain';

const hasLLMApiKey = !!(
  process.env.OPENAI_API_KEY ||
  process.env.ANTHROPIC_API_KEY ||
  process.env.GOOGLE_API_KEY
);

describe.skipIf(!hasLLMApiKey)('LongTermMemory Integration (live LLM)', () => {
  beforeAll(async () => {
    await embeddingService.initialize();
  }, 60000);

  it('should extract real facts from a machine learning conversation', async () => {
    const result = await longTermMemory.extractAndMergeKeyFacts(
      [],
      mockWorkingMemory,
      mockCoreContext
    );

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    result.forEach(fact => {
      expect(fact.content).toBeTruthy();
      expect(fact.confidence).toBeGreaterThan(0);
      expect(fact.confidence).toBeLessThanOrEqual(1);
      expect(Array.isArray(fact.supportingEvidence)).toBe(true);
    });

    // Should extract something relevant to the ML conversation in the fixture
    const allText = result.map(f => f.content.toLowerCase()).join(' ');
    const hasMlContent =
      allText.includes('python') ||
      allText.includes('tensorflow') ||
      allText.includes('machine learning') ||
      allText.includes('resnet') ||
      allText.includes('image');
    expect(hasMlContent).toBe(true);
  }, 60000);

  it('should not duplicate a fact that is semantically identical to an existing one', async () => {
    const existingFact: KeyFact = {
      id: 'existing-1',
      content: 'User prefers Python for machine learning',
      confidence: 0.8,
      source: 'USER_STATED' as any,
      extractedAt: Date.now(),
      supportingEvidence: ['User stated this directly'],
      embedding: await embeddingService.embed('User prefers Python for machine learning'),
    };

    const result = await longTermMemory.extractAndMergeKeyFacts(
      [existingFact],
      mockWorkingMemory,
      mockCoreContext
    );

    // There should not be two distinct Python facts — near-duplicate should be merged
    const pythonFacts = result.filter(f =>
      f.content.toLowerCase().includes('python')
    );
    expect(pythonFacts.length).toBeLessThanOrEqual(1);
  }, 60000);

  it('should apply time decay and pruning to extracted facts', async () => {
    const result = await longTermMemory.extractAndMergeKeyFacts(
      [],
      mockWorkingMemory,
      mockCoreContext
    );

    // All facts should survive pruning (confidence > 0.2)
    result.forEach(fact => {
      expect(fact.confidence).toBeGreaterThanOrEqual(0.2);
    });

    // Result count should be capped at MAX_FACTS (50)
    expect(result.length).toBeLessThanOrEqual(50);
  }, 60000);
});
