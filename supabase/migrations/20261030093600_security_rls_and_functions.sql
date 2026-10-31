-- ==============================================================================
-- Migration: 20261030093600_security_rls_and_functions.sql
-- Description: Security Policies, PostGIS Duplicate Logic, Atomic Functions &
--              Safe Public Map Access for RoadCare
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SECURITY DEFINER ROLE FUNCTIONS (Never trust client metadata)
-- ------------------------------------------------------------------------------

-- Verified Admin Check: Strictly queries public.user_roles
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

-- Primary Role Resolver
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


-- ------------------------------------------------------------------------------
-- 2. AUTOMATIC TRIGGERS & ATTRIBUTE SYNCHRONIZATION
-- ------------------------------------------------------------------------------

-- Synchronize geography location and public map visibility on complaints
CREATE OR REPLACE FUNCTION public.sync_complaint_location_and_public_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- PostGIS geography synchronization
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;

    -- Requirement: Only complaints with approved/in-progress/resolved workflow statuses become public
    IF NEW.status IN ('Approved', 'Assigned', 'In Progress', 'Resolved', 'Closed') THEN
        NEW.is_public := true;
    ELSE
        NEW.is_public := false;
    END IF;

    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_complaint_location ON public.complaints;
CREATE TRIGGER trg_sync_complaint_location
    BEFORE INSERT OR UPDATE ON public.complaints
    FOR EACH ROW EXECUTE FUNCTION public.sync_complaint_location_and_public_flag();

-- Synchronize geography location on individual reports
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

-- Synchronize attachment review status with is_approved flag
CREATE OR REPLACE FUNCTION public.sync_attachment_review_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.review_status = 'approved' THEN
        NEW.is_approved := true;
    ELSE
        NEW.is_approved := false;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_attachment_review ON public.report_attachments;
CREATE TRIGGER trg_sync_attachment_review
    BEFORE INSERT OR UPDATE ON public.report_attachments
    FOR EACH ROW EXECUTE FUNCTION public.sync_attachment_review_approval();

-- Enforce Valid Status Transitions
CREATE OR REPLACE FUNCTION public.enforce_status_transitions()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Allowed transitions:
        -- New -> Under Review, Rejected
        -- Under Review -> Approved, Rejected
        -- Approved -> Assigned, Rejected
        -- Assigned -> In Progress, Under Review
        -- In Progress -> Resolved, Assigned
        -- Resolved -> Closed, In Progress
        -- Closed -> (none, terminal)
        -- Rejected -> Under Review
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

        -- Record into status history
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

-- Provision profile and default 'citizen' role on user signup
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;

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
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

-- Enable RLS on all 10 tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_audit_log ENABLE ROW LEVEL SECURITY;

-- 3.1 PROFILES POLICIES
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
CREATE POLICY "Admins view all profiles"
    ON public.profiles FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 3.2 USER ROLES POLICIES (Users CANNOT modify roles)
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles"
    ON public.user_roles FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all user roles" ON public.user_roles;
CREATE POLICY "Admins view all user roles"
    ON public.user_roles FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "Only admins insert roles" ON public.user_roles;
CREATE POLICY "Only admins insert roles"
    ON public.user_roles FOR INSERT
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Only admins update roles" ON public.user_roles;
CREATE POLICY "Only admins update roles"
    ON public.user_roles FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Only admins delete roles" ON public.user_roles;
CREATE POLICY "Only admins delete roles"
    ON public.user_roles FOR DELETE
    USING (public.is_admin());

-- 3.3 REPAIR TEAMS POLICIES
DROP POLICY IF EXISTS "Authenticated users view teams" ON public.repair_teams;
CREATE POLICY "Authenticated users view teams"
    ON public.repair_teams FOR SELECT
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Only admins manage repair teams" ON public.repair_teams;
CREATE POLICY "Only admins manage repair teams"
    ON public.repair_teams FOR ALL
    USING (public.is_admin());

