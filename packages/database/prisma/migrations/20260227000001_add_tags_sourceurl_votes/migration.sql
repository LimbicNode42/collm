-- Add tags array to Node
ALTER TABLE "Node" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT '{}';

-- Add sourceUrl to Message
ALTER TABLE "Message" ADD COLUMN "sourceUrl" TEXT;

-- Create Vote table
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- Add FK from Vote to Message (cascade delete)
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Unique constraint: one vote per user per message
CREATE UNIQUE INDEX "Vote_userId_messageId_key" ON "Vote"("userId", "messageId");
