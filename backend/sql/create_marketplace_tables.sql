-- ============================================================================
-- SICHRPLACE MARKETPLACE TABLES CREATION SCRIPT
-- ============================================================================
-- Purpose: Create marketplace tables required for user-to-user transactions
-- Run this ONLY if the verification script shows missing marketplace tables
-- Dependencies: Requires 'users' table to exist first
-- Last Updated: October 6, 2025
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. MARKETPLACE LISTINGS TABLE
-- ============================================================================
-- Stores items users want to sell/trade in the marketplace

CREATE TABLE IF NOT EXISTS marketplace_listings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Listing Information
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100), -- 'furniture', 'electronics', 'decor', 'appliances', etc.
    condition VARCHAR(50) CHECK (condition IN ('new', 'like_new', 'good', 'fair', 'poor')),
    
    -- Pricing
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    original_price DECIMAL(10,2),
    negotiable BOOLEAN DEFAULT true,
    
    -- Media
    images TEXT[] DEFAULT '{}',
    primary_image_url TEXT,
    
    -- Location
    location VARCHAR(255),
    pickup_only BOOLEAN DEFAULT false,
    delivery_available BOOLEAN DEFAULT false,
    shipping_cost DECIMAL(10,2),
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('draft', 'active', 'sold', 'pending', 'withdrawn', 'expired')),
    featured BOOLEAN DEFAULT false,
    
    -- Metrics
    view_count INTEGER DEFAULT 0,
    inquiry_count INTEGER DEFAULT 0,
    favorite_count INTEGER DEFAULT 0,
    
    -- Timestamps
    published_at TIMESTAMP WITH TIME ZONE,
    sold_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Admin
    admin_notes TEXT,
    flagged BOOLEAN DEFAULT false,
    flag_reason TEXT
);

-- Indexes for marketplace_listings
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_user ON marketplace_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status ON marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_category ON marketplace_listings(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_price ON marketplace_listings(price);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_created ON marketplace_listings(created_at DESC);

-- ============================================================================
-- 2. MARKETPLACE CONTACTS TABLE
-- ============================================================================
-- Tracks initial contact requests between buyers and sellers

CREATE TABLE IF NOT EXISTS marketplace_contacts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Contact Information
    initial_message TEXT,
    contact_method VARCHAR(50) DEFAULT 'chat' CHECK (contact_method IN ('chat', 'email', 'phone')),
    
    -- Status
    status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'replied', 'negotiating', 'completed', 'cancelled')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    replied_at TIMESTAMP WITH TIME ZONE,
    last_interaction_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate contacts
    UNIQUE(listing_id, buyer_id)
);

