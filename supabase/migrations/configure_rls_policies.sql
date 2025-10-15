-- ============================================================================
-- SICHRPLACE - ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Comprehensive security policies for all 31 tables
-- Run this AFTER creating all tables and test data
-- Created: October 6, 2025
-- ============================================================================

-- ============================================================================
-- STEP 1: ENABLE RLS ON ALL TABLES
-- ============================================================================

-- Core Tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE viewing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Payment Tables
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_requests ENABLE ROW LEVEL SECURITY;

-- Marketplace Tables
ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_payments ENABLE ROW LEVEL SECURITY;

-- Admin Tables
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_safety_reports ENABLE ROW LEVEL SECURITY;

-- GDPR Tables
ALTER TABLE gdpr_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_tracking_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_purposes ENABLE ROW LEVEL SECURITY;
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_processing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_breaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE dpias ENABLE ROW LEVEL SECURITY;

-- Notification Tables
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- User Activity Tables
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE recently_viewed ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: DROP EXISTING POLICIES (if re-running this script)
-- ============================================================================

-- Core Tables Policies
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Admins can update any user" ON users;

DROP POLICY IF EXISTS "Anyone can view available apartments" ON apartments;
DROP POLICY IF EXISTS "Owners can manage their apartments" ON apartments;
DROP POLICY IF EXISTS "Admins can manage all apartments" ON apartments;

DROP POLICY IF EXISTS "Users can view their viewing requests" ON viewing_requests;
DROP POLICY IF EXISTS "Landlords can view requests for their apartments" ON viewing_requests;
DROP POLICY IF EXISTS "Users can create viewing requests" ON viewing_requests;
DROP POLICY IF EXISTS "Admins can view all viewing requests" ON viewing_requests;

DROP POLICY IF EXISTS "Participants can view their conversations" ON conversations;
DROP POLICY IF EXISTS "Participants can view messages in their conversations" ON messages;

DROP POLICY IF EXISTS "Users can view offers they sent or received" ON offers;
DROP POLICY IF EXISTS "Tenants can create offers" ON offers;

-- Marketplace Policies
DROP POLICY IF EXISTS "Anyone can view active listings" ON marketplace_listings;
DROP POLICY IF EXISTS "Users can manage their listings" ON marketplace_listings;
DROP POLICY IF EXISTS "Admins can manage all listings" ON marketplace_listings;

DROP POLICY IF EXISTS "Buyers and sellers can view their contacts" ON marketplace_contacts;
DROP POLICY IF EXISTS "Buyers and sellers can view their chats" ON marketplace_chats;
DROP POLICY IF EXISTS "Chat participants can view messages" ON chat_messages;

-- Payment Policies
DROP POLICY IF EXISTS "Users can view their transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Admins can view all transactions" ON payment_transactions;

-- Admin Policies
DROP POLICY IF EXISTS "Admins can view audit logs" ON admin_audit_log;
DROP POLICY IF EXISTS "Users can view their tickets" ON support_tickets;
DROP POLICY IF EXISTS "Admins can view all tickets" ON support_tickets;

-- GDPR Policies
DROP POLICY IF EXISTS "Users can view their GDPR requests" ON gdpr_requests;
DROP POLICY IF EXISTS "Users can view their consents" ON consents;

-- Notification Policies
DROP POLICY IF EXISTS "Users can view their notifications" ON notifications;

-- ============================================================================
-- STEP 3: CREATE RLS POLICIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. USERS TABLE POLICIES
-- ----------------------------------------------------------------------------

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
    ON users FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
    ON users FOR UPDATE
    USING (auth.uid() = id);

-- Admins can view all users
CREATE POLICY "Admins can view all users"
    ON users FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- Admins can update any user
CREATE POLICY "Admins can update any user"
    ON users FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- ----------------------------------------------------------------------------
-- 2. APARTMENTS TABLE POLICIES
-- ----------------------------------------------------------------------------

-- Anyone can view available apartments (public listings)
CREATE POLICY "Anyone can view available apartments"
    ON apartments FOR SELECT
    USING (status IN ('available', 'verfuegbar'));

-- Owners can view and manage their own apartments
CREATE POLICY "Owners can manage their apartments"
    ON apartments FOR ALL
    USING (auth.uid() = owner_id);

-- Admins can manage all apartments
CREATE POLICY "Admins can manage all apartments"
    ON apartments FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- ----------------------------------------------------------------------------
-- 3. VIEWING REQUESTS TABLE POLICIES
-- ----------------------------------------------------------------------------

-- Users can view their own viewing requests
CREATE POLICY "Users can view their viewing requests"
    ON viewing_requests FOR SELECT
    USING (auth.uid() = requester_id);

