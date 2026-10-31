-- ==============================================================================
-- Migration: 20261030132000_create_approved_public_complaints_view.sql
-- Description: Secure public map view and RPC returning only approved complaints,
--              reviewed photos, and safe public progress notes.
--              Reporters' names, emails, phone numbers, and private photos are never exposed.
-- ==============================================================================

-- 1. Create a safe public view exposing strictly approved consolidated hazards
CREATE OR REPLACE VIEW public.approved_public_complaints AS
SELECT
    c.id,
    c.reference_no,
    c.title,
    c.description,
    c.latitude,
    c.longitude,
    c.address,
    c.priority,
    c.status,
    c.report_count,
    c.resolution_notes,
    c.resolved_at,
    c.created_at,
    c.updated_at,
    -- Select first approved photograph, if one passed attachment review
    (
        SELECT ra.public_url
        FROM public.report_attachments ra
        WHERE ra.complaint_id = c.id
          AND ra.is_approved = true
        ORDER BY ra.created_at ASC
        LIMIT 1
    ) AS approved_photo_url,
    -- Count verified attached reports
    (
        SELECT COUNT(*)::INTEGER
        FROM public.reports r
        WHERE r.complaint_id = c.id
    ) AS reports_count
FROM public.complaints c
WHERE c.is_public = true
  AND c.status IN ('Approved', 'Assigned', 'In Progress', 'Resolved', 'Closed');

-- Grant read access on the public view to all roles (anon and authenticated)
GRANT SELECT ON public.approved_public_complaints TO anon, authenticated;

-- 2. Secure RPC to fetch approved public complaints with optional status and priority filtering
CREATE OR REPLACE FUNCTION public.get_approved_public_complaints(
    p_status TEXT DEFAULT 'All',
    p_priority TEXT DEFAULT 'All',
    p_search TEXT DEFAULT ''
)
RETURNS TABLE (
    id UUID,
    reference_no TEXT,
    title TEXT,
    description TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    address TEXT,
    priority TEXT,
    status TEXT,
    report_count INTEGER,
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    approved_photo_url TEXT,
    reports_count INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT
        v.id,
        v.reference_no,
        v.title,
        v.description,
        v.latitude,
        v.longitude,
        v.address,
        v.priority,
        v.status,
        v.report_count,
        v.resolution_notes,
        v.resolved_at,
        v.created_at,
        v.updated_at,
        v.approved_photo_url,
        v.reports_count
    FROM public.approved_public_complaints v
    WHERE
        (p_status = 'All' OR v.status = p_status)
        AND (p_priority = 'All' OR v.priority = p_priority)
        AND (
            p_search = ''
            OR v.reference_no ILIKE '%' || p_search || '%'
            OR v.title ILIKE '%' || p_search || '%'
            OR COALESCE(v.address, '') ILIKE '%' || p_search || '%'
        )
    ORDER BY v.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_approved_public_complaints(TEXT, TEXT, TEXT) TO anon, authenticated;

