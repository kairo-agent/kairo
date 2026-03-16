-- Add ReEngagement fields to leads table
ALTER TABLE "leads" ADD COLUMN "lastReEngagementAt" TIMESTAMP(3);
ALTER TABLE "leads" ADD COLUMN "reEngagementCount" INTEGER NOT NULL DEFAULT 0;

-- Add ReEngagement config to ai_agents table
ALTER TABLE "ai_agents" ADD COLUMN "reEngagementConfig" JSONB;
