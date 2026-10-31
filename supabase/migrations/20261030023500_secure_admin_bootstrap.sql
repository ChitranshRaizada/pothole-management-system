-- ==============================================================================
-- Migration: 20261030023500_secure_admin_bootstrap.sql
-- Description: Secure Administrator Bootstrap, Role Escalation Guard, and
--              Citizen Contributor Status Policy
-- ==============================================================================

-- 1. One-Time Secure Bootstrap Function for Initial Administrator
-- Can ONLY be called when 0 administrators exist in the database.
-- Once an administrator is registered, this function locks automatically.
CREATE OR REPLACE FUNCTION public.bootstrap_initial_admin(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_count INTEGER;
    v_target_email TEXT;
BEGIN
    -- Verify target user exists in auth.users or profiles
    SELECT email INTO v_target_email FROM public.profiles WHERE id = p_user_id;
    IF v_target_email IS NULL THEN
        SELECT email INTO v_target_email FROM auth.users WHERE id = p_user_id;
    END IF;

    IF v_target_email IS NULL THEN
        RAISE EXCEPTION 'User ID "%" was not found in the authentication system.', p_user_id;
    END IF;

    -- Count existing administrators
    SELECT COUNT(*) INTO v_admin_count
    FROM public.user_roles
    WHERE role = 'admin';

    IF v_admin_count > 0 THEN
        RAISE EXCEPTION 'Administrative bootstrap is permanently locked: % administrator(s) already exist. Subsequent admins must be granted by an existing administrator.', v_admin_count;
    END IF;

    -- Assign initial admin role
    INSERT INTO public.user_roles (user_id, role, assigned_by)
    VALUES (p_user_id, 'admin', p_user_id)
    ON CONFLICT (user_id, role) DO UPDATE SET assigned_at = timezone('utc'::text, now());

    -- Audit log entry
    INSERT INTO public.complaint_audit_log (action, details, performed_by)
    VALUES (
        'INITIAL_ADMIN_BOOTSTRAPPED',
        jsonb_build_object(
            'target_user_id', p_user_id,
            'target_email', v_target_email,
            'bootstrap_timestamp', timezone('utc'::text, now())
        ),
        p_user_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Initial administrator bootstrapped successfully.',
        'user_id', p_user_id,
        'email', v_target_email
    );
END;
$$;


-- 2. Trusted Admin-to-Admin Role Delegation Function
-- Can ONLY be executed by a verified administrator (is_admin() = true)
CREATE OR REPLACE FUNCTION public.grant_admin_role(p_target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_is_admin BOOLEAN;
    v_target_email TEXT;
BEGIN
    -- Strictly verify caller is an administrator
    v_caller_is_admin := public.is_admin();
    IF NOT v_caller_is_admin THEN
        RAISE EXCEPTION 'Access Denied: Only active administrators can promote users to administrator.';
    END IF;

    -- Verify target user exists
    SELECT email INTO v_target_email FROM public.profiles WHERE id = p_target_user_id;
    IF v_target_email IS NULL THEN
        RAISE EXCEPTION 'Target user ID "%" was not found in profiles.', p_target_user_id;
    END IF;

    -- Insert admin role
    INSERT INTO public.user_roles (user_id, role, assigned_by)
    VALUES (p_target_user_id, 'admin', auth.uid())
    ON CONFLICT (user_id, role) DO UPDATE SET assigned_by = auth.uid(), assigned_at = timezone('utc'::text, now());

    -- Audit log entry
    INSERT INTO public.complaint_audit_log (action, details, performed_by)
    VALUES (
        'ADMIN_ROLE_GRANTED',
        jsonb_build_object(
            'target_user_id', p_target_user_id,
            'target_email', v_target_email,
            'granted_by', auth.uid()
        ),
        auth.uid()
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Administrator role granted successfully.',
        'target_user_id', p_target_user_id
    );
END;
$$;


-- 3. Revoke Administrator Role Function
-- Prevents lockout: An administrator cannot revoke their own role if they are the sole administrator
CREATE OR REPLACE FUNCTION public.revoke_admin_role(p_target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_count INTEGER;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Only active administrators can revoke administrator privileges.';
    END IF;

    -- Check if target is the last admin
    SELECT COUNT(*) INTO v_admin_count
    FROM public.user_roles
    WHERE role = 'admin';

    IF v_admin_count <= 1 AND p_target_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Operation blocked: You cannot revoke your own administrator role when you are the sole administrator.';
    END IF;

    DELETE FROM public.user_roles
    WHERE user_id = p_target_user_id AND role = 'admin';

    INSERT INTO public.complaint_audit_log (action, details, performed_by)
    VALUES (
        'ADMIN_ROLE_REVOKED',
        jsonb_build_object(
            'target_user_id', p_target_user_id,
            'revoked_by', auth.uid()
        ),
        auth.uid()
    );

    RETURN jsonb_build_object('success', true, 'message', 'Administrator role revoked.');
END;
$$;


-- 4. Enable Safe Status Updates for Contributing Citizens
-- Requirement 8: Ensure citizens who contributed duplicate reports to a complaint
-- can view safe progress updates and timeline for that complaint
DROP POLICY IF EXISTS "Reporters and contributors can view complaint status history" ON public.complaint_status_history;
CREATE POLICY "Reporters and contributors can view complaint status history"
    ON public.complaint_status_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.complaints c
            WHERE c.id = complaint_id AND (c.is_public = true OR c.reporter_id = auth.uid())
        )
        OR EXISTS (
            SELECT 1 FROM public.reports r
            WHERE r.complaint_id = complaint_status_history.complaint_id AND r.reporter_id = auth.uid()
        )
    );

