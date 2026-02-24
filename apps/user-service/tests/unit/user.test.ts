/**
 * UserService Unit Tests
 *
 * prismaUser and bcryptjs are both mocked so:
 * - No database connection needed
 * - Tests run in milliseconds (no real bcrypt rounds)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDbUser, mockUser } from '../fixtures/test-data';

// ─── Module mocks ─────────────────────────────────────────────────────────────
// vi.hoisted() ensures these are initialised before the hoisted vi.mock factories run

const mockFindUnique = vi.hoisted(() => vi.fn());
const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('@collm/database', () => ({
  prismaUser: {
    user: {
      findUnique: mockFindUnique,
      create: mockCreate,
    },
  },
}));

const mockHash = vi.hoisted(() => vi.fn());
const mockCompare = vi.hoisted(() => vi.fn());

vi.mock('bcryptjs', () => ({
  hash: mockHash,
  compare: mockCompare,
}));

// ─── Import under test (after mocks are declared) ────────────────────────────

import { UserService } from '../../src/services/user';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UserService();
  });

  describe('createUser', () => {
    it('should hash the password before saving', async () => {
      mockHash.mockResolvedValueOnce('hashed-pw');
      mockCreate.mockResolvedValueOnce(mockDbUser);

      await service.createUser('alice@example.com', 'plaintext', 'Alice');

      expect(mockHash).toHaveBeenCalledWith('plaintext', 10);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ password: 'hashed-pw' }) })
      );
    });

    it('should return user without password field', async () => {
      mockHash.mockResolvedValueOnce('hashed-pw');
      mockCreate.mockResolvedValueOnce(mockDbUser);

      const result = await service.createUser('alice@example.com', 'plaintext', 'Alice');

      expect(result).not.toHaveProperty('password');
      expect(result.email).toBe('alice@example.com');
      expect(result.name).toBe('Alice');
    });

    it('should create user without name when name is omitted', async () => {
      mockHash.mockResolvedValueOnce('hashed-pw');
      mockCreate.mockResolvedValueOnce({ ...mockDbUser, name: undefined });

      await service.createUser('alice@example.com', 'plaintext');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.not.objectContaining({ name: expect.anything() }) })
      );
    });

    it('should propagate DB errors', async () => {
      mockHash.mockResolvedValueOnce('hashed-pw');
      mockCreate.mockRejectedValueOnce(new Error('unique constraint'));

      await expect(service.createUser('alice@example.com', 'pw')).rejects.toThrow('unique constraint');
    });
  });

  describe('getUser', () => {
    it('should return user without password when found', async () => {
      mockFindUnique.mockResolvedValueOnce(mockDbUser);

      const result = await service.getUser('user-001');

      expect(result).not.toBeNull();
      expect(result).not.toHaveProperty('password');
      expect(result?.id).toBe('user-001');
      expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: 'user-001' } });
    });

    it('should return null when user not found', async () => {
      mockFindUnique.mockResolvedValueOnce(null);
      const result = await service.getUser('nonexistent');
      expect(result).toBeNull();
    });

    it('should propagate DB errors', async () => {
      mockFindUnique.mockRejectedValueOnce(new Error('DB error'));
      await expect(service.getUser('user-001')).rejects.toThrow('DB error');
    });
  });

  describe('getUserByEmail', () => {
    it('should return user without password when found', async () => {
      mockFindUnique.mockResolvedValueOnce(mockDbUser);

      const result = await service.getUserByEmail('alice@example.com');

      expect(result).not.toBeNull();
      expect(result).not.toHaveProperty('password');
      expect(result?.email).toBe('alice@example.com');
      expect(mockFindUnique).toHaveBeenCalledWith({ where: { email: 'alice@example.com' } });
    });

    it('should return null when user not found', async () => {
      mockFindUnique.mockResolvedValueOnce(null);
      const result = await service.getUserByEmail('nobody@example.com');
      expect(result).toBeNull();
    });
  });

  describe('validateUser', () => {
    it('should return user without password when credentials are valid', async () => {
      mockFindUnique.mockResolvedValueOnce(mockDbUser);
      mockCompare.mockResolvedValueOnce(true);

      const result = await service.validateUser('alice@example.com', 'correct-password');

      expect(result).not.toBeNull();
      expect(result).not.toHaveProperty('password');
      expect(result?.email).toBe('alice@example.com');
      expect(mockCompare).toHaveBeenCalledWith('correct-password', mockDbUser.password);
    });

    it('should return null when user does not exist', async () => {
      mockFindUnique.mockResolvedValueOnce(null);

      const result = await service.validateUser('nobody@example.com', 'any-password');

      expect(result).toBeNull();
      expect(mockCompare).not.toHaveBeenCalled();
    });

    it('should return null when password is wrong', async () => {
      mockFindUnique.mockResolvedValueOnce(mockDbUser);
      mockCompare.mockResolvedValueOnce(false);

      const result = await service.validateUser('alice@example.com', 'wrong-password');

      expect(result).toBeNull();
    });

    it('should not call compare when user is not found (avoids timing leak)', async () => {
      mockFindUnique.mockResolvedValueOnce(null);

      await service.validateUser('nobody@example.com', 'any-password');

      expect(mockCompare).not.toHaveBeenCalled();
    });
  });
});
