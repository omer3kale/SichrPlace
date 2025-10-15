-- ============================================================================
-- SICHRPLACE - COMPLETE DATABASE SCHEMA
-- ============================================================================
-- Creates all 31 required tables for production deployment
-- Run this in your Supabase SQL Editor or via psql
-- Created: October 6, 2025
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================================
-- CATEGORY 1: CORE TABLES (7 tables) - ⚠️ CRITICAL
-- ============================================================================

-- 1.1 Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    
    -- User Types
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'mieter', 'vermieter', 'kundenmanager')),
    user_type VARCHAR(20) DEFAULT 'user',
    
    -- Personal Information
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    profile_picture_url TEXT,
    
    -- Account Status
    blocked BOOLEAN DEFAULT false,
    email_verified BOOLEAN DEFAULT false,
    email_verification_token VARCHAR(255),
    verification_token_hash VARCHAR(255),
    verified_at TIMESTAMP WITH TIME ZONE,
    verified BOOLEAN DEFAULT FALSE,
    
    -- Password Reset
    reset_password_token VARCHAR(255),
    reset_password_expires TIMESTAMP WITH TIME ZONE,
    
    -- GDPR Compliance
    gdpr_consent BOOLEAN DEFAULT false,
    gdpr_consent_date TIMESTAMP WITH TIME ZONE,
    marketing_consent BOOLEAN DEFAULT false,
    data_processing_consent BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- 1.2 Apartments Table
CREATE TABLE IF NOT EXISTS apartments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Basic Information
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255) NOT NULL,
    
    -- Pricing
    price DECIMAL(10,2) NOT NULL,
    deposit DECIMAL(10,2),
    utilities_included BOOLEAN DEFAULT false,
    
    -- Property Details
    size INTEGER, -- in square meters
    rooms INTEGER,
    bathrooms INTEGER,
    
    -- Availability
    available_from DATE,
    available_to DATE,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'rented', 'pending', 'withdrawn', 'verfuegbar', 'vermietet', 'reserviert', 'wartung', 'offline')),
    
    -- Features
    images TEXT[] DEFAULT '{}',
    amenities TEXT[] DEFAULT '{}',
    pet_friendly BOOLEAN DEFAULT false,
    furnished BOOLEAN DEFAULT false,
    balcony BOOLEAN DEFAULT false,
    garden BOOLEAN DEFAULT false,
    parking BOOLEAN DEFAULT false,
    elevator BOOLEAN DEFAULT false,
    washing_machine BOOLEAN DEFAULT false,
    dishwasher BOOLEAN DEFAULT false,
    internet BOOLEAN DEFAULT false,
    
    -- Energy & Heating
    heating VARCHAR(50),
    energy_rating VARCHAR(5),
    
    -- Location Details
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    postal_code VARCHAR(10),
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Germany',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.3 Viewing Requests Table
CREATE TABLE IF NOT EXISTS viewing_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    requester_id UUID REFERENCES users(id) ON DELETE CASCADE,
    landlord_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Request Details
    requested_date TIMESTAMP WITH TIME ZONE NOT NULL,
    alternative_date_1 TIMESTAMP WITH TIME ZONE,
    alternative_date_2 TIMESTAMP WITH TIME ZONE,
    confirmed_date TIMESTAMP WITH TIME ZONE,
    message TEXT,
    notes TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled', 'ausstehend', 'bestaetigt', 'abgeschlossen', 'storniert', 'zahlung_erforderlich')),
    
    -- Payment
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'failed')),
    payment_amount DECIMAL(10,2),
    payment_id VARCHAR(255),
    booking_fee DECIMAL(10,2) DEFAULT 10.00,
    
    -- Contact Information
    phone VARCHAR(20),
    email VARCHAR(255),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.4 Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    participant_1_id UUID REFERENCES users(id) ON DELETE CASCADE,
    participant_2_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(apartment_id, participant_1_id, participant_2_id)
);

-- 1.5 Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Message Content
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'document', 'system')),
    
    -- Status
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.6 Offers Table
CREATE TABLE IF NOT EXISTS offers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES users(id) ON DELETE CASCADE,
    landlord_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Offer Details
    offer_amount DECIMAL(10,2) NOT NULL,
    move_in_date DATE NOT NULL,
    lease_duration INTEGER, -- in months
    message TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn', 'expired')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- 1.7 Feedback Table
