-- ==============================================================================
-- POTHOLE REPORTING & MANAGEMENT SYSTEM - PRODUCTION DATABASE MIGRATION
-- Compliant with Supabase PostgreSQL, RLS, Haversine 20m Duplication & Transition Logic
-- ==============================================================================

-- 1. Create User Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helper security function: Check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
$$;

-- Profiles Policies
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    USING (public.is_admin());

CREATE POLICY "Users can update their own profile basic info"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id
        -- Prevent self-granting of admin role through client update
        AND (role = (SELECT role FROM public.profiles WHERE id = auth.uid()))
    );

CREATE POLICY "Admins can update user roles"
    ON public.profiles FOR UPDATE
    USING (public.is_admin());

-- Trigger to create profile when auth.users signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url',
        'citizen' -- Default role is always citizen; never allow client self-escalation
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 2. Repair Teams Table
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

CREATE POLICY "Anyone can view repair teams"
    ON public.repair_teams FOR SELECT
    USING (true);

CREATE POLICY "Admins manage repair teams"
    ON public.repair_teams FOR ALL
    USING (public.is_admin());

-- Seed standard road repair teams
INSERT INTO public.repair_teams (name, leader_name, contact_number, zone, status)
VALUES 
    ('Rapid Asphalt Response Unit A', 'David Miller', '+1 (555) 019-2831', 'North Zone', 'active'),
    ('Heavy Machinery Patch Squad B', 'Marcus Vance', '+1 (555) 014-9922', 'Central Downtown', 'active'),
    ('Emergency Surface Team C', 'Elena Rostova', '+1 (555) 018-7744', 'South Corridor', 'active')
ON CONFLICT DO NOTHING;


-- 3. Master Complaints Table
CREATE TABLE IF NOT EXISTS public.complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_no TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address TEXT,
    priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
    status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Under Review', 'Approved', 'Assigned', 'In Progress', 'Resolved', 'Closed', 'Rejected')),
    assigned_team_id UUID REFERENCES public.repair_teams(id) ON DELETE SET NULL,
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_public BOOLEAN NOT NULL DEFAULT false,
    estimated_repair_date DATE,
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index geospatial coordinates and status
CREATE INDEX IF NOT EXISTS idx_complaints_lat_long ON public.complaints(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_is_public ON public.complaints(is_public);
CREATE INDEX IF NOT EXISTS idx_complaints_reporter ON public.complaints(reporter_id);

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- Synchronize is_public flag with approved workflow statuses:
-- Public only when Approved, Assigned, In Progress, Resolved, or Closed.
CREATE OR REPLACE FUNCTION public.sync_complaint_public_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status IN ('Approved', 'Assigned', 'In Progress', 'Resolved', 'Closed') THEN
        NEW.is_public := true;
    ELSE
        NEW.is_public := false;
    END IF;
    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_complaint_public_status ON public.complaints;
CREATE TRIGGER trg_sync_complaint_public_status
    BEFORE INSERT OR UPDATE ON public.complaints
    FOR EACH ROW EXECUTE FUNCTION public.sync_complaint_public_status();

-- Complaints RLS:
-- Requirement 9: Keep unapproved complaints hidden from public map
CREATE POLICY "Public can view approved complaints on map"
    ON public.complaints FOR SELECT
    USING (is_public = true);

CREATE POLICY "Reporters can view their own complaints anytime"
    ON public.complaints FOR SELECT
    USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can view all complaints"
    ON public.complaints FOR SELECT
    USING (public.is_admin());

CREATE POLICY "Authenticated users can submit complaints"
    ON public.complaints FOR INSERT
    WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Admins can update complaints"
    ON public.complaints FOR UPDATE
    USING (public.is_admin());

CREATE POLICY "Admins can delete complaints"
    ON public.complaints FOR DELETE
    USING (public.is_admin());


-- 4. Individual Reports Table (Supports 20m Duplicate Clustering & Preserving all Citizen Data)
CREATE TABLE IF NOT EXISTS public.complaint_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reporter_name TEXT,
    description TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy_meters DOUBLE PRECISION,
    photo_url TEXT NOT NULL,
    is_approved_attachment BOOLEAN NOT NULL DEFAULT false,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    distance_from_master DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_reports_complaint ON public.complaint_reports(complaint_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.complaint_reports(reporter_id);

ALTER TABLE public.complaint_reports ENABLE ROW LEVEL SECURITY;

-- Requirement 9: Keep unreviewed report attachments hidden from the public map
CREATE POLICY "Public can view approved attachments on public complaints"
    ON public.complaint_reports FOR SELECT
    USING (
        is_approved_attachment = true
        AND EXISTS (
            SELECT 1 FROM public.complaints c
            WHERE c.id = complaint_id AND c.is_public = true
        )
    );

CREATE POLICY "Reporters can view their own submitted reports"
    ON public.complaint_reports FOR SELECT
    USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can view all complaint reports"
    ON public.complaint_reports FOR SELECT
    USING (public.is_admin());

CREATE POLICY "Authenticated users can insert reports"
    ON public.complaint_reports FOR INSERT
    WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Admins can update reports (e.g. approve attachment or relink)"
    ON public.complaint_reports FOR UPDATE
    USING (public.is_admin());


-- 5. Complaint Status History Table
CREATE TABLE IF NOT EXISTS public.complaint_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT NOT NULL,
    notes TEXT,
    changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_status_history_complaint ON public.complaint_status_history(complaint_id);
ALTER TABLE public.complaint_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view status history of public complaints"
    ON public.complaint_status_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.complaints c
            WHERE c.id = complaint_id AND c.is_public = true
        )
    );

