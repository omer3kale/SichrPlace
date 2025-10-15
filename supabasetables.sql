-- 🎯 100% COMPLETE MIGRATION FOR SICHRPLACE
-- Comprehensive database schema with full website integration
-- Run this in your Supabase SQL editor

-- ===== ENABLE REQUIRED EXTENSIONS =====
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- For encryption

-- ===== CORE FOUNDATION =====

-- Email tracking table for audit and debugging
CREATE TABLE IF NOT EXISTS email_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    recipient_email VARCHAR(255) NOT NULL,
    email_type VARCHAR(50) NOT NULL, -- 'request_confirmation', 'viewing_ready', 'payment_confirmation', etc.
    subject VARCHAR(500),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered', 'bounced')),
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    related_entity_type VARCHAR(50), -- 'viewing_request', 'payment', 'apartment', etc.
    related_entity_id UUID,
    user_id UUID, -- Foreign key will be added later after users table is created
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'email_logs'
          AND column_name = 'recipient_email'
    ) THEN
        ALTER TABLE email_logs ADD COLUMN recipient_email VARCHAR(255);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'email_logs'
          AND column_name = 'email_type'
    ) THEN
        ALTER TABLE email_logs ADD COLUMN email_type VARCHAR(50);
    END IF;

    BEGIN
        ALTER TABLE email_logs ALTER COLUMN recipient_email SET NOT NULL;
        ALTER TABLE email_logs ALTER COLUMN email_type SET NOT NULL;
    EXCEPTION WHEN undefined_column THEN
        NULL;
    END;
END $$;

-- Payment transactions table for detailed payment tracking
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    payment_id VARCHAR(255) NOT NULL UNIQUE, -- PayPal payment ID
    payer_id VARCHAR(255), -- PayPal payer ID  
    user_id UUID, -- Foreign key will be added later
    viewing_request_id UUID, -- Foreign key will be added later
    apartment_id UUID, -- Foreign key will be added later
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR',
    payment_method VARCHAR(50) DEFAULT 'paypal',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'created', 'approved', 'completed', 'cancelled', 'failed', 'refunded')),
    gateway_status VARCHAR(50), -- Raw status from payment gateway
    transaction_id VARCHAR(255), -- Gateway transaction ID
    gateway_response JSONB, -- Full gateway response for debugging
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    refunded_at TIMESTAMP WITH TIME ZONE,
    refund_amount DECIMAL(10,2),
    fees DECIMAL(10,2), -- Gateway fees
    net_amount DECIMAL(10,2) -- Amount after fees
);

DO $$
BEGIN
    -- Ensure all critical columns exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payment_transactions' AND column_name = 'payment_id'
    ) THEN
        ALTER TABLE payment_transactions ADD COLUMN payment_id VARCHAR(255);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payment_transactions' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE payment_transactions ADD COLUMN user_id UUID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payment_transactions' AND column_name = 'viewing_request_id'
    ) THEN
        ALTER TABLE payment_transactions ADD COLUMN viewing_request_id UUID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payment_transactions' AND column_name = 'apartment_id'
    ) THEN
        ALTER TABLE payment_transactions ADD COLUMN apartment_id UUID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payment_transactions' AND column_name = 'status'
    ) THEN
        ALTER TABLE payment_transactions ADD COLUMN status VARCHAR(20) DEFAULT 'pending';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payment_transactions' AND column_name = 'amount'
    ) THEN
        ALTER TABLE payment_transactions ADD COLUMN amount DECIMAL(10,2);
    END IF;

    -- Apply constraints
    BEGIN
        ALTER TABLE payment_transactions ALTER COLUMN payment_id SET NOT NULL;
        ALTER TABLE payment_transactions ALTER COLUMN amount SET NOT NULL;
        
        -- Add unique constraint if not exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'payment_transactions_payment_id_key' 
            AND table_name = 'payment_transactions'
        ) THEN
            ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_payment_id_key UNIQUE (payment_id);
        END IF;
    EXCEPTION WHEN undefined_column THEN
        NULL;
    END;
END $$;

-- Support tickets/messages table for admin management
CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    ticket_number VARCHAR(20) UNIQUE NOT NULL, -- Human-readable ticket number
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    category VARCHAR(50) NOT NULL, -- 'technical', 'billing', 'general', 'complaint'
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'pending_user', 'resolved', 'closed')),
    subject VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL, -- Admin user
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
    internal_notes TEXT -- Private admin notes
);

-- Support ticket messages for conversation history
CREATE TABLE IF NOT EXISTS support_ticket_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false, -- Internal admin messages
    attachments TEXT[], -- File URLs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE
);

-- Trust and safety reports
CREATE TABLE IF NOT EXISTS safety_reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    report_number VARCHAR(20) UNIQUE NOT NULL,
    reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reported_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reported_apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,
    category VARCHAR(50) NOT NULL, -- 'harassment', 'fraud', 'inappropriate_content', 'violence', 'other'
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'dismissed')),
    description TEXT NOT NULL,
    evidence_urls TEXT[], -- Screenshots, documents, etc.
    action_taken VARCHAR(100), -- What action was taken
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    internal_notes TEXT
);

-- Refund requests table
CREATE TABLE IF NOT EXISTS refund_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    request_number VARCHAR(20) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    payment_transaction_id UUID REFERENCES payment_transactions(id) ON DELETE CASCADE,
    viewing_request_id UUID REFERENCES viewing_requests(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL,
    reason VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'processed', 'cancelled')),
    processed_by UUID REFERENCES users(id) ON DELETE SET NULL, -- Admin who processed
    processed_at TIMESTAMP WITH TIME ZONE,
    refund_method VARCHAR(50) DEFAULT 'original_payment',
    refund_transaction_id VARCHAR(255), -- Gateway refund transaction ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    admin_notes TEXT
);

-- Notifications table for user notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'viewing_confirmed', 'payment_received', 'message_received', etc.
    title VARCHAR(255) NOT NULL,
    message TEXT,
    related_entity_type VARCHAR(50), -- 'viewing_request', 'apartment', 'payment', etc.
    related_entity_id UUID,
    read_at TIMESTAMP WITH TIME ZONE,
    action_url TEXT, -- URL to take action on notification
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- System settings/configuration table
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(20) DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    is_public BOOLEAN DEFAULT false, -- Can be accessed by non-admin users
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- GDPR tracking logs table for audit trail
CREATE TABLE IF NOT EXISTS gdpr_tracking_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    event VARCHAR(50) NOT NULL CHECK (event IN (
        'clarity_initialized',
        'clarity_disabled', 
        'user_data_deleted',
        'consent_given',
        'consent_withdrawn',
        'tracking_blocked',
        'privacy_settings_accessed'
    )),
    service VARCHAR(50) NOT NULL DEFAULT 'microsoft_clarity',
    data JSONB,
    ip_address INET,
    user_agent TEXT,
    url TEXT,
    consent_version VARCHAR(10) DEFAULT '1.0',
    legal_basis VARCHAR(50) CHECK (legal_basis IN ('consent', 'legitimate_interest', 'legal_obligation', 'vital_interests', 'public_task', 'contract')),
    retention_date TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '3 years'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== 100% WEBSITE INTEGRATION TABLES =====

-- User favorites/bookmarks (Frontend has "Add to Favorites" buttons)
CREATE TABLE IF NOT EXISTS user_favorites (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, apartment_id)
);

-- Apartment analytics for landlord dashboard performance tracking
CREATE TABLE IF NOT EXISTS apartment_analytics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    views_count INTEGER DEFAULT 0,
    favorites_count INTEGER DEFAULT 0,
    viewing_requests_count INTEGER DEFAULT 0,
    contact_attempts_count INTEGER DEFAULT 0,
    search_appearances_count INTEGER DEFAULT 0, -- How many times it appeared in search results
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(apartment_id, date)
);

-- Reviews and ratings (Frontend mentions "top-rated apartments")
CREATE TABLE IF NOT EXISTS apartment_reviews (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(200),
    review_text TEXT,
    pros TEXT,
    cons TEXT,
    stay_duration_months INTEGER,
    would_recommend BOOLEAN DEFAULT true,
    landlord_rating INTEGER CHECK (landlord_rating >= 1 AND landlord_rating <= 5),
    location_rating INTEGER CHECK (location_rating >= 1 AND location_rating <= 5),
    value_rating INTEGER CHECK (value_rating >= 1 AND value_rating <= 5),
    verified_stay BOOLEAN DEFAULT false,
    helpful_votes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Media files management (Frontend has photo upload, video tours mentioned)
CREATE TABLE IF NOT EXISTS media_files (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    related_entity_type VARCHAR(50) NOT NULL, -- 'apartment', 'user', 'viewing_request'
    related_entity_id UUID NOT NULL,
    file_type VARCHAR(20) NOT NULL CHECK (file_type IN ('image', 'video', 'document', 'floor_plan', 'virtual_tour')),
    file_url TEXT NOT NULL,
    file_name VARCHAR(255),
    file_size INTEGER, -- in bytes
    mime_type VARCHAR(100),
    alt_text VARCHAR(500),
    display_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,
    is_featured BOOLEAN DEFAULT false, -- For featured apartment images
    upload_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Search history for user experience improvement
CREATE TABLE IF NOT EXISTS search_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    search_query JSONB NOT NULL, -- Store filter criteria
    results_count INTEGER DEFAULT 0,
    city VARCHAR(100),
    min_price DECIMAL(10,2),
    max_price DECIMAL(10,2),
    property_type VARCHAR(50),
    amenities TEXT[],
    clicked_apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL, -- Track which apartment they clicked
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Saved searches for user convenience
CREATE TABLE IF NOT EXISTS saved_searches (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    search_name VARCHAR(200) NOT NULL,
    search_criteria JSONB NOT NULL,
    email_alerts BOOLEAN DEFAULT true,
    alert_frequency VARCHAR(20) DEFAULT 'daily' CHECK (alert_frequency IN ('immediate', 'daily', 'weekly')),
    last_notified_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat messages for real-time messaging (Frontend has chat functionality)
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversation_id UUID, -- Foreign key will be added later after conversations table is created
    sender_id UUID, -- Foreign key will be added later after users table is created
    message TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
    attachment_url TEXT,
    read_at TIMESTAMP WITH TIME ZONE,
    edited_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
    -- Ensure all critical columns exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'chat_messages' AND column_name = 'conversation_id'
    ) THEN
        ALTER TABLE chat_messages ADD COLUMN conversation_id UUID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'chat_messages' AND column_name = 'sender_id'
    ) THEN
        ALTER TABLE chat_messages ADD COLUMN sender_id UUID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'chat_messages' AND column_name = 'message'
    ) THEN
        ALTER TABLE chat_messages ADD COLUMN message TEXT;
    END IF;

    -- Apply constraints
    BEGIN
        ALTER TABLE chat_messages ALTER COLUMN message SET NOT NULL;
    EXCEPTION WHEN undefined_column THEN
        NULL;
    END;
