-- ==============================================================================
-- MIGRATION: 20261030143500_pothole_reports_storage_rls_policies.sql
-- PURPOSE: Supabase Storage RLS Policies for private 'pothole-reports' bucket.
--          Enforces folder-level citizen isolation (USER_ID/REPORT_ID/FILENAME)
--          and administrative review access.
-- ==============================================================================

-- 1. Ensure private 'pothole-reports' bucket exists and enforces strict constraints
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'pothole-reports',
    'pothole-reports',
    false, -- Strictly private: No anonymous or public access
    8388608, -- 8 MB maximum file size limit (8 * 1024 * 1024 bytes)
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 8388608,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- NOTE: storage.objects is owned by supabase_storage_admin and has RLS enabled by default.
-- Do not run `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;` as it triggers error 42501 (must be owner of table objects).

-- 2. Clean up any existing or conflicting policies on storage.objects for pothole-reports
DROP POLICY IF EXISTS "Authenticated citizens can upload pothole reports" ON storage.objects;
DROP POLICY IF EXISTS "Citizens can upload own pothole photos" ON storage.objects;
DROP POLICY IF EXISTS "Citizens can upload photographs to their own folder" ON storage.objects;

DROP POLICY IF EXISTS "Citizens and admins can read pothole report photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own photographs or admins can view all" ON storage.objects;

DROP POLICY IF EXISTS "Citizens and admins can delete pothole report photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own photographs or admins can delete any" ON storage.objects;


-- 3. POLICY: INSERT (Citizens and Admins upload only into their own folder: USER_ID/...)
-- - Enforces bucket_id = 'pothole-reports'
-- - Checks that the first folder in the path matches the authenticated caller's auth.uid()
-- - Verifies that the caller has an assigned role ('citizen' or 'admin') in public.user_roles
CREATE POLICY "Citizens can upload photographs to their own folder"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'pothole-reports'
        AND (storage.foldername(name))[1] = auth.uid()::text
        AND EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
              AND role IN ('citizen', 'admin')
        )
    );


-- 4. POLICY: SELECT (Citizens can view only their own photos; Admins can view all)
-- - Regular citizens are isolated strictly to files where the root folder is their own auth.uid()
-- - Authorized administrators (is_admin() = true) can inspect any photo for review and verification
CREATE POLICY "Users can view own photographs or admins can view all"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'pothole-reports'
        AND (
            (storage.foldername(name))[1] = auth.uid()::text
            OR public.is_admin()
        )
    );


-- 5. POLICY: DELETE (Citizens can delete their own unprocessed files for cleanup; Admins can delete any)
-- - Used for orphan file cleanup when a database submission transaction fails
-- - Admins retain moderation deletion rights
CREATE POLICY "Users can delete own photographs or admins can delete any"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'pothole-reports'
        AND (
            (storage.foldername(name))[1] = auth.uid()::text
            OR public.is_admin()
        )
    );

