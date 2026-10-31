-- ==============================================================================
-- MIGRATION: 20261030143000_automatic_citizen_role_assignment.sql
-- PURPOSE: Idempotent Automatic Role Assignment Trigger for Google OAuth & Signups
--          Preserves existing administrator accounts and enforces server-side role security.
-- ==============================================================================

-- 1. SECURE TRIGGER FUNCTION FOR NEW AUTH USERS
-- Runs with SECURITY DEFINER and restricted search_path.
-- Provisions profile and automatically assigns 'citizen' role if no role exists.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_has_role BOOLEAN;
BEGIN
    -- 1.1 Provision or synchronize public.profiles
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        avatar_url,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name',
            split_part(NEW.email, '@', 1)
        ),
        NEW.raw_user_meta_data->>'avatar_url',
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
        updated_at = timezone('utc'::text, now());

    -- 1.2 Check if user already has an assigned role (CRITICAL: Preserves manual Admin accounts)
    SELECT EXISTS (
        SELECT 1 
        FROM public.user_roles 
        WHERE user_id = NEW.id
    ) INTO v_has_role;

    -- 1.3 Assign 'citizen' role ONLY if the user currently has NO assigned role
    IF NOT v_has_role THEN
        INSERT INTO public.user_roles (
            user_id,
            role,
            assigned_at,
            assigned_by
        )
        VALUES (
            NEW.id,
            'citizen',
            timezone('utc'::text, now()),
            NULL
        )
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

-- 2. CREATE IDEMPOTENT TRIGGER ON auth.users
DROP TRIGGER IF EXISTS trg_handle_new_auth_user ON auth.users;
CREATE TRIGGER trg_handle_new_auth_user
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();


-- 3. SAFE ONE-TIME BACKFILL FOR EXISTING USERS
-- Step 3.1: Backfill missing public.profiles for any existing auth.users
INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    created_at,
    updated_at
)
SELECT 
    u.id,
    COALESCE(u.email, ''),
    COALESCE(
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name',
        split_part(u.email, '@', 1)
    ),
    u.raw_user_meta_data->>'avatar_url',
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Step 3.2: Backfill 'citizen' role for users WITHOUT ANY existing role
-- STRICT GUARD: Completely excludes any account that already has a role (e.g. administrator)
INSERT INTO public.user_roles (
    user_id,
    role,
    assigned_at,
    assigned_by
)
SELECT 
    u.id,
    'citizen',
    timezone('utc'::text, now()),
    NULL
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 
    FROM public.user_roles ur 
    WHERE ur.user_id = u.id
)
ON CONFLICT (user_id, role) DO NOTHING;


-- 4. VERIFY RLS POLICIES ON user_roles TO PREVENT CLIENT SELF-ASSIGNMENT
-- Regular authenticated users can ONLY SELECT their own role.
-- INSERT, UPDATE, DELETE on user_roles are strictly restricted to administrators.
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins view all user roles" ON public.user_roles;
CREATE POLICY "Admins view all user roles"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Only admins insert roles" ON public.user_roles;
CREATE POLICY "Only admins insert roles"
    ON public.user_roles FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Only admins update roles" ON public.user_roles;
CREATE POLICY "Only admins update roles"
    ON public.user_roles FOR UPDATE
    TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Only admins delete roles" ON public.user_roles;
CREATE POLICY "Only admins delete roles"
    ON public.user_roles FOR DELETE
    TO authenticated
    USING (public.is_admin());

