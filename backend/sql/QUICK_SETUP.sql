-- ============================================================================
-- QUICK DATABASE SETUP - SICHRPLACE
-- ============================================================================
-- Run these commands in order if starting from scratch
-- ============================================================================

-- STEP 1: Enable Extensions
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- STEP 2: Run Core Schema Migration
-- ============================================================================
-- In Supabase SQL Editor, paste and run:
-- backend/migrations/001_initial_supabase_setup.sql

-- STEP 3: Run Enhanced API Support Migration
-- ============================================================================
-- In Supabase SQL Editor, paste and run:
-- backend/migrations/002_enhanced_api_support.sql

-- STEP 4: Create Marketplace Tables
-- ============================================================================
-- In Supabase SQL Editor, paste and run:
-- backend/sql/create_marketplace_tables.sql

-- STEP 5: Verify All Tables Exist
-- ============================================================================
-- In Supabase SQL Editor, paste and run:
-- backend/sql/verify_required_tables.sql

-- STEP 6: Quick Manual Check
-- ============================================================================
SELECT 
    'Critical Tables Check' as test,
    COUNT(*) as table_count,
    CASE 
        WHEN COUNT(*) >= 18 THEN '✅ PASS - Minimum tables exist'
        ELSE '❌ FAIL - Missing critical tables'
    END as status
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
AND table_name IN (
    -- Core (7)
    'users', 'apartments', 'viewing_requests', 'conversations', 'messages', 'offers', 'feedback',
    -- Payments (2)
    'payment_transactions', 'refund_requests',
    -- Marketplace (5)
    'marketplace_listings', 'marketplace_contacts', 'marketplace_chats', 'chat_messages', 'marketplace_payments',
    -- Admin (4)
    'admin_audit_log', 'support_tickets', 'support_ticket_messages', 'trust_safety_reports'
);

-- Expected Output: table_count = 18, status = '✅ PASS - Minimum tables exist'

-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================

-- Check which specific tables are missing:
SELECT 
    required_table,
    CASE 
        WHEN table_name IS NOT NULL THEN '✓ EXISTS'
        ELSE '✗ MISSING'
    END as status
FROM (
    SELECT unnest(ARRAY[
        'users', 'apartments', 'viewing_requests', 'payment_transactions', 
        'marketplace_listings', 'marketplace_chats', 'admin_audit_log',
        'support_tickets', 'refund_requests', 'chat_messages'
    ]) as required_table
) required
LEFT JOIN information_schema.tables t 
    ON required.required_table = t.table_name 
    AND t.table_schema = 'public'
ORDER BY status DESC, required_table;

-- ============================================================================
-- END OF QUICK SETUP
-- ============================================================================