CREATE TABLE IF NOT EXISTS feedback (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Feedback Details
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    category VARCHAR(50),
    email VARCHAR(255),
    
    -- Status
    resolved BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- CATEGORY 2: PAYMENT TABLES (2 tables) - ⚠️ CRITICAL
-- ============================================================================

-- 2.1 Payment Transactions Table
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Transaction Details
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) DEFAULT 'EUR',
    payment_method VARCHAR(50) CHECK (payment_method IN ('paypal', 'stripe', 'bank_transfer', 'cash', 'credit_card', 'debit_card')),
    
    -- Transaction IDs
    transaction_id VARCHAR(255) UNIQUE,
    payment_provider_id VARCHAR(255),
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled')),
    
    -- Related Resources
    resource_type VARCHAR(50), -- 'viewing_request', 'marketplace_payment', etc.
    resource_id UUID,
    
    -- Metadata
    description TEXT,
    failure_reason TEXT,
    refund_reason TEXT,
    metadata JSONB,
    
    -- Timestamps
    initiated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    refunded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.2 Refund Requests Table
CREATE TABLE IF NOT EXISTS refund_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    payment_transaction_id UUID REFERENCES payment_transactions(id) ON DELETE CASCADE,
    
    -- Refund Details
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'processing', 'completed', 'failed')),
    
    -- Admin Review
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    admin_notes TEXT,
    denial_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- CATEGORY 3: MARKETPLACE TABLES (5 tables) - ⚠️ CRITICAL
-- ============================================================================

-- 3.1 Marketplace Listings Table
CREATE TABLE IF NOT EXISTS marketplace_listings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Listing Information
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
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

-- 3.2 Marketplace Contacts Table
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
    
    UNIQUE(listing_id, buyer_id)
);

-- 3.3 Marketplace Chats Table
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
    
    UNIQUE(listing_id, buyer_id)
);

-- 3.4 Chat Messages Table
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
    
    -- Offer-specific fields
    offer_amount DECIMAL(10,2),
    offer_status VARCHAR(20) CHECK (offer_status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    edited_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 3.5 Marketplace Payments Table
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
    payment_provider_id VARCHAR(255),
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

-- ============================================================================
-- CATEGORY 4: ADMIN TABLES (4 tables) - ⚠️ CRITICAL
-- ============================================================================

-- 4.1 Admin Audit Log Table
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Action Details
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
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

-- 4.2 Support Tickets Table
CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Ticket Details
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    
    -- Status
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_user', 'resolved', 'closed')),
    
    -- Assignment
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Resolution
    resolution TEXT,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE
);

-- 4.3 Support Ticket Messages Table
CREATE TABLE IF NOT EXISTS support_ticket_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Message Content
    message TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false, -- Internal notes not visible to user
    
    -- Attachments
    attachments TEXT[] DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4.4 Trust & Safety Reports Table
CREATE TABLE IF NOT EXISTS trust_safety_reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reported_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Report Details
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('scam', 'inappropriate_content', 'harassment', 'spam', 'fake_listing', 'other')),
    resource_type VARCHAR(50),
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
    action_taken VARCHAR(100),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- CATEGORY 5: GDPR TABLES (7 tables) - ✅ Required
-- ============================================================================

-- 5.1 GDPR Requests Table
CREATE TABLE IF NOT EXISTS gdpr_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Request Details
    request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('access', 'deletion', 'portability', 'rectification')),
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
    
    -- Notes
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 5.2 GDPR Tracking Logs Table
CREATE TABLE IF NOT EXISTS gdpr_tracking_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Log Details
    log_type VARCHAR(50) NOT NULL,
    description TEXT,
    
    -- Status
    compliance_status VARCHAR(20) CHECK (compliance_status IN ('compliant', 'non_compliant', 'warning', 'info')),
    
    -- Metadata
    details JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5.3 Consent Purposes Table