-- 3.4 TEAM MEMBERS POLICIES
DROP POLICY IF EXISTS "Authenticated users view team members" ON public.team_members;
CREATE POLICY "Authenticated users view team members"
    ON public.team_members FOR SELECT
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Only admins manage team members" ON public.team_members;
CREATE POLICY "Only admins manage team members"
    ON public.team_members FOR ALL
    USING (public.is_admin());

-- 3.5 CONSOLIDATED COMPLAINTS POLICIES
DROP POLICY IF EXISTS "Public can view approved complaints" ON public.complaints;
CREATE POLICY "Public can view approved complaints"
    ON public.complaints FOR SELECT
    USING (is_public = true);

DROP POLICY IF EXISTS "Reporters can view own complaints" ON public.complaints;
CREATE POLICY "Reporters can view own complaints"
    ON public.complaints FOR SELECT
    USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Admins can view all complaints" ON public.complaints;
CREATE POLICY "Admins can view all complaints"
    ON public.complaints FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "Authenticated users can submit complaints" ON public.complaints;
CREATE POLICY "Authenticated users can submit complaints"
    ON public.complaints FOR INSERT
    WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Only admins can update complaints" ON public.complaints;
CREATE POLICY "Only admins can update complaints"
    ON public.complaints FOR UPDATE
    USING (public.is_admin());

DROP POLICY IF EXISTS "Only admins can delete complaints" ON public.complaints;
CREATE POLICY "Only admins can delete complaints"
    ON public.complaints FOR DELETE
    USING (public.is_admin());

