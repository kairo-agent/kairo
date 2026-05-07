-- AlterTable: drop n8n legacy columns from projects
-- Pre-requisito: ya no hay codigo que lea/escriba estos campos (Fase 1.7b cleanup
-- en commits previos). Schema.prisma ya los removio. La columna fisica sigue en BD
-- hasta ejecutar este SQL en Supabase SQL Editor.
--
-- Las columnas son nullable, asi que el DROP es seguro (no requiere defaults).
-- Operacion idempotente con IF EXISTS por si se ejecuta dos veces.
--
-- Pendiente de aplicar manualmente:
ALTER TABLE "projects" DROP COLUMN IF EXISTS "n8nWebhookUrl";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "n8nApiKey";
