-- AlterTable: Add archivedAt field to leads
ALTER TABLE "leads" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- CreateIndex: Composite index for efficient archive filtering per project
CREATE INDEX "leads_projectId_archivedAt_idx" ON "leads"("projectId", "archivedAt");
