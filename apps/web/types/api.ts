// Client-side type definitions for the web app
// These represent the shape of data received from API calls

export interface User {
  id: string;
  email: string;
  name?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NodeMemory {
  coreContext: string;
  workingMemory: string;
  keyFacts: string[];
  messageCount: number;
  lastSummaryAt: string | null;
}

export interface Node {
  id: string;
  topic: string;
  description?: string | null;
  model: string;
  memory: NodeMemory;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export enum MessageStatus {
  PENDING = 'PENDING',
  ADJUDICATING = 'ADJUDICATING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  STALE = 'STALE',
}

export interface ChatMessage {
  id: string;
  content: string;
  userId: string;        // 'llm' for AI responses, email/id for users
  isLlm: boolean;
  status: string;
  createdAt: string;
}

/** Legacy shape — kept for backward compat with test page */
export interface Message {
  id: string;
  content: string;
  userId: string;
  nodeId: string;
  targetNodeVersion: number;
  status: MessageStatus;
  createdAt: Date;
}
