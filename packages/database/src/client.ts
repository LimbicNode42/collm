// Construct DATABASE_URL environment variables before any imports
// This must happen before Prisma clients are instantiated
if (!process.env.DATABASE_URL_USER || !process.env.DATABASE_URL_CORE) {
  const dbHost = process.env.DB_HOST;
  const dbPort = process.env.DB_PORT || '5432';
  const dbUsername = process.env.DB_USERNAME;
  const dbPassword = process.env.DB_PASSWORD;

  if (dbHost && dbUsername && dbPassword) {
    // URL encode the username and password to handle special characters
    const encodedUsername = encodeURIComponent(dbUsername);
    const encodedPassword = encodeURIComponent(dbPassword);
    
    if (!process.env.DATABASE_URL_USER) {
      process.env.DATABASE_URL_USER = `postgresql://${encodedUsername}:${encodedPassword}@${dbHost}:${dbPort}/collm_user`;
    }
    if (!process.env.DATABASE_URL_CORE) {
      process.env.DATABASE_URL_CORE = `postgresql://${encodedUsername}:${encodedPassword}@${dbHost}:${dbPort}/collm_core`;
    }
    console.log('[Database] Constructed database URLs from component environment variables');
    console.log(`[Database] Host: ${dbHost}, Port: ${dbPort}, Username: ${dbUsername}`);
  }
}

import { PrismaClient as UserClient } from '../generated/user-client'
import { PrismaClient as CoreClient } from '../generated/core-client'

const globalForPrisma = global as unknown as { 
  prismaUser: UserClient,
  prismaCore: CoreClient 
}

export const prismaUser =
  globalForPrisma.prismaUser ||
  new UserClient({
    log: ['query'],
  })

export const prismaCore =
  globalForPrisma.prismaCore ||
  new CoreClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaUser = prismaUser
  globalForPrisma.prismaCore = prismaCore
}

export * as UserTypes from '../generated/user-client'
export * as CoreTypes from '../generated/core-client'