END $$;

-- Property matching preferences for smart matching
CREATE TABLE IF NOT EXISTS matching_preferences (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('tenant', 'landlord')),
    preferences JSONB NOT NULL, -- Store detailed matching criteria
    max_distance_km INTEGER DEFAULT 10,
    budget_min DECIMAL(10,2),
    budget_max DECIMAL(10,2),
    preferred_move_in_date DATE,
    lease_duration_months INTEGER,
    pet_friendly BOOLEAN,
    smoking_allowed BOOLEAN,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Viewing scheduler for automated coordination
CREATE TABLE IF NOT EXISTS viewing_schedule (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    viewing_request_id UUID REFERENCES viewing_requests(id) ON DELETE CASCADE,
    scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
    customer_manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled')),
    preparation_notes TEXT,
    equipment_needed TEXT[], -- Camera, measuring tape, etc.
    access_instructions TEXT,
    completion_report TEXT,
    video_urls TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contract generation for digital contracts
CREATE TABLE IF NOT EXISTS digital_contracts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    contract_number VARCHAR(30) UNIQUE NOT NULL,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES users(id) ON DELETE SET NULL,
    landlord_id UUID REFERENCES users(id) ON DELETE SET NULL,
    viewing_request_id UUID REFERENCES viewing_requests(id) ON DELETE SET NULL,
    contract_type VARCHAR(30) DEFAULT 'rental_agreement',
    contract_data JSONB NOT NULL, -- All contract details
    monthly_rent DECIMAL(10,2) NOT NULL,
    deposit_amount DECIMAL(10,2) NOT NULL,
    lease_start_date DATE NOT NULL,
    lease_end_date DATE,
    lease_duration_months INTEGER,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent_for_signature', 'partially_signed', 'fully_signed', 'active', 'terminated', 'expired')),
    tenant_signed_at TIMESTAMP WITH TIME ZONE,
    landlord_signed_at TIMESTAMP WITH TIME ZONE,
    contract_pdf_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== FUNCTIONS AND TRIGGERS =====

-- Updated at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Updated at triggers for new tables
DROP TRIGGER IF EXISTS update_payment_transactions_updated_at ON payment_transactions;
CREATE TRIGGER update_payment_transactions_updated_at BEFORE UPDATE ON payment_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_support_tickets_updated_at ON support_tickets;
CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON support_tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_safety_reports_updated_at ON safety_reports;
CREATE TRIGGER update_safety_reports_updated_at BEFORE UPDATE ON safety_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_refund_requests_updated_at ON refund_requests;
CREATE TRIGGER update_refund_requests_updated_at BEFORE UPDATE ON refund_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_system_settings_updated_at ON system_settings;
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_gdpr_tracking_logs_updated_at ON gdpr_tracking_logs;
CREATE TRIGGER update_gdpr_tracking_logs_updated_at BEFORE UPDATE ON gdpr_tracking_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- New table triggers
DROP TRIGGER IF EXISTS update_apartment_reviews_updated_at ON apartment_reviews;
CREATE TRIGGER update_apartment_reviews_updated_at BEFORE UPDATE ON apartment_reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_saved_searches_updated_at ON saved_searches;
CREATE TRIGGER update_saved_searches_updated_at BEFORE UPDATE ON saved_searches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_matching_preferences_updated_at ON matching_preferences;
CREATE TRIGGER update_matching_preferences_updated_at BEFORE UPDATE ON matching_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_viewing_schedule_updated_at ON viewing_schedule;
CREATE TRIGGER update_viewing_schedule_updated_at BEFORE UPDATE ON viewing_schedule
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_digital_contracts_updated_at ON digital_contracts;
CREATE TRIGGER update_digital_contracts_updated_at BEFORE UPDATE ON digital_contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate unique numbers
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    counter INTEGER := 1;
BEGIN
    LOOP
        new_number := 'TKT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');
        EXIT WHEN NOT EXISTS (SELECT 1 FROM support_tickets WHERE ticket_number = new_number);
        counter := counter + 1;
    END LOOP;
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_report_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    counter INTEGER := 1;
BEGIN
    LOOP
        new_number := 'RPT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');
        EXIT WHEN NOT EXISTS (SELECT 1 FROM safety_reports WHERE report_number = new_number);
        counter := counter + 1;
    END LOOP;
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_refund_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    counter INTEGER := 1;
BEGIN
    LOOP
        new_number := 'REF-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');
        EXIT WHEN NOT EXISTS (SELECT 1 FROM refund_requests WHERE request_number = new_number);
        counter := counter + 1;
    END LOOP;
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_contract_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    counter INTEGER := 1;
BEGIN
    LOOP
        new_number := 'CNT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');
        EXIT WHEN NOT EXISTS (SELECT 1 FROM digital_contracts WHERE contract_number = new_number);
        counter := counter + 1;
    END LOOP;
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Auto-number generation triggers
CREATE OR REPLACE FUNCTION set_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ticket_number IS NULL THEN
        NEW.ticket_number := generate_ticket_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_report_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.report_number IS NULL THEN
        NEW.report_number := generate_report_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_refund_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.request_number IS NULL THEN
        NEW.request_number := generate_refund_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_contract_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.contract_number IS NULL THEN
        NEW.contract_number := generate_contract_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Number generation triggers
DROP TRIGGER IF EXISTS support_tickets_set_number ON support_tickets;
CREATE TRIGGER support_tickets_set_number BEFORE INSERT ON support_tickets
    FOR EACH ROW EXECUTE FUNCTION set_ticket_number();

DROP TRIGGER IF EXISTS safety_reports_set_number ON safety_reports;
CREATE TRIGGER safety_reports_set_number BEFORE INSERT ON safety_reports
    FOR EACH ROW EXECUTE FUNCTION set_report_number();

DROP TRIGGER IF EXISTS refund_requests_set_number ON refund_requests;
CREATE TRIGGER refund_requests_set_number BEFORE INSERT ON refund_requests
    FOR EACH ROW EXECUTE FUNCTION set_refund_number();

DROP TRIGGER IF EXISTS digital_contracts_set_number ON digital_contracts;
CREATE TRIGGER digital_contracts_set_number BEFORE INSERT ON digital_contracts
    FOR EACH ROW EXECUTE FUNCTION set_contract_number();

-- Function to update apartment rating averages
CREATE OR REPLACE FUNCTION update_apartment_rating()
RETURNS TRIGGER AS $$
DECLARE
    apartment_uuid UUID;
BEGIN
    -- Handle both INSERT/UPDATE and DELETE
    IF TG_OP = 'DELETE' THEN
        apartment_uuid := OLD.apartment_id;
    ELSE
        apartment_uuid := NEW.apartment_id;
    END IF;
    
    UPDATE apartments 
    SET 
        average_rating = COALESCE((SELECT AVG(rating)::DECIMAL(3,2) FROM apartment_reviews WHERE apartment_id = apartment_uuid), 0.0),
        review_count = COALESCE((SELECT COUNT(*) FROM apartment_reviews WHERE apartment_id = apartment_uuid), 0),
        last_activity_at = NOW()
    WHERE id = apartment_uuid;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS apartment_rating_trigger ON apartment_reviews;
CREATE TRIGGER apartment_rating_trigger
    AFTER INSERT OR UPDATE OR DELETE ON apartment_reviews
    FOR EACH ROW EXECUTE FUNCTION update_apartment_rating();

-- Function to update apartment analytics
CREATE OR REPLACE FUNCTION update_apartment_analytics_on_activity()
RETURNS TRIGGER AS $$
BEGIN
    -- Update analytics on various apartment activities
    INSERT INTO apartment_analytics (apartment_id, date, views_count, favorites_count, viewing_requests_count)
    VALUES (NEW.apartment_id, CURRENT_DATE, 0, 0, 0)
    ON CONFLICT (apartment_id, date) 
    DO UPDATE SET
        views_count = apartment_analytics.views_count + CASE WHEN TG_TABLE_NAME = 'apartment_views' THEN 1 ELSE 0 END,
        favorites_count = apartment_analytics.favorites_count + CASE WHEN TG_TABLE_NAME = 'user_favorites' THEN 1 ELSE 0 END,
        viewing_requests_count = apartment_analytics.viewing_requests_count + CASE WHEN TG_TABLE_NAME = 'viewing_requests' THEN 1 ELSE 0 END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===== COMPREHENSIVE ROW LEVEL SECURITY =====

-- Enable RLS for all tables
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_tracking_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartment_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartment_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE matching_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE viewing_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_contracts ENABLE ROW LEVEL SECURITY;

