-- ============================================================================
-- SICHRPLACE - QUICK START VERIFICATION SCRIPT
-- ============================================================================
-- This script verifies your database setup and provides next steps
-- Run this in Supabase SQL Editor AFTER running all migrations
-- ============================================================================

DO $$
DECLARE
    v_table_count INTEGER;
    v_user_count INTEGER;
    v_apartment_count INTEGER;
    v_listing_count INTEGER;
    v_rls_enabled_count INTEGER;
    v_policy_count INTEGER;
    v_index_count INTEGER;
    v_trigger_count INTEGER;
    v_consent_purpose_count INTEGER;
BEGIN
    -- Clear screen
    RAISE NOTICE '';
    RAISE NOTICE '';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '               SICHRPLACE DATABASE VERIFICATION REPORT';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '';
    
    -- ========================================================================
    -- 1. TABLE VERIFICATION
    -- ========================================================================
    RAISE NOTICE '📊 STEP 1: CHECKING TABLES...';
    RAISE NOTICE '────────────────────────────────────────────────────────────────────────────';
    
    SELECT COUNT(*) INTO v_table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name IN (
        'users', 'apartments', 'viewing_requests', 'conversations', 'messages', 'offers', 'feedback',
        'payment_transactions', 'refund_requests',
        'marketplace_listings', 'marketplace_contacts', 'marketplace_chats', 'chat_messages', 'marketplace_payments',
        'admin_audit_log', 'support_tickets', 'support_ticket_messages', 'trust_safety_reports',
        'gdpr_requests', 'gdpr_tracking_logs', 'consent_purposes', 'consents', 'data_processing_logs', 'data_breaches', 'dpias',
        'notifications', 'email_logs',
        'user_favorites', 'saved_searches', 'recently_viewed', 'reviews'
    );
    
    IF v_table_count = 31 THEN
        RAISE NOTICE '  ✅ All 31 tables exist';
    ELSE
        RAISE NOTICE '  ⚠️  Only % out of 31 tables found', v_table_count;
    END IF;
    RAISE NOTICE '';
    
    -- ========================================================================
    -- 2. DATA VERIFICATION
    -- ========================================================================
    RAISE NOTICE '📦 STEP 2: CHECKING TEST DATA...';
    RAISE NOTICE '────────────────────────────────────────────────────────────────────────────';
    
    SELECT COUNT(*) INTO v_user_count FROM users;
    SELECT COUNT(*) INTO v_apartment_count FROM apartments;
    SELECT COUNT(*) INTO v_listing_count FROM marketplace_listings;
    SELECT COUNT(*) INTO v_consent_purpose_count FROM consent_purposes;
    
    IF v_user_count >= 6 THEN
        RAISE NOTICE '  ✅ Users: % (6 expected)', v_user_count;
    ELSE
        RAISE NOTICE '  ⚠️  Users: % (need test data)', v_user_count;
    END IF;
    
    IF v_apartment_count >= 4 THEN
        RAISE NOTICE '  ✅ Apartments: % (4 expected)', v_apartment_count;
    ELSE
        RAISE NOTICE '  ⚠️  Apartments: % (need test data)', v_apartment_count;
    END IF;
    
    IF v_listing_count >= 3 THEN
        RAISE NOTICE '  ✅ Marketplace Listings: % (3 expected)', v_listing_count;
    ELSE
        RAISE NOTICE '  ⚠️  Marketplace Listings: % (need test data)', v_listing_count;
    END IF;
    
    IF v_consent_purpose_count >= 4 THEN
        RAISE NOTICE '  ✅ Consent Purposes: % (4 default)', v_consent_purpose_count;
    ELSE
        RAISE NOTICE '  ⚠️  Consent Purposes: % (need defaults)', v_consent_purpose_count;
    END IF;
    RAISE NOTICE '';
    
    -- ========================================================================
    -- 3. SECURITY VERIFICATION (RLS)
    -- ========================================================================
    RAISE NOTICE '🔐 STEP 3: CHECKING SECURITY (RLS)...';
    RAISE NOTICE '────────────────────────────────────────────────────────────────────────────';
    
    SELECT COUNT(*) INTO v_rls_enabled_count
    FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public'
    AND c.relrowsecurity = true;
    
    SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
    WHERE schemaname = 'public';
    
    IF v_rls_enabled_count >= 31 THEN
        RAISE NOTICE '  ✅ RLS Enabled: % tables', v_rls_enabled_count;
    ELSE
        RAISE NOTICE '  ⚠️  RLS Enabled: % tables (31 expected)', v_rls_enabled_count;
        RAISE NOTICE '     → Run: configure_rls_policies.sql';
    END IF;
    
    IF v_policy_count >= 50 THEN
        RAISE NOTICE '  ✅ Security Policies: % active', v_policy_count;
    ELSE
        RAISE NOTICE '  ⚠️  Security Policies: % (50+ expected)', v_policy_count;
        RAISE NOTICE '     → Run: configure_rls_policies.sql';
    END IF;
    RAISE NOTICE '';
    
    -- ========================================================================
    -- 4. PERFORMANCE VERIFICATION
    -- ========================================================================
    RAISE NOTICE '⚡ STEP 4: CHECKING PERFORMANCE...';
    RAISE NOTICE '────────────────────────────────────────────────────────────────────────────';
    
    SELECT COUNT(*) INTO v_index_count
    FROM pg_indexes
    WHERE schemaname = 'public';
    
    SELECT COUNT(*) INTO v_trigger_count
    FROM information_schema.triggers
    WHERE trigger_schema = 'public';
    
    IF v_index_count >= 40 THEN
        RAISE NOTICE '  ✅ Indexes: % created', v_index_count;
    ELSE
        RAISE NOTICE '  ⚠️  Indexes: % (40+ expected)', v_index_count;
    END IF;
    
    IF v_trigger_count >= 14 THEN
        RAISE NOTICE '  ✅ Triggers: % active', v_trigger_count;
    ELSE
        RAISE NOTICE '  ⚠️  Triggers: % (14 expected)', v_trigger_count;
    END IF;
    RAISE NOTICE '';
    
    -- ========================================================================
    -- 5. FINAL STATUS
    -- ========================================================================
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '                           OVERALL STATUS';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '';
    
    IF v_table_count = 31 AND v_user_count >= 6 AND v_rls_enabled_count >= 31 AND v_policy_count >= 50 THEN
        RAISE NOTICE '🎉 ✅ DATABASE IS PRODUCTION READY! ✅ 🎉';
        RAISE NOTICE '';
        RAISE NOTICE 'All systems go:';
        RAISE NOTICE '  • 31 tables created';
        RAISE NOTICE '  • Test data populated';
        RAISE NOTICE '  • Security policies active';
        RAISE NOTICE '  • Performance optimized';
        RAISE NOTICE '';
        RAISE NOTICE '────────────────────────────────────────────────────────────────────────────';
        RAISE NOTICE '📋 NEXT STEPS:';
        RAISE NOTICE '────────────────────────────────────────────────────────────────────────────';
        RAISE NOTICE '';
        RAISE NOTICE '1️⃣  CONFIGURE ENVIRONMENT';
        RAISE NOTICE '   → Follow: ENV_SETUP_GUIDE.md';
        RAISE NOTICE '   → Update .env with Supabase credentials';
        RAISE NOTICE '';
        RAISE NOTICE '2️⃣  START BACKEND SERVER';
        RAISE NOTICE '   → cd backend';
        RAISE NOTICE '   → npm run dev';
        RAISE NOTICE '   → Verify "Database connected" message';
        RAISE NOTICE '';
        RAISE NOTICE '3️⃣  TEST ADMIN ENDPOINTS';
        RAISE NOTICE '   → GET  /api/admin/payments';
        RAISE NOTICE '   → GET  /api/admin/refunds';
        RAISE NOTICE '   → GET  /api/admin/tickets';
        RAISE NOTICE '';
        RAISE NOTICE '4️⃣  TEST MARKETPLACE ENDPOINTS';
        RAISE NOTICE '   → POST /api/marketplace/contact';
        RAISE NOTICE '   → GET  /api/marketplace/chat/:listingId';
        RAISE NOTICE '   → POST /api/marketplace/payment';
        RAISE NOTICE '';
        RAISE NOTICE '5️⃣  TEST FRONTEND INTEGRATION';
        RAISE NOTICE '   → Open browser: http://localhost:3000';
        RAISE NOTICE '   → Test marketplace functions';
        RAISE NOTICE '   → Test admin dashboard';
        RAISE NOTICE '';
    ELSE
        RAISE NOTICE '⚠️  DATABASE SETUP INCOMPLETE';
        RAISE NOTICE '';
        RAISE NOTICE '📋 TO-DO LIST:';
        RAISE NOTICE '────────────────────────────────────────────────────────────────────────────';
        
        IF v_table_count < 31 THEN
            RAISE NOTICE '';
            RAISE NOTICE '❌ MISSING TABLES (Priority: HIGH)';
            RAISE NOTICE '   → Run in Supabase SQL Editor:';
            RAISE NOTICE '   → supabase/migrations/20251006_create_all_required_tables.sql';
            RAISE NOTICE '';
        END IF;
        
        IF v_user_count < 6 THEN
            RAISE NOTICE '❌ MISSING TEST DATA (Priority: MEDIUM)';
            RAISE NOTICE '   → Run in Supabase SQL Editor:';
            RAISE NOTICE '   → supabase/migrations/create_test_data.sql';
            RAISE NOTICE '';
        END IF;
        
        IF v_rls_enabled_count < 31 OR v_policy_count < 50 THEN
            RAISE NOTICE '❌ SECURITY NOT CONFIGURED (Priority: CRITICAL)';
            RAISE NOTICE '   → Run in Supabase SQL Editor:';
            RAISE NOTICE '   → supabase/migrations/configure_rls_policies.sql';
            RAISE NOTICE '';
        END IF;
        
        RAISE NOTICE '────────────────────────────────────────────────────────────────────────────';
        RAISE NOTICE '';
        RAISE NOTICE 'After completing the above, re-run this script to verify.';
        RAISE NOTICE '';
    END IF;
    
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '                        END OF VERIFICATION REPORT';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '';
    RAISE NOTICE '';
    
END $$;

-- ============================================================================
-- QUICK REFERENCE QUERIES
-- ============================================================================

-- To manually check specific data:
-- SELECT COUNT(*) FROM users WHERE role = 'admin';
-- SELECT COUNT(*) FROM apartments WHERE status = 'verfuegbar';
-- SELECT COUNT(*) FROM marketplace_listings WHERE status = 'active';

-- To check RLS status:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- To list all policies:
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;

-- ============================================================================
-- END OF QUICK START SCRIPT
-- ============================================================================
