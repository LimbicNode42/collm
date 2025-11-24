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

