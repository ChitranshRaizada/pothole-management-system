-- ==============================================================================
-- MIGRATION: 20261030140000_pothole_reports_storage_and_rls.sql
-- PURPOSE: Create private 'pothole-reports' Supabase Storage bucket with strict RLS
-- ==============================================================================

-- 1. Create or configure private storage bucket for pothole report photographs
-- Bucket is strictly private (public = false) with an 8 MB size limit and image-only MIME types
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'pothole-reports',
    'pothole-reports',
    false, -- Private bucket: Never expose raw photos to public
    8388608, -- 8 MB (8 * 1024 * 1024 bytes)
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 8388608,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 2. Storage RLS Policies for 'pothole-reports' bucket
-- Policy A: Authenticated users can upload to pothole-reports
DROP POLICY IF EXISTS "Authenticated citizens can upload pothole reports" ON storage.objects;
CREATE POLICY "Authenticated citizens can upload pothole reports"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'pothole-reports');

-- Policy B: Authenticated citizens and admins can view report photos
DROP POLICY IF EXISTS "Citizens and admins can read pothole report photos" ON storage.objects;
CREATE POLICY "Citizens and admins can read pothole report photos"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'pothole-reports');

-- Policy C: Authenticated citizens and admins can delete/cleanup photos
DROP POLICY IF EXISTS "Citizens and admins can delete pothole report photos" ON storage.objects;
CREATE POLICY "Citizens and admins can delete pothole report photos"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'pothole-reports');

