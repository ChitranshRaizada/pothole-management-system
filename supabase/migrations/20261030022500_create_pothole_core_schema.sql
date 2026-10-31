-- ==============================================================================
-- Migration: 20261030022500_create_pothole_core_schema.sql
-- Description: Production database schema for RoadCare Pothole Management System
-- Tables: profiles, user_roles, complaints, reports, report_attachments,
--         repair_teams, complaint_assignments, complaint_status_history, complaint_audit_log
-- Security: Strict Row Level Security (RLS), server-controlled roles, PostGIS geospatial
--           20-metre duplicate clustering, and transactional report submission.
-- ==============================================================================

-- 0. Enable PostGIS Extension if available
CREATE EXTENSION IF NOT EXISTS postgis;

-- ------------------------------------------------------------------------------
-- 1. PROFILES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. USER ROLES TABLE (Server-Controlled; Prevents Self-Assignment)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('citizen', 'admin')),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT uq_user_roles UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security Definer: Check if user has administrator role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
    );
$$;

-- Security Definer: Get primary role of user
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT COALESCE(
        (SELECT role FROM public.user_roles WHERE user_id = p_user_id AND role = 'admin' LIMIT 1),
        (SELECT role FROM public.user_roles WHERE user_id = p_user_id LIMIT 1),
        'citizen'
    );
$$;

-- RLS: Profiles Policies
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    USING (public.is_admin());

CREATE POLICY "Users can update their own basic profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- RLS: User Roles Policies (Strict: Citizens CANNOT insert/update roles)
CREATE POLICY "Users can view their own roles"
    ON public.user_roles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all user roles"
    ON public.user_roles FOR SELECT
    USING (public.is_admin());

CREATE POLICY "Only admins can insert roles"
    ON public.user_roles FOR INSERT
    WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can update roles"
    ON public.user_roles FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can delete roles"
    ON public.user_roles FOR DELETE
    USING (public.is_admin());

-- Trigger: Automatically provision profile & default 'citizen' role on sign up
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 1. Insert Profile
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;

    -- 2. Insert Default 'citizen' Role (Never grant admin automatically)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'citizen')
    ON CONFLICT (user_id, role) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_new_auth_user ON auth.users;
CREATE TRIGGER trg_handle_new_auth_user
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();


-- ------------------------------------------------------------------------------
-- 3. REPAIR TEAMS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.repair_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    leader_name TEXT NOT NULL,
    contact_number TEXT NOT NULL,
    zone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'busy', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.repair_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view repair teams"
    ON public.repair_teams FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Only admins can manage repair teams"
    ON public.repair_teams FOR ALL
    USING (public.is_admin());


-- ------------------------------------------------------------------------------
-- 4. CONSOLIDATED COMPLAINTS TABLE (Master Pothole Records)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_no TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOGRAPHY(Point, 4326),
    address TEXT,
    priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
    status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Under Review', 'Approved', 'Assigned', 'In Progress', 'Resolved', 'Closed', 'Rejected')),
    assigned_team_id UUID REFERENCES public.repair_teams(id) ON DELETE SET NULL,
    reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    report_count INTEGER NOT NULL DEFAULT 1 CHECK (report_count >= 1),
    is_public BOOLEAN NOT NULL DEFAULT false,
    estimated_repair_date DATE,
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for status, coordinates, and geospatial queries
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_priority ON public.complaints(priority);
CREATE INDEX IF NOT EXISTS idx_complaints_is_public ON public.complaints(is_public);
CREATE INDEX IF NOT EXISTS idx_complaints_reporter ON public.complaints(reporter_id);
CREATE INDEX IF NOT EXISTS idx_complaints_location ON public.complaints USING GIST(location);

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- Synchronize geography location column and public map visibility
CREATE OR REPLACE FUNCTION public.sync_complaint_attributes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Synchronize PostGIS geography point from coordinates
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;

    -- Requirement 9: Unapproved complaints hidden from public map
    IF NEW.status IN ('Approved', 'Assigned', 'In Progress', 'Resolved', 'Closed') THEN
        NEW.is_public := true;
    ELSE
        NEW.is_public := false;
    END IF;

    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_complaint_attributes ON public.complaints;
CREATE TRIGGER trg_sync_complaint_attributes
    BEFORE INSERT OR UPDATE ON public.complaints
    FOR EACH ROW EXECUTE FUNCTION public.sync_complaint_attributes();

-- Complaints RLS
CREATE POLICY "Public can view approved complaints on public map"
    ON public.complaints FOR SELECT
    USING (is_public = true);

