import { KeyFact, FactSource } from '../types/domain';
import { llmService } from './llm';
import { embeddingService } from './embedding';

export interface ILongTermMemory {
  /**
   * Extracts and deduplicates key facts using semantic similarity
   */
  extractAndMergeKeyFacts(
    existingFacts: KeyFact[], 
    workingMemory: string, 
    coreContext: string
  ): Promise<KeyFact[]>;

  /**
   * Calculates semantic similarity between two text strings
   */
  calculateSimilarity(text1: string, text2: string): Promise<number>;

  /**
   * Updates confidence scores for facts based on various events
   */
  updateFactConfidence(fact: KeyFact, eventType: ConfidenceEvent): KeyFact;

  /**
   * Filters out low-confidence facts and applies temporal decay
   */
  pruneFactsByConfidence(facts: KeyFact[], minConfidence?: number): KeyFact[];
}

export enum ConfidenceEventType {
  USER_CONFIRMED = 'USER_CONFIRMED',
  MENTIONED_AGAIN = 'MENTIONED_AGAIN', 
  CONTRADICTED = 'CONTRADICTED',
  TIME_DECAY = 'TIME_DECAY',
  IMPLICIT_VALIDATION = 'IMPLICIT_VALIDATION'
}

export interface ConfidenceEvent {
  type: ConfidenceEventType;
  evidence?: string;
  timestamp: number;
}

export class SemanticLongTermMemory implements ILongTermMemory {
  private readonly SIMILARITY_THRESHOLD = 0.75; // Facts above this similarity are considered duplicates (lowered for better merging)
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.2;
  private readonly MAX_FACTS = 50; // Limit maximum number of facts per node
  private readonly CONFIDENCE_WEIGHTS = {
    [FactSource.USER_STATED]: 0.9,
    [FactSource.USER_CONFIRMED]: 1.0,
    [FactSource.LLM_INFERRED]: 0.6,
    [FactSource.IMPLICIT]: 0.4
  };

  /**
   * Cleans LLM response to extract valid JSON from markdown code blocks
   */
  private cleanJsonResponse(response: string): string {
    // Remove markdown code blocks if present
    const cleaned = response
      .trim()
      .replace(/^```(?:json)?\s*/, '') // Remove opening code block
      .replace(/\s*```$/, '')         // Remove closing code block
      .trim();
    
    console.log('[LongTermMemory] Cleaning JSON response. Original length:', response.length, 'Cleaned length:', cleaned.length);
    return cleaned;
  }

