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
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
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
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.get('/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const user = await userService.getUser(id);
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }
      return reply.send(user);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  return fastify;
}
