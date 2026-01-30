-- ========================================================
-- RLS Policies para tabla messages - Soporte Realtime
-- ========================================================
--
-- Propósito: Habilitar políticas SELECT en tabla messages para
-- que Supabase Realtime funcione correctamente.
--
-- Contexto: Supabase Realtime respeta RLS. Sin política SELECT,
-- no hay broadcasts aunque RLS esté habilitado.
--
-- Ejecutar en: Supabase SQL Editor
-- Proyecto: KAIRO
-- Fecha: 2026-01-29
-- ========================================================

-- Función helper: verificar acceso a conversación
-- Retorna TRUE si:
-- 1. El usuario es super_admin, o
-- 2. El usuario es miembro del proyecto al que pertenece el lead de la conversación
CREATE OR REPLACE FUNCTION public.user_has_conversation_access(conv_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Super admins tienen acceso a todo
  IF EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()::TEXT AND "systemRole" = 'super_admin'
  ) THEN
    RETURN TRUE;
  END IF;

  -- Verificar membresía en proyecto vía conversación → lead → project
  RETURN EXISTS (
    SELECT 1
    FROM conversations c
    JOIN leads l ON c."leadId" = l.id
    JOIN project_members pm ON l."projectId" = pm."projectId"
    WHERE c.id = conv_id AND pm."userId" = auth.uid()::TEXT
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================================
-- Política SELECT (CRÍTICA para Realtime)
-- ========================================================
-- Sin esta política, Realtime NO envía broadcasts aunque RLS esté habilitado
DROP POLICY IF EXISTS "Users can read messages from their conversations" ON messages;
CREATE POLICY "Users can read messages from their conversations"
  ON messages FOR SELECT TO authenticated
  USING (public.user_has_conversation_access("conversationId"));

-- ========================================================
-- Política INSERT
-- ========================================================
-- Permite insertar mensajes solo en conversaciones con acceso
DROP POLICY IF EXISTS "Users can insert messages to their conversations" ON messages;
CREATE POLICY "Users can insert messages to their conversations"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (public.user_has_conversation_access("conversationId"));

-- ========================================================
-- Política UPDATE
-- ========================================================
-- Permite actualizar estado de mensajes (delivered, read)
DROP POLICY IF EXISTS "Users can update messages in their conversations" ON messages;
CREATE POLICY "Users can update messages in their conversations"
  ON messages FOR UPDATE TO authenticated
  USING (public.user_has_conversation_access("conversationId"));

-- ========================================================
-- Verificación de políticas instaladas
-- ========================================================
-- Ejecutar para confirmar que las políticas están activas:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE tablename = 'messages';
