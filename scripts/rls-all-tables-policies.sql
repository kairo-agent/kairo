-- ========================================================
-- RLS POLICIES COMPLETAS - TODAS LAS TABLAS DE KAIRO
-- ========================================================
--
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- Proyecto: KAIRO
-- Fecha: 2026-03-12
--
-- Patron:
--   - service_role (Prisma backend) bypassa RLS automaticamente
--   - authenticated users: acceso via project membership
--   - super_admin: acceso total
--   - Realtime NECESITA policy SELECT para funcionar
-- ========================================================

-- ========================================================
-- FUNCION HELPER: Verificar acceso a proyecto
-- ========================================================
CREATE OR REPLACE FUNCTION public.user_has_project_access(p_project_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Super admins tienen acceso a todo
  IF EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()::TEXT AND "systemRole" = 'super_admin'
  ) THEN
    RETURN TRUE;
  END IF;

  -- Verificar membresia en proyecto
  RETURN EXISTS (
    SELECT 1 FROM project_members
    WHERE "userId" = auth.uid()::TEXT AND "projectId" = p_project_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================================
-- FUNCION HELPER: Verificar si es super_admin
-- ========================================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()::TEXT AND "systemRole" = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================================
-- FUNCION HELPER: Verificar membresia en organizacion
-- ========================================================
CREATE OR REPLACE FUNCTION public.user_has_org_access(p_org_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF public.is_super_admin() THEN RETURN TRUE; END IF;

  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE "userId" = auth.uid()::TEXT AND "organizationId" = p_org_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================================
-- 1. USERS
-- ========================================================
DROP POLICY IF EXISTS "Users can read own profile" ON users;
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT TO authenticated
  USING (id = auth.uid()::TEXT OR public.is_super_admin());

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE TO authenticated
  USING (id = auth.uid()::TEXT OR public.is_super_admin());

-- ========================================================
-- 2. ORGANIZATIONS
-- ========================================================
DROP POLICY IF EXISTS "Users can read their organizations" ON organizations;
CREATE POLICY "Users can read their organizations"
  ON organizations FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM organization_members
      WHERE "organizationId" = organizations.id AND "userId" = auth.uid()::TEXT
    )
  );

-- ========================================================
-- 3. ORGANIZATION_MEMBERS
-- ========================================================
DROP POLICY IF EXISTS "Users can read org memberships" ON organization_members;
CREATE POLICY "Users can read org memberships"
  ON organization_members FOR SELECT TO authenticated
  USING (
    "userId" = auth.uid()::TEXT
    OR public.is_super_admin()
    OR public.user_has_org_access("organizationId")
  );

-- ========================================================
-- 4. PROJECTS
-- ========================================================
DROP POLICY IF EXISTS "Users can read their projects" ON projects;
CREATE POLICY "Users can read their projects"
  ON projects FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM project_members
      WHERE "projectId" = projects.id AND "userId" = auth.uid()::TEXT
    )
  );

-- ========================================================
-- 5. PROJECT_MEMBERS
-- ========================================================
DROP POLICY IF EXISTS "Users can read project memberships" ON project_members;
CREATE POLICY "Users can read project memberships"
  ON project_members FOR SELECT TO authenticated
  USING (
    "userId" = auth.uid()::TEXT
    OR public.is_super_admin()
    OR public.user_has_project_access("projectId")
  );

-- ========================================================
-- 6. LEADS (CRITICO para Realtime)
-- ========================================================
DROP POLICY IF EXISTS "Users can read leads from their projects" ON leads;
CREATE POLICY "Users can read leads from their projects"
  ON leads FOR SELECT TO authenticated
  USING (public.user_has_project_access("projectId"));

DROP POLICY IF EXISTS "Users can update leads from their projects" ON leads;
CREATE POLICY "Users can update leads from their projects"
  ON leads FOR UPDATE TO authenticated
  USING (public.user_has_project_access("projectId"));

DROP POLICY IF EXISTS "Users can insert leads to their projects" ON leads;
CREATE POLICY "Users can insert leads to their projects"
  ON leads FOR INSERT TO authenticated
  WITH CHECK (public.user_has_project_access("projectId"));

-- ========================================================
-- 7. CONVERSATIONS
-- ========================================================
DROP POLICY IF EXISTS "Users can read conversations from their projects" ON conversations;
CREATE POLICY "Users can read conversations from their projects"
  ON conversations FOR SELECT TO authenticated
  USING (
    public.user_has_conversation_access(id)
  );

-- ========================================================
-- 8. MESSAGES (ya tiene policies de rls-messages-realtime.sql)
-- Solo recrear si no existen
-- ========================================================
-- Las policies de messages ya fueron creadas por rls-messages-realtime.sql
-- Si necesitas recrear, descomenta:
-- DROP POLICY IF EXISTS "Users can read messages from their conversations" ON messages;
-- CREATE POLICY "Users can read messages from their conversations"
--   ON messages FOR SELECT TO authenticated
--   USING (public.user_has_conversation_access("conversationId"));

