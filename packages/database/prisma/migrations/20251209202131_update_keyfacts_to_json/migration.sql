-- Update keyFacts from TEXT[] to JSON[] to support structured facts with confidence
ALTER TABLE "Node" DROP COLUMN "keyFacts";
ALTER TABLE "Node" ADD COLUMN "keyFacts" JSON[] NOT NULL DEFAULT '{}';