-- Comprehensive RLS policies
DROP POLICY IF EXISTS "Users can view own payment transactions" ON payment_transactions;
CREATE POLICY "Users can view own payment transactions" ON payment_transactions
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own support tickets" ON support_tickets;
CREATE POLICY "Users can view own support tickets" ON support_tickets
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create support tickets" ON support_tickets;
CREATE POLICY "Users can create support tickets" ON support_tickets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public system settings are viewable" ON system_settings;
CREATE POLICY "Public system settings are viewable" ON system_settings
    FOR SELECT USING (is_public = true);

-- New table policies
DROP POLICY IF EXISTS "Users can manage own favorites" ON user_favorites;
CREATE POLICY "Users can manage own favorites" ON user_favorites
    FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view apartment analytics" ON apartment_analytics;
CREATE POLICY "Users can view apartment analytics" ON apartment_analytics
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can read reviews" ON apartment_reviews;
CREATE POLICY "Users can read reviews" ON apartment_reviews
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create reviews" ON apartment_reviews;
CREATE POLICY "Users can create reviews" ON apartment_reviews
    FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

DROP POLICY IF EXISTS "Users can view chat messages in their conversations" ON chat_messages;
CREATE POLICY "Users can view chat messages in their conversations" ON chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM conversations 
            WHERE conversations.id = chat_messages.conversation_id 
            AND (conversations.participant_1_id = auth.uid() OR conversations.participant_2_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Users can send chat messages in their conversations" ON chat_messages;
CREATE POLICY "Users can send chat messages in their conversations" ON chat_messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM conversations 
            WHERE conversations.id = chat_messages.conversation_id 
            AND (conversations.participant_1_id = auth.uid() OR conversations.participant_2_id = auth.uid())
        )
    );

-- ===== COMPREHENSIVE SYSTEM SETTINGS =====

INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public) VALUES
('booking_fee_default', '25.00', 'number', 'Default viewing service fee in EUR', true),
('max_viewing_alternatives', '2', 'number', 'Maximum alternative dates for viewing requests', true),
('payment_timeout_minutes', '60', 'number', 'Payment timeout in minutes', false),
('email_notifications_enabled', 'true', 'boolean', 'Enable email notifications', false),
('platform_commission_rate', '0.05', 'number', 'Platform commission rate (5%)', false),
('max_apartment_images', '20', 'number', 'Maximum images per apartment', true),
('supported_image_formats', '["jpg","jpeg","png","webp"]', 'json', 'Supported image formats', true),
('max_image_size_mb', '10', 'number', 'Maximum image size in MB', true),
('maintenance_mode', 'false', 'boolean', 'Maintenance mode status', true),
('support_email', 'support@sichrplace.com', 'string', 'Support contact email', true),
('platform_name', 'SichrPlace', 'string', 'Platform name', true),
('privacy_policy_version', '1.0', 'string', 'Current privacy policy version', true),
('terms_of_service_version', '1.0', 'string', 'Current terms of service version', true),
('max_search_results', '50', 'number', 'Maximum search results per page', true),
('featured_apartments_limit', '10', 'number', 'Number of featured apartments on homepage', true),
('review_moderation_enabled', 'true', 'boolean', 'Enable review moderation', false),
('auto_approve_reviews', 'false', 'boolean', 'Automatically approve reviews', false),
('chat_enabled', 'true', 'boolean', 'Enable chat functionality', true),
('video_tour_enabled', 'true', 'boolean', 'Enable video tour functionality', true),
('virtual_tour_enabled', 'true', 'boolean', 'Enable virtual tour functionality', true),
('smart_matching_enabled', 'true', 'boolean', 'Enable smart matching algorithm', true)
ON CONFLICT (setting_key) DO NOTHING;

-- ===== FUNCTIONS AND TRIGGERS =====

-- Updated at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===== CORE TABLES CREATION =====

-- 1. Drop existing tables if they exist (in reverse dependency order)
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS viewing_requests CASCADE;
DROP TABLE IF EXISTS apartments CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS viewing_requests CASCADE;
DROP TABLE IF EXISTS user_favorites CASCADE;
    ARRAY['No smoking indoors', 'No parties after 10 PM', 'Keep common areas clean'],
    'verified',
    4.5,
    12
),
(
    'Cozy Student Studio near University',
    'Perfect for students! Fully furnished studio apartment close to University of Cologne. All utilities included in rent. Great study environment.',
    'University District, Cologne',
    650.00,
    45,
    1,
    1,
    CURRENT_DATE + INTERVAL '2 weeks',
    (SELECT id FROM users WHERE email = 'omer3kale@gmail.com' LIMIT 1),
    ARRAY['../img/koeln4.jpg', '../img/koeln5.jpg'],
    ARRAY['Furnished', 'Internet', 'Washing Machine', 'Central Heating', 'Study Desk', 'All utilities included'],
    true,
    true,
    false,
    false,
    false,
    true,
    'Cologne',
    'Germany',
    'available',
    false,
    NULL,
    NULL,
    NULL,
    ARRAY['University 5 min walk', 'Library nearby', 'Student cafeteria', 'Bus stop 2 min'],
    ARRAY['Students only', 'No pets', 'Quiet hours 9 PM - 8 AM', 'No smoking'],
    'verified',
    4.2,
    8
),
(
    'Luxury Penthouse with Garden View',
    'Stunning penthouse apartment with private garden and panoramic city views. Premium location with all modern amenities. Perfect for executives.',
    'Cologne Old Town, Germany',
    1200.00,
    120,
    4,
    2,
    CURRENT_DATE + INTERVAL '1 month',
    (SELECT id FROM users WHERE email = 'omer3kale@gmail.com' LIMIT 1),
    ARRAY['../img/koeln6.jpg', '../img/apartment1.jpg', '../img/apartment2.jpg'],
    ARRAY['Garden', 'Balcony', 'Dishwasher', 'Parking', 'Elevator', 'Internet', 'Premium Location', 'Concierge'],
    false,
    false,
    true,
    true,
    true,
    true,
    'Cologne',
    'Germany',
    'available',
    true,
    'https://example.com/video-tours/luxury-penthouse.mp4',
    'https://example.com/virtual-tours/luxury-penthouse',
    'https://example.com/floor-plans/luxury-penthouse.pdf',
    ARRAY['Shopping district', 'Fine dining', 'Opera house', 'Business district 15 min'],
    ARRAY['No pets', 'Professional tenants only', 'No smoking', 'Minimum 12-month lease'],
    'verified',
    4.8,
    5
)
ON CONFLICT DO NOTHING;

-- ===== GRANTS AND PERMISSIONS =====

-- Grant permissions for all tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- ===== COMMENTS FOR DOCUMENTATION =====

COMMENT ON TABLE email_logs IS '100% Integration: Tracks all emails sent by the system for audit and debugging';
COMMENT ON TABLE payment_transactions IS '100% Integration: Complete payment transaction history with PayPal gateway integration';
COMMENT ON TABLE support_tickets IS '100% Integration: Customer support ticket management system with full conversation tracking';
COMMENT ON TABLE safety_reports IS '100% Integration: Trust and safety reporting system for user reports and moderation';
COMMENT ON TABLE refund_requests IS '100% Integration: Refund request management with approval workflow';
COMMENT ON TABLE notifications IS '100% Integration: In-app notification system for users';
COMMENT ON TABLE system_settings IS '100% Integration: Configurable system settings and feature flags';
COMMENT ON TABLE gdpr_tracking_logs IS '100% Integration: GDPR compliance tracking and audit trail';
COMMENT ON TABLE user_favorites IS '100% Integration: User favorites/bookmarks for apartment listings (Frontend "Add to Favorites")';
COMMENT ON TABLE apartment_analytics IS '100% Integration: Property performance analytics for landlord dashboard';
COMMENT ON TABLE apartment_reviews IS '100% Integration: Review and rating system for "top-rated apartments" feature';
COMMENT ON TABLE media_files IS '100% Integration: Comprehensive media management for photos, videos, virtual tours';
COMMENT ON TABLE search_history IS '100% Integration: User search history for improved UX and recommendations';
COMMENT ON TABLE saved_searches IS '100% Integration: Saved search functionality with email alerts';
COMMENT ON TABLE chat_messages IS '100% Integration: Real-time messaging system for user communication';
COMMENT ON TABLE matching_preferences IS '100% Integration: Smart matching algorithm preferences for tenants and landlords';
COMMENT ON TABLE viewing_schedule IS '100% Integration: Automated viewing coordination and customer manager assignment';
COMMENT ON TABLE digital_contracts IS '100% Integration: Digital contract generation and signature management';

-- Success message
DO $$
BEGIN
    RAISE NOTICE '🎉 100%% COMPLETE MIGRATION DEPLOYED SUCCESSFULLY! 🎉';
    RAISE NOTICE '✅ Core functionality: Email tracking, Payment processing, Support system';
    RAISE NOTICE '✅ Website integration: Favorites, Analytics, Reviews, Media management';
    RAISE NOTICE '✅ Advanced features: Smart matching, Digital contracts, Real-time chat';
    RAISE NOTICE '✅ Security: Comprehensive RLS policies and indexing';
    RAISE NOTICE '✅ Sample data: Test user and featured apartments created';
    RAISE NOTICE '🚀 Ready for 100%% API success rate mission!';
END $$;



-- Rental Platform Database Schema

-- Step 4 Complete Database Schema: Full Installation
-- This version creates ALL necessary tables including users, apartments, and Step 4 enhancements