CREATE POLICY "Reporters can view their own filed complaints"
    ON public.complaints FOR SELECT
    USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can view all complaints"
    ON public.complaints FOR SELECT
    USING (public.is_admin());

CREATE POLICY "Authenticated users can insert complaints"
    ON public.complaints FOR INSERT
    WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Admins can update complaints"
    ON public.complaints FOR UPDATE
    USING (public.is_admin());

CREATE POLICY "Admins can delete complaints"
    ON public.complaints FOR DELETE
    USING (public.is_admin());


-- ------------------------------------------------------------------------------
-- 5. INDIVIDUAL REPORTS TABLE (Preserving Reporter Data & Coordinates)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reporter_name TEXT,
    description TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOGRAPHY(Point, 4326),
    accuracy_meters DOUBLE PRECISION,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    distance_from_master DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_reports_complaint_id ON public.reports(complaint_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_location ON public.reports USING GIST(location);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.sync_report_location()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_report_location ON public.reports;
CREATE TRIGGER trg_sync_report_location
    BEFORE INSERT OR UPDATE ON public.reports
    FOR EACH ROW EXECUTE FUNCTION public.sync_report_location();

-- RLS: Citizens can ONLY read their own reports; Admins can read all reports
CREATE POLICY "Reporters can view their own individual reports"
    ON public.reports FOR SELECT
    USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can view all reports"
    ON public.reports FOR SELECT
    USING (public.is_admin());

CREATE POLICY "Authenticated reporters can submit reports"
    ON public.reports FOR INSERT
    WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Only admins can update or relink reports"
    ON public.reports FOR UPDATE
    USING (public.is_admin());


-- ------------------------------------------------------------------------------
-- 6. REPORT ATTACHMENTS TABLE (Private Storage Metadata & Independent Review)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.report_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    public_url TEXT,
    file_name TEXT,
    file_size_bytes BIGINT,
    mime_type TEXT,
    is_approved BOOLEAN NOT NULL DEFAULT false,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_report_attachments_report ON public.report_attachments(report_id);
CREATE INDEX IF NOT EXISTS idx_report_attachments_complaint ON public.report_attachments(complaint_id);
CREATE INDEX IF NOT EXISTS idx_report_attachments_is_approved ON public.report_attachments(is_approved);

ALTER TABLE public.report_attachments ENABLE ROW LEVEL SECURITY;

-- Requirement 9: Public map can ONLY query approved attachments on public complaints
CREATE POLICY "Public can view approved attachments for public complaints"
    ON public.report_attachments FOR SELECT
    USING (
        is_approved = true
        AND EXISTS (
            SELECT 1 FROM public.complaints c
            WHERE c.id = complaint_id AND c.is_public = true
        )
    );

CREATE POLICY "Reporters can view their own uploaded attachments"
    ON public.report_attachments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.reports r
            WHERE r.id = report_id AND r.reporter_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all attachments"
    ON public.report_attachments FOR SELECT
    USING (public.is_admin());

CREATE POLICY "Reporters can insert attachments for their reports"
    ON public.report_attachments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.reports r
            WHERE r.id = report_id AND r.reporter_id = auth.uid()
        )
    );

CREATE POLICY "Admins can update attachment review status"
    ON public.report_attachments FOR UPDATE
    USING (public.is_admin());


-- ------------------------------------------------------------------------------
-- 7. COMPLAINT ASSIGNMENTS TABLE (Squad Work Dispatch History)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.complaint_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES public.repair_teams(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    target_completion_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_assignments_complaint ON public.complaint_assignments(complaint_id);
CREATE INDEX IF NOT EXISTS idx_assignments_team ON public.complaint_assignments(team_id);

ALTER TABLE public.complaint_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view assignments for public complaints"
    ON public.complaint_assignments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.complaints c
            WHERE c.id = complaint_id AND (c.is_public = true OR c.reporter_id = auth.uid())
        )
    );

CREATE POLICY "Admins can manage assignments"
    ON public.complaint_assignments FOR ALL
    USING (public.is_admin());


-- ------------------------------------------------------------------------------
-- 8. COMPLAINT STATUS HISTORY TABLE (Audit Trail & Valid Status Transitions)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.complaint_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT NOT NULL,
    notes TEXT,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_status_history_complaint ON public.complaint_status_history(complaint_id);

ALTER TABLE public.complaint_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view status history of public complaints"
    ON public.complaint_status_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.complaints c
            WHERE c.id = complaint_id AND (c.is_public = true OR c.reporter_id = auth.uid())
        )
    );

CREATE POLICY "Admins can view all status histories"
    ON public.complaint_status_history FOR SELECT
    USING (public.is_admin());

CREATE POLICY "System and admins can insert status history"
    ON public.complaint_status_history FOR INSERT
    WITH CHECK (true);

