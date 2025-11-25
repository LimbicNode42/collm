import { Client } from 'pg';
import { execSync } from 'child_process';

async function createDatabaseIfNotExists(connectionString: string) {
  // Parse connection string to get DB name and base connection
  // Format: postgresql://user:pass@host:port/dbname
  const url = new URL(connectionString);
  const dbName = url.pathname.substring(1); // remove leading /
  
  // Connect to 'postgres' database to create new DBs
  // We extract credentials and host from the original URL
  
  const client = new Client({ 
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    host: url.hostname,
    port: parseInt(url.port) || 5432,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    
    const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
    
    if (res.rowCount === 0) {
      console.log(`Database ${dbName} does not exist. Creating...`);
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Database ${dbName} created successfully.`);
    } else {
      console.log(`Database ${dbName} already exists.`);
    }
  } catch (err) {
    console.error(`Error checking/creating database ${dbName}:`, err);
    throw err;
  } finally {
    await client.end();
  }
}

async function runMigrations() {
  const userDbUrl = process.env.DATABASE_URL_USER;
  const coreDbUrl = process.env.DATABASE_URL_CORE;

  if (!userDbUrl || !coreDbUrl) {
    console.error("Missing DATABASE_URL_USER or DATABASE_URL_CORE environment variables.");
    process.exit(1);
  }

  console.log("Ensuring databases exist...");
  await createDatabaseIfNotExists(userDbUrl);
  await createDatabaseIfNotExists(coreDbUrl);

  console.log("Running User Service migrations...");
  try {
    execSync('npx prisma migrate deploy --schema=../../packages/database/prisma/user.prisma', { 
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: userDbUrl } // Prisma expects DATABASE_URL or explicit url in schema
    });
  } catch (e) {
    console.error("Failed to migrate User DB");
    process.exit(1);
  }

  console.log("Running Core Service migrations...");
  try {
    execSync('npx prisma migrate deploy --schema=../../packages/database/prisma/core.prisma', { 
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: coreDbUrl }
    });
  } catch (e) {
    console.error("Failed to migrate Core DB");
    process.exit(1);
  }

  console.log("All migrations applied successfully.");

  await createUserAndGrantPermissions(userDbUrl, 'user_service_app', process.env.APP_USER_PASSWORD!);
}

async function createUserAndGrantPermissions(connectionString: string, username: string, password: string) {
  if (!password) {
    console.warn("APP_USER_PASSWORD not provided. Skipping app user creation.");
    return;
  }

  const url = new URL(connectionString);
  const dbName = url.pathname.substring(1);

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log(`Configuring user ${username} for database ${dbName}...`);

    // Check if user exists
    const userRes = await client.query(`SELECT 1 FROM pg_roles WHERE rolname = $1`, [username]);
    
    if (userRes.rowCount === 0) {
      await client.query(`CREATE USER "${username}" WITH PASSWORD '${password}'`);
      console.log(`User ${username} created.`);
    } else {
      await client.query(`ALTER USER "${username}" WITH PASSWORD '${password}'`);
      console.log(`User ${username} password updated.`);
    }

    // Grant permissions
    await client.query(`GRANT CONNECT ON DATABASE "${dbName}" TO "${username}"`);
    await client.query(`GRANT USAGE ON SCHEMA public TO "${username}"`);
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${username}"`);
    await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${username}"`);
    
    // Ensure future tables are accessible
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${username}"`);
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO "${username}"`);

    console.log(`Permissions granted to ${username} on ${dbName}.`);

  } catch (err) {
    console.error(`Error configuring user ${username}:`, err);
    throw err;
  } finally {
    await client.end();
  }
}

runMigrations().catch(console.error);