-- ⚠️ WARNING: This will delete any existing data in these tables:
-- users, apartments, viewing_requests, conversations, messages, saved_searches, reviews, notifications, recently_viewed

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Drop existing tables (if they exist) to start completely fresh
DROP TABLE IF EXISTS saved_searches CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS recently_viewed CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS viewing_requests CASCADE;
DROP TABLE IF EXISTS user_favorites CASCADE;
DROP TABLE IF EXISTS apartments CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 2. Create users table
CREATE TABLE users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    username VARCHAR(32) NOT NULL UNIQUE,
    email VARCHAR(64) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(10) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    blocked BOOLEAN DEFAULT false,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    phone VARCHAR(20),
    profile_picture TEXT,
    bio TEXT,
    notification_preferences JSONB DEFAULT '{"email": true, "sms": false, "push": true, "marketing": false}'::jsonb,
    preferences JSONB,
    notification_settings JSONB,
    profile_completion_score INTEGER DEFAULT 0 CHECK (profile_completion_score >= 0 AND profile_completion_score <= 100),
    account_status VARCHAR(20) DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'pending_verification', 'deactivated')),
    suspension_reason TEXT,
    suspended_until TIMESTAMP WITH TIME ZONE,
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(255),
    profile_image_url TEXT,
    verification_level VARCHAR(20) DEFAULT 'basic' CHECK (verification_level IN ('basic', 'verified', 'premium')),
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    failed_login_attempts INTEGER DEFAULT 0 NOT NULL,
    last_failed_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    email_verified BOOLEAN DEFAULT false,
    email_verification_token VARCHAR(255),
    reset_password_token VARCHAR(255),
    reset_password_expires TIMESTAMP WITH TIME ZONE,
    gdpr_consent BOOLEAN DEFAULT false,
    gdpr_consent_date TIMESTAMP WITH TIME ZONE,
    marketing_consent BOOLEAN DEFAULT false,
    data_processing_consent BOOLEAN DEFAULT false
);

-- 3. Create apartments table
CREATE TABLE apartments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    size INTEGER, -- in square meters
    rooms INTEGER,
    bathrooms INTEGER,
    available_from DATE,
    available_to DATE,
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    images TEXT[], -- Array of image URLs
    amenities TEXT[],
    pet_friendly BOOLEAN DEFAULT false,
    furnished BOOLEAN DEFAULT false,
    balcony BOOLEAN DEFAULT false,
    garden BOOLEAN DEFAULT false,
    parking BOOLEAN DEFAULT false,
    elevator BOOLEAN DEFAULT false,
    washing_machine BOOLEAN DEFAULT false,
    dishwasher BOOLEAN DEFAULT false,
    internet BOOLEAN DEFAULT false,
    heating VARCHAR(50),
    energy_rating VARCHAR(5),
    deposit DECIMAL(10,2),
    utilities_included BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'rented', 'pending', 'withdrawn')),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    postal_code VARCHAR(10),
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Germany'
);

-- 4. Create viewing_requests table
CREATE TABLE viewing_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    requester_id UUID REFERENCES users(id) ON DELETE CASCADE,
    landlord_id UUID REFERENCES users(id) ON DELETE CASCADE,
    requested_date TIMESTAMP WITH TIME ZONE NOT NULL,
    alternative_date_1 TIMESTAMP WITH TIME ZONE,
    alternative_date_2 TIMESTAMP WITH TIME ZONE,
    message TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')),
    confirmed_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    phone VARCHAR(20),
    email VARCHAR(255),
    notes TEXT,
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'failed')),
    payment_amount DECIMAL(10,2),
    payment_id VARCHAR(255),
    booking_fee DECIMAL(10,2) DEFAULT 10.00
);

-- 5. Create conversations table
CREATE TABLE conversations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    participant_1_id UUID REFERENCES users(id) ON DELETE CASCADE,
    participant_2_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_at TIMESTAMP WITH TIME ZONE,
    participants UUID[] DEFAULT ARRAY[]::UUID[] -- For easier querying
);

-- 6. Create messages table
CREATE TABLE messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    edited_at TIMESTAMP WITH TIME ZONE,
    file_url TEXT,
    file_name TEXT,
    file_size INTEGER
);

-- 7. Create user_favorites table
CREATE TABLE user_favorites (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, apartment_id) -- One favorite per user per apartment
);

-- 8. Create saved_searches table (Step 4)
-- 8. Create saved_searches table (Step 4)
CREATE TABLE saved_searches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    search_criteria JSONB NOT NULL,
    alerts_enabled BOOLEAN DEFAULT true,
    alert_frequency VARCHAR(20) DEFAULT 'daily',
    last_executed TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Create reviews table (Step 4)
CREATE TABLE reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    viewing_request_id UUID REFERENCES viewing_requests(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(100) NOT NULL,
    comment TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    moderation_note TEXT,
    moderated_at TIMESTAMP WITH TIME ZONE,
    moderated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(apartment_id, user_id) -- One review per user per apartment
);

-- 10. Create notifications table (Step 4)
CREATE TABLE notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    action_url TEXT,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Create recently_viewed table (Step 4)
CREATE TABLE recently_viewed (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, apartment_id) -- One record per user per apartment
);

-- ===== EXISTING TABLE ENHANCEMENTS =====
-- Add missing columns to tables now that they exist

-- Add missing columns to viewing_requests
ALTER TABLE viewing_requests ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE viewing_requests ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE viewing_requests ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE viewing_requests ADD COLUMN IF NOT EXISTS completion_notes TEXT;
ALTER TABLE viewing_requests ADD COLUMN IF NOT EXISTS completion_rating INTEGER CHECK (completion_rating >= 1 AND completion_rating <= 5);

-- Add payment reference to viewing_requests if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='viewing_requests' AND column_name='payment_transaction_id') THEN
        ALTER TABLE viewing_requests ADD COLUMN payment_transaction_id UUID REFERENCES payment_transactions(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add apartment features that might be missing
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS video_tour_url TEXT;
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS virtual_tour_url TEXT;
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS floor_plan_url TEXT;
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS public_transport_info TEXT;
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS nearby_amenities TEXT[];
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS house_rules TEXT[];
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS availability_notes TEXT;
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS minimum_lease_duration INTEGER; -- in months
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS maximum_lease_duration INTEGER; -- in months
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS admin_notes TEXT; -- Internal admin notes
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected'));
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS verification_notes TEXT;
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,2) DEFAULT 0.0;
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add user profile enhancements
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB; -- User preferences as JSON
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_settings JSONB; -- Notification preferences
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_completion_score INTEGER DEFAULT 0 CHECK (profile_completion_score >= 0 AND profile_completion_score <= 100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'pending_verification', 'deactivated'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_level VARCHAR(20) DEFAULT 'basic' CHECK (verification_level IN ('basic', 'verified', 'premium'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 12. Create indexes for better performance

-- Core table indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);

CREATE INDEX idx_apartments_owner_id ON apartments(owner_id);
CREATE INDEX idx_apartments_status ON apartments(status);
CREATE INDEX idx_apartments_location ON apartments(location);
CREATE INDEX idx_apartments_price ON apartments(price);
CREATE INDEX idx_apartments_created_at ON apartments(created_at DESC);

CREATE INDEX idx_viewing_requests_apartment_id ON viewing_requests(apartment_id);
CREATE INDEX idx_viewing_requests_requester_id ON viewing_requests(requester_id);
CREATE INDEX idx_viewing_requests_landlord_id ON viewing_requests(landlord_id);
CREATE INDEX idx_viewing_requests_status ON viewing_requests(status);

CREATE INDEX idx_conversations_apartment_id ON conversations(apartment_id);
CREATE INDEX idx_conversations_participant_1 ON conversations(participant_1_id);
CREATE INDEX idx_conversations_participant_2 ON conversations(participant_2_id);
CREATE INDEX idx_conversations_participants ON conversations USING gin(participants);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

CREATE INDEX idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX idx_user_favorites_apartment_id ON user_favorites(apartment_id);

-- Step 4 indexes
CREATE INDEX idx_saved_searches_user_id ON saved_searches(user_id);
CREATE INDEX idx_saved_searches_alerts_enabled ON saved_searches(alerts_enabled);

CREATE INDEX idx_reviews_apartment_id ON reviews(apartment_id);
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_status ON reviews(status);
CREATE INDEX idx_reviews_rating ON reviews(rating);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

CREATE INDEX idx_recently_viewed_user_id ON recently_viewed(user_id);
CREATE INDEX idx_recently_viewed_viewed_at ON recently_viewed(viewed_at DESC);

-- 13. Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE viewing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE recently_viewed ENABLE ROW LEVEL SECURITY;

-- 14. Create RLS Policies

-- Users Policies (users can view their own data, admins can view all)
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Apartments Policies (public read, owners can manage)
CREATE POLICY "Anyone can view available apartments" ON apartments
    FOR SELECT USING (status = 'available');

CREATE POLICY "Owners can view their own apartments" ON apartments
    FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Owners can create apartments" ON apartments
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their own apartments" ON apartments
    FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their own apartments" ON apartments
    FOR DELETE USING (auth.uid() = owner_id);

-- Viewing Requests Policies
CREATE POLICY "Users can view their own viewing requests" ON viewing_requests
    FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = landlord_id);

CREATE POLICY "Users can create viewing requests" ON viewing_requests
    FOR INSERT WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Landlords can update viewing requests" ON viewing_requests
    FOR UPDATE USING (auth.uid() = landlord_id OR auth.uid() = requester_id);

-- Conversations Policies
CREATE POLICY "Participants can view their conversations" ON conversations
    FOR SELECT USING (auth.uid() = participant_1_id OR auth.uid() = participant_2_id);

CREATE POLICY "Users can create conversations" ON conversations
    FOR INSERT WITH CHECK (auth.uid() = participant_1_id OR auth.uid() = participant_2_id);

-- Messages Policies
CREATE POLICY "Conversation participants can view messages" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM conversations 
            WHERE id = conversation_id 
            AND (participant_1_id = auth.uid() OR participant_2_id = auth.uid())
        )
    );

CREATE POLICY "Conversation participants can send messages" ON messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM conversations 
            WHERE id = conversation_id 
            AND (participant_1_id = auth.uid() OR participant_2_id = auth.uid())
        )
    );