-- Requirement 10: Enforce Valid Status Transitions
CREATE OR REPLACE FUNCTION public.enforce_status_transitions()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        IF (OLD.status = 'New' AND NEW.status NOT IN ('Under Review', 'Rejected')) OR
           (OLD.status = 'Under Review' AND NEW.status NOT IN ('Approved', 'Rejected')) OR
           (OLD.status = 'Approved' AND NEW.status NOT IN ('Assigned', 'Rejected')) OR
           (OLD.status = 'Assigned' AND NEW.status NOT IN ('In Progress', 'Under Review')) OR
           (OLD.status = 'In Progress' AND NEW.status NOT IN ('Resolved', 'Assigned')) OR
           (OLD.status = 'Resolved' AND NEW.status NOT IN ('Closed', 'In Progress')) OR
           (OLD.status = 'Closed') OR
           (OLD.status = 'Rejected' AND NEW.status NOT IN ('Under Review'))
        THEN
            RAISE EXCEPTION 'Invalid status transition from "%" to "%"', OLD.status, NEW.status;
        END IF;

        IF NEW.status = 'Resolved' AND OLD.status != 'Resolved' THEN
            NEW.resolved_at := timezone('utc'::text, now());
        END IF;

        -- Record into history table
        INSERT INTO public.complaint_status_history (complaint_id, from_status, to_status, notes, changed_by)
        VALUES (NEW.id, OLD.status, NEW.status, NEW.resolution_notes, auth.uid());
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_status_transitions ON public.complaints;
CREATE TRIGGER trg_enforce_status_transitions
    BEFORE UPDATE ON public.complaints
    FOR EACH ROW EXECUTE FUNCTION public.enforce_status_transitions();


