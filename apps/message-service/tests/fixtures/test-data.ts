import { QueueMessage, Message, MessageStatus } from '../../src/types/domain';

// ─── Queue messages ──────────────────────────────────────────────────────────

export const mockQueueMessage: QueueMessage = {
  messageId: 'msg-001',
  nodeId: 'node-abc',
  targetNodeVersion: 1,
  content: 'Hello from the test fixture',
  userId: 'user-xyz',
  timestamp: 1700000000000,
};

export const mockQueueMessage2: QueueMessage = {
  messageId: 'msg-002',
  nodeId: 'node-abc',
  targetNodeVersion: 1,
  content: 'Second message',
  userId: 'user-xyz',
  timestamp: 1700000001000,
};

export const mockQueueMessage3: QueueMessage = {
  messageId: 'msg-003',
  nodeId: 'node-def',
  targetNodeVersion: 2,
  content: 'Message on a different node',
  userId: 'user-123',
  timestamp: 1700000002000,
};

// ─── DB messages (as returned by prismaCore) ─────────────────────────────────

export const mockDbMessage: Message = {
  id: 'msg-001',
  content: 'Hello from the test fixture',
  userId: 'user-xyz',
  nodeId: 'node-abc',
  targetNodeVersion: 1,
  status: MessageStatus.PENDING,
  createdAt: new Date('2024-01-01T00:00:00Z'),
};

// ─── POST /message request bodies ────────────────────────────────────────────

export const validSendRequest = {
  userId: 'user-xyz',
  nodeId: 'node-abc',
  content: 'Hello, world!',
  targetNodeVersion: 1,
};

export const missingSendRequests = [
  { nodeId: 'node-abc', content: 'Hello', targetNodeVersion: 1 },           // no userId
  { userId: 'user-xyz', content: 'Hello', targetNodeVersion: 1 },           // no nodeId
  { userId: 'user-xyz', nodeId: 'node-abc', targetNodeVersion: 1 },         // no content
  { userId: 'user-xyz', nodeId: 'node-abc', content: 'Hello' },             // no version
];
