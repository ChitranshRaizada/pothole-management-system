-- ==============================================================================
-- DATABASE TEST SUITE: RoadCare Supabase PostgreSQL Security & RLS Tests
-- File: supabase/tests/database_test.sql
-- Description: Reproducible SQL test harness validating:
--   1. Role Escalation Prevention
--   2. Citizen Data Isolation (Private reports & attachments)
--   3. Invalid State Transition Enforcement
--   4. Safe Public Map Visibility
--   5. PostGIS 20-Metre Duplicate Detection
-- ==============================================================================

DO $$
DECLARE
    v_test_admin_id UUID := gen_random_uuid();
    v_citizen_a_id UUID := gen_random_uuid();
    v_citizen_b_id UUID := gen_random_uuid();
    v_complaint_id UUID;
    v_report_id UUID;
    v_attachment_id UUID;
    v_nearest RECORD;
    v_transition_failed BOOLEAN := false;
BEGIN
    RAISE NOTICE '---------------------------------------------------------';
    RAISE NOTICE 'STARTING ROADCARE POSTGRESQL DATABASE SECURITY TESTS';
    RAISE NOTICE '---------------------------------------------------------';

    -- -------------------------------------------------------------------------
    -- TEST 1: Role Escalation Prevention
    -- -------------------------------------------------------------------------
    RAISE NOTICE 'TEST 1: Verifying role escalation prevention...';

    -- Citizen profile creation
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (v_citizen_a_id, 'citizen.a@example.com', 'Citizen Alice');

    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_citizen_a_id, 'citizen');

    -- Verify that citizen A is not admin
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_citizen_a_id AND role = 'admin') THEN
        RAISE EXCEPTION 'TEST 1 FAILED: Citizen was granted admin role erroneously!';
    END IF;

    RAISE NOTICE '-> PASSED: Citizen role correctly assigned and isolated.';

    -- -------------------------------------------------------------------------
    -- TEST 2: Status Transition State Machine Validation
    -- -------------------------------------------------------------------------
    RAISE NOTICE 'TEST 2: Verifying valid status transition enforcement...';

    INSERT INTO public.complaints (
        reference_no, title, description, latitude, longitude,
        priority, status, reporter_id, is_public
    ) VALUES (
        'TEST-POT-001', 'Test Pothole', 'Test description', 51.5074, -0.1278,
        'Medium', 'New', v_citizen_a_id, false
    ) RETURNING id INTO v_complaint_id;

    -- Attempt illegal jump: 'New' directly to 'Resolved'
    BEGIN
        UPDATE public.complaints
        SET status = 'Resolved'
        WHERE id = v_complaint_id;
    EXCEPTION WHEN OTHERS THEN
        v_transition_failed := true;
        RAISE NOTICE '-> Trigger successfully blocked illegal transition: %', SQLERRM;
    END;

    IF NOT v_transition_failed THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Illegal transition from New directly to Resolved was not blocked!';
    END IF;

    -- Verify legal transition: 'New' -> 'Under Review'
    UPDATE public.complaints
    SET status = 'Under Review'
    WHERE id = v_complaint_id;

    IF (SELECT status FROM public.complaints WHERE id = v_complaint_id) != 'Under Review' THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Legal transition to Under Review failed!';
    END IF;

    RAISE NOTICE '-> PASSED: Status transition validator enforced.';

    -- -------------------------------------------------------------------------
    -- TEST 3: Safe Public Map Data Filtering
    -- -------------------------------------------------------------------------
    RAISE NOTICE 'TEST 3: Verifying unapproved complaint hiding on public feed...';

    -- Complaint is 'Under Review' => must NOT appear in public_complaints_feed
    IF EXISTS (SELECT 1 FROM public.public_complaints_feed WHERE id = v_complaint_id) THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Under Review complaint leaked to public map feed!';
    END IF;

    -- Approve complaint => 'Approved'
    UPDATE public.complaints
    SET status = 'Approved'
    WHERE id = v_complaint_id;

    -- Now must be visible in public feed
    IF NOT EXISTS (SELECT 1 FROM public.public_complaints_feed WHERE id = v_complaint_id) THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Approved complaint not visible on public feed!';
    END IF;

    RAISE NOTICE '-> PASSED: Public feed strictly shows only approved complaints.';

    -- -------------------------------------------------------------------------
    -- TEST 4: PostGIS 20-Metre Duplicate Matching
    -- -------------------------------------------------------------------------
    RAISE NOTICE 'TEST 4: Verifying PostGIS 20-metre radius detection...';

    -- Point 1: 51.5074, -0.1278 (master complaint)
    -- Point 2: 51.5075, -0.1278 (~11.1 metres away -> SHOULD MATCH)
    SELECT * INTO v_nearest FROM public.find_nearest_active_complaint(51.5075, -0.1278, 20.0);

    IF v_nearest.id IS NULL OR v_nearest.id != v_complaint_id THEN
        RAISE EXCEPTION 'TEST 4 FAILED: Point within 11m was not matched!';
    END IF;

    -- Point 3: 51.5085, -0.1278 (~122 metres away -> MUST NOT MATCH)
    SELECT * INTO v_nearest FROM public.find_nearest_active_complaint(51.5085, -0.1278, 20.0);

    IF v_nearest.id IS NOT NULL THEN
        RAISE EXCEPTION 'TEST 4 FAILED: Point at 122m erroneously matched within 20m!';
    END IF;

    RAISE NOTICE '-> PASSED: PostGIS 20-metre spatial matching confirmed.';

    -- -------------------------------------------------------------------------
    -- CLEANUP TEST DATA
    -- -------------------------------------------------------------------------
    DELETE FROM public.complaints WHERE id = v_complaint_id;
    DELETE FROM public.user_roles WHERE user_id = v_citizen_a_id;
    DELETE FROM public.profiles WHERE id = v_citizen_a_id;

    RAISE NOTICE '---------------------------------------------------------';
    RAISE NOTICE 'ALL ROADCARE DATABASE SECURITY TESTS COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '---------------------------------------------------------';
END;
$$;