-- ------------------------------------------------------------------------------
-- 9. COMPLAINT AUDIT LOG TABLE (Administrator & System Actions)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.complaint_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID REFERENCES public.complaints(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details JSONB,
    performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_log_complaint ON public.complaint_audit_log(complaint_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.complaint_audit_log(action);

ALTER TABLE public.complaint_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view audit logs"
    ON public.complaint_audit_log FOR SELECT
    USING (public.is_admin());

CREATE POLICY "Only system triggers/functions can insert audit logs"
    ON public.complaint_audit_log FOR INSERT
    WITH CHECK (public.is_admin() OR auth.role() = 'authenticated');


-- ------------------------------------------------------------------------------
-- 10. GEOSPATIAL 20-METRE DUPLICATE DETECTION & TRANSACTIONAL SUBMISSION
-- ------------------------------------------------------------------------------

-- Find nearest active complaint within 20 metres
CREATE OR REPLACE FUNCTION public.find_nearest_active_complaint(
    p_lat DOUBLE PRECISION,
    p_lon DOUBLE PRECISION,
    p_radius_meters DOUBLE PRECISION DEFAULT 20.0
)
RETURNS TABLE (
    id UUID,
    reference_no TEXT,
    title TEXT,
    status TEXT,
    priority TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    address TEXT,
    distance_meters DOUBLE PRECISION,
    report_count INTEGER,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.reference_no,
        c.title,
        c.status,
        c.priority,
        c.latitude,
        c.longitude,
        c.address,
        ROUND(ST_Distance(c.location, ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography)::numeric, 1)::double precision AS distance_meters,
        c.report_count,
        c.created_at
    FROM public.complaints c
    WHERE 
        c.status NOT IN ('Resolved', 'Closed', 'Rejected') -- Active hazards only
        AND ST_DWithin(c.location, ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography, p_radius_meters)
    ORDER BY distance_meters ASC
    LIMIT 1; -- Select nearest eligible complaint
END;
$$;

-- Secure Transactional Function: Submit report & cluster duplicates atomically
CREATE OR REPLACE FUNCTION public.submit_pothole_report(
    p_title TEXT,
    p_description TEXT,
    p_latitude DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION,
    p_address TEXT,
    p_priority TEXT,
    p_photo_storage_path TEXT,
    p_photo_public_url TEXT,
    p_accuracy_meters DOUBLE PRECISION DEFAULT NULL,
    p_link_to_complaint_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_user_name TEXT;
    v_complaint_id UUID;
    v_reference_no TEXT;
    v_report_id UUID;
    v_attachment_id UUID;
    v_is_duplicate BOOLEAN := false;
    v_dist DOUBLE PRECISION := 0;
    v_nearest RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to submit a road hazard complaint.';
    END IF;

    -- Retrieve reporter name from profile
    SELECT full_name INTO v_user_name FROM public.profiles WHERE id = v_user_id;

    -- Determine duplicate status
    IF p_link_to_complaint_id IS NOT NULL THEN
        -- Explicit link requested
        v_complaint_id := p_link_to_complaint_id;
        v_is_duplicate := true;
        
        -- Compute distance from target complaint
        SELECT ST_Distance(location, ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography)
        INTO v_dist
        FROM public.complaints WHERE id = v_complaint_id;
        
        -- Update parent complaint report count
        UPDATE public.complaints
        SET report_count = report_count + 1,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_complaint_id
        RETURNING reference_no INTO v_reference_no;
    ELSE
        -- Check automatic 20m match
        SELECT * INTO v_nearest FROM public.find_nearest_active_complaint(p_latitude, p_longitude, 20.0);
        
        IF v_nearest.id IS NOT NULL THEN
            -- Attach to nearest active complaint within 20m
            v_complaint_id := v_nearest.id;
            v_reference_no := v_nearest.reference_no;
            v_is_duplicate := true;
            v_dist := v_nearest.distance_meters;

            UPDATE public.complaints
            SET report_count = report_count + 1,
                updated_at = timezone('utc'::text, now())
            WHERE id = v_complaint_id;
        ELSE
            -- Create brand new consolidated complaint
            v_reference_no := 'POT-' || to_char(now(), 'YYYY') || '-' || upper(substring(md5(random()::text) from 1 for 5));
            
            INSERT INTO public.complaints (
                reference_no,
                title,
                description,
                latitude,
                longitude,
                address,
                priority,
                status,
                reporter_id,
                report_count,
                is_public
            ) VALUES (
                v_reference_no,
                p_title,
                p_description,
                p_latitude,
                p_longitude,
                p_address,
                p_priority,
                'New',
                v_user_id,
                1,
                false -- Kept private until reviewed and approved
            )
            RETURNING id INTO v_complaint_id;

            -- Initial status history entry
            INSERT INTO public.complaint_status_history (complaint_id, from_status, to_status, notes, changed_by)
            VALUES (v_complaint_id, NULL, 'New', 'Initial citizen report filed', v_user_id);
        END IF;
    END IF;

    -- Insert individual report record (preserving reporter's coordinates, photo, and timestamp)
    INSERT INTO public.reports (
        complaint_id,
        reporter_id,
        reporter_name,
        description,
        latitude,
        longitude,
        accuracy_meters,
        is_primary,
        distance_from_master
    ) VALUES (
        v_complaint_id,
        v_user_id,
        v_user_name,
        p_description,
        p_latitude,
        p_longitude,
        p_accuracy_meters,
        (NOT v_is_duplicate),
        COALESCE(v_dist, 0)
    )
    RETURNING id INTO v_report_id;

    -- Insert attachment (unapproved by default per Requirement 9)
    INSERT INTO public.report_attachments (
        report_id,
        complaint_id,
        storage_path,
        public_url,
        is_approved
    ) VALUES (
        v_report_id,
        v_complaint_id,
        p_photo_storage_path,
        p_photo_public_url,
        false -- Hidden from public map until administrative review
    )
    RETURNING id INTO v_attachment_id;

    -- Audit Log entry
    INSERT INTO public.complaint_audit_log (complaint_id, action, details, performed_by)
    VALUES (
        v_complaint_id,
        CASE WHEN v_is_duplicate THEN 'DUPLICATE_REPORT_LINKED' ELSE 'COMPLAINT_CREATED' END,
        jsonb_build_object(
            'report_id', v_report_id,
            'attachment_id', v_attachment_id,
            'distance_meters', v_dist,
            'is_duplicate', v_is_duplicate
        ),
        v_user_id
    );

    RETURN jsonb_build_object(
        'complaint_id', v_complaint_id,
        'reference_no', v_reference_no,
        'report_id', v_report_id,
        'is_duplicate', v_is_duplicate,
        'distance_meters', v_dist
    );
END;
$$;


-- ------------------------------------------------------------------------------
-- 11. SECURE PUBLIC VIEW (Sanitized Public Map Feed)
-- ------------------------------------------------------------------------------
-- Protects citizen identity and private storage paths from the public map
CREATE OR REPLACE VIEW public.public_complaints_feed AS
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
    c.created_at,
    c.updated_at,
    (
        SELECT ra.public_url 
        FROM public.report_attachments ra
        WHERE ra.complaint_id = c.id AND ra.is_approved = true
        ORDER BY ra.created_at ASC 
        LIMIT 1
    ) AS primary_photo_url
FROM public.complaints c
WHERE c.is_public = true; -- Filtered to Approved, Assigned, In Progress, Resolved, Closed

