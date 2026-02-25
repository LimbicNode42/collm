const { spawn } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');

// Load root .env so all vars are available
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const sharedEnv = {
  ...process.env,
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-123',
};

// Define the services to run
const services = [
  {
    name: 'user-service',
    command: 'npm',
    args: ['run', 'dev'],
    cwd: path.join(__dirname, '../apps/user-service'),
    env: {
      ...sharedEnv,
      DATABASE_URL_USER: process.env.DATABASE_URL_USER,
      PORT: '3002',
    }
  },
  {
    name: 'message-service',
    command: 'npm',
    args: ['run', 'dev'],
    cwd: path.join(__dirname, '../apps/message-service'),
    env: {
      ...sharedEnv,
      DATABASE_URL_CORE: process.env.DATABASE_URL_CORE,
      PORT: '3001',
    }
  },
  {
    name: 'core-service',
    command: 'npm',
    args: ['run', 'dev'],
    cwd: path.join(__dirname, '../apps/core-service'),
    env: {
      ...sharedEnv,
      DATABASE_URL_CORE: process.env.DATABASE_URL_CORE,
      PORT: '3003',
    }
  },
  {
    name: 'web',
    command: 'npm',
    args: ['run', 'dev'],
    cwd: path.join(__dirname, '../apps/web'),
    env: {
      ...sharedEnv,
      CORE_SERVICE_URL: process.env.CORE_SERVICE_URL || 'http://localhost:3003',
      USER_SERVICE_URL: process.env.USER_SERVICE_URL || 'http://localhost:3002',
      MESSAGE_SERVICE_URL: process.env.MESSAGE_SERVICE_URL || 'http://localhost:3001',
      PORT: '3000',
    }
  }
];

// Function to start a service
function startService(service) {
  const child = spawn(service.command, service.args, {
    cwd: service.cwd,
    env: service.env,
    shell: true,
    stdio: 'pipe'
  });

  console.log(`[${service.name}] Starting...`);

  child.stdout.on('data', (data) => {
    process.stdout.write(`[${service.name}] ${data}`);
  });

  child.stderr.on('data', (data) => {
    process.stderr.write(`[${service.name}] ${data}`);
  });

  child.on('close', (code) => {
    console.log(`[${service.name}] Exited with code ${code}`);
  });

  return child;
}

// Start all services
const children = services.map(startService);

// Handle exit
process.on('SIGINT', () => {
  console.log('\nStopping all services...');
  children.forEach(child => child.kill());
  process.exit();
});
