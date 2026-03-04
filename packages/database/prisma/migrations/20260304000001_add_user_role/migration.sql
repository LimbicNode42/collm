-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CONTRIBUTOR', 'VIEWER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'CONTRIBUTOR';

-- Make all existing users ADMIN (first users are trusted admins)
UPDATE "User" SET "role" = 'ADMIN';
