-- Add model field to Node table for LLM selection
ALTER TABLE "Node" ADD COLUMN "model" TEXT NOT NULL DEFAULT 'claude-sonnet-4-5-20250929';