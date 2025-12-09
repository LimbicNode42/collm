import { KeyFact } from '../types/domain';
import { Prisma } from '@collm/database/generated/core-client';

/**
 * Converts database JSON values to KeyFact array
 */
export function parseKeyFactsFromDb(jsonFacts: Prisma.JsonValue[]): KeyFact[] {
  if (!Array.isArray(jsonFacts)) return [];
  
  return jsonFacts
    .filter((fact): fact is Record<string, any> => 
      fact !== null && typeof fact === 'object' && !Array.isArray(fact)
    )
    .map(fact => ({
      id: fact.id || `fact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content: fact.content || '',
      confidence: Math.max(0, Math.min(1, Number(fact.confidence) || 0.5)),
      source: fact.source || 'LLM_INFERRED',
      extractedAt: Number(fact.extractedAt) || Date.now(),
      lastConfirmedAt: fact.lastConfirmedAt ? Number(fact.lastConfirmedAt) : undefined,
      supportingEvidence: Array.isArray(fact.supportingEvidence) ? fact.supportingEvidence : [],
      embedding: Array.isArray(fact.embedding) ? fact.embedding : undefined
    }));
}

/**
 * Converts KeyFact array to database JSON format
 */
export function serializeKeyFactsForDb(facts: KeyFact[]): Prisma.InputJsonValue[] {
  return facts.map(fact => ({
    id: fact.id,
    content: fact.content,
    confidence: fact.confidence,
    source: fact.source,
    extractedAt: fact.extractedAt,
    lastConfirmedAt: fact.lastConfirmedAt || null,
    supportingEvidence: fact.supportingEvidence,
    embedding: fact.embedding || null
  }));
}