  async extractAndMergeKeyFacts(
    existingFacts: KeyFact[], 
    workingMemory: string, 
    coreContext: string
  ): Promise<KeyFact[]> {
    const startTime = Date.now();
    
    // Step 1: Extract candidate facts from working memory using LLM
    const candidateFacts = await this.extractCandidateFacts(workingMemory, coreContext);
    console.log(`[LongTermMemory] Extracted ${candidateFacts.length} candidate facts`);
    
    // Step 2: Generate embeddings for all candidate facts upfront (batch processing)
    const candidateEmbeddings = await Promise.all(
      candidateFacts.map(fact => embeddingService.embed(fact.content))
    );
    
    // Step 3: Ensure existing facts have embeddings (generate if missing)
    const existingFactsWithEmbeddings = await Promise.all(
      existingFacts.map(async (fact) => {
        if (!fact.embedding || fact.embedding.length === 0) {
          const embedding = await embeddingService.embed(fact.content);
          return { ...fact, embedding };
        }
        return fact;
      })
    );
    
    // Step 4: Check each candidate against existing facts using cached embeddings
    const mergedFacts = [...existingFactsWithEmbeddings];
    
    for (let i = 0; i < candidateFacts.length; i++) {
      const candidate = candidateFacts[i];
      const candidateEmbedding = candidateEmbeddings[i];
      
      const similarFact = this.findSimilarFactWithEmbedding(
        candidateEmbedding, 
        existingFactsWithEmbeddings
      );
      
      if (similarFact) {
        // Merge with existing fact - increase confidence and add evidence
        const updatedFact = this.mergeFacts(similarFact, candidate);
        const index = mergedFacts.findIndex(f => f.id === similarFact.id);
        mergedFacts[index] = updatedFact;
        console.log(`[LongTermMemory] Merged fact: "${candidate.content.substring(0, 50)}..."`);
      } else {
        // Add as new fact with embedding
        mergedFacts.push({
          ...candidate,
          id: `fact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          extractedAt: Date.now(),
          embedding: candidateEmbedding
        });
        console.log(`[LongTermMemory] Added new fact: "${candidate.content.substring(0, 50)}..."`);
      }
    }

    // Step 5: Apply temporal decay and prune low-confidence facts
    const prunedFacts = this.pruneFactsByConfidence(
      mergedFacts.map(fact => this.updateFactConfidence(fact, { 
        type: ConfidenceEventType.TIME_DECAY, 
        timestamp: Date.now() 
      }))
    );
    
    const elapsed = Date.now() - startTime;
    console.log(`[LongTermMemory] Compression complete in ${elapsed}ms. Facts: ${existingFacts.length} → ${prunedFacts.length}`);
    
    return prunedFacts;
  }

  async calculateSimilarity(text1: string, text2: string): Promise<number> {
    // Use local embeddings for fast, free semantic similarity
    try {
      const similarity = await embeddingService.calculateSimilarity(text1, text2);
      return similarity;
    } catch (error) {
      console.error('[LongTermMemory] Error calculating similarity:', error);
      return 0;
    }
  }

  updateFactConfidence(fact: KeyFact, event: ConfidenceEvent): KeyFact {
    let newConfidence = fact.confidence;
    
    switch(event.type) {
      case ConfidenceEventType.USER_CONFIRMED:
        newConfidence = Math.min(1.0, newConfidence + 0.3);
        break;
      case ConfidenceEventType.MENTIONED_AGAIN:
        newConfidence = Math.min(1.0, newConfidence + 0.1);
        break;
      case ConfidenceEventType.CONTRADICTED:
        newConfidence = Math.max(0.1, newConfidence - 0.4);
        break;
      case ConfidenceEventType.TIME_DECAY:
        // Apply weekly decay if fact hasn't been confirmed recently
        const weeksSinceConfirmed = fact.lastConfirmedAt 
          ? (Date.now() - fact.lastConfirmedAt) / (7 * 24 * 60 * 60 * 1000)
          : (Date.now() - fact.extractedAt) / (7 * 24 * 60 * 60 * 1000);
        newConfidence *= Math.pow(0.95, weeksSinceConfirmed);
        break;
      case ConfidenceEventType.IMPLICIT_VALIDATION:
        newConfidence = Math.min(1.0, newConfidence + 0.05);
        break;
    }

    return {
      ...fact,
      confidence: newConfidence,
      lastConfirmedAt: event.type === ConfidenceEventType.USER_CONFIRMED ? event.timestamp : fact.lastConfirmedAt
    };
  }

  pruneFactsByConfidence(facts: KeyFact[], minConfidence = this.MIN_CONFIDENCE_THRESHOLD): KeyFact[] {
    const filtered = facts
      .filter(fact => fact.confidence >= minConfidence)
      .sort((a, b) => b.confidence - a.confidence); // Sort by confidence descending (highest first)
    
    // Limit to MAX_FACTS to prevent unbounded growth
    // IMPORTANT: We sort by confidence BEFORE slicing, so we keep the highest-quality facts
    if (filtered.length > this.MAX_FACTS) {
      const pruned = filtered.slice(this.MAX_FACTS); // Facts being removed
      const kept = filtered.slice(0, this.MAX_FACTS); // Facts being kept
      
      console.log(`[LongTermMemory] Pruning facts from ${filtered.length} to ${this.MAX_FACTS}`);
      console.log(`[LongTermMemory] Keeping top ${this.MAX_FACTS} facts (confidence range: ${kept[kept.length-1].confidence.toFixed(2)} to ${kept[0].confidence.toFixed(2)})`);
      console.log(`[LongTermMemory] Removing ${pruned.length} low-confidence facts (confidence range: ${pruned[pruned.length-1].confidence.toFixed(2)} to ${pruned[0].confidence.toFixed(2)})`);
      
      return kept;
    }
    
    return filtered;
  }

  private async extractCandidateFacts(workingMemory: string, coreContext: string): Promise<Omit<KeyFact, 'id' | 'extractedAt'>[]> {
    const prompt = `Extract key facts from the following conversation that are relevant to the core context.

CORE CONTEXT:
${coreContext}

CONVERSATION TO ANALYZE:
${workingMemory}

Extract facts that are:
1. Factual statements (not opinions or questions)
2. Relevant to the core topic
3. Worth remembering for future conversations
4. Specific and actionable
5. **IMPORTANT: Extract ONLY the 3-5 most important facts. Quality over quantity!**

Return a JSON array of objects with this structure:
{
  "content": "The factual statement",
  "confidence": 0.6,
  "source": "LLM_INFERRED",
  "supportingEvidence": ["Quote or context that supports this fact"]
}

JSON array:`;

    try {
      const response = await llmService.generateCompletion(prompt, 'You are a fact extraction system. Return only valid JSON.');
      console.log('[LongTermMemory] Raw LLM response:', response.content.substring(0, 200));
      const cleanedResponse = this.cleanJsonResponse(response.content);
      console.log('[LongTermMemory] Cleaned response:', cleanedResponse.substring(0, 200));
      const facts = JSON.parse(cleanedResponse);
      
      return Array.isArray(facts) ? facts.map(fact => ({
        content: fact.content || '',
        confidence: Math.max(0, Math.min(1, fact.confidence || this.CONFIDENCE_WEIGHTS[FactSource.LLM_INFERRED])),
        source: fact.source in FactSource ? fact.source : FactSource.LLM_INFERRED,
        supportingEvidence: Array.isArray(fact.supportingEvidence) ? fact.supportingEvidence : [],
        lastConfirmedAt: undefined,
        embedding: undefined
      })) : [];
    } catch (error) {
      console.error('Error extracting facts:', error);
      return [];
    }
  }

  /**
   * Find similar fact using pre-computed embeddings (much faster than LLM calls)
   */
  private findSimilarFactWithEmbedding(candidateEmbedding: number[], existingFacts: KeyFact[]): KeyFact | null {
    for (const existing of existingFacts) {
      if (!existing.embedding || existing.embedding.length === 0) {
        continue; // Skip facts without embeddings
      }
      
      const similarity = embeddingService.cosineSimilarity(candidateEmbedding, existing.embedding);
      if (similarity >= this.SIMILARITY_THRESHOLD) {
        console.log(`[LongTermMemory] Found similar fact (similarity: ${similarity.toFixed(3)})`);
        return existing;
      }
    }
    return null;
  }

  /**
   * Legacy method - kept for backwards compatibility but now uses embedding service
   */
  private async findSimilarFact(candidate: Omit<KeyFact, 'id' | 'extractedAt'>, existingFacts: KeyFact[]): Promise<KeyFact | null> {
    for (const existing of existingFacts) {
      const similarity = await this.calculateSimilarity(candidate.content, existing.content);
      if (similarity >= this.SIMILARITY_THRESHOLD) {
        return existing;
      }
    }
    return null;
  }

  private mergeFacts(existing: KeyFact, candidate: Omit<KeyFact, 'id' | 'extractedAt'>): KeyFact {
    return {
      ...existing,
      confidence: Math.min(1.0, existing.confidence + 0.1), // Boost confidence for reinforcement
      supportingEvidence: [...existing.supportingEvidence, ...candidate.supportingEvidence],
      lastConfirmedAt: Date.now()
    };
  }
}

export const longTermMemory = new SemanticLongTermMemory();
