-- CreateEnum
CREATE TYPE "HandoffMode" AS ENUM ('ai', 'human');

-- CreateEnum
CREATE TYPE "MessageSender" AS ENUM ('ai', 'human', 'lead');

-- AlterTable: Add n8n integration fields to Project
ALTER TABLE "projects" ADD COLUMN "n8nWebhookUrl" TEXT;
ALTER TABLE "projects" ADD COLUMN "n8nApiKey" TEXT;
ALTER TABLE "projects" ADD COLUMN "whatsappPhoneNumber" TEXT;

-- AlterTable: Add handoff fields to Lead
ALTER TABLE "leads" ADD COLUMN "handoffMode" "HandoffMode" NOT NULL DEFAULT 'ai';
ALTER TABLE "leads" ADD COLUMN "handoffAt" TIMESTAMP(3);
ALTER TABLE "leads" ADD COLUMN "handoffUserId" TEXT;
ALTER TABLE "leads" ADD COLUMN "whatsappId" TEXT;

-- CreateTable: Conversation
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Message
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "sender" "MessageSender" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentByUserId" TEXT,
    "whatsappMsgId" TEXT,
    "metadata" JSONB,
    "isDelivered" BOOLEAN NOT NULL DEFAULT false,
    "deliveredAt" TIMESTAMP(3),
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversations_leadId_key" ON "conversations"("leadId");
CREATE INDEX "conversations_leadId_idx" ON "conversations"("leadId");

-- CreateIndex
CREATE INDEX "messages_conversationId_idx" ON "messages"("conversationId");
CREATE INDEX "messages_sender_idx" ON "messages"("sender");
CREATE INDEX "messages_createdAt_idx" ON "messages"("createdAt");
CREATE INDEX "messages_whatsappMsgId_idx" ON "messages"("whatsappMsgId");

-- CreateIndex for Lead handoff fields
CREATE INDEX "leads_handoffMode_idx" ON "leads"("handoffMode");
CREATE INDEX "leads_whatsappId_idx" ON "leads"("whatsappId");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_handoffUserId_fkey" FOREIGN KEY ("handoffUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
