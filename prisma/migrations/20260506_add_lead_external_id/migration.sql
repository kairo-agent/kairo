-- AlterTable
ALTER TABLE "leads" ADD COLUMN "externalId" TEXT;

-- CreateIndex
CREATE INDEX "leads_projectId_channel_externalId_idx" ON "leads"("projectId", "channel", "externalId");
