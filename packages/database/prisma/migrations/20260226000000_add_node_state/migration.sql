-- Add nodeState field: the evolving knowledge document for each node
ALTER TABLE "public"."Node" ADD COLUMN "nodeState" TEXT NOT NULL DEFAULT '';
