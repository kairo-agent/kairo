-- CreateTable
CREATE TABLE "project_channels" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "channel" "LeadChannel" NOT NULL,
    "provisioned" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "publicKey" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_channels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_channels_publicKey_key" ON "project_channels"("publicKey");

-- CreateIndex
CREATE INDEX "project_channels_projectId_idx" ON "project_channels"("projectId");

-- CreateIndex
CREATE INDEX "project_channels_publicKey_idx" ON "project_channels"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "project_channels_projectId_channel_key" ON "project_channels"("projectId", "channel");

-- AddForeignKey
ALTER TABLE "project_channels" ADD CONSTRAINT "project_channels_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable RLS (safety net; Supabase trigger should auto-enable on new tables)
ALTER TABLE "project_channels" ENABLE ROW LEVEL SECURITY;

-- RLS Policy: project members can SELECT their channels (super_admin bypassed by helper fn)
-- Pattern consistente con leads RLS policy. INSERT/UPDATE/DELETE solo via service_role
-- (server actions); RLS implicitamente bloquea acceso directo desde cliente browser.
CREATE POLICY "project_channels_select" ON "project_channels"
  FOR SELECT
  USING (user_has_project_access("projectId"));

-- Backfill: create whatsapp ProjectChannel for each existing project
-- (idempotent via NOT EXISTS check, safe to re-run)
INSERT INTO "project_channels" (id, "projectId", channel, provisioned, enabled, config, "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  p.id,
  'whatsapp',
  true,
  true,
  CASE
    WHEN p."whatsappPhoneNumber" IS NOT NULL
    THEN jsonb_build_object('phoneNumberDisplay', p."whatsappPhoneNumber")
    ELSE '{}'::jsonb
  END,
  NOW(),
  NOW()
FROM projects p
WHERE NOT EXISTS (
  SELECT 1 FROM "project_channels" pc
  WHERE pc."projectId" = p.id AND pc.channel = 'whatsapp'
);
