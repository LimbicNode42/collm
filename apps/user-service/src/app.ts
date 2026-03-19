/**
 * Fastify app factory — separate from server startup so tests can call
 * buildApp() and use fastify.inject() without binding to a port.
 */
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { userService } from './services/user';
import { UserService } from '@collm/contracts';

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: false });

  await fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  });

  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'supersecret',
  });

  fastify.get('/health', async () => {
    return { status: 'ok' };
  });

  fastify.post<{
    Body: UserService.RegisterRequest;
    Reply: UserService.AuthResponse;
  }>('/register', async (request, reply) => {
    const { email, password, name } = request.body;

    if (!email || !password) {
      return reply.code(400).send({
        success: false,
        error: 'Missing required fields: email, password',
      });
    }

    try {
      const existingUser = await userService.getUserByEmail(email);
      if (existingUser) {
        return reply.code(409).send({ success: false, error: 'User already exists' });
      }

      const user = await userService.createUser(email, password, name);
      const token = fastify.jwt.sign({ id: user.id, email: user.email });

      return reply.code(201).send({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.post<{
    Body: UserService.LoginRequest;
    Reply: UserService.AuthResponse;
  }>('/login', async (request, reply) => {
    const { email, password } = request.body;

    if (!email || !password) {
      return reply.code(400).send({
        success: false,
        error: 'Missing required fields: email, password',
      });
    }

    try {
      const user = await userService.validateUser(email, password);
      if (!user) {
        return reply.code(401).send({ success: false, error: 'Invalid email or password' });
      }

      const token = fastify.jwt.sign({ id: user.id, email: user.email });
      return reply.send({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // GET /users/search?q=<email|name|id> — query-param based lookup (avoids URL encoding edge cases)
  fastify.get('/users/search', async (request, reply) => {
    const { q } = request.query as { q?: string };
    if (!q?.trim()) return reply.code(400).send({ error: 'q query param required' });
    const decoded = decodeURIComponent(q.trim());
    try {
      let user = await userService.getUser(decoded);
      if (!user) user = await userService.getUserByEmail(decoded);
      if (!user) user = await userService.getUserByName(decoded);
      if (!user) return reply.code(404).send({ error: 'User not found' });
      return reply.send(user);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.get('/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      // Try ID first, then email — profile URLs may use email as the identifier
      let user = await userService.getUser(id);
      if (!user) user = await userService.getUserByEmail(decodeURIComponent(id));
      if (!user) user = await userService.getUserByName(id);
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }
      return reply.send(user);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // PATCH /users/:id — update own profile (name only)
  fastify.patch('/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name } = request.body as { name?: string };
    try {
      const updated = await userService.updateUser(id, { name });
      if (!updated) return reply.code(404).send({ error: 'User not found' });
      return reply.send(updated);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // GET /users/by-email/:email — lookup user by email (used by core-service for role checks)
  fastify.get('/users/by-email/:email', async (request, reply) => {
    const { email } = request.params as { email: string };
    try {
      const user = await userService.getUserByEmail(decodeURIComponent(email));
      if (!user) return reply.code(404).send({ error: 'User not found' });
      return reply.send(user);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // PATCH /users/:id/role — update a user's role (admin only)
  fastify.patch('/users/:id/role', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { role, requestedBy } = request.body as { role?: string; requestedBy?: string };
    if (!role) return reply.code(400).send({ error: 'role is required' });
    if (!requestedBy) return reply.code(401).send({ error: 'requestedBy is required' });

    // Verify requesting user is an ADMIN
    try {
      let requester = await userService.getUser(requestedBy);
      if (!requester) requester = await userService.getUserByEmail(requestedBy);
      if (!requester || requester.role !== 'ADMIN') {
        return reply.code(403).send({ error: 'Admin role required to change user roles' });
      }

      const updated = await userService.updateUserRole(id, role);
      if (!updated) return reply.code(404).send({ error: 'User not found or invalid role' });
      return reply.send(updated);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // GET /users — list all users (admin panel use)
  fastify.get('/users', async (_request, reply) => {
    try {
      const users = await userService.getAllUsers();
      return reply.send({ users });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // DELETE /users/:id — admin hard-deletes a user account
  fastify.delete('/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { requestedBy } = request.query as { requestedBy?: string };
    if (!requestedBy) return reply.code(401).send({ error: 'requestedBy is required' });

    try {
      // Prevent deleting yourself
      if (id === requestedBy) {
        return reply.code(400).send({ error: 'You cannot delete your own account via admin panel' });
      }
      // Verify requester is admin
      let requester = await userService.getUser(requestedBy);
      if (!requester) requester = await userService.getUserByEmail(requestedBy);
      if (!requester || requester.role !== 'ADMIN') {
        return reply.code(403).send({ error: 'Admin role required to delete users' });
      }
      const deleted = await userService.deleteUser(id);
      if (!deleted) return reply.code(404).send({ error: 'User not found' });
      return reply.send({ success: true, message: 'User deleted' });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // POST /admin/users — admin creates a user with a specified role
  fastify.post('/admin/users', async (request, reply) => {
    const { email, password, name, role, requestedBy } = request.body as {
      email?: string;
      password?: string;
      name?: string;
      role?: string;
      requestedBy?: string;
    };

    if (!email || !password) {
      return reply.code(400).send({ error: 'email and password are required' });
    }
    if (!requestedBy) return reply.code(401).send({ error: 'requestedBy is required' });

    try {
      // Verify requester is admin
      let requester = await userService.getUser(requestedBy);
      if (!requester) requester = await userService.getUserByEmail(requestedBy);
      if (!requester || requester.role !== 'ADMIN') {
        return reply.code(403).send({ error: 'Admin role required to create users' });
      }
      // Check email not already taken
      const existing = await userService.getUserByEmail(email);
      if (existing) return reply.code(409).send({ error: 'A user with this email already exists' });

      const user = await userService.createUser(email, password, name, role);
      return reply.code(201).send({ success: true, user });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // POST /users/:id/reset-password — admin resets a user's password
  fastify.post('/users/:id/reset-password', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { newPassword, requestedBy } = request.body as {
      newPassword?: string;
      requestedBy?: string;
    };

    if (!newPassword || newPassword.length < 8) {
      return reply.code(400).send({ error: 'newPassword must be at least 8 characters' });
    }
    if (!requestedBy) return reply.code(401).send({ error: 'requestedBy is required' });

    try {
      // Verify requester is admin
      let requester = await userService.getUser(requestedBy);
      if (!requester) requester = await userService.getUserByEmail(requestedBy);
      if (!requester || requester.role !== 'ADMIN') {
        return reply.code(403).send({ error: 'Admin role required to reset passwords' });
      }
      const updated = await userService.resetPassword(id, newPassword);
      if (!updated) return reply.code(404).send({ error: 'User not found or password too short' });
      return reply.send({ success: true, message: 'Password reset successfully' });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  return fastify;
}