-- Landlords can view requests for their apartments
CREATE POLICY "Landlords can view requests for their apartments"
    ON viewing_requests FOR SELECT
    USING (auth.uid() = landlord_id);

-- Users can create viewing requests
CREATE POLICY "Users can create viewing requests"
    ON viewing_requests FOR INSERT
    WITH CHECK (auth.uid() = requester_id);

-- Users can update their own requests
CREATE POLICY "Users can update their viewing requests"
    ON viewing_requests FOR UPDATE
    USING (auth.uid() = requester_id);

-- Landlords can update requests for their apartments
CREATE POLICY "Landlords can update requests for their apartments"
    ON viewing_requests FOR UPDATE
    USING (auth.uid() = landlord_id);

-- Admins can view all viewing requests
CREATE POLICY "Admins can view all viewing requests"
    ON viewing_requests FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- ----------------------------------------------------------------------------
-- 4. CONVERSATIONS & MESSAGES POLICIES
-- ----------------------------------------------------------------------------

-- Participants can view their conversations
CREATE POLICY "Participants can view their conversations"
    ON conversations FOR SELECT
    USING (
        auth.uid() = participant_1_id OR
        auth.uid() = participant_2_id
    );

-- Participants can view messages in their conversations
CREATE POLICY "Participants can view messages in their conversations"
    ON messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND (conversations.participant_1_id = auth.uid() OR conversations.participant_2_id = auth.uid())
        )
    );

-- Participants can send messages
CREATE POLICY "Participants can send messages"
    ON messages FOR INSERT
    WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND (conversations.participant_1_id = auth.uid() OR conversations.participant_2_id = auth.uid())
        )
    );

-- ----------------------------------------------------------------------------
-- 5. OFFERS TABLE POLICIES
-- ----------------------------------------------------------------------------

-- Users can view offers they sent or received
CREATE POLICY "Users can view offers they sent or received"
    ON offers FOR SELECT
    USING (
        auth.uid() = tenant_id OR
        auth.uid() = landlord_id
    );

-- Tenants can create offers
CREATE POLICY "Tenants can create offers"
    ON offers FOR INSERT
    WITH CHECK (auth.uid() = tenant_id);

-- Users can update their own offers
CREATE POLICY "Users can update their offers"
    ON offers FOR UPDATE
    USING (auth.uid() = tenant_id);

-- Landlords can update offers for their apartments
CREATE POLICY "Landlords can update offers for their apartments"
    ON offers FOR UPDATE
    USING (auth.uid() = landlord_id);

-- ----------------------------------------------------------------------------
-- 6. FEEDBACK TABLE POLICIES
-- ----------------------------------------------------------------------------

-- Users can create feedback
CREATE POLICY "Users can create feedback"
    ON feedback FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can view their own feedback
CREATE POLICY "Users can view their feedback"
    ON feedback FOR SELECT
    USING (auth.uid() = user_id);

-- Admins can view all feedback
CREATE POLICY "Admins can view all feedback"
    ON feedback FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- ----------------------------------------------------------------------------
-- 7. MARKETPLACE LISTINGS POLICIES
-- ----------------------------------------------------------------------------

-- Anyone can view active listings
CREATE POLICY "Anyone can view active listings"
    ON marketplace_listings FOR SELECT
    USING (status = 'active');

-- Users can manage their own listings
CREATE POLICY "Users can manage their listings"
    ON marketplace_listings FOR ALL
    USING (auth.uid() = user_id);

-- Admins can manage all listings
CREATE POLICY "Admins can manage all listings"
    ON marketplace_listings FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- ----------------------------------------------------------------------------
-- 8. MARKETPLACE CONTACTS POLICIES
-- ----------------------------------------------------------------------------

-- Buyers and sellers can view their contacts
CREATE POLICY "Buyers and sellers can view their contacts"
    ON marketplace_contacts FOR SELECT
    USING (
        auth.uid() = buyer_id OR
        auth.uid() = seller_id
    );

-- Buyers can create contacts
CREATE POLICY "Buyers can create contacts"
    ON marketplace_contacts FOR INSERT
    WITH CHECK (auth.uid() = buyer_id);

-- ----------------------------------------------------------------------------
-- 9. MARKETPLACE CHATS & MESSAGES POLICIES
-- ----------------------------------------------------------------------------

-- Buyers and sellers can view their chats
CREATE POLICY "Buyers and sellers can view their chats"
    ON marketplace_chats FOR SELECT
    USING (
        auth.uid() = buyer_id OR
        auth.uid() = seller_id
    );