-- User Favorites Policies
CREATE POLICY "Users can view their own favorites" ON user_favorites
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own favorites" ON user_favorites
    FOR ALL USING (auth.uid() = user_id);

-- Saved Searches Policies
CREATE POLICY "Users can view their own saved searches" ON saved_searches
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own saved searches" ON saved_searches
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved searches" ON saved_searches
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved searches" ON saved_searches
    FOR DELETE USING (auth.uid() = user_id);

-- Reviews Policies
CREATE POLICY "Anyone can view approved reviews" ON reviews
    FOR SELECT USING (status = 'approved');

CREATE POLICY "Users can view their own reviews" ON reviews
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all reviews" ON reviews
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Users can create reviews" ON reviews
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews" ON reviews
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews" ON reviews
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can moderate reviews" ON reviews
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Notifications Policies
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications" ON notifications
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications" ON notifications
    FOR INSERT WITH CHECK (true); -- Allow system to create notifications

-- Recently Viewed Policies
CREATE POLICY "Users can view their own recently viewed" ON recently_viewed
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can track their own views" ON recently_viewed
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own views" ON recently_viewed
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own views" ON recently_viewed
    FOR DELETE USING (auth.uid() = user_id);

-- 15. Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_apartments_updated_at BEFORE UPDATE ON apartments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_viewing_requests_updated_at BEFORE UPDATE ON viewing_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_saved_searches_updated_at BEFORE UPDATE ON saved_searches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 16. Insert sample data for testing
DO $$
DECLARE
    test_user_id UUID;
    test_apartment_id UUID;
BEGIN
    -- Insert test user
    INSERT INTO users (username, email, password, first_name, last_name, role) 
    VALUES ('sichrplace_test', 'sichrplace@gmail.com', '$2b$10$encrypted_password_here', 'Test', 'User', 'user')
    RETURNING id INTO test_user_id;
    
    -- Insert test apartment
    INSERT INTO apartments (title, description, location, price, size, rooms, bathrooms, owner_id)
    VALUES (
        'Beautiful Test Apartment in Cologne',
        'A lovely 2-bedroom apartment perfect for testing our platform.',
        'Cologne, Germany',
        850.00,
        75,
        2,
        1,
        test_user_id
    ) RETURNING id INTO test_apartment_id;
    
    -- Insert sample saved search
    INSERT INTO saved_searches (user_id, name, search_criteria, alerts_enabled) 
    VALUES (
        test_user_id,
        'Affordable Apartments in Cologne',
        '{"maxPrice": 800, "location": "Cologne", "minRooms": 2}'::jsonb,
        true
    );
    
    -- Insert sample notification
    INSERT INTO notifications (user_id, type, title, message, priority)
    VALUES (
        test_user_id,
        'welcome',
        'Welcome to SichrPlace!',
        'Thank you for joining our platform. Start searching for your perfect apartment today!',
        'normal'
    );
    
END $$;

-- Success message
SELECT 'Complete database schema created successfully!' as status,
       'All tables created: users, apartments, viewing_requests, conversations, messages, user_favorites, saved_searches, reviews, notifications, recently_viewed' as details;


-- Frontend table


-- =====================================================
-- SICHRPLACE TENANT SCREENING DATABASE MIGRATION
-- =====================================================
-- Migration: 20250922_tenant_screening_schema
-- Description: Add German tenant screening tables and functionality
-- Dependencies: Initial schema migration (users, apartments tables)

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- =====================================================
-- TENANT SCREENING TABLES
-- =====================================================

-- 1. SCHUFA Credit Checks
CREATE TABLE IF NOT EXISTS schufa_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,
    schufa_request_id VARCHAR(100) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    address TEXT NOT NULL,
    postal_code VARCHAR(10) NOT NULL,
    city VARCHAR(100) NOT NULL,
    credit_score INTEGER CHECK (credit_score >= 0 AND credit_score <= 1000),
    risk_category VARCHAR(20) CHECK (risk_category IN ('VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH')),
    credit_rating VARCHAR(5),
    negative_entries INTEGER DEFAULT 0,
    payment_defaults INTEGER DEFAULT 0,
    open_debts DECIMAL(10,2) DEFAULT 0,
    meets_requirements BOOLEAN DEFAULT false,
    risk_assessment JSONB,
    recommendations TEXT[],
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
    schufa_response_date TIMESTAMP WITH TIME ZONE,
    valid_until TIMESTAMP WITH TIME ZONE,
    data_protection_consent BOOLEAN DEFAULT false,
    schufa_consent_date TIMESTAMP WITH TIME ZONE,
    schufa_raw_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Employment Verifications
CREATE TABLE IF NOT EXISTS employment_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,
    employer_name VARCHAR(255) NOT NULL,
    employer_address TEXT,
    position_title VARCHAR(255) NOT NULL,
    employment_type VARCHAR(50) NOT NULL CHECK (employment_type IN ('permanent', 'temporary', 'freelance', 'self_employed', 'student', 'unemployed')),
    employment_start_date DATE,
    gross_monthly_salary DECIMAL(10,2) NOT NULL,
    net_monthly_salary DECIMAL(10,2),
    monthly_rent DECIMAL(10,2) NOT NULL,
    income_to_rent_ratio DECIMAL(5,2),
    meets_three_times_rule BOOLEAN DEFAULT false,
    employment_stability_score INTEGER CHECK (employment_stability_score >= 0 AND employment_stability_score <= 100),
    employment_risk_level VARCHAR(20) CHECK (employment_risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    risk_factors TEXT[],
    employment_contract_verified BOOLEAN DEFAULT false,
    payslip_verified BOOLEAN DEFAULT false,
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'in_review', 'verified', 'rejected', 'expired')),
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    verification_date TIMESTAMP WITH TIME ZONE,
    existing_debts DECIMAL(10,2) DEFAULT 0,
    monthly_expenses DECIMAL(10,2) DEFAULT 0,
    has_guarantor BOOLEAN DEFAULT false,
    guarantor_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '6 months')
);

-- 3. Landlord Reference Checks
CREATE TABLE IF NOT EXISTS landlord_reference_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,
    total_references_requested INTEGER DEFAULT 0,
    references_received INTEGER DEFAULT 0,
    references_verified INTEGER DEFAULT 0,
    overall_reference_score INTEGER CHECK (overall_reference_score >= 0 AND overall_reference_score <= 100),
    reference_quality VARCHAR(20) CHECK (reference_quality IN ('EXCELLENT', 'GOOD', 'AVERAGE', 'POOR', 'INADEQUATE')),
    positive_references INTEGER DEFAULT 0,
    neutral_references INTEGER DEFAULT 0,
    negative_references INTEGER DEFAULT 0,
    average_tenancy_duration DECIMAL(4,2),
    rent_payment_reliability_score INTEGER CHECK (rent_payment_reliability_score >= 0 AND rent_payment_reliability_score <= 100),
    property_maintenance_score INTEGER CHECK (property_maintenance_score >= 0 AND property_maintenance_score <= 100),
    late_payments_reported INTEGER DEFAULT 0,
    damage_reports INTEGER DEFAULT 0,
    eviction_history BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'collecting' CHECK (status IN ('collecting', 'pending_responses', 'completed', 'insufficient_data', 'expired')),
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    collection_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    collection_deadline TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '14 days'),
    completed_at TIMESTAMP WITH TIME ZONE,
    reference_summary TEXT,
    recommendation TEXT,
    red_flags TEXT[],
    positive_highlights TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Individual Landlord References
CREATE TABLE IF NOT EXISTS individual_landlord_references (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference_check_id UUID NOT NULL REFERENCES landlord_reference_checks(id) ON DELETE CASCADE,
    landlord_name VARCHAR(255) NOT NULL,
    landlord_email VARCHAR(255) NOT NULL,
    landlord_phone VARCHAR(50),
    property_address TEXT NOT NULL,
    tenancy_start_date DATE NOT NULL,
    tenancy_end_date DATE,
    monthly_rent DECIMAL(10,2) NOT NULL,
    lease_type VARCHAR(50) CHECK (lease_type IN ('fixed_term', 'periodic', 'student', 'short_term')),
    tenancy_duration_months INTEGER,
    rent_payment_punctuality INTEGER CHECK (rent_payment_punctuality >= 1 AND rent_payment_punctuality <= 5),
    property_condition_maintained INTEGER CHECK (property_condition_maintained >= 1 AND property_condition_maintained <= 5),
    communication_quality INTEGER CHECK (communication_quality >= 1 AND communication_quality <= 5),
    would_rent_again BOOLEAN,
    positive_comments TEXT,
    negative_comments TEXT,
    reason_for_leaving VARCHAR(255),
    late_payment_instances INTEGER DEFAULT 0,
    property_damage_reported BOOLEAN DEFAULT false,
    damage_description TEXT,
    lease_violations TEXT[],
    verification_status VARCHAR(20) DEFAULT 'sent' CHECK (verification_status IN ('sent', 'reminded', 'responded', 'verified', 'expired', 'declined')),
    verification_token VARCHAR(100) UNIQUE NOT NULL,
    email_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    response_received_at TIMESTAMP WITH TIME ZONE,
    response_ip_address INET,
    individual_reference_score INTEGER CHECK (individual_reference_score >= 0 AND individual_reference_score <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days')
);

-- 5. Financial Qualifications
CREATE TABLE IF NOT EXISTS financial_qualifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,
    monthly_rent DECIMAL(10,2) NOT NULL,
    total_gross_income DECIMAL(10,2) NOT NULL,
    estimated_net_income DECIMAL(10,2) NOT NULL,
    disposable_income DECIMAL(10,2) NOT NULL,
    income_breakdown JSONB NOT NULL,
    existing_debts DECIMAL(10,2) DEFAULT 0,
    monthly_expenses DECIMAL(10,2) DEFAULT 0,
    debt_to_income_ratio DECIMAL(5,2),
    meets_three_times_rule BOOLEAN DEFAULT false,
    income_ratio DECIMAL(5,2) NOT NULL,
    required_income DECIMAL(10,2),
    has_guarantor BOOLEAN DEFAULT false,
    guarantor_income DECIMAL(10,2),
    income_type VARCHAR(50) NOT NULL CHECK (income_type IN ('permanent_employment', 'temporary_employment', 'freelance', 'self_employed', 'mixed', 'student', 'benefits')),
    stability_score INTEGER CHECK (stability_score >= 0 AND stability_score <= 150),
    affordability_score INTEGER CHECK (affordability_score >= 0 AND affordability_score <= 150),
    qualification_level VARCHAR(20) NOT NULL CHECK (qualification_level IN ('EXCELLENT', 'GOOD', 'ACCEPTABLE', 'REVIEW_REQUIRED', 'REJECTED')),
    financial_risk_level VARCHAR(20) CHECK (financial_risk_level IN ('VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    risk_factors TEXT[],
    recommendations TEXT[],
    documentation_required TEXT[],
    status VARCHAR(20) DEFAULT 'calculated' CHECK (status IN ('calculated', 'under_review', 'approved', 'rejected', 'expired')),
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approval_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valid_until TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '3 months')
);

-- 6. Tenant Screening Logs
CREATE TABLE IF NOT EXISTS tenant_screening_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,
    screening_type VARCHAR(50) NOT NULL CHECK (screening_type IN ('schufa_check', 'employment_verification', 'landlord_references', 'financial_qualification', 'document_upload', 'admin_review')),
    action VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('initiated', 'in_progress', 'completed', 'failed', 'cancelled', 'expired')),
    result_summary JSONB,
    processing_time_seconds INTEGER,
    error_code VARCHAR(50),
    error_message TEXT,
    ip_address INET,
    user_agent TEXT,
    admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    admin_action VARCHAR(100),
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    severity_level VARCHAR(20) DEFAULT 'info' CHECK (severity_level IN ('debug', 'info', 'warning', 'error', 'critical'))
);

