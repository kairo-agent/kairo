-- AlterTable: drop legacy whatsappPhoneNumber column from projects (Fase 2.4).
-- Pre-requisito: codigo no lee/escribe este campo (verified empty grep).
-- ProjectChannel.config.phoneNumberDisplay reemplaza este campo (decision #15
-- del plan multi-canal). En BD actual TODOS los proyectos tenian este campo
-- en NULL (verificado en Fase 1.2 backfill), asi que el drop no pierde datos.
-- Operacion idempotente con IF EXISTS.

ALTER TABLE "projects" DROP COLUMN IF EXISTS "whatsappPhoneNumber";