CREATE TABLE IF NOT EXISTS consent_purposes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Purpose Details
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    required BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5.4 Consents Table
CREATE TABLE IF NOT EXISTS consents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    purpose_id UUID REFERENCES consent_purposes(id) ON DELETE CASCADE,
    
    -- Consent Details
    granted BOOLEAN NOT NULL,
    
    -- Timestamps
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    withdrawn_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(user_id, purpose_id)
);

-- 5.5 Data Processing Logs Table
CREATE TABLE IF NOT EXISTS data_processing_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Processing Details
    action VARCHAR(100) NOT NULL,
    data_type VARCHAR(100),
    purpose VARCHAR(100),
    legal_basis VARCHAR(100),
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5.6 Data Breaches Table
CREATE TABLE IF NOT EXISTS data_breaches (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Incident Details
    incident_date TIMESTAMP WITH TIME ZONE NOT NULL,
    description TEXT NOT NULL,
    affected_users INTEGER,
    data_types TEXT[],
    
    -- Severity
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Status
    status VARCHAR(20) DEFAULT 'identified' CHECK (status IN ('identified', 'investigating', 'contained', 'resolved')),
    
    -- Reporting
    reported_to_authority BOOLEAN DEFAULT false,
    reported_to_users BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- 5.7 DPIAs (Data Protection Impact Assessments) Table
CREATE TABLE IF NOT EXISTS dpias (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- DPIA Details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    data_types TEXT[],
    processing_purposes TEXT[],
    legal_basis VARCHAR(100),
    
    -- Risk Assessment
    risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high')),
    mitigation_measures TEXT[],
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'rejected')),
    
    -- Approval
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- CATEGORY 6: NOTIFICATION TABLES (2 tables) - ✅ Recommended
-- ============================================================================

-- 6.1 Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Notification Details
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    -- Link
    link_url TEXT,
    
    -- Status
    read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6.2 Email Logs Table
CREATE TABLE IF NOT EXISTS email_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Email Details
    to_email VARCHAR(255) NOT NULL,
    from_email VARCHAR(255),
    subject VARCHAR(255) NOT NULL,
    template VARCHAR(100),
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
    
    -- Provider Details
    provider VARCHAR(50),
    provider_message_id VARCHAR(255),
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- CATEGORY 7: USER ACTIVITY TABLES (4 tables) - ℹ️ Optional
-- ============================================================================

-- 7.1 User Favorites Table
CREATE TABLE IF NOT EXISTS user_favorites (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, apartment_id)
);

-- 7.2 Saved Searches Table
CREATE TABLE IF NOT EXISTS saved_searches (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Search Details
    name VARCHAR(255),
    search_params JSONB NOT NULL,
    
    -- Notifications
    notify_on_new BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7.3 Recently Viewed Table
CREATE TABLE IF NOT EXISTS recently_viewed (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    
    -- Timestamps
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, apartment_id)
);

