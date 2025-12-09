-- Update Node table to use hierarchical memory structure
-- This replaces the simple 'state' field with structured memory fields

-- Remove the old state field
ALTER TABLE "Node" DROP COLUMN "state";

-- Add hierarchical memory fields
ALTER TABLE "Node" ADD COLUMN "coreContext" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Node" ADD COLUMN "workingMemory" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Node" ADD COLUMN "keyFacts" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "Node" ADD COLUMN "messageCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Node" ADD COLUMN "lastSummaryAt" INTEGER NOT NULL DEFAULT 0;