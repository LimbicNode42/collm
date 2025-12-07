// Domain models for the Message Service
// These are internal to this service and should not be shared with other services

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

export interface QueueMessage {
  messageId: string;
  nodeId: string;
  targetNodeVersion: number;
  content: string;
  userId: string;
  timestamp?: number;
}