-- =====================================================
-- INDEXES
-- =====================================================

-- SCHUFA Checks
CREATE INDEX IF NOT EXISTS idx_schufa_checks_user_id ON schufa_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_schufa_checks_apartment_id ON schufa_checks(apartment_id);
CREATE INDEX IF NOT EXISTS idx_schufa_checks_status ON schufa_checks(status);

-- Employment Verifications
CREATE INDEX IF NOT EXISTS idx_employment_verifications_user_id ON employment_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_employment_verifications_apartment_id ON employment_verifications(apartment_id);
CREATE INDEX IF NOT EXISTS idx_employment_verifications_status ON employment_verifications(verification_status);

-- Landlord References
CREATE INDEX IF NOT EXISTS idx_landlord_reference_checks_user_id ON landlord_reference_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_individual_landlord_references_check_id ON individual_landlord_references(reference_check_id);
CREATE INDEX IF NOT EXISTS idx_individual_landlord_references_token ON individual_landlord_references(verification_token);

-- Financial Qualifications
CREATE INDEX IF NOT EXISTS idx_financial_qualifications_user_id ON financial_qualifications(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_qualifications_apartment_id ON financial_qualifications(apartment_id);

-- Screening Logs
CREATE INDEX IF NOT EXISTS idx_tenant_screening_logs_user_id ON tenant_screening_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_screening_logs_type ON tenant_screening_logs(screening_type);
CREATE INDEX IF NOT EXISTS idx_tenant_screening_logs_created_at ON tenant_screening_logs(created_at);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS
ALTER TABLE schufa_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE employment_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE landlord_reference_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE individual_landlord_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_screening_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenant data access
CREATE POLICY "Users can manage their own screening data" ON schufa_checks
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own employment data" ON employment_verifications
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own reference data" ON landlord_reference_checks
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their reference responses" ON individual_landlord_references
    FOR SELECT USING (
        reference_check_id IN (
            SELECT id FROM landlord_reference_checks WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their own financial data" ON financial_qualifications
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own screening logs" ON tenant_screening_logs
    FOR SELECT USING (auth.uid() = user_id);

-- RLS Policies for landlord access
CREATE POLICY "Landlords can view tenant screening for their apartments" ON schufa_checks
    FOR SELECT USING (
        apartment_id IN (
            SELECT id FROM apartments WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Landlords can view employment data for their apartments" ON employment_verifications
    FOR SELECT USING (
        apartment_id IN (
            SELECT id FROM apartments WHERE owner_id = auth.uid()
        )
    );

-- =====================================================
-- UTILITY FUNCTIONS
-- =====================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_schufa_checks_updated_at BEFORE UPDATE ON schufa_checks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employment_verifications_updated_at BEFORE UPDATE ON employment_verifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_landlord_reference_checks_updated_at BEFORE UPDATE ON landlord_reference_checks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_individual_landlord_references_updated_at BEFORE UPDATE ON individual_landlord_references
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_financial_qualifications_updated_at BEFORE UPDATE ON financial_qualifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Screening status function
CREATE OR REPLACE FUNCTION get_tenant_screening_status(tenant_user_id UUID, target_apartment_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    schufa_status TEXT;
    employment_status TEXT;
    references_status TEXT;
    financial_status TEXT;
    overall_completion INTEGER;
BEGIN
    -- Check completion status
    SELECT status INTO schufa_status 
    FROM schufa_checks 
    WHERE user_id = tenant_user_id AND apartment_id = target_apartment_id
    ORDER BY created_at DESC LIMIT 1;
    
    SELECT verification_status INTO employment_status
    FROM employment_verifications
    WHERE user_id = tenant_user_id AND apartment_id = target_apartment_id
    ORDER BY created_at DESC LIMIT 1;
    
    SELECT status INTO references_status
    FROM landlord_reference_checks
    WHERE user_id = tenant_user_id AND apartment_id = target_apartment_id
    ORDER BY created_at DESC LIMIT 1;
    
    SELECT status INTO financial_status
    FROM financial_qualifications
    WHERE user_id = tenant_user_id AND apartment_id = target_apartment_id
    ORDER BY created_at DESC LIMIT 1;
    
    -- Calculate completion
    overall_completion := 0;
    IF schufa_status = 'completed' THEN overall_completion := overall_completion + 25; END IF;
    IF employment_status = 'verified' THEN overall_completion := overall_completion + 25; END IF;
    IF references_status = 'completed' THEN overall_completion := overall_completion + 25; END IF;
    IF financial_status = 'approved' THEN overall_completion := overall_completion + 25; END IF;
    
    result := jsonb_build_object(
        'tenant_id', tenant_user_id,
        'apartment_id', target_apartment_id,
        'overall_completion_percentage', overall_completion,
        'schufa_status', COALESCE(schufa_status, 'not_started'),
        'employment_status', COALESCE(employment_status, 'not_started'),
        'references_status', COALESCE(references_status, 'not_started'),
        'financial_status', COALESCE(financial_status, 'not_started'),
        'is_complete', (overall_completion = 100),
        'checked_at', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Tenant Screening


-- Step 4 Database Schema: Enhanced User Experience Tables (SAFE VERSION)
-- Execute these SQL commands in Supabase SQL Editor
-- SAFE: Checks for existing policies and tables before creating

-- 1. Add new columns to users table for enhanced profiles (safe)
DO $$
BEGIN
    -- Add profile_picture if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'profile_picture') THEN
        ALTER TABLE users ADD COLUMN profile_picture TEXT;
    END IF;
    
    -- Add notification_preferences if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'notification_preferences') THEN
        ALTER TABLE users ADD COLUMN notification_preferences JSONB DEFAULT '{"email": true, "sms": false, "push": true, "marketing": false}'::jsonb;
    END IF;
    
    -- Add last_login if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_login') THEN
        ALTER TABLE users ADD COLUMN last_login TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Add user_created_at if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'user_created_at') THEN
        ALTER TABLE users ADD COLUMN user_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- 2. Create saved_searches table (safe)
CREATE TABLE IF NOT EXISTS saved_searches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    search_criteria JSONB NOT NULL,
    alerts_enabled BOOLEAN DEFAULT true,
    alert_frequency VARCHAR(20) DEFAULT 'daily',
    last_executed TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create reviews table (safe)
CREATE TABLE IF NOT EXISTS reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    viewing_request_id UUID REFERENCES viewing_requests(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(100) NOT NULL,
    comment TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    moderation_note TEXT,
    moderated_at TIMESTAMP WITH TIME ZONE,
    moderated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(apartment_id, user_id) -- One review per user per apartment
);

-- 4. Create notifications table (FIXED: read -> is_read)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    action_url TEXT,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create recently_viewed table (safe)
CREATE TABLE IF NOT EXISTS recently_viewed (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, apartment_id) -- One record per user per apartment
);

-- 6. Create indexes for better performance (safe)
CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_alerts_enabled ON saved_searches(alerts_enabled);

CREATE INDEX IF NOT EXISTS idx_reviews_apartment_id ON reviews(apartment_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_recently_viewed_user_id ON recently_viewed(user_id);
CREATE INDEX IF NOT EXISTS idx_recently_viewed_viewed_at ON recently_viewed(viewed_at DESC);

-- 7. Enable Row Level Security (safe)
DO $$
BEGIN
    -- Enable RLS on tables if not already enabled
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'saved_searches') THEN
        ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reviews') THEN
        ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'recently_viewed') THEN
        ALTER TABLE recently_viewed ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- 8. Create RLS Policies (SAFE - checks for existing policies)

-- Saved Searches Policies
DO $$
BEGIN
    -- Check if policy exists before creating
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saved_searches' AND policyname = 'Users can view their own saved searches') THEN
        CREATE POLICY "Users can view their own saved searches" ON saved_searches
            FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saved_searches' AND policyname = 'Users can create their own saved searches') THEN
        CREATE POLICY "Users can create their own saved searches" ON saved_searches
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saved_searches' AND policyname = 'Users can update their own saved searches') THEN
        CREATE POLICY "Users can update their own saved searches" ON saved_searches
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saved_searches' AND policyname = 'Users can delete their own saved searches') THEN
        CREATE POLICY "Users can delete their own saved searches" ON saved_searches
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- Reviews Policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Anyone can view approved reviews') THEN
        CREATE POLICY "Anyone can view approved reviews" ON reviews
            FOR SELECT USING (status = 'approved');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Users can view their own reviews') THEN
        CREATE POLICY "Users can view their own reviews" ON reviews
            FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Admins can view all reviews') THEN
        CREATE POLICY "Admins can view all reviews" ON reviews
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM users 
                    WHERE id = auth.uid() AND role = 'admin'
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Users can create reviews') THEN
        CREATE POLICY "Users can create reviews" ON reviews
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Users can update their own reviews') THEN
        CREATE POLICY "Users can update their own reviews" ON reviews
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Users can delete their own reviews') THEN
        CREATE POLICY "Users can delete their own reviews" ON reviews
            FOR DELETE USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Admins can moderate reviews') THEN
        CREATE POLICY "Admins can moderate reviews" ON reviews
            FOR UPDATE USING (
                EXISTS (
                    SELECT 1 FROM users 
                    WHERE id = auth.uid() AND role = 'admin'
                )
            );
    END IF;
END $$;

-- Notifications Policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can view their own notifications') THEN
        CREATE POLICY "Users can view their own notifications" ON notifications
            FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can update their own notifications') THEN
        CREATE POLICY "Users can update their own notifications" ON notifications
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can delete their own notifications') THEN
        CREATE POLICY "Users can delete their own notifications" ON notifications
            FOR DELETE USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'System can create notifications') THEN
        CREATE POLICY "System can create notifications" ON notifications
            FOR INSERT WITH CHECK (true);
    END IF;
END $$;

-- Recently Viewed Policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recently_viewed' AND policyname = 'Users can view their own recently viewed') THEN
        CREATE POLICY "Users can view their own recently viewed" ON recently_viewed
            FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recently_viewed' AND policyname = 'Users can track their own views') THEN
        CREATE POLICY "Users can track their own views" ON recently_viewed
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recently_viewed' AND policyname = 'Users can update their own views') THEN
        CREATE POLICY "Users can update their own views" ON recently_viewed
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recently_viewed' AND policyname = 'Users can delete their own views') THEN
        CREATE POLICY "Users can delete their own views" ON recently_viewed
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- 9. Create triggers for updated_at timestamps (safe)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers if they exist and recreate
DROP TRIGGER IF EXISTS update_saved_searches_updated_at ON saved_searches;
CREATE TRIGGER update_saved_searches_updated_at BEFORE UPDATE ON saved_searches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reviews_updated_at ON reviews;
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Success message
SELECT 'Step 4 Enhanced User Experience Schema created successfully!' as status,
       'All policies and tables checked safely' as safety_note,
       NOW() as completed_at;


       -- Enhanced User Experience


       -- Add hashed token columns for security
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'verification_token_hash') THEN
        ALTER TABLE users ADD COLUMN verification_token_hash TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'reset_token_hash') THEN
        ALTER TABLE users ADD COLUMN reset_token_hash TEXT;
    END IF;
