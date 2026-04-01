-- Add formConfig JSONB to ai_agents (same pattern as reEngagementConfig)
ALTER TABLE "ai_agents" ADD COLUMN "formConfig" JSONB;

-- Create lead_form_data table
CREATE TABLE "lead_form_data" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "fieldData" JSONB NOT NULL DEFAULT '{}',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_form_data_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "lead_form_data_leadId_idx" ON "lead_form_data"("leadId");
CREATE INDEX "lead_form_data_agentId_idx" ON "lead_form_data"("agentId");

-- Unique constraint: one form data per lead per agent
CREATE UNIQUE INDEX "lead_form_data_leadId_agentId_key" ON "lead_form_data"("leadId", "agentId");

-- Foreign keys
ALTER TABLE "lead_form_data" ADD CONSTRAINT "lead_form_data_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lead_form_data" ADD CONSTRAINT "lead_form_data_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ai_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