-- 3.6 REPORTS POLICIES (Citizens CANNOT read other citizens' individual reports)
DROP POLICY IF EXISTS "Reporters view own individual reports" ON public.reports;
CREATE POLICY "Reporters view own individual reports"
    ON public.reports FOR SELECT
    USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Admins view all individual reports" ON public.reports;
CREATE POLICY "Admins view all individual reports"
    ON public.reports FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "Authenticated reporters submit reports" ON public.reports;
CREATE POLICY "Authenticated reporters submit reports"
    ON public.reports FOR INSERT
    WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Only admins update reports" ON public.reports;
CREATE POLICY "Only admins update reports"
    ON public.reports FOR UPDATE
    USING (public.is_admin());

-- 3.7 REPORT ATTACHMENTS POLICIES (Unapproved attachments hidden from public)
DROP POLICY IF EXISTS "Public view approved attachments for public complaints" ON public.report_attachments;
CREATE POLICY "Public view approved attachments for public complaints"
    ON public.report_attachments FOR SELECT
    USING (
        is_approved = true
        AND EXISTS (
            SELECT 1 FROM public.complaints c
            WHERE c.id = complaint_id AND c.is_public = true
        )
    );

DROP POLICY IF EXISTS "Reporters view own attachments" ON public.report_attachments;
CREATE POLICY "Reporters view own attachments"
    ON public.report_attachments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.reports r
            WHERE r.id = report_id AND r.reporter_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Admins view all attachments" ON public.report_attachments;
CREATE POLICY "Admins view all attachments"
    ON public.report_attachments FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "Reporters insert attachments for own reports" ON public.report_attachments;
CREATE POLICY "Reporters insert attachments for own reports"
    ON public.report_attachments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.reports r
            WHERE r.id = report_id AND r.reporter_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Only admins update attachments" ON public.report_attachments;
CREATE POLICY "Only admins update attachments"
    ON public.report_attachments FOR UPDATE
    USING (public.is_admin());

-- 3.8 COMPLAINT ASSIGNMENTS POLICIES
DROP POLICY IF EXISTS "View assignments for public or own complaints" ON public.complaint_assignments;
CREATE POLICY "View assignments for public or own complaints"
    ON public.complaint_assignments FOR SELECT
    USING (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.complaints c
            WHERE c.id = complaint_id AND (c.is_public = true OR c.reporter_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Only admins manage assignments" ON public.complaint_assignments;
CREATE POLICY "Only admins manage assignments"
    ON public.complaint_assignments FOR ALL
    USING (public.is_admin());

-- 3.9 COMPLAINT STATUS HISTORY POLICIES (Citizens receive safe progress updates)
DROP POLICY IF EXISTS "View status history for public, own, or contributed complaints" ON public.complaint_status_history;
CREATE POLICY "View status history for public, own, or contributed complaints"
    ON public.complaint_status_history FOR SELECT
    USING (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.complaints c
            WHERE c.id = complaint_id AND (c.is_public = true OR c.reporter_id = auth.uid())
        )
        OR EXISTS (
            SELECT 1 FROM public.reports r
            WHERE r.complaint_id = complaint_status_history.complaint_id AND r.reporter_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Insert status history" ON public.complaint_status_history;
CREATE POLICY "Insert status history"
    ON public.complaint_status_history FOR INSERT
    WITH CHECK (public.is_admin() OR auth.role() = 'authenticated');

-- 3.10 COMPLAINT AUDIT LOG POLICIES (Citizens strictly blocked)
DROP POLICY IF EXISTS "Only admins view audit log" ON public.complaint_audit_log;
CREATE POLICY "Only admins view audit log"
    ON public.complaint_audit_log FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "Insert audit log" ON public.complaint_audit_log;
CREATE POLICY "Insert audit log"
    ON public.complaint_audit_log FOR INSERT
    WITH CHECK (public.is_admin() OR auth.role() = 'authenticated');


-- ------------------------------------------------------------------------------
-- 4. GEOSPATIAL 20M DUPLICATE DETECTION & TRANSACTIONAL SUBMISSION
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
        c.status NOT IN ('Resolved', 'Closed', 'Rejected')
        AND ST_DWithin(c.location, ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography, p_radius_meters)
    ORDER BY distance_meters ASC
    LIMIT 1;
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

    SELECT full_name INTO v_user_name FROM public.profiles WHERE id = v_user_id;

    -- Duplicate determination
    IF p_link_to_complaint_id IS NOT NULL THEN
        v_complaint_id := p_link_to_complaint_id;
        v_is_duplicate := true;
        
        SELECT ST_Distance(location, ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography)
        INTO v_dist
        FROM public.complaints WHERE id = v_complaint_id;
        
        UPDATE public.complaints
        SET report_count = report_count + 1,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_complaint_id
        RETURNING reference_no INTO v_reference_no;
    ELSE
        SELECT * INTO v_nearest FROM public.find_nearest_active_complaint(p_latitude, p_longitude, 20.0);
        
        IF v_nearest.id IS NOT NULL THEN
            v_complaint_id := v_nearest.id;
            v_reference_no := v_nearest.reference_no;
            v_is_duplicate := true;
            v_dist := v_nearest.distance_meters;

            UPDATE public.complaints
            SET report_count = report_count + 1,
                updated_at = timezone('utc'::text, now())
            WHERE id = v_complaint_id;
        ELSE
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
                false
            )
            RETURNING id INTO v_complaint_id;

            INSERT INTO public.complaint_status_history (complaint_id, from_status, to_status, notes, changed_by)
            VALUES (v_complaint_id, NULL, 'New', 'Initial citizen report filed', v_user_id);
        END IF;
    END IF;

    -- Insert individual report record
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

    -- Insert attachment (pending review, hidden from public map)
    INSERT INTO public.report_attachments (
        report_id,
        complaint_id,
        storage_path,
        public_url,
        review_status,
        is_approved
    ) VALUES (
        v_report_id,
        v_complaint_id,
        p_photo_storage_path,
        p_photo_public_url,
        'pending',
        false
    )
    RETURNING id INTO v_attachment_id;

    -- Audit log
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
-- 5. SAFE PUBLIC MAP DATA ACCESS MECHANISM
-- ------------------------------------------------------------------------------
-- Sanitized view: Excludes reporter email, user IDs, and raw storage paths
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
        WHERE ra.complaint_id = c.id 
          AND ra.is_approved = true 
          AND ra.review_status = 'approved'
        ORDER BY ra.created_at ASC 
        LIMIT 1
    ) AS primary_photo_url
FROM public.complaints c
WHERE c.is_public = true; -- Restricted to Approved, Assigned, In Progress, Resolved, Closed