-- ========================================================
-- 9. AI_AGENTS
-- ========================================================
DROP POLICY IF EXISTS "Users can read agents from their projects" ON ai_agents;
CREATE POLICY "Users can read agents from their projects"
  ON ai_agents FOR SELECT TO authenticated
  USING (public.user_has_project_access("projectId"));

DROP POLICY IF EXISTS "Users can update agents from their projects" ON ai_agents;
CREATE POLICY "Users can update agents from their projects"
  ON ai_agents FOR UPDATE TO authenticated
  USING (public.user_has_project_access("projectId"));

-- ========================================================
-- 10. NOTES
-- ========================================================
DROP POLICY IF EXISTS "Users can read notes from their projects" ON notes;
CREATE POLICY "Users can read notes from their projects"
  ON notes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leads l
      WHERE l.id = notes."leadId" AND public.user_has_project_access(l."projectId")
    )
  );

DROP POLICY IF EXISTS "Users can insert notes" ON notes;
CREATE POLICY "Users can insert notes"
  ON notes FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leads l
      WHERE l.id = notes."leadId" AND public.user_has_project_access(l."projectId")
    )
  );

-- ========================================================
-- 11. ACTIVITIES
-- ========================================================
DROP POLICY IF EXISTS "Users can read activities from their projects" ON activities;
CREATE POLICY "Users can read activities from their projects"
  ON activities FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leads l
      WHERE l.id = activities."leadId" AND public.user_has_project_access(l."projectId")
    )
  );

DROP POLICY IF EXISTS "Users can insert activities" ON activities;
CREATE POLICY "Users can insert activities"
  ON activities FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leads l
      WHERE l.id = activities."leadId" AND public.user_has_project_access(l."projectId")
    )
  );

-- ========================================================
-- 12. NOTIFICATIONS (CRITICO para Realtime)
-- ========================================================
DROP POLICY IF EXISTS "Users can read their notifications" ON notifications;
CREATE POLICY "Users can read their notifications"
  ON notifications FOR SELECT TO authenticated
  USING ("userId" = auth.uid()::TEXT OR public.is_super_admin());

DROP POLICY IF EXISTS "Users can update their notifications" ON notifications;
CREATE POLICY "Users can update their notifications"
  ON notifications FOR UPDATE TO authenticated
  USING ("userId" = auth.uid()::TEXT OR public.is_super_admin());

DROP POLICY IF EXISTS "Service can insert notifications" ON notifications;
CREATE POLICY "Service can insert notifications"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (true);

-- ========================================================
-- 13. GLOBAL_RULES (solo super_admin)
-- ========================================================
DROP POLICY IF EXISTS "Super admins can manage global rules" ON global_rules;
CREATE POLICY "Super admins can manage global rules"
  ON global_rules FOR ALL TO authenticated
  USING (public.is_super_admin());

-- Todos pueden leer (se inyectan en system prompt)
DROP POLICY IF EXISTS "Authenticated can read global rules" ON global_rules;
CREATE POLICY "Authenticated can read global rules"
  ON global_rules FOR SELECT TO authenticated
  USING (true);

-- ========================================================
-- 14. PUSH_SUBSCRIPTIONS
-- ========================================================
DROP POLICY IF EXISTS "Users can manage their push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can manage their push subscriptions"
  ON push_subscriptions FOR ALL TO authenticated
  USING ("userId" = auth.uid()::TEXT);

-- ========================================================
-- 15. PROJECT_SECRETS (solo super_admin)
-- ========================================================
DROP POLICY IF EXISTS "Super admins can manage project secrets" ON project_secrets;
CREATE POLICY "Super admins can manage project secrets"
  ON project_secrets FOR ALL TO authenticated
  USING (public.is_super_admin());

-- ========================================================
-- 16. SECRET_ACCESS_LOGS (solo super_admin)
-- ========================================================
DROP POLICY IF EXISTS "Super admins can read access logs" ON secret_access_logs;
CREATE POLICY "Super admins can read access logs"
  ON secret_access_logs FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Service can insert access logs" ON secret_access_logs;
CREATE POLICY "Service can insert access logs"
  ON secret_access_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- ========================================================
-- NOTA: _prisma_migrations NO necesita RLS
-- Es una tabla interna de Prisma usada solo por CLI migrations
-- ========================================================

-- ========================================================
-- HABILITAR RLS en tablas que faltan
-- ========================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ========================================================
-- VERIFICACION FINAL
-- ========================================================
-- Ejecutar despues para confirmar todas las policies:
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
