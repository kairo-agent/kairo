-- Fase 4.A Multi-Canal Realtime — agrega `realtimeTopicSecret` a conversaciones.
--
-- Modelo de seguridad:
--   - El widget WebChat se conecta a Supabase Realtime con la anon key (publica)
--     y hace phx_join al topic `realtime:wc:<realtimeTopicSecret>`. El topic
--     name es un UUID v4 que SOLO el server y el widget legitimo conocen.
--   - El backend emite un broadcast SIN payload sensible (solo "hay algo nuevo"),
--     y el widget responde refetcheando el endpoint /api/webchat/messages que ya
--     valida publicKey + tenant. El broadcast funciona como senal, no como fuente
--     de verdad — un atacante con anon key NO puede inyectar mensajes falsos.
--   - Se desacopla del `Conversation.id` (cuid) para que un leak de id no
--     comprometa el canal Realtime.
--
-- Backfill: las conversaciones existentes reciben un UUID auto-generado para no
-- romper el handler/pipeline al primer mensaje post-deploy.

-- 1. Agregar columna nullable
ALTER TABLE "conversations" ADD COLUMN "realtimeTopicSecret" TEXT;

-- 2. Backfill (gen_random_uuid requiere extension pgcrypto, ya disponible en Supabase)
UPDATE "conversations" SET "realtimeTopicSecret" = gen_random_uuid()::text WHERE "realtimeTopicSecret" IS NULL;

-- 3. Hacer la columna requerida + default
ALTER TABLE "conversations" ALTER COLUMN "realtimeTopicSecret" SET NOT NULL;
ALTER TABLE "conversations" ALTER COLUMN "realtimeTopicSecret" SET DEFAULT gen_random_uuid()::text;

-- 4. Unique index (defensa: dos conversaciones nunca comparten topic)
CREATE UNIQUE INDEX "conversations_realtimeTopicSecret_key" ON "conversations"("realtimeTopicSecret");