CREATE POLICY "Reporters can view status history of own complaints"
    ON public.complaint_status_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.complaints c
            WHERE c.id = complaint_id AND c.reporter_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all status history"
    ON public.complaint_status_history FOR SELECT
    USING (public.is_admin());

CREATE POLICY "Admins or triggers can insert status history"
    ON public.complaint_status_history FOR INSERT
    WITH CHECK (true);


-- 6. Repair Progress Notes Table
CREATE TABLE IF NOT EXISTS public.repair_progress_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    photo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.repair_progress_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view progress notes for public complaints"
    ON public.repair_progress_notes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.complaints c
            WHERE c.id = complaint_id AND c.is_public = true
        )
    );

CREATE POLICY "Admins can manage progress notes"
    ON public.repair_progress_notes FOR ALL
    USING (public.is_admin());


-- 7. Haversine Distance Function & Duplicate Detection (20-meter radius)
CREATE OR REPLACE FUNCTION public.haversine_distance_meters(
    lat1 DOUBLE PRECISION,
    lon1 DOUBLE PRECISION,
    lat2 DOUBLE PRECISION,
    lon2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT 6371000 * 2 * ASIN(
        SQRT(
            POWER(SIN(RADIANS(lat2 - lat1) / 2), 2) +
            COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
            POWER(SIN(RADIANS(lon2 - lon1) / 2), 2)
        )
    );
$$;

-- Function: Find nearest active complaint within radius (default 20 meters per Requirement 8)
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
    created_at TIMESTAMPTZ,
    reports_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
        ROUND(public.haversine_distance_meters(p_lat, p_lon, c.latitude, c.longitude)::numeric, 1)::double precision AS distance_meters,
        c.created_at,
        COUNT(r.id) AS reports_count
    FROM public.complaints c
    LEFT JOIN public.complaint_reports r ON r.complaint_id = c.id
    WHERE 
        c.status NOT IN ('Resolved', 'Closed', 'Rejected') -- Only active complaints
        AND public.haversine_distance_meters(p_lat, p_lon, c.latitude, c.longitude) <= p_radius_meters
    GROUP BY c.id
    ORDER BY distance_meters ASC
    LIMIT 1; -- Select the nearest eligible complaint
END;
$$;


-- 8. Valid Status Transition Validation Trigger (Requirement 10)
CREATE OR REPLACE FUNCTION public.validate_complaint_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only check if status actually changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Allowed transitions:
        -- New -> Under Review, Rejected
        -- Under Review -> Approved, Rejected
        -- Approved -> Assigned, Rejected
        -- Assigned -> In Progress, Under Review
        -- In Progress -> Resolved, Assigned
        -- Resolved -> Closed, In Progress
        -- Closed -> (none)
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

        -- If resolved, set resolved_at
        IF NEW.status = 'Resolved' AND OLD.status != 'Resolved' THEN
            NEW.resolved_at := timezone('utc'::text, now());
        END IF;

        -- Log to complaint_status_history
        INSERT INTO public.complaint_status_history (complaint_id, from_status, to_status, notes, changed_by)
        VALUES (NEW.id, OLD.status, NEW.status, NEW.resolution_notes, auth.uid());
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_complaint_status_transition ON public.complaints;
CREATE TRIGGER trg_validate_complaint_status_transition
    BEFORE UPDATE ON public.complaints
    FOR EACH ROW EXECUTE FUNCTION public.validate_complaint_status_transition();


-- 9. Initial creation status history logger
CREATE OR REPLACE FUNCTION public.log_initial_complaint_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.complaint_status_history (complaint_id, from_status, to_status, notes, changed_by)
    VALUES (NEW.id, NULL, NEW.status, 'Initial citizen submission received', NEW.reporter_id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_initial_complaint_creation ON public.complaints;
CREATE TRIGGER trg_log_initial_complaint_creation
    AFTER INSERT ON public.complaints
    FOR EACH ROW EXECUTE FUNCTION public.log_initial_complaint_creation();


-- 10. Supabase Storage Setup for Pothole Photographs
-- Execute via Supabase SQL Editor to configure bucket and policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('pothole-photos', 'pothole-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage RLS
CREATE POLICY "Public Read Pothole Photos"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'pothole-photos');

CREATE POLICY "Authenticated users can upload photos"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'pothole-photos'
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "Admins can delete photos"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'pothole-photos'
        AND public.is_admin()
    );

