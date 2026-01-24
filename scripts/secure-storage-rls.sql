-- ============================================
-- SECURE RLS POLICIES FOR SUPABASE STORAGE
-- ============================================
--
-- Este script reemplaza las políticas RLS actuales con
-- políticas seguras que verifican membresía al proyecto.
--
-- EJECUTAR EN: Supabase Dashboard → SQL Editor
-- ============================================

-- 1. Eliminar políticas existentes (inseguras)
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete" ON storage.objects;

-- 2. Crear función helper para verificar acceso al proyecto
CREATE OR REPLACE FUNCTION storage.user_has_project_access(file_path TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    project_id TEXT;
    user_role TEXT;
    has_membership BOOLEAN;
BEGIN
    -- Extraer projectId del path (primer segmento)
    -- Path format: {projectId}/{year}/{month}/{uuid}.{ext}
    project_id := split_part(file_path, '/', 1);

    -- Si no hay projectId válido, denegar
    IF project_id IS NULL OR project_id = '' THEN
        RETURN FALSE;
    END IF;

    -- Verificar si es super_admin (acceso total)
    SELECT system_role INTO user_role
    FROM public."User"
    WHERE id = auth.uid()::TEXT;

    IF user_role = 'super_admin' THEN
        RETURN TRUE;
    END IF;

    -- Verificar membresía al proyecto
    SELECT EXISTS(
        SELECT 1 FROM public."ProjectMember"
        WHERE "userId" = auth.uid()::TEXT
        AND "projectId" = project_id
    ) INTO has_membership;

    RETURN has_membership;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Política: Solo miembros del proyecto pueden subir archivos
CREATE POLICY "Project members can upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'media'
    AND storage.user_has_project_access(name)
);

-- 4. Política: Lectura pública (las URLs son públicas para WhatsApp)
CREATE POLICY "Public read access"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'media');

-- 5. Política: Solo miembros del proyecto pueden eliminar
CREATE POLICY "Project members can delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'media'
    AND storage.user_has_project_access(name)
);

-- 6. Verificar que las políticas se crearon correctamente
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage';
