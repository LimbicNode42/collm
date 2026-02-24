/**
 * HTTP Route Tests
 *
 * Uses fastify.inject() — no real port, no DB, no bcrypt.
 * userService is mocked via vi.spyOn so routes call the mock directly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  mockUser,
  mockUserNoName,
  validRegisterRequest,
  validLoginRequest,
  missingEmailRegister,
  missingPasswordRegister,
  missingEmailLogin,
  missingPasswordLogin,
} from '../fixtures/test-data';

// ─── Mock the entire userService singleton ────────────────────────────────────
// We mock the module so routes pick up mock methods when the app is built.

const mockCreateUser = vi.fn();
const mockGetUser = vi.fn();
const mockGetUserByEmail = vi.fn();
const mockValidateUser = vi.fn();

vi.mock('../../src/services/user', () => ({
  userService: {
    createUser: mockCreateUser,
    getUser: mockGetUser,
    getUserByEmail: mockGetUserByEmail,
    validateUser: mockValidateUser,
  },
  UserService: class {},
}));

// ─── App setup ────────────────────────────────────────────────────────────────

let app: FastifyInstance;

beforeEach(async () => {
  vi.clearAllMocks();
  const { buildApp } = await import('../../src/app');
  app = await buildApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
  vi.resetModules();
});

// ─── GET /health ──────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('should return 200 with status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});

// ─── POST /register ───────────────────────────────────────────────────────────

describe('POST /register', () => {
  it('should return 201 with token and user when registration succeeds', async () => {
    mockGetUserByEmail.mockResolvedValueOnce(null);       // user does not exist
    mockCreateUser.mockResolvedValueOnce(mockUser);

    const res = await app.inject({
      method: 'POST', url: '/register',
      headers: { 'content-type': 'application/json' },
      payload: validRegisterRequest,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.token).toBeTruthy();
    expect(body.user.id).toBe('user-001');
    expect(body.user.email).toBe('alice@example.com');
  });

  it('should include a signed JWT token in the response', async () => {
    mockGetUserByEmail.mockResolvedValueOnce(null);
    mockCreateUser.mockResolvedValueOnce(mockUser);

    const res = await app.inject({
      method: 'POST', url: '/register',
      headers: { 'content-type': 'application/json' },
      payload: validRegisterRequest,
    });

    const { token } = res.json();
    // JWT tokens have 3 dot-separated base64 sections
    expect(token.split('.').length).toBe(3);
  });

  it('should return 409 when user already exists', async () => {
    mockGetUserByEmail.mockResolvedValueOnce(mockUser);   // user exists

    const res = await app.inject({
      method: 'POST', url: '/register',
      headers: { 'content-type': 'application/json' },
      payload: validRegisterRequest,
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ success: false, error: 'User already exists' });
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it('should return 400 when email is missing', async () => {
    const res = await app.inject({
      method: 'POST', url: '/register',
      headers: { 'content-type': 'application/json' },
      payload: missingEmailRegister,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/email/i);
  });

  it('should return 400 when password is missing', async () => {
    const res = await app.inject({
      method: 'POST', url: '/register',
      headers: { 'content-type': 'application/json' },
      payload: missingPasswordRegister,
    });
    expect(res.statusCode).toBe(400);
  });

  it('should return 500 when createUser throws', async () => {
    mockGetUserByEmail.mockResolvedValueOnce(null);
    mockCreateUser.mockRejectedValueOnce(new Error('DB error'));

    const res = await app.inject({
      method: 'POST', url: '/register',
      headers: { 'content-type': 'application/json' },
      payload: validRegisterRequest,
    });
    expect(res.statusCode).toBe(500);
  });

  it('should work for a user with no name', async () => {
    mockGetUserByEmail.mockResolvedValueOnce(null);
    mockCreateUser.mockResolvedValueOnce(mockUserNoName);

    const res = await app.inject({
      method: 'POST', url: '/register',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'bob@example.com', password: 'pass123' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().user.name).toBeNull();
  });
});

// ─── POST /login ──────────────────────────────────────────────────────────────

describe('POST /login', () => {
  it('should return 200 with token and user when credentials are valid', async () => {
    mockValidateUser.mockResolvedValueOnce(mockUser);

    const res = await app.inject({
      method: 'POST', url: '/login',
      headers: { 'content-type': 'application/json' },
      payload: validLoginRequest,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.token).toBeTruthy();
    expect(body.user.email).toBe('alice@example.com');
  });

  it('should return 401 when credentials are invalid', async () => {
    mockValidateUser.mockResolvedValueOnce(null);

    const res = await app.inject({
      method: 'POST', url: '/login',
      headers: { 'content-type': 'application/json' },
      payload: validLoginRequest,
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ success: false, error: 'Invalid email or password' });
  });

  it('should return 400 when email is missing', async () => {
    const res = await app.inject({
      method: 'POST', url: '/login',
      headers: { 'content-type': 'application/json' },
      payload: missingEmailLogin,
    });
    expect(res.statusCode).toBe(400);
  });

  it('should return 400 when password is missing', async () => {
    const res = await app.inject({
      method: 'POST', url: '/login',
      headers: { 'content-type': 'application/json' },
      payload: missingPasswordLogin,
    });
    expect(res.statusCode).toBe(400);
  });

  it('should return 500 when validateUser throws', async () => {
    mockValidateUser.mockRejectedValueOnce(new Error('DB down'));

    const res = await app.inject({
      method: 'POST', url: '/login',
      headers: { 'content-type': 'application/json' },
      payload: validLoginRequest,
    });
    expect(res.statusCode).toBe(500);
  });
});

// ─── GET /users/:id ───────────────────────────────────────────────────────────

describe('GET /users/:id', () => {
  it('should return 200 with user when found', async () => {
    mockGetUser.mockResolvedValueOnce(mockUser);

    const res = await app.inject({ method: 'GET', url: '/users/user-001' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: 'user-001', email: 'alice@example.com' });
    expect(mockGetUser).toHaveBeenCalledWith('user-001');
  });

  it('should return 404 when user not found', async () => {
    mockGetUser.mockResolvedValueOnce(null);

    const res = await app.inject({ method: 'GET', url: '/users/nonexistent' });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: 'User not found' });
  });

  it('should return 500 when getUser throws', async () => {
    mockGetUser.mockRejectedValueOnce(new Error('DB error'));

    const res = await app.inject({ method: 'GET', url: '/users/user-001' });

    expect(res.statusCode).toBe(500);
  });
});
