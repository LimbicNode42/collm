/**
 * Memory Quality Gates — Integration Tests
 *
 * These use a live LLM + the MemoryEvaluator to enforce minimum quality
 * thresholds on the full extraction pipeline.
 *
 * They answer: "Did a code change hurt compression quality?"
 *
 * Skipped silently without an API key. Run locally with:
 *   ANTHROPIC_API_KEY=sk-... npm run test:integration
 *
 * Or in CI by adding any of OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_API_KEY
 * to GitHub → Settings → Secrets → Actions.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { longTermMemory } from '../../src/services/longTermMemory';
import { embeddingService } from '../../src/services/embedding';
import { memoryEvaluator, EvaluationThresholds } from '../evaluation/memoryEvaluator';
import { conversationScenarios } from '../fixtures/test-data';
import { KeyFact } from '../../src/types/domain';

const hasLLMApiKey = !!(
  process.env.OPENAI_API_KEY ||
  process.env.ANTHROPIC_API_KEY ||
  process.env.GOOGLE_API_KEY
);

/**
 * Quality thresholds for this project.
 * Tighten these as the system matures.
 */
const QUALITY_THRESHOLDS: EvaluationThresholds = {
  minRetention: 0.5,       // Capture at least 50% of expected facts semantically
  minRelevance: 0.4,       // Facts should be at least 40% similar to core topic
  minConsistency: 0.8,     // At most 20% of fact pairs can be near-duplicates
  maxPerformanceMs: 10000, // Full extraction should finish in under 10 seconds
};

describe.skipIf(!hasLLMApiKey)('Memory Quality Gates (live LLM)', () => {
  beforeAll(async () => {
    await embeddingService.initialize();
  }, 60000);

  it.each(conversationScenarios)(
    '$name — extraction quality must meet minimum thresholds',
    async ({ name: scenarioName, workingMemory, coreContext, expectedFacts }) => {
      const start = Date.now();

      const extractedFacts = await longTermMemory.extractAndMergeKeyFacts(
        [],
        workingMemory,
        coreContext
      );

      const elapsed = Date.now() - start;

      const evaluation = await memoryEvaluator.evaluate(
        extractedFacts,
        expectedFacts,
        coreContext,
        workingMemory,
        elapsed
      );

      console.log(`[QualityGate] ${scenarioName}:`, {
        retention: evaluation.retention.toFixed(2),
        relevance: evaluation.relevance.toFixed(2),
        consistency: evaluation.consistency.toFixed(2),
        compressionRatio: evaluation.compressionRatio.toFixed(1) + 'x',
        performance: evaluation.performance + 'ms',
        factCount: evaluation.factCount,
      });

      const failures = memoryEvaluator.checkThresholds(evaluation, QUALITY_THRESHOLDS);

      if (failures.length > 0) {
        throw new Error(
          `Quality gate failed for scenario "${scenarioName}":\n` +
          failures.map(f => `  • ${f}`).join('\n')
        );
      }
    },
    60000
  );

  it('repeated compressions should not cause fact explosion or degrade consistency', async () => {
    const scenario = conversationScenarios[0];

    // Simulate 3 rounds of compression (as if a long ongoing conversation)
    let facts: KeyFact[] = [];
    for (let round = 0; round < 3; round++) {
      facts = await longTermMemory.extractAndMergeKeyFacts(
        facts,
        scenario.workingMemory,
        scenario.coreContext
      );
    }

    const evaluation = await memoryEvaluator.evaluate(
      facts,
      scenario.expectedFacts,
      scenario.coreContext,
      scenario.workingMemory,
      0
    );

    console.log('[QualityGate] After 3 compression rounds:', {
      factCount: evaluation.factCount,
      consistency: evaluation.consistency.toFixed(2),
      retention: evaluation.retention.toFixed(2),
    });

    // Fact count should stay bounded by MAX_FACTS
    expect(evaluation.factCount).toBeLessThanOrEqual(50);

    // Consistency should not collapse from repeated compression
    // (would indicate the deduplication/merge isn't working)
    expect(evaluation.consistency).toBeGreaterThan(0.7);
  }, 90000);
});
