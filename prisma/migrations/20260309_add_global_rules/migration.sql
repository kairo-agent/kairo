-- CreateTable
CREATE TABLE "global_rules" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "global_rules_isActive_order_idx" ON "global_rules"("isActive", "order");
