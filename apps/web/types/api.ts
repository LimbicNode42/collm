// Client-side type definitions for the web app
// These represent the shape of data received from API calls

export interface User {
  id: string;
  email: string;
  name?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Node {
  id: string;
  topic: string;
  description?: string | null;
  state: string;
  model: string;
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