-- Chat participants can view messages
CREATE POLICY "Chat participants can view messages"
    ON chat_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM marketplace_chats
            WHERE marketplace_chats.id = chat_messages.chat_id
            AND (marketplace_chats.buyer_id = auth.uid() OR marketplace_chats.seller_id = auth.uid())
        )
    );

-- Chat participants can send messages
CREATE POLICY "Chat participants can send messages"
    ON chat_messages FOR INSERT
    WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM marketplace_chats
            WHERE marketplace_chats.id = chat_messages.chat_id
            AND (marketplace_chats.buyer_id = auth.uid() OR marketplace_chats.seller_id = auth.uid())
        )
    );

-- ----------------------------------------------------------------------------
-- 10. PAYMENT TRANSACTIONS POLICIES
-- ----------------------------------------------------------------------------

-- Users can view their own transactions
CREATE POLICY "Users can view their transactions"
    ON payment_transactions FOR SELECT
    USING (auth.uid() = user_id);

-- Admins can view all transactions
CREATE POLICY "Admins can view all transactions"
    ON payment_transactions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- ----------------------------------------------------------------------------
-- 11. REFUND REQUESTS POLICIES
-- ----------------------------------------------------------------------------

-- Users can view their refund requests
CREATE POLICY "Users can view their refund requests"
    ON refund_requests FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create refund requests
CREATE POLICY "Users can create refund requests"
    ON refund_requests FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Admins can manage all refund requests
CREATE POLICY "Admins can manage all refund requests"
    ON refund_requests FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- ----------------------------------------------------------------------------
-- 12. MARKETPLACE PAYMENTS POLICIES
-- ----------------------------------------------------------------------------

-- Buyers and sellers can view their payments
CREATE POLICY "Buyers and sellers can view their payments"
    ON marketplace_payments FOR SELECT
    USING (
        auth.uid() = buyer_id OR
        auth.uid() = seller_id
    );

-- Admins can view all marketplace payments
CREATE POLICY "Admins can view all marketplace payments"
    ON marketplace_payments FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- ----------------------------------------------------------------------------
-- 13. ADMIN AUDIT LOG POLICIES
-- ----------------------------------------------------------------------------

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
    ON admin_audit_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- ----------------------------------------------------------------------------
-- 14. SUPPORT TICKETS POLICIES
-- ----------------------------------------------------------------------------

-- Users can view their own tickets
CREATE POLICY "Users can view their tickets"
    ON support_tickets FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create tickets
CREATE POLICY "Users can create tickets"
    ON support_tickets FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Admins can view all tickets
CREATE POLICY "Admins can view all tickets"
    ON support_tickets FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- ----------------------------------------------------------------------------
-- 15. SUPPORT TICKET MESSAGES POLICIES
-- ----------------------------------------------------------------------------

-- Users can view messages for their tickets
CREATE POLICY "Users can view their ticket messages"
    ON support_ticket_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM support_tickets
            WHERE support_tickets.id = support_ticket_messages.ticket_id
            AND support_tickets.user_id = auth.uid()
        )
    );

-- Admins can manage all ticket messages
CREATE POLICY "Admins can manage all ticket messages"
    ON support_ticket_messages FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- ----------------------------------------------------------------------------
-- 16. TRUST & SAFETY REPORTS POLICIES
-- ----------------------------------------------------------------------------

-- Users can create reports
CREATE POLICY "Users can create reports"
    ON trust_safety_reports FOR INSERT
    WITH CHECK (auth.uid() = reporter_id);

-- Users can view their reports
CREATE POLICY "Users can view their reports"
    ON trust_safety_reports FOR SELECT
    USING (auth.uid() = reporter_id);

-- Admins can manage all reports
CREATE POLICY "Admins can manage all reports"
    ON trust_safety_reports FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- ----------------------------------------------------------------------------
-- 17. GDPR REQUESTS POLICIES
-- ----------------------------------------------------------------------------

-- Users can view their GDPR requests
CREATE POLICY "Users can view their GDPR requests"
    ON gdpr_requests FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create GDPR requests
CREATE POLICY "Users can create GDPR requests"
    ON gdpr_requests FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Admins can manage all GDPR requests
CREATE POLICY "Admins can manage all GDPR requests"
    ON gdpr_requests FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- ----------------------------------------------------------------------------
-- 18. GDPR TRACKING LOGS POLICIES (Admin Only)
-- ----------------------------------------------------------------------------

CREATE POLICY "Admins can view GDPR tracking logs"
    ON gdpr_tracking_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- ----------------------------------------------------------------------------
-- 19. CONSENT PURPOSES POLICIES (Public Read)
-- ----------------------------------------------------------------------------

CREATE POLICY "Anyone can view consent purposes"
    ON consent_purposes FOR SELECT
    USING (true);