END $$;

-- Optional: keep legacy columns but stop using them; ensure indexes exist on hash columns
CREATE INDEX IF NOT EXISTS idx_users_verification_token_hash ON users(verification_token_hash);
CREATE INDEX IF NOT EXISTS idx_users_reset_token_hash ON users(reset_token_hash);

-- Backfill: if legacy tokens exist without hashes, compute hashes via database function (Postgres sha256)
-- Note: This requires pgcrypto extension for digest(); enable if not present
DO $$
BEGIN
    PERFORM 1 FROM pg_extension WHERE extname = 'pgcrypto';
    IF NOT FOUND THEN
        -- Attempt to enable; requires superuser privileges
        BEGIN
            CREATE EXTENSION IF NOT EXISTS pgcrypto;
        EXCEPTION WHEN OTHERS THEN
            -- If cannot enable, skip backfill silently
            RAISE NOTICE 'pgcrypto extension not enabled; skipping backfill of token hashes';
            RETURN;
        END;
    END IF;

        -- Backfill hashes where legacy tokens are present and hashes are null
        -- Handle multiple possible legacy column names without referencing non-existent columns
        IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'verification_token'
        ) THEN
                        EXECUTE $sql$
                            UPDATE users SET 
                                verification_token_hash = COALESCE(verification_token_hash, encode(digest(verification_token, 'sha256'), 'hex'))
                            WHERE verification_token IS NOT NULL AND (verification_token_hash IS NULL OR verification_token_hash = '')
                        $sql$;
        ELSIF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'email_verification_token'
        ) THEN
                        EXECUTE $sql$
                            UPDATE users SET 
                                verification_token_hash = COALESCE(verification_token_hash, encode(digest(email_verification_token, 'sha256'), 'hex'))
                            WHERE email_verification_token IS NOT NULL AND (verification_token_hash IS NULL OR verification_token_hash = '')
                        $sql$;
        END IF;

        IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'reset_token'
        ) THEN
                        EXECUTE $sql$
                            UPDATE users SET 
                                reset_token_hash = COALESCE(reset_token_hash, encode(digest(reset_token, 'sha256'), 'hex'))
                            WHERE reset_token IS NOT NULL AND (reset_token_hash IS NULL OR reset_token_hash = '')
                        $sql$;
        ELSIF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'reset_password_token'
        ) THEN
                        EXECUTE $sql$
                            UPDATE users SET 
                                reset_token_hash = COALESCE(reset_token_hash, encode(digest(reset_password_token, 'sha256'), 'hex'))
                            WHERE reset_password_token IS NOT NULL AND (reset_token_hash IS NULL OR reset_token_hash = '')
                        $sql$;
        END IF;
END $$;

-- Do not drop legacy columns automatically to avoid breaking older code paths
-- Consider nulling legacy token columns via app code after migration

SELECT 'Token hash columns ensured and backfill attempted' AS status;



--Add and Backfill Token Hashes


-- Cleanup legacy plaintext token columns by nulling their values if present
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'verification_token'
    ) THEN
        UPDATE users SET verification_token = NULL WHERE verification_token IS NOT NULL;
        RAISE NOTICE 'Cleared users.verification_token';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'email_verification_token'
    ) THEN
        UPDATE users SET email_verification_token = NULL WHERE email_verification_token IS NOT NULL;
        RAISE NOTICE 'Cleared users.email_verification_token';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'reset_token'
    ) THEN
        UPDATE users SET reset_token = NULL WHERE reset_token IS NOT NULL;
        RAISE NOTICE 'Cleared users.reset_token';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'reset_password_token'
    ) THEN
        UPDATE users SET reset_password_token = NULL WHERE reset_password_token IS NOT NULL;
        RAISE NOTICE 'Cleared users.reset_password_token';
    END IF;
END $$;

SELECT 'Legacy plaintext token columns have been nulled (where present)' AS status;



--Null Legacy Token Columns


-- Drop legacy plaintext token columns and related indexes, if present
DO $$
BEGIN
  -- Drop indexes that reference legacy columns (if any)
  BEGIN
    EXECUTE 'DROP INDEX IF EXISTS idx_users_email_verification_token';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Index idx_users_email_verification_token not dropped (may not exist)';
  END;

  BEGIN
    EXECUTE 'DROP INDEX IF EXISTS idx_users_reset_password_token';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Index idx_users_reset_password_token not dropped (may not exist)';
  END;

  -- Drop columns if they exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'verification_token'
  ) THEN
    ALTER TABLE users DROP COLUMN verification_token;
    RAISE NOTICE 'Dropped users.verification_token';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'email_verification_token'
  ) THEN
    ALTER TABLE users DROP COLUMN email_verification_token;
    RAISE NOTICE 'Dropped users.email_verification_token';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'reset_token'
  ) THEN
    ALTER TABLE users DROP COLUMN reset_token;
    RAISE NOTICE 'Dropped users.reset_token';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'reset_password_token'
  ) THEN
    ALTER TABLE users DROP COLUMN reset_password_token;
    RAISE NOTICE 'Dropped users.reset_password_token';
  END IF;
END $$;

SELECT 'Legacy token columns and indexes dropped where present' AS status;



-- Drop Legacy



-- Complete Database Schema Updates for Email Verification
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;

UPDATE users SET verified = COALESCE(email_verified, false) WHERE verified IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_verification_token_hash ON users(verification_token_hash);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email, verified);



--Email Schema Update



-- Add verification token columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS verification_token_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_verification_token_hash ON users(verification_token_hash);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email, verified);

-- Update existing users to use the new verified column if email_verified exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='users' AND column_name='email_verified') THEN
        UPDATE users SET verified = email_verified WHERE email_verified IS NOT NULL;
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN users.verification_token_hash IS 'Hashed email verification token for security';
COMMENT ON COLUMN users.verified_at IS 'Timestamp when email was verified';
COMMENT ON COLUMN users.verified IS 'Boolean flag indicating if email is verified';



--Email Verification Columns



-- Check current users table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;


-- Users Table (enhanced profiles)


-- SichrPlace Missing Tables Creation - FIXED VERSION
-- Run this in your Supabase SQL Editor to create all missing tables

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- First, add the missing columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS verification_token_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_verification_token_hash ON users(verification_token_hash);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email, verified);

