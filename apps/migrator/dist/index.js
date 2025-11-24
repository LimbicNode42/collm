"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const child_process_1 = require("child_process");
async function createDatabaseIfNotExists(connectionString) {
    // Parse connection string to get DB name and base connection
    // Format: postgresql://user:pass@host:port/dbname
    const url = new URL(connectionString);
    const dbName = url.pathname.substring(1); // remove leading /
    // Connect to 'postgres' database to create new DBs
    url.pathname = '/postgres';
    const adminConnectionString = url.toString();
    const client = new pg_1.Client({ connectionString: adminConnectionString });
    try {
        await client.connect();
        const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
        if (res.rowCount === 0) {
            console.log(`Database ${dbName} does not exist. Creating...`);
            await client.query(`CREATE DATABASE "${dbName}"`);
            console.log(`Database ${dbName} created successfully.`);
        }
        else {
            console.log(`Database ${dbName} already exists.`);
        }
    }
    catch (err) {
        console.error(`Error checking/creating database ${dbName}:`, err);
        throw err;
    }
    finally {
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
        (0, child_process_1.execSync)('npx prisma migrate deploy --schema=../../packages/database/prisma/user.prisma', {
            stdio: 'inherit',
            env: { ...process.env, DATABASE_URL: userDbUrl } // Prisma expects DATABASE_URL or explicit url in schema
        });
    }
    catch (e) {
        console.error("Failed to migrate User DB");
        process.exit(1);
    }
    console.log("Running Core Service migrations...");
    try {
        (0, child_process_1.execSync)('npx prisma migrate deploy --schema=../../packages/database/prisma/core.prisma', {
            stdio: 'inherit',
            env: { ...process.env, DATABASE_URL: coreDbUrl }
        });
    }
    catch (e) {
        console.error("Failed to migrate Core DB");
        process.exit(1);
    }
    console.log("All migrations applied successfully.");
}
runMigrations().catch(console.error);
