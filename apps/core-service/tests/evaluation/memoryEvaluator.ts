/**
 * Custom Memory Evaluator
 *
 * Measures quality of the memory system's fact extraction using local embeddings.
 * No LLM API call needed — scoring is done purely with cosine similarity.
 *
 * Metrics:
 *  - retention:         proportion of expected facts captured (0–1, higher is better)
 *  - relevance:         avg similarity of extracted facts to the core topic (0–1)
 *  - consistency:       absence of near-duplicate facts in the output (0–1)
 *  - compressionRatio:  input chars / output chars (higher = more compressed)
 *  - performance:       wall-clock ms for the extraction call (lower is better)
 *  - factCount:         number of facts that survived pruning
 */

import { embeddingService } from '../../src/services/embedding';
import { KeyFact } from '../../src/types/domain';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface MemoryEvaluation {
  retention: number;
  relevance: number;
  consistency: number;
  compressionRatio: number;
  performance: number;
  factCount: number;
}

export interface EvaluationThresholds {
  minRetention?: number;     // default 0.5
  minRelevance?: number;     // default 0.4
  minConsistency?: number;   // default 0.8
  maxPerformanceMs?: number; // default 5000
}

// ─── Evaluator ────────────────────────────────────────────────────────────────

export class MemoryEvaluator {
  // A pair of facts with similarity above this are considered near-duplicates
  private readonly DUPLICATE_THRESHOLD = 0.9;

  /**
   * Evaluates the quality of an extraction result.
   *
   * @param extractedFacts   - Facts returned by extractAndMergeKeyFacts
   * @param expectedFacts    - Ground-truth strings you want to be captured
   * @param coreContext      - The node's core context / topic text
   * @param workingMemory    - The working memory that was compressed
   * @param elapsedMs        - Time taken by the extraction (pass 0 if not timing)
   */
  async evaluate(
    extractedFacts: KeyFact[],
    expectedFacts: string[],
    coreContext: string,
    workingMemory: string,
    elapsedMs: number
  ): Promise<MemoryEvaluation> {
    const [retention, relevance, consistency] = await Promise.all([
      this.scoreRetention(extractedFacts, expectedFacts),
      this.scoreRelevance(extractedFacts, coreContext),
      this.scoreConsistency(extractedFacts),
    ]);

    const compressionRatio = this.compressionRatio(workingMemory, extractedFacts);

    return {
      retention,
      relevance,
      consistency,
      compressionRatio,
      performance: elapsedMs,
      factCount: extractedFacts.length,
    };
  }

  /**
   * Checks whether an evaluation result meets minimum quality thresholds.
   * Returns an array of human-readable failure messages (empty = pass).
   */
  checkThresholds(
    evaluation: MemoryEvaluation,
    thresholds: EvaluationThresholds = {}
  ): string[] {
    const failures: string[] = [];
    const {
      minRetention = 0.5,
      minRelevance = 0.4,
      minConsistency = 0.8,
      maxPerformanceMs = 5000,
    } = thresholds;

    if (evaluation.retention < minRetention) {
      failures.push(
        `Retention ${evaluation.retention.toFixed(2)} < threshold ${minRetention} — too many expected facts were missed`
      );
    }
    if (evaluation.relevance < minRelevance) {
      failures.push(
        `Relevance ${evaluation.relevance.toFixed(2)} < threshold ${minRelevance} — extracted facts are off-topic`
      );
    }
    if (evaluation.consistency < minConsistency) {
      failures.push(
        `Consistency ${evaluation.consistency.toFixed(2)} < threshold ${minConsistency} — too many near-duplicate facts`
      );
    }
    if (evaluation.performance > maxPerformanceMs) {
      failures.push(
        `Performance ${evaluation.performance}ms > threshold ${maxPerformanceMs}ms — compression is too slow`
      );
    }

    return failures;
  }

  // ── Private metric implementations ─────────────────────────────────────────

  /**
   * Retention: for each expected fact, find the most similar extracted fact.
   * Score = average of those max-similarity values.
   * A score of 1.0 means every expected fact has an extracted near-match.
   */
  private async scoreRetention(
    extracted: KeyFact[],
    expected: string[]
  ): Promise<number> {
    if (expected.length === 0) return 1.0;
    if (extracted.length === 0) return 0.0;

    const extractedEmbeddings = await this.getOrComputeEmbeddings(extracted);
    const expectedEmbeddings = await Promise.all(
      expected.map(e => embeddingService.embed(e))
    );

    const scores = expectedEmbeddings.map(expEmbed => {
      const similarities = extractedEmbeddings.map(extEmbed =>
        embeddingService.cosineSimilarity(expEmbed, extEmbed)
      );
      return Math.max(...similarities);
    });

    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  /**
   * Relevance: average similarity of each extracted fact to the core context.
   * Penalises facts that are off-topic relative to the node's purpose.
   */
  private async scoreRelevance(
    extracted: KeyFact[],
    coreContext: string
  ): Promise<number> {
    if (extracted.length === 0) return 0.0;

    const contextEmbedding = await embeddingService.embed(coreContext);
    const factEmbeddings = await this.getOrComputeEmbeddings(extracted);

    const similarities = factEmbeddings.map(embed =>
      embeddingService.cosineSimilarity(contextEmbedding, embed)
    );

    return similarities.reduce((a, b) => a + b, 0) / similarities.length;
  }

  /**
   * Consistency: measures absence of near-duplicate facts in the output.
   * Score = 1 - (duplicate pairs / total pairs).
   * 1.0 means no near-duplicates; 0.0 means every fact is a near-duplicate of another.
   */
  private async scoreConsistency(extracted: KeyFact[]): Promise<number> {
    if (extracted.length <= 1) return 1.0;

    const embeddings = await this.getOrComputeEmbeddings(extracted);
    let duplicatePairs = 0;
    let totalPairs = 0;

    for (let i = 0; i < embeddings.length; i++) {
      for (let j = i + 1; j < embeddings.length; j++) {
        const similarity = embeddingService.cosineSimilarity(
          embeddings[i],
          embeddings[j]
        );
        if (similarity >= this.DUPLICATE_THRESHOLD) {
          duplicatePairs++;
        }
        totalPairs++;
      }
    }

    return 1 - duplicatePairs / totalPairs;
  }

  /**
   * Compression ratio: input chars / total output fact chars.
   * Higher means more compression was achieved.
   * Returns 1.0 (no change) if no facts were extracted.
   */
  private compressionRatio(workingMemory: string, extracted: KeyFact[]): number {
    const inputLength = workingMemory.length;
    const outputLength = extracted.reduce((sum, f) => sum + f.content.length, 0);

    if (outputLength === 0) return 1.0;
    return inputLength / outputLength;
  }

  /**
   * Returns cached embeddings where available, computing missing ones.
   */
  private async getOrComputeEmbeddings(facts: KeyFact[]): Promise<number[][]> {
    return Promise.all(
      facts.map(fact =>
        fact.embedding && fact.embedding.length > 0
          ? Promise.resolve(fact.embedding)
          : embeddingService.embed(fact.content)
      )
    );
  }
}

export const memoryEvaluator = new MemoryEvaluator();
