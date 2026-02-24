import { User } from '../../src/types/domain';

// ─── DB user (as returned by prismaUser — includes password) ─────────────────

export const mockDbUser = {
  id: 'user-001',
  email: 'alice@example.com',
  name: 'Alice',
  password: '$2a$10$hashedpasswordvalue123456789012345678901234567890', // fake bcrypt hash
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

// ─── User (as returned by UserService — no password field) ───────────────────

export const mockUser: User = {
  id: 'user-001',
  email: 'alice@example.com',
  name: 'Alice',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

export const mockUserNoName: User = {
  id: 'user-002',
  email: 'bob@example.com',
  name: null,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

// ─── Request payloads ─────────────────────────────────────────────────────────

export const validRegisterRequest = {
  email: 'alice@example.com',
  password: 'securepassword123',
  name: 'Alice',
};

export const validLoginRequest = {
  email: 'alice@example.com',
  password: 'securepassword123',
};

export const missingEmailRegister = { password: 'securepassword123' };
export const missingPasswordRegister = { email: 'alice@example.com' };
export const missingEmailLogin = { password: 'securepassword123' };
export const missingPasswordLogin = { email: 'alice@example.com' };
