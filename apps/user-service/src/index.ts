import Fastify from 'fastify';
import { userService } from './services/user';

const fastify = Fastify({
  logger: true
});

fastify.post('/users', async (request, reply) => {
  const body = request.body as any;
  const { email, name } = body;

  if (!email) {
    return reply.code(400).send({ error: 'Missing required field: email' });
  }

  try {
    const user = await userService.createUser(email, name);
    return reply.code(201).send(user);
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
