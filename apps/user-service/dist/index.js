"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
const user_1 = require("./services/user");
const fastify = (0, fastify_1.default)({
    logger: true
});
fastify.register(cors_1.default, {
    origin: true,
});
fastify.register(jwt_1.default, {
    secret: process.env.JWT_SECRET || 'supersecret',
});
fastify.get('/health', async () => {
    return { status: 'ok' };
});
fastify.post('/register', async (request, reply) => {
    const { email, password, name } = request.body;
    if (!email || !password) {
        return reply.code(400).send({
            success: false,
            error: 'Missing required fields: email, password'
        });
    }
    try {
        const existingUser = await user_1.userService.getUserByEmail(email);
        if (existingUser) {
            return reply.code(409).send({
                success: false,
                error: 'User already exists'
            });
        }
        const user = await user_1.userService.createUser(email, password, name);
        const token = fastify.jwt.sign({ id: user.id, email: user.email });
        return reply.code(201).send({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                createdAt: user.createdAt.toISOString(),
                updatedAt: user.updatedAt.toISOString()
            }
        });
    }
    catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal Server Error' });
    }
});
fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body;
    if (!email || !password) {
        return reply.code(400).send({
            success: false,
            error: 'Missing required fields: email, password'
        });
    }
    try {
        const user = await user_1.userService.validateUser(email, password);
        if (!user) {
            return reply.code(401).send({
                success: false,
                error: 'Invalid email or password'
            });
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
                updatedAt: user.updatedAt.toISOString()
            }
        });
    }
    catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal Server Error' });
    }
});
fastify.get('/users/:id', async (request, reply) => {
    const { id } = request.params;
    try {
        const user = await user_1.userService.getUser(id);
        if (!user) {
            return reply.code(404).send({ error: 'User not found' });
        }
        return reply.send(user);
    }
    catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal Server Error' });
    }
});
const start = async () => {
    try {
        await fastify.listen({ port: 3003, host: '0.0.0.0' });
    }
    catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};
start();
//# sourceMappingURL=index.js.map