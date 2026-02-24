// ─── Auth responses ───────────────────────────────────────────────────────────

export const mockAuthSuccessResponse = {
  success: true,
  token: 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InVzZXItMDAxIn0.fake',
  user: {
    id: 'user-001',
    email: 'alice@example.com',
    name: 'Alice',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
};

export const mockAuthErrorResponse = {
  success: false,
  error: 'Invalid email or password',
};

export const mockUserAlreadyExistsResponse = {
  success: false,
  error: 'User already exists',
};

// ─── Node responses ───────────────────────────────────────────────────────────

export const mockNode = {
  id: 'node-001',
  topic: 'Test Topic',
  description: 'A test node',
  model: 'claude-sonnet-4-5-20250929',
  createdAt: '2024-01-01T00:00:00.000Z',
};

export const mockNodeList = [mockNode, { ...mockNode, id: 'node-002' }];

// ─── Message responses ────────────────────────────────────────────────────────

export const mockMessageResponse = {
  success: true,
  data: { messageId: 'msg-001' },
};
