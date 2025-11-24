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
    version: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare enum MessageStatus {
    PENDING = "PENDING",
    ADJUDICATING = "ADJUDICATING",
    ACCEPTED = "ACCEPTED",
    REJECTED = "REJECTED",
    STALE = "STALE"
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
    score: number;
}
export interface QueueMessage {
    messageId: string;
    nodeId: string;
    targetNodeVersion: number;
    content: string;
    timestamp: number;
}
