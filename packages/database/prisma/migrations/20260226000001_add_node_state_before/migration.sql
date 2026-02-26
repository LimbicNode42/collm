-- AlterTable: store the document snapshot before each contribution
ALTER TABLE "Message" ADD COLUMN "nodeStateBefore" TEXT;