-- Indexes for marketplace_contacts
CREATE INDEX IF NOT EXISTS idx_marketplace_contacts_listing ON marketplace_contacts(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_contacts_buyer ON marketplace_contacts(buyer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_contacts_seller ON marketplace_contacts(seller_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_contacts_status ON marketplace_contacts(status);

-- ============================================================================
-- 3. MARKETPLACE CHATS TABLE
-- ============================================================================
-- Persistent chat sessions between buyers and sellers

CREATE TABLE IF NOT EXISTS marketplace_chats (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Chat Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'blocked')),
    
    -- Metadata
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    unread_count_buyer INTEGER DEFAULT 0,
    unread_count_seller INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    archived_at TIMESTAMP WITH TIME ZONE,
    
    -- One chat per buyer-listing combination
    UNIQUE(listing_id, buyer_id)
);

-- Indexes for marketplace_chats
CREATE INDEX IF NOT EXISTS idx_marketplace_chats_listing ON marketplace_chats(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_chats_buyer ON marketplace_chats(buyer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_chats_seller ON marketplace_chats(seller_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_chats_last_message ON marketplace_chats(last_message_at DESC);

-- ============================================================================
-- 4. CHAT MESSAGES TABLE
-- ============================================================================
-- Individual messages within marketplace chats

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    chat_id UUID NOT NULL REFERENCES marketplace_chats(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Message Content
    message TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'offer', 'system')),
    
    -- Attachments
    attachments TEXT[] DEFAULT '{}',
    
    -- Status
    read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Offer-specific fields (when message_type = 'offer')
    offer_amount DECIMAL(10,2),
    offer_status VARCHAR(20) CHECK (offer_status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    edited_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for chat_messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat ON chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);

-- ============================================================================
-- 5. MARKETPLACE PAYMENTS TABLE
-- ============================================================================
-- Payment tracking for marketplace transactions

CREATE TABLE IF NOT EXISTS marketplace_payments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Payment Details
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) DEFAULT 'EUR',
    payment_method VARCHAR(50) CHECK (payment_method IN ('paypal', 'stripe', 'bank_transfer', 'cash', 'other')),
    
    -- Transaction IDs
    payment_provider_id VARCHAR(255), -- PayPal transaction ID, Stripe payment intent, etc.
    platform_fee DECIMAL(10,2) DEFAULT 0.00,
    seller_payout DECIMAL(10,2),
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled')),
    
    -- Timestamps
    initiated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    refunded_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    failure_reason TEXT,
    refund_reason TEXT,
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for marketplace_payments
CREATE INDEX IF NOT EXISTS idx_marketplace_payments_listing ON marketplace_payments(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_payments_buyer ON marketplace_payments(buyer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_payments_seller ON marketplace_payments(seller_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_payments_status ON marketplace_payments(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_payments_provider_id ON marketplace_payments(payment_provider_id);

-- ============================================================================
-- 6. ADMIN AUDIT LOG TABLE (if not exists)
-- ============================================================================
-- Tracks all admin actions for compliance

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Action Details
    action VARCHAR(100) NOT NULL, -- 'approve_refund', 'resolve_ticket', 'ban_user', etc.
    resource_type VARCHAR(50), -- 'payment', 'ticket', 'user', 'listing', etc.
    resource_id UUID,
    
    -- Metadata
    details JSONB,
    old_value JSONB,
    new_value JSONB,
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for admin_audit_log
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_resource ON admin_audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created ON admin_audit_log(created_at DESC);

-- ============================================================================
-- 7. TRUST & SAFETY REPORTS TABLE (if not exists)
-- ============================================================================
-- User reports for inappropriate content or behavior

CREATE TABLE IF NOT EXISTS trust_safety_reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reported_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Report Details
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('scam', 'inappropriate_content', 'harassment', 'spam', 'fake_listing', 'other')),
    resource_type VARCHAR(50), -- 'listing', 'message', 'user', etc.
    resource_id UUID,
    
    -- Content
    description TEXT NOT NULL,
    evidence_urls TEXT[] DEFAULT '{}',
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'dismissed')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    
    -- Resolution
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    action_taken VARCHAR(100), -- 'warning_issued', 'content_removed', 'user_banned', etc.
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for trust_safety_reports
CREATE INDEX IF NOT EXISTS idx_trust_safety_reports_reporter ON trust_safety_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_trust_safety_reports_reported_user ON trust_safety_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_trust_safety_reports_status ON trust_safety_reports(status);
CREATE INDEX IF NOT EXISTS idx_trust_safety_reports_priority ON trust_safety_reports(priority);

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- ============================================================================

-- Create update trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to marketplace tables
DROP TRIGGER IF EXISTS update_marketplace_listings_updated_at ON marketplace_listings;
CREATE TRIGGER update_marketplace_listings_updated_at 
    BEFORE UPDATE ON marketplace_listings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_marketplace_payments_updated_at ON marketplace_payments;
CREATE TRIGGER update_marketplace_payments_updated_at 
    BEFORE UPDATE ON marketplace_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trust_safety_reports_updated_at ON trust_safety_reports;
CREATE TRIGGER update_trust_safety_reports_updated_at 
    BEFORE UPDATE ON trust_safety_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
-- Grant necessary permissions for authenticated and anonymous users

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON marketplace_listings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON marketplace_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON marketplace_chats TO authenticated;
GRANT SELECT, INSERT, UPDATE ON chat_messages TO authenticated;
GRANT SELECT, INSERT ON marketplace_payments TO authenticated;
GRANT SELECT, INSERT ON trust_safety_reports TO authenticated;

-- Admin-only permissions
GRANT ALL ON admin_audit_log TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Check if all marketplace tables were created successfully

DO $$
DECLARE
    v_table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN (
        'marketplace_listings',
        'marketplace_contacts',
        'marketplace_chats',
        'chat_messages',
        'marketplace_payments',
        'admin_audit_log',
        'trust_safety_reports'
    );
    
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'MARKETPLACE TABLES CREATION - COMPLETE';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Created/Verified % marketplace tables', v_table_count;
    
    IF v_table_count = 7 THEN
        RAISE NOTICE '✅ SUCCESS: All marketplace tables are ready!';
    ELSE
        RAISE WARNING '⚠️  WARNING: Expected 7 tables, found %', v_table_count;
        RAISE NOTICE 'Please review the script output for errors.';
    END IF;
    RAISE NOTICE '============================================================================';
END $$;

-- ============================================================================
-- END OF MARKETPLACE TABLES CREATION SCRIPT
-- ============================================================================
-- Next Steps:
-- 1. Run the verification script: backend/sql/verify_required_tables.sql
-- 2. If all tables exist, proceed with seeding test data
-- 3. Configure Row Level Security (RLS) policies as needed
-- ============================================================================
