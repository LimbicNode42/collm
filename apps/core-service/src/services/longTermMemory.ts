import { KeyFact, FactSource } from '../types/domain';
import { llmService } from './llm';

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
  private readonly SIMILARITY_THRESHOLD = 0.8; // Facts above this similarity are considered duplicates
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.2;
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
    
    // Step 1: Extract candidate facts from working memory using LLM
    const candidateFacts = await this.extractCandidateFacts(workingMemory, coreContext);
    
    // Step 2: Check each candidate against existing facts for semantic similarity
    const mergedFacts = [...existingFacts];
    
    for (const candidate of candidateFacts) {
      const similarFact = await this.findSimilarFact(candidate, existingFacts);
      
      if (similarFact) {
        // Merge with existing fact - increase confidence and add evidence
        const updatedFact = this.mergeFacts(similarFact, candidate);
        const index = mergedFacts.findIndex(f => f.id === similarFact.id);
        mergedFacts[index] = updatedFact;
      } else {
        // Add as new fact
        mergedFacts.push({
          ...candidate,
          id: `fact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          extractedAt: Date.now()
        });
      }
    }

    // Step 3: Apply temporal decay and prune low-confidence facts
    return this.pruneFactsByConfidence(
      mergedFacts.map(fact => this.updateFactConfidence(fact, { 
        type: ConfidenceEventType.TIME_DECAY, 
        timestamp: Date.now() 
      }))
    );
  }

  async calculateSimilarity(text1: string, text2: string): Promise<number> {
    // For now, use a simple approach. Later we can implement proper embeddings
    // This is a placeholder - in production you'd use actual embeddings
    try {
      const prompt = `Rate the semantic similarity between these two statements on a scale of 0.0 to 1.0:

Statement 1: "${text1}"
Statement 2: "${text2}"

Return only a number between 0.0 and 1.0, where:
- 0.0 = completely unrelated
- 0.5 = somewhat related
- 1.0 = essentially the same meaning

Similarity score:`;

      console.debug('[LongTermMemory] Calculating similarity with prompt:', prompt.substring(0, 100) + '...');

      const response = await llmService.generateCompletion(prompt, 'You are a semantic similarity analyzer. Return only a decimal number.');
      const score = parseFloat(response.content.trim());
      return isNaN(score) ? 0 : Math.max(0, Math.min(1, score));
    } catch (error) {
      console.error('Error calculating similarity:', error);
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
    return facts
      .filter(fact => fact.confidence >= minConfidence)
      .sort((a, b) => b.confidence - a.confidence); // Sort by confidence descending
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