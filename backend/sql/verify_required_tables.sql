-- ============================================================================
-- SICHRPLACE DATABASE VERIFICATION SCRIPT
-- ============================================================================
-- Purpose: Verify all required Supabase tables exist for production deployment
-- Run this in your Supabase SQL Editor to check database schema completeness
-- Last Updated: October 6, 2025
-- ============================================================================

-- Set client encoding
SET client_encoding = 'UTF8';

DO $$
DECLARE
    v_table_name TEXT;
    v_missing_tables TEXT[] := ARRAY[]::TEXT[];
    v_existing_tables TEXT[] := ARRAY[]::TEXT[];
    v_table_count INTEGER := 0;
    v_missing_count INTEGER := 0;
BEGIN
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'SICHRPLACE DATABASE VERIFICATION - Starting...';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '';

    -- ========================================================================
    -- 1. CORE USER & PROPERTY TABLES (Required for basic functionality)
    -- ========================================================================
    RAISE NOTICE '1. Checking CORE TABLES...';
    RAISE NOTICE '----------------------------------------';
    
    FOREACH v_table_name IN ARRAY ARRAY[
        'users',
        'apartments',
        'viewing_requests',
        'conversations',
        'messages',
        'offers',
        'feedback'
    ] LOOP
        v_table_count := v_table_count + 1;
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = v_table_name
        ) THEN
            v_existing_tables := array_append(v_existing_tables, v_table_name);
            RAISE NOTICE '  ✓ % - EXISTS', v_table_name;
        ELSE
            v_missing_tables := array_append(v_missing_tables, v_table_name);
            RAISE WARNING '  ✗ % - MISSING (CRITICAL)', v_table_name;
            v_missing_count := v_missing_count + 1;
        END IF;
    END LOOP;
    RAISE NOTICE '';

    -- ========================================================================
    -- 2. PAYMENT & TRANSACTION TABLES (Required for financial operations)
    -- ========================================================================
    RAISE NOTICE '2. Checking PAYMENT & TRANSACTION TABLES...';
    RAISE NOTICE '----------------------------------------';
    
    FOREACH v_table_name IN ARRAY ARRAY[
        'payment_transactions',
        'refund_requests'
    ] LOOP
        v_table_count := v_table_count + 1;
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = v_table_name
        ) THEN
            v_existing_tables := array_append(v_existing_tables, v_table_name);
            RAISE NOTICE '  ✓ % - EXISTS', v_table_name;
        ELSE
            v_missing_tables := array_append(v_missing_tables, v_table_name);
            RAISE WARNING '  ✗ % - MISSING (CRITICAL)', v_table_name;
            v_missing_count := v_missing_count + 1;
        END IF;
    END LOOP;
    RAISE NOTICE '';

    -- ========================================================================
    -- 3. MARKETPLACE TABLES (Required for user-to-user transactions)
    -- ========================================================================
    RAISE NOTICE '3. Checking MARKETPLACE TABLES...';
    RAISE NOTICE '----------------------------------------';
    
    FOREACH v_table_name IN ARRAY ARRAY[
        'marketplace_listings',
        'marketplace_contacts',
        'marketplace_chats',
        'marketplace_payments',
        'chat_messages'
    ] LOOP
        v_table_count := v_table_count + 1;
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = v_table_name
        ) THEN
            v_existing_tables := array_append(v_existing_tables, v_table_name);
            RAISE NOTICE '  ✓ % - EXISTS', v_table_name;
        ELSE
            v_missing_tables := array_append(v_missing_tables, v_table_name);
            RAISE WARNING '  ✗ % - MISSING (CRITICAL)', v_table_name;
            v_missing_count := v_missing_count + 1;
        END IF;
    END LOOP;
    RAISE NOTICE '';

    -- ========================================================================
    -- 4. ADMIN & SUPPORT TABLES (Required for admin dashboard)
    -- ========================================================================
    RAISE NOTICE '4. Checking ADMIN & SUPPORT TABLES...';
    RAISE NOTICE '----------------------------------------';
    
    FOREACH v_table_name IN ARRAY ARRAY[
        'admin_audit_log',
        'support_tickets',
        'support_ticket_messages',
        'trust_safety_reports'
    ] LOOP
        v_table_count := v_table_count + 1;
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = v_table_name
        ) THEN
            v_existing_tables := array_append(v_existing_tables, v_table_name);
            RAISE NOTICE '  ✓ % - EXISTS', v_table_name;
        ELSE
            v_missing_tables := array_append(v_missing_tables, v_table_name);
            RAISE WARNING '  ✗ % - MISSING (CRITICAL)', v_table_name;
            v_missing_count := v_missing_count + 1;
        END IF;
    END LOOP;
    RAISE NOTICE '';

    -- ========================================================================
    -- 5. GDPR COMPLIANCE TABLES (Required for legal compliance)
    -- ========================================================================
    RAISE NOTICE '5. Checking GDPR COMPLIANCE TABLES...';
    RAISE NOTICE '----------------------------------------';
    
    FOREACH v_table_name IN ARRAY ARRAY[
        'gdpr_requests',
        'gdpr_tracking_logs',
        'consent_purposes',
        'consents',
        'data_processing_logs',
        'data_breaches',
        'dpias'
    ] LOOP
        v_table_count := v_table_count + 1;
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = v_table_name
        ) THEN
            v_existing_tables := array_append(v_existing_tables, v_table_name);
            RAISE NOTICE '  ✓ % - EXISTS', v_table_name;
        ELSE
            v_missing_tables := array_append(v_missing_tables, v_table_name);
            RAISE WARNING '  ✗ % - MISSING', v_table_name;
            v_missing_count := v_missing_count + 1;
        END IF;
    END LOOP;
    RAISE NOTICE '';

    -- ========================================================================
    -- 6. NOTIFICATION & COMMUNICATION TABLES
    -- ========================================================================
    RAISE NOTICE '6. Checking NOTIFICATION TABLES...';
    RAISE NOTICE '----------------------------------------';
    
    FOREACH v_table_name IN ARRAY ARRAY[
        'notifications',
        'email_logs'
    ] LOOP
        v_table_count := v_table_count + 1;
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = v_table_name
        ) THEN
            v_existing_tables := array_append(v_existing_tables, v_table_name);
            RAISE NOTICE '  ✓ % - EXISTS', v_table_name;
        ELSE
            v_missing_tables := array_append(v_missing_tables, v_table_name);
            RAISE WARNING '  ✗ % - MISSING', v_table_name;
            v_missing_count := v_missing_count + 1;
        END IF;
    END LOOP;
    RAISE NOTICE '';

    -- ========================================================================
    -- 7. USER ACTIVITY TABLES (Optional but recommended)
    -- ========================================================================
    RAISE NOTICE '7. Checking USER ACTIVITY TABLES...';
    RAISE NOTICE '----------------------------------------';
    
    FOREACH v_table_name IN ARRAY ARRAY[
        'user_favorites',
        'saved_searches',
        'recently_viewed',
        'reviews'
    ] LOOP
        v_table_count := v_table_count + 1;
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = v_table_name
        ) THEN
            v_existing_tables := array_append(v_existing_tables, v_table_name);
            RAISE NOTICE '  ✓ % - EXISTS', v_table_name;
        ELSE
            v_missing_tables := array_append(v_missing_tables, v_table_name);
            RAISE NOTICE '  ⚠ % - MISSING (optional)', v_table_name;
            v_missing_count := v_missing_count + 1;
        END IF;
    END LOOP;
    RAISE NOTICE '';

    -- ========================================================================
    -- SUMMARY REPORT
    -- ========================================================================
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'VERIFICATION SUMMARY';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Total Tables Checked: %', v_table_count;
    RAISE NOTICE 'Existing Tables: % (%.1f%%)', array_length(v_existing_tables, 1), 
        (array_length(v_existing_tables, 1)::FLOAT / v_table_count * 100);
    RAISE NOTICE 'Missing Tables: % (%.1f%%)', v_missing_count, 
        (v_missing_count::FLOAT / v_table_count * 100);
    RAISE NOTICE '';

    IF v_missing_count = 0 THEN
        RAISE NOTICE '✅ SUCCESS: All required tables exist!';
        RAISE NOTICE 'Database is ready for production deployment.';
    ELSE
        RAISE WARNING '⚠️  WARNING: % missing table(s) detected!', v_missing_count;
        RAISE NOTICE '';
        RAISE NOTICE 'Missing Tables List:';
        RAISE NOTICE '----------------------------------------';
        FOREACH v_table_name IN ARRAY v_missing_tables LOOP
            RAISE NOTICE '  - %', v_table_name;
        END LOOP;
        RAISE NOTICE '';
        RAISE NOTICE 'Action Required:';
        RAISE NOTICE '  1. Review missing tables above';
        RAISE NOTICE '  2. Run appropriate migration scripts:';
        RAISE NOTICE '     - backend/migrations/001_initial_supabase_setup.sql';
        RAISE NOTICE '     - backend/migrations/002_enhanced_api_support.sql';
        RAISE NOTICE '     - supabase/migrations/20250929000002_german_rental_platform_schema.sql';
        RAISE NOTICE '  3. Create marketplace tables if missing (see CREATE_MARKETPLACE_TABLES.sql)';
        RAISE NOTICE '  4. Re-run this verification script';
    END IF;
    RAISE NOTICE '============================================================================';
