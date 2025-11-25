import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { userService } from './services/user';

const fastify = Fastify({
  logger: true
});

// Register CORS
fastify.register(cors, {
  origin: true, // Allow all origins for dev
});

// Register JWT
fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'supersecret',
});

fastify.get('/health', async () => {
  return { status: 'ok' };
});

fastify.post('/register', async (request, reply) => {
  const body = request.body as any;
  const { email, password, name } = body;

  if (!email || !password) {
    return reply.code(400).send({ error: 'Missing required fields: email, password' });
  }

  try {
    const existingUser = await userService.getUserByEmail(email);
    if (existingUser) {
      return reply.code(409).send({ error: 'User already exists' });
    }

    const user = await userService.createUser(email, password, name);
    const token = fastify.jwt.sign({ id: user.id, email: user.email });

    return reply.code(201).send({ user, token });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
});

fastify.post('/login', async (request, reply) => {
  const body = request.body as any;
  const { email, password } = body;

  if (!email || !password) {
    return reply.code(400).send({ error: 'Missing required fields: email, password' });
  }

  try {
    const user = await userService.validateUser(email, password);
    if (!user) {
      return reply.code(401).send({ error: 'Invalid email or password' });
    }

    const token = fastify.jwt.sign({ id: user.id, email: user.email });
    return reply.send({ user, token });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
});

fastify.get('/users/:id', async (request, reply) => {
  const { id } = request.params as any;

  try {
    const user = await userService.getUser(id);
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }
    return reply.send(user);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
});

const start = async () => {
  try {
    await fastify.listen({ port: 3002, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