-- 7.4 Reviews Table
CREATE TABLE IF NOT EXISTS reviews (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Review Details
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(255),
    comment TEXT,
    
    -- Review Type
    review_type VARCHAR(20) CHECK (review_type IN ('apartment', 'landlord', 'tenant')),
    
    -- Status
    verified BOOLEAN DEFAULT false,
    flagged BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Core Tables Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_apartments_owner ON apartments(owner_id);
CREATE INDEX IF NOT EXISTS idx_apartments_location ON apartments(location);
CREATE INDEX IF NOT EXISTS idx_apartments_price ON apartments(price);
CREATE INDEX IF NOT EXISTS idx_apartments_status ON apartments(status);
CREATE INDEX IF NOT EXISTS idx_viewing_requests_apartment ON viewing_requests(apartment_id);
CREATE INDEX IF NOT EXISTS idx_viewing_requests_requester ON viewing_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_viewing_requests_status ON viewing_requests(status);
CREATE INDEX IF NOT EXISTS idx_conversations_apartment ON conversations(apartment_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_offers_apartment ON offers(apartment_id);
CREATE INDEX IF NOT EXISTS idx_offers_tenant ON offers(tenant_id);

-- Payment Tables Indexes
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_refund_requests_user ON refund_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON refund_requests(status);

-- Marketplace Tables Indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_user ON marketplace_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status ON marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_category ON marketplace_listings(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_price ON marketplace_listings(price);
CREATE INDEX IF NOT EXISTS idx_marketplace_contacts_listing ON marketplace_contacts(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_contacts_buyer ON marketplace_contacts(buyer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_chats_listing ON marketplace_chats(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_chats_buyer ON marketplace_chats(buyer_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat ON chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_payments_listing ON marketplace_payments(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_payments_status ON marketplace_payments(status);

-- Admin Tables Indexes
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_trust_safety_reports_reporter ON trust_safety_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_trust_safety_reports_status ON trust_safety_reports(status);

-- Notification Tables Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_email_logs_user ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- ============================================================================

-- Create or replace update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at column
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_apartments_updated_at ON apartments;
CREATE TRIGGER update_apartments_updated_at BEFORE UPDATE ON apartments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_viewing_requests_updated_at ON viewing_requests;
CREATE TRIGGER update_viewing_requests_updated_at BEFORE UPDATE ON viewing_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_offers_updated_at ON offers;
CREATE TRIGGER update_offers_updated_at BEFORE UPDATE ON offers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payment_transactions_updated_at ON payment_transactions;
CREATE TRIGGER update_payment_transactions_updated_at BEFORE UPDATE ON payment_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_refund_requests_updated_at ON refund_requests;
CREATE TRIGGER update_refund_requests_updated_at BEFORE UPDATE ON refund_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_marketplace_listings_updated_at ON marketplace_listings;
CREATE TRIGGER update_marketplace_listings_updated_at BEFORE UPDATE ON marketplace_listings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_marketplace_payments_updated_at ON marketplace_payments;
CREATE TRIGGER update_marketplace_payments_updated_at BEFORE UPDATE ON marketplace_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_support_tickets_updated_at ON support_tickets;
CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON support_tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trust_safety_reports_updated_at ON trust_safety_reports;
CREATE TRIGGER update_trust_safety_reports_updated_at BEFORE UPDATE ON trust_safety_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dpias_updated_at ON dpias;
CREATE TRIGGER update_dpias_updated_at BEFORE UPDATE ON dpias
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_saved_searches_updated_at ON saved_searches;
CREATE TRIGGER update_saved_searches_updated_at BEFORE UPDATE ON saved_searches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reviews_updated_at ON reviews;
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INSERT DEFAULT CONSENT PURPOSES
-- ============================================================================

INSERT INTO consent_purposes (name, description, required) VALUES
    ('Essential Services', 'Processing necessary for providing core platform services', true),
    ('Marketing Communications', 'Sending marketing emails and promotional content', false),
    ('Analytics', 'Collecting usage data to improve our services', false),
    ('Third Party Integrations', 'Sharing data with payment processors and other service providers', true)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================

DO $$
DECLARE
    v_table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_table_count
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
        'admin_audit_log', 'support_tickets', 'support_ticket_messages', 'trust_safety_reports',
        -- GDPR (7)
        'gdpr_requests', 'gdpr_tracking_logs', 'consent_purposes', 'consents', 'data_processing_logs', 'data_breaches', 'dpias',
        -- Notifications (2)
        'notifications', 'email_logs',
        -- User Activity (4)
        'user_favorites', 'saved_searches', 'recently_viewed', 'reviews'
    );
    
    RAISE NOTICE '';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'DATABASE CREATION COMPLETE';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Total Tables Created/Verified: % out of 31', v_table_count;
    RAISE NOTICE '';
    
    IF v_table_count = 31 THEN
        RAISE NOTICE '✅ SUCCESS: All 31 required tables exist!';
        RAISE NOTICE '';
        RAISE NOTICE 'Database is ready for production deployment.';
        RAISE NOTICE '';
        RAISE NOTICE 'Next Steps:';
        RAISE NOTICE '  1. Run verification script: backend/sql/verify_required_tables.sql';
        RAISE NOTICE '  2. Configure Row Level Security (RLS) policies';
        RAISE NOTICE '  3. Seed test data if needed';
        RAISE NOTICE '  4. Test backend endpoints: npm run dev';
    ELSE
        RAISE WARNING '⚠️  WARNING: Only % tables created (expected 31)', v_table_count;
        RAISE NOTICE 'Please review the script output for errors.';
    END IF;
    
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
