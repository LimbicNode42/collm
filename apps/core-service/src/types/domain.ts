// Domain models for the Core Service
// These are internal to this service and should not be shared with other services

export interface Node {
  id: string;
  topic: string;
  description?: string | null;
  state: string; // Serialized LLM state or summary
  model: string; // LLM model to use for this node
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