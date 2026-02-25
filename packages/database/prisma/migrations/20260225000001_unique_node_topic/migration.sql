-- Deduplicate Node.topic: keep only the most recently updated node per topic,
-- delete all older duplicates (and their messages via CASCADE would fail since we
-- have no ON DELETE CASCADE, so delete messages first).

-- Step 1: Delete messages belonging to duplicate (older) nodes
DELETE FROM "Message"
WHERE "nodeId" IN (
  SELECT id FROM "Node"
  WHERE id NOT IN (
    -- Keep the most recently updated node per topic
    SELECT DISTINCT ON (topic) id
    FROM "Node"
    ORDER BY topic, "updatedAt" DESC
  )
);

-- Step 2: Delete the duplicate older nodes
DELETE FROM "Node"
WHERE id NOT IN (
  SELECT DISTINCT ON (topic) id
  FROM "Node"
  ORDER BY topic, "updatedAt" DESC
);

-- Step 3: Now it's safe to add the unique constraint
CREATE UNIQUE INDEX "Node_topic_key" ON "Node"("topic");
