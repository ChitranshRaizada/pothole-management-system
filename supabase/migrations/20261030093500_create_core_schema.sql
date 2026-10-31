-- ==============================================================================
-- Migration: 20261030093500_create_core_schema.sql
-- Description: Core Schema Definitions for RoadCare Pothole Management System
-- Tables:
--   1. profiles
--   2. user_roles
--   3. repair_teams
--   4. team_members
--   5. complaints (consolidated potholes)
--   6. reports (individual citizen submissions)
--   7. report_attachments (private image metadata & review status)
--   8. complaint_assignments
--   9. complaint_status_history
--  10. complaint_audit_log
-- ==============================================================================

-- Enable PostGIS geospatial extension
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

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- ------------------------------------------------------------------------------
-- 2. USER ROLES TABLE (Server-Controlled; Prevents Client Self-Assignment)
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

CREATE INDEX IF NOT EXISTS idx_repair_teams_status ON public.repair_teams(status);
CREATE INDEX IF NOT EXISTS idx_repair_teams_zone ON public.repair_teams(zone);

-- ------------------------------------------------------------------------------
-- 4. TEAM MEMBERS TABLE (Crew Members & Specialists)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.repair_teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    member_name TEXT NOT NULL,
    role_in_team TEXT NOT NULL DEFAULT 'technician' CHECK (role_in_team IN ('leader', 'technician', 'operator', 'driver', 'inspector')),
    contact_phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_team_member UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_is_active ON public.team_members(is_active);

-- ------------------------------------------------------------------------------
-- 5. CONSOLIDATED COMPLAINTS TABLE (Master Pothole Clusters)
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

CREATE INDEX IF NOT EXISTS idx_complaints_reporter ON public.complaints(reporter_id);
CREATE INDEX IF NOT EXISTS idx_complaints_assigned_team ON public.complaints(assigned_team_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_priority ON public.complaints(priority);
CREATE INDEX IF NOT EXISTS idx_complaints_is_public ON public.complaints(is_public);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON public.complaints(created_at);
CREATE INDEX IF NOT EXISTS idx_complaints_location ON public.complaints USING GIST(location);

-- ------------------------------------------------------------------------------
-- 6. REPORTS TABLE (Individual Citizen Submissions)
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
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at);
CREATE INDEX IF NOT EXISTS idx_reports_location ON public.reports USING GIST(location);

-- ------------------------------------------------------------------------------
-- 7. REPORT ATTACHMENTS TABLE (Private Photo Metadata & Independent Review)
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
    review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
    is_approved BOOLEAN NOT NULL DEFAULT false,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_report_attachments_report ON public.report_attachments(report_id);
CREATE INDEX IF NOT EXISTS idx_report_attachments_complaint ON public.report_attachments(complaint_id);
CREATE INDEX IF NOT EXISTS idx_report_attachments_review_status ON public.report_attachments(review_status);
CREATE INDEX IF NOT EXISTS idx_report_attachments_is_approved ON public.report_attachments(is_approved);
CREATE INDEX IF NOT EXISTS idx_report_attachments_created_at ON public.report_attachments(created_at);

-- ------------------------------------------------------------------------------
-- 8. COMPLAINT ASSIGNMENTS TABLE (Squad Dispatch History)
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
CREATE INDEX IF NOT EXISTS idx_assignments_created_at ON public.complaint_assignments(created_at);

-- ------------------------------------------------------------------------------
-- 9. COMPLAINT STATUS HISTORY TABLE (Status Progression & Audit Notes)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.complaint_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT NOT NULL CHECK (to_status IN ('New', 'Under Review', 'Approved', 'Assigned', 'In Progress', 'Resolved', 'Closed', 'Rejected')),
    notes TEXT,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_status_history_complaint ON public.complaint_status_history(complaint_id);
CREATE INDEX IF NOT EXISTS idx_status_history_changed_by ON public.complaint_status_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_status_history_created_at ON public.complaint_status_history(created_at);

-- ------------------------------------------------------------------------------
-- 10. COMPLAINT AUDIT LOG TABLE (Administrator & Critical Operations)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.complaint_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID REFERENCES public.complaints(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_log_complaint ON public.complaint_audit_log(complaint_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_performed_by ON public.complaint_audit_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.complaint_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.complaint_audit_log(created_at);

