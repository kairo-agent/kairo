-- Add promptStructure JSON field to ai_agents table
ALTER TABLE "ai_agents" ADD COLUMN "promptStructure" JSONB;

-- Add category and structured_data to agent_knowledge table (not in Prisma)
ALTER TABLE "agent_knowledge" ADD COLUMN IF NOT EXISTS "category" VARCHAR(50) NOT NULL DEFAULT 'free_text';
ALTER TABLE "agent_knowledge" ADD COLUMN IF NOT EXISTS "structured_data" JSONB;

-- Index for fast lookup of structured categories per agent
CREATE INDEX IF NOT EXISTS "idx_agent_knowledge_category" ON "agent_knowledge" ("agent_id", "project_id", "category");

-- Unique constraint: only 1 structured entry per category per agent (except free_text)
CREATE UNIQUE INDEX IF NOT EXISTS "idx_agent_knowledge_unique_category"
ON "agent_knowledge" ("agent_id", "project_id", "category")
WHERE "category" != 'free_text';