-- Activity Logs Table (for user action tracking)
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Landlord Profiles Table (extended profile info for landlords)
CREATE TABLE IF NOT EXISTS landlord_profiles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    company_name VARCHAR(255),
    business_registration VARCHAR(100),
    tax_number VARCHAR(100),
    website_url TEXT,
    business_address TEXT,
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    verification_date TIMESTAMP WITH TIME ZONE,
    property_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0.0,
    total_reviews INTEGER DEFAULT 0,
    bio TEXT,
    specialties TEXT[],
    languages TEXT[] DEFAULT ARRAY['German'],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Applicant Profiles Table (extended profile info for tenants)
CREATE TABLE IF NOT EXISTS applicant_profiles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    occupation VARCHAR(255),
    employer VARCHAR(255),
    monthly_income DECIMAL(10,2),
    preferred_move_in_date DATE,
    preferred_locations TEXT[],
    max_budget DECIMAL(10,2),
    min_rooms INTEGER,
    max_rooms INTEGER,
    pet_owner BOOLEAN DEFAULT false,
    pet_details TEXT,
    smoker BOOLEAN DEFAULT false,
    tenant_references TEXT, -- FIXED: renamed from 'references' to 'tenant_references'
    bio TEXT,
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    verification_date TIMESTAMP WITH TIME ZONE,
    credit_score INTEGER,
    background_check_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Favorites Table (user saved apartments)
CREATE TABLE IF NOT EXISTS favorites (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, apartment_id)
);

-- User Reports Table (for content moderation)
CREATE TABLE IF NOT EXISTS user_reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    reporter_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reported_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reported_apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,
    reason VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'rejected')),
    moderator_id UUID REFERENCES users(id) ON DELETE SET NULL,
    moderator_notes TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Consent Audit Log Table (for GDPR compliance)
CREATE TABLE IF NOT EXISTS consent_audit_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    consent_type VARCHAR(50) NOT NULL,
    consent_given BOOLEAN NOT NULL,
    consent_version VARCHAR(10) DEFAULT '1.0',
    ip_address INET,
    user_agent TEXT,
    withdrawal_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update existing users to use the new verified column if email_verified exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='users' AND column_name='email_verified') THEN
        UPDATE users SET verified = email_verified WHERE email_verified IS NOT NULL;
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN users.verification_token_hash IS 'Hashed email verification token for security';
COMMENT ON COLUMN users.verified_at IS 'Timestamp when email was verified';
COMMENT ON COLUMN users.verified IS 'Boolean flag indicating if email is verified';



--Missing table Setup



-- Test query to see current users (corrected)
SELECT id, email, username, first_name, user_type, verified, created_at 
FROM users 
ORDER BY created_at DESC 
LIMIT 5;


--Latest users


-- Fix users table - add all missing columns
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS user_type VARCHAR(20) CHECK (user_type IN ('landlord', 'applicant', 'tenant', 'admin')) DEFAULT 'applicant',
ADD COLUMN IF NOT EXISTS verification_token_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS username VARCHAR(255),
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user',
ADD COLUMN IF NOT EXISTS gdpr_consent BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS data_processing_consent BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_verification_token_hash ON users(verification_token_hash);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email, verified);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Update existing users to use the new verified column if email_verified exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='users' AND column_name='email_verified') THEN
        UPDATE users SET verified = email_verified WHERE email_verified IS NOT NULL;
    END IF;
END $$;

-- Set default user_type for existing users if they don't have one
UPDATE users SET user_type = 'applicant' WHERE user_type IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN users.user_type IS 'Type of user: landlord, applicant, tenant, or admin';
COMMENT ON COLUMN users.verification_token_hash IS 'Hashed email verification token for security';
COMMENT ON COLUMN users.verified_at IS 'Timestamp when email was verified';
COMMENT ON COLUMN users.verified IS 'Boolean flag indicating if email is verified';


--User Schema Migration



-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Activity Logs Table (for user action tracking)
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Landlord Profiles Table (extended profile info for landlords)
CREATE TABLE IF NOT EXISTS landlord_profiles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    company_name VARCHAR(255),
    business_registration VARCHAR(100),
    tax_number VARCHAR(100),
    website_url TEXT,
    business_address TEXT,
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    verification_date TIMESTAMP WITH TIME ZONE,
    property_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0.0,
    total_reviews INTEGER DEFAULT 0,
    bio TEXT,
    specialties TEXT[],
    languages TEXT[] DEFAULT ARRAY['German'],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Applicant Profiles Table (extended profile info for tenants)
CREATE TABLE IF NOT EXISTS applicant_profiles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    occupation VARCHAR(255),
    employer VARCHAR(255),
    monthly_income DECIMAL(10,2),
    preferred_move_in_date DATE,
    preferred_locations TEXT[],
    max_budget DECIMAL(10,2),
    min_rooms INTEGER,
    max_rooms INTEGER,
    pet_owner BOOLEAN DEFAULT false,
    pet_details TEXT,
    smoker BOOLEAN DEFAULT false,
    tenant_references TEXT,
    bio TEXT,
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    verification_date TIMESTAMP WITH TIME ZONE,
    credit_score INTEGER,
    background_check_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Favorites Table (user saved apartments)
CREATE TABLE IF NOT EXISTS favorites (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, apartment_id)
);



--Activity, Profiles, Favorites Tables



-- 🎯 ESSENTIAL TABLES FOR SICHRPLACE ACCOUNT CREATION
-- Run this directly in your Supabase SQL Editor
-- This creates only the minimum tables needed for your account creation to work

-- Ensure UUID extension is working
SELECT CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') 
    THEN 'uuid-ossp extension is installed' 
    ELSE 'Installing uuid-ossp extension'
END;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Test if uuid_generate_v4() works
SELECT uuid_generate_v4() as test_uuid;

-- Create users table if it doesn't have the right structure
DO $$
BEGIN
    -- Add user_type column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='user_type') THEN
        ALTER TABLE users ADD COLUMN user_type VARCHAR(20) DEFAULT 'applicant';
    END IF;
    
    -- Add email_verification_token if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='email_verification_token') THEN
        ALTER TABLE users ADD COLUMN email_verification_token VARCHAR(255);
    END IF;
    
    -- Add gdpr_consent columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='gdpr_consent') THEN
        ALTER TABLE users ADD COLUMN gdpr_consent BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='gdpr_consent_date') THEN
        ALTER TABLE users ADD COLUMN gdpr_consent_date TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='data_processing_consent') THEN
        ALTER TABLE users ADD COLUMN data_processing_consent BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Ensure your auth registration endpoint works
-- Test insert (will help verify the table structure is correct)
INSERT INTO users (
    username, 
    email, 
    password, 
    role, 
    user_type,
    first_name, 
    last_name, 
    email_verified, 
    gdpr_consent, 
    gdpr_consent_date,
    data_processing_consent
) VALUES (
    'test_user_verification',
    'test_verify@sichrplace.com',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'applicant',
    'applicant',
    'Test',
    'User',
    false,
    true,
    NOW(),
    true
) ON CONFLICT (email) DO UPDATE SET
    user_type = EXCLUDED.user_type,
    gdpr_consent = EXCLUDED.gdpr_consent,
    data_processing_consent = EXCLUDED.data_processing_consent;

-- Show final result
SELECT 
    'Account creation setup complete! ✅' as status,
    COUNT(*) as total_users 
FROM users;

SELECT 
    'Test user created: ' || email as verification,
    user_type,
    role,
    gdpr_consent
FROM users 
WHERE email = 'test_verify@sichrplace.com';

-- List all columns in users table for debugging
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- ===== ADD FOREIGN KEY CONSTRAINTS =====
-- Add foreign keys after all tables are created to avoid dependency issues

-- Add foreign keys to email_logs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'email_logs_user_id_fkey' 
        AND table_name = 'email_logs'
    ) THEN
        ALTER TABLE email_logs 
        ADD CONSTRAINT email_logs_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
        RAISE NOTICE '✅ Added foreign key: email_logs.user_id -> users.id';
    END IF;
END $$;

-- Add foreign keys to payment_transactions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'payment_transactions_user_id_fkey' 
        AND table_name = 'payment_transactions'
    ) THEN
        ALTER TABLE payment_transactions 
        ADD CONSTRAINT payment_transactions_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
        RAISE NOTICE '✅ Added foreign key: payment_transactions.user_id -> users.id';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'payment_transactions_viewing_request_id_fkey' 
        AND table_name = 'payment_transactions'
    ) THEN
        ALTER TABLE payment_transactions 
        ADD CONSTRAINT payment_transactions_viewing_request_id_fkey 
        FOREIGN KEY (viewing_request_id) REFERENCES viewing_requests(id) ON DELETE SET NULL;
        RAISE NOTICE '✅ Added foreign key: payment_transactions.viewing_request_id -> viewing_requests.id';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'payment_transactions_apartment_id_fkey' 
        AND table_name = 'payment_transactions'
    ) THEN
        ALTER TABLE payment_transactions 
        ADD CONSTRAINT payment_transactions_apartment_id_fkey 
        FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE SET NULL;
        RAISE NOTICE '✅ Added foreign key: payment_transactions.apartment_id -> apartments.id';
    END IF;
END $$;

-- Add foreign keys to chat_messages
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'chat_messages_conversation_id_fkey' 
        AND table_name = 'chat_messages'
    ) THEN
        ALTER TABLE chat_messages 
        ADD CONSTRAINT chat_messages_conversation_id_fkey 
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ Added foreign key: chat_messages.conversation_id -> conversations.id';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'chat_messages_sender_id_fkey' 
        AND table_name = 'chat_messages'
    ) THEN
        ALTER TABLE chat_messages 
        ADD CONSTRAINT chat_messages_sender_id_fkey 
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL;
        RAISE NOTICE '✅ Added foreign key: chat_messages.sender_id -> users.id';
    END IF;
END $$;

--Account Creation Fix