END $$;

-- ============================================================================
-- DETAILED TABLE INFORMATION
-- ============================================================================
-- This query provides column counts and row counts for existing tables

SELECT 
    t.table_name,
    (SELECT COUNT(*) 
     FROM information_schema.columns c 
     WHERE c.table_schema = 'public' 
     AND c.table_name = t.table_name) as column_count,
    (SELECT reltuples::bigint 
     FROM pg_class 
     WHERE relname = t.table_name 
     AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) as estimated_row_count
FROM information_schema.tables t
WHERE t.table_schema = 'public'
AND t.table_type = 'BASE TABLE'
AND t.table_name IN (
    'users', 'apartments', 'viewing_requests', 'conversations', 'messages',
    'offers', 'feedback', 'payment_transactions', 'refund_requests',
    'marketplace_listings', 'marketplace_contacts', 'marketplace_chats',
    'marketplace_payments', 'chat_messages', 'admin_audit_log',
    'support_tickets', 'support_ticket_messages', 'trust_safety_reports',
    'gdpr_requests', 'gdpr_tracking_logs', 'consent_purposes', 'consents',
    'data_processing_logs', 'data_breaches', 'dpias', 'notifications',
    'email_logs', 'user_favorites', 'saved_searches', 'recently_viewed', 'reviews'
)
ORDER BY t.table_name;

-- ============================================================================
-- EXTENSION CHECK
-- ============================================================================
-- Verify required PostgreSQL extensions are installed

SELECT 
    'Extension Check' as category,
    e.extname as extension_name,
    CASE 
        WHEN e.extname IS NOT NULL THEN '✓ Installed'
        ELSE '✗ Missing'
    END as status
FROM (
    SELECT 'uuid-ossp' as required_ext
    UNION SELECT 'pg_trgm'
    UNION SELECT 'postgis'
) r
LEFT JOIN pg_extension e ON r.required_ext = e.extname
ORDER BY e.extname NULLS LAST;

-- ============================================================================
-- END OF VERIFICATION SCRIPT
-- ============================================================================