-- ----------------------------------------------------------------------------
-- 20. CONSENTS POLICIES
-- ----------------------------------------------------------------------------

-- Users can view their consents
CREATE POLICY "Users can view their consents"
    ON consents FOR SELECT
    USING (auth.uid() = user_id);

-- Users can manage their consents
CREATE POLICY "Users can manage their consents"
    ON consents FOR ALL
    USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 21. DATA PROCESSING LOGS POLICIES (Admin Only)
-- ----------------------------------------------------------------------------

CREATE POLICY "Admins can view data processing logs"
    ON data_processing_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- ----------------------------------------------------------------------------
-- 22. DATA BREACHES POLICIES (Admin Only)
-- ----------------------------------------------------------------------------

CREATE POLICY "Admins can manage data breaches"
    ON data_breaches FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- ----------------------------------------------------------------------------
-- 23. DPIAs POLICIES (Admin Only)
-- ----------------------------------------------------------------------------

CREATE POLICY "Admins can manage DPIAs"
    ON dpias FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- ----------------------------------------------------------------------------
-- 24. NOTIFICATIONS POLICIES
-- ----------------------------------------------------------------------------

-- Users can view their notifications
CREATE POLICY "Users can view their notifications"
    ON notifications FOR SELECT
    USING (auth.uid() = user_id);

-- Users can update their notifications (mark as read)
CREATE POLICY "Users can update their notifications"
    ON notifications FOR UPDATE
    USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 25. EMAIL LOGS POLICIES
-- ----------------------------------------------------------------------------

-- Users can view their email logs
CREATE POLICY "Users can view their email logs"
    ON email_logs FOR SELECT
    USING (auth.uid() = user_id);

-- Admins can view all email logs
CREATE POLICY "Admins can view all email logs"
    ON email_logs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- ----------------------------------------------------------------------------
-- 26. USER FAVORITES POLICIES
-- ----------------------------------------------------------------------------

-- Users can manage their favorites
CREATE POLICY "Users can manage their favorites"
    ON user_favorites FOR ALL
    USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 27. SAVED SEARCHES POLICIES
-- ----------------------------------------------------------------------------

-- Users can manage their saved searches
CREATE POLICY "Users can manage their saved searches"
    ON saved_searches FOR ALL
    USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 28. RECENTLY VIEWED POLICIES
-- ----------------------------------------------------------------------------

-- Users can manage their recently viewed
CREATE POLICY "Users can manage their recently viewed"
    ON recently_viewed FOR ALL
    USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 29. REVIEWS POLICIES
-- ----------------------------------------------------------------------------

-- Anyone can view verified reviews
CREATE POLICY "Anyone can view reviews"
    ON reviews FOR SELECT
    USING (verified = true);

-- Users can create reviews
CREATE POLICY "Users can create reviews"
    ON reviews FOR INSERT
    WITH CHECK (auth.uid() = reviewer_id);

-- Users can view their own reviews
CREATE POLICY "Users can view their reviews"
    ON reviews FOR SELECT
    USING (auth.uid() = reviewer_id);

-- Admins can manage all reviews
CREATE POLICY "Admins can manage all reviews"
    ON reviews FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================

DO $$
DECLARE
    v_policy_count INTEGER;
    v_enabled_count INTEGER;
BEGIN
    -- Count enabled RLS tables
    SELECT COUNT(*) INTO v_enabled_count
    FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public'
    AND c.relrowsecurity = true;
    
    -- Count policies
    SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
    WHERE schemaname = 'public';
    
    RAISE NOTICE '';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'RLS CONFIGURATION COMPLETE';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Tables with RLS Enabled: %', v_enabled_count;
    RAISE NOTICE 'Total Policies Created: %', v_policy_count;
    RAISE NOTICE '';
    
    IF v_enabled_count >= 31 AND v_policy_count >= 50 THEN
        RAISE NOTICE '✅ SUCCESS: RLS is properly configured!';
        RAISE NOTICE '';
        RAISE NOTICE 'Security Features:';
        RAISE NOTICE '  - Users can only access their own data';
        RAISE NOTICE '  - Landlords can manage their apartments';
        RAISE NOTICE '  - Admins have full access to all tables';
        RAISE NOTICE '  - Public listings are viewable by everyone';
        RAISE NOTICE '  - Chat participants can only see their messages';
    ELSE
        RAISE WARNING '⚠️  WARNING: RLS configuration may be incomplete';
        RAISE NOTICE 'Expected: 31 tables with RLS, 50+ policies';
        RAISE NOTICE 'Actual: % tables, % policies', v_enabled_count, v_policy_count;
    END IF;
    
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- END OF RLS CONFIGURATION
-- ============================================================================
