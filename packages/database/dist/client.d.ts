import { PrismaClient as UserClient } from '../generated/user-client';
import { PrismaClient as CoreClient } from '../generated/core-client';
export declare const prismaUser: UserClient<import("../generated/user-client").Prisma.PrismaClientOptions, never, import("../generated/user-client/runtime/library").DefaultArgs>;
export declare const prismaCore: CoreClient<import("../generated/core-client").Prisma.PrismaClientOptions, never, import("../generated/core-client/runtime/library").DefaultArgs>;
export * as UserTypes from '../generated/user-client';
export * as CoreTypes from '../generated/core-client';
