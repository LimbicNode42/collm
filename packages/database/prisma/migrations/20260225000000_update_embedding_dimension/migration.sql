-- Change embedding column from vector(1536) to vector(384)
-- Reason: switching from OpenAI embeddings (1536-dim) to local all-MiniLM-L6-v2
-- embeddings (384-dim) which are free, fast, and run entirely locally.
--
-- pgvector does not support ALTER COLUMN for dimension changes, so we drop and
-- re-add the column. Existing embeddings were generated with random mock values
-- so there is no real data loss here — all nodes will be re-embedded on next access.

ALTER TABLE "Node" DROP COLUMN IF EXISTS "embedding";
ALTER TABLE "Node" ADD COLUMN "embedding" vector(384);
