// Domain models for the Core Service
// These are internal to this service and should not be shared with other services

export enum FactSource {
  USER_STATED = 'USER_STATED',
  USER_CONFIRMED = 'USER_CONFIRMED', 
  LLM_INFERRED = 'LLM_INFERRED',
  IMPLICIT = 'IMPLICIT'
}

export interface KeyFact {
  id: string;
  content: string;
  confidence: number;
  source: FactSource;
  extractedAt: number;
  lastConfirmedAt?: number;
  supportingEvidence: string[];
  embedding?: number[];  // For semantic similarity
}

export interface NodeMemory {
  coreContext: string;      // The essential topic/conversation essence - never decays
  workingMemory: string;    // Recent compressed state  
  keyFacts: KeyFact[];      // Structured facts with confidence and metadata
  messageCount: number;
  lastSummaryAt: number;    // Message count when last summarized
}

export interface Node {
  id: string;
  topic: string;
  description?: string | null;
  memory: NodeMemory;       // Structured memory replacing simple state
  model: string;            // LLM model to use for this node
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export enum MessageStatus {
  PENDING = 'PENDING',
  ADJUDICATING = 'ADJUDICATING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  STALE = 'STALE',
}

export interface Message {
  id: string;
  content: string;
  userId: string;
  nodeId: string;
  targetNodeVersion: number;
  status: MessageStatus;
  createdAt: Date;
}

export interface AdjudicationResult {
  messageId: string;
  isRelevant: boolean;
  isStale: boolean;
  reason?: string;
  score: number; // 0 to 1 confidence score
}

export interface QueueMessage {
  messageId: string;
  nodeId: string;
  targetNodeVersion: number;
  content: string;
  userId: string;
  timestamp?: number;
}