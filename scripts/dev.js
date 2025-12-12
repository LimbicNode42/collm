const { spawn } = require('child_process');
const path = require('path');

const dbPath = path.resolve(__dirname, '../packages/database/prisma/user.db');
// Ensure proper formatting for Windows paths in URL
const dbUrl = `file:${dbPath.replace(/\\/g, '/')}`;

console.log(`Using Database URL: ${dbUrl}`);

// Define the services to run
const services = [
  {
    name: 'message-service',
    command: 'npm',
    args: ['run', 'dev'],
    cwd: path.join(__dirname, '../apps/message-service'),
    env: { 
      ...process.env, 
      DATABASE_URL: dbUrl,
      DATABASE_URL_USER: dbUrl,
      JWT_SECRET: 'dev-secret-123'
    }
  },
  {
    name: 'user-service',
    command: 'npm',
    args: ['run', 'dev'],
    cwd: path.join(__dirname, '../apps/user-service'),
    env: { 
      ...process.env, 
      DATABASE_URL: dbUrl,
      DATABASE_URL_USER: dbUrl,
      JWT_SECRET: 'dev-secret-123'
    }
  },
  {
    name: 'core-service',
    command: 'npm',
    args: ['run', 'dev'],
    cwd: path.join(__dirname, '../apps/core-service'),
    env: { 
      ...process.env, 
      DATABASE_URL: dbUrl,
      DATABASE_URL_USER: dbUrl,
      JWT_SECRET: 'dev-secret-123'
    }
  },
  {
    name: 'web',
    command: 'npm',
    args: ['run', 'dev'],
    cwd: path.join(__dirname, '../apps/web'),
    env: { ...process.env }
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
  console.log('Stopping all services...');
  children.forEach(child => child.kill());
  process.exit();
});
