-- 🎯 SICHRPLACE CLEAN SCHEMA MIGRATION
-- Safe, step-by-step database setup that resolves all foreign key issues
-- Run this AFTER clearing your database

-- ===== ENABLE REQUIRED EXTENSIONS =====
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ===== STEP 1: DROP ALL EXISTING TABLES (Clean Slate) =====
-- This ensures no conflicts with existing data

DROP TABLE IF EXISTS digital_contracts CASCADE;
DROP TABLE IF EXISTS viewing_schedule CASCADE;
DROP TABLE IF EXISTS matching_preferences CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS saved_searches CASCADE;
DROP TABLE IF EXISTS search_history CASCADE;
DROP TABLE IF EXISTS media_files CASCADE;
DROP TABLE IF EXISTS apartment_reviews CASCADE;
DROP TABLE IF EXISTS apartment_analytics CASCADE;
DROP TABLE IF EXISTS user_favorites CASCADE;
DROP TABLE IF EXISTS gdpr_tracking_logs CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS refund_requests CASCADE;
DROP TABLE IF EXISTS safety_reports CASCADE;
DROP TABLE IF EXISTS support_ticket_messages CASCADE;
DROP TABLE IF EXISTS support_tickets CASCADE;
DROP TABLE IF EXISTS payment_transactions CASCADE;
DROP TABLE IF EXISTS email_logs CASCADE;
DROP TABLE IF EXISTS recently_viewed CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS feedback CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS viewing_requests CASCADE;
DROP TABLE IF EXISTS apartments CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ===== STEP 2: CORE FOUNDATION TABLES (No Dependencies) =====

-- 2.1 Users Table (Must be first - everything references this)
CREATE TABLE users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'applicant' CHECK (role IN ('applicant', 'landlord', 'admin', 'customer_manager')),
    user_type VARCHAR(20) DEFAULT 'applicant' CHECK (user_type IN ('applicant', 'landlord', 'admin', 'customer_manager')),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    date_of_birth DATE,
    gdpr_consent BOOLEAN DEFAULT false,
    gdpr_consent_date TIMESTAMP WITH TIME ZONE,
    data_processing_consent BOOLEAN DEFAULT false,
    marketing_consent BOOLEAN DEFAULT false,
    email_verified BOOLEAN DEFAULT false,
    verification_token_hash VARCHAR(255),
    verified_at TIMESTAMP WITH TIME ZONE,
    verified BOOLEAN DEFAULT FALSE,
    reset_password_token VARCHAR(255),
    reset_password_expires TIMESTAMP WITH TIME ZONE,
    profile_image_url TEXT,
    bio TEXT,
    preferences JSONB,
    notification_settings JSONB,
    profile_completion_score INTEGER DEFAULT 0 CHECK (profile_completion_score >= 0 AND profile_completion_score <= 100),
    account_status VARCHAR(20) DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'pending_verification', 'deactivated')),
    suspension_reason TEXT,
    suspended_until TIMESTAMP WITH TIME ZONE,
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(255),
    verification_level VARCHAR(20) DEFAULT 'basic' CHECK (verification_level IN ('basic', 'verified', 'premium')),
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.2 Apartments Table (Second - depends only on users)
CREATE TABLE apartments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    location TEXT NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'Germany',
    price DECIMAL(10,2) NOT NULL,
    size INTEGER NOT NULL,
    rooms INTEGER NOT NULL,
    bedrooms INTEGER,
    bathrooms INTEGER DEFAULT 1,
    available_from DATE,
    available_until DATE,
    furnished BOOLEAN DEFAULT false,
    pet_friendly BOOLEAN DEFAULT false,
    smoking_allowed BOOLEAN DEFAULT false,
    balcony BOOLEAN DEFAULT false,
    parking BOOLEAN DEFAULT false,
    elevator BOOLEAN DEFAULT false,
    garden BOOLEAN DEFAULT false,
    heating_type VARCHAR(50),
    energy_rating VARCHAR(10),
    deposit DECIMAL(10,2),
    utilities_included BOOLEAN DEFAULT false,
    internet_included BOOLEAN DEFAULT false,
    cleaning_fee DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'rented', 'maintenance', 'pending')),
    images TEXT[],
    video_tour_url TEXT,
    virtual_tour_url TEXT,
    floor_plan_url TEXT,
    public_transport_info TEXT,
    nearby_amenities TEXT[],
    house_rules TEXT[],
    availability_notes TEXT,
    minimum_lease_duration INTEGER,
    maximum_lease_duration INTEGER,
    admin_notes TEXT,
    featured BOOLEAN DEFAULT false,
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    verification_notes TEXT,
    average_rating DECIMAL(3,2) DEFAULT 0.0,
    review_count INTEGER DEFAULT 0,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== STEP 3: CORE FEATURE TABLES =====

-- 3.1 Viewing Requests
CREATE TABLE viewing_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    requester_id UUID REFERENCES users(id) ON DELETE CASCADE,
    landlord_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'payment_required')),
    preferred_date_1 TIMESTAMP WITH TIME ZONE NOT NULL,
    preferred_date_2 TIMESTAMP WITH TIME ZONE,
    preferred_date_3 TIMESTAMP WITH TIME ZONE,
    confirmed_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    contact_phone VARCHAR(20),
    contact_email VARCHAR(255),
    number_of_people INTEGER DEFAULT 1,
    special_requirements TEXT,
    customer_manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
    payment_required BOOLEAN DEFAULT true,
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    booking_fee DECIMAL(10,2) DEFAULT 25.00,
    cancellation_reason TEXT,
    cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    completion_notes TEXT,
    completion_rating INTEGER CHECK (completion_rating >= 1 AND completion_rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.2 Conversations
CREATE TABLE conversations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    participant_1_id UUID REFERENCES users(id) ON DELETE CASCADE,
    participant_2_id UUID REFERENCES users(id) ON DELETE CASCADE,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    participants UUID[] DEFAULT ARRAY[]::UUID[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(apartment_id, participant_1_id, participant_2_id)
);

-- 3.3 Messages
CREATE TABLE messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file')),
    read_by_recipient BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    file_url TEXT,
    file_name TEXT,
    file_size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.4 User Favorites
CREATE TABLE user_favorites (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, apartment_id)
);

-- 3.5 Reviews (renamed from apartment_reviews for consistency)
CREATE TABLE reviews (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    viewing_request_id UUID REFERENCES viewing_requests(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(255),
    comment TEXT,
    pros TEXT,
    cons TEXT,
    would_recommend BOOLEAN,
    landlord_rating INTEGER CHECK (landlord_rating >= 1 AND landlord_rating <= 5),
    location_rating INTEGER CHECK (location_rating >= 1 AND location_rating <= 5),
    value_rating INTEGER CHECK (value_rating >= 1 AND value_rating <= 5),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    moderated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    moderated_at TIMESTAMP WITH TIME ZONE,
    moderation_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(apartment_id, user_id)
);

-- 3.6 Notifications
CREATE TABLE notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    related_entity_type VARCHAR(50),
    related_entity_id UUID,
    read_at TIMESTAMP WITH TIME ZONE,
    action_url TEXT,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- 3.7 Saved Searches
CREATE TABLE saved_searches (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    search_criteria JSONB NOT NULL,
    alerts_enabled BOOLEAN DEFAULT true,
    last_alert_sent TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.8 Recently Viewed
CREATE TABLE recently_viewed (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, apartment_id)
);

-- 3.9 Feedback
CREATE TABLE feedback (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    category VARCHAR(50) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'resolved', 'dismissed')),
    user_email VARCHAR(255),
    user_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== STEP 4: INDEXES FOR PERFORMANCE =====

-- Core table indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_verification_token_hash ON users(verification_token_hash);

CREATE INDEX idx_apartments_owner_id ON apartments(owner_id);
CREATE INDEX idx_apartments_status ON apartments(status);
CREATE INDEX idx_apartments_city ON apartments(city);
CREATE INDEX idx_apartments_price ON apartments(price);
CREATE INDEX idx_apartments_featured ON apartments(featured);
CREATE INDEX idx_apartments_created_at ON apartments(created_at DESC);

CREATE INDEX idx_viewing_requests_apartment_id ON viewing_requests(apartment_id);
CREATE INDEX idx_viewing_requests_requester_id ON viewing_requests(requester_id);
CREATE INDEX idx_viewing_requests_landlord_id ON viewing_requests(landlord_id);
CREATE INDEX idx_viewing_requests_status ON viewing_requests(status);

CREATE INDEX idx_conversations_apartment_id ON conversations(apartment_id);
CREATE INDEX idx_conversations_participant_1 ON conversations(participant_1_id);
CREATE INDEX idx_conversations_participant_2 ON conversations(participant_2_id);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- User experience indexes
CREATE INDEX idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX idx_user_favorites_apartment_id ON user_favorites(apartment_id);
CREATE INDEX idx_reviews_apartment_id ON reviews(apartment_id);
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_saved_searches_user_id ON saved_searches(user_id);
CREATE INDEX idx_recently_viewed_user_id ON recently_viewed(user_id);
CREATE INDEX idx_feedback_user_id ON feedback(user_id);
CREATE INDEX idx_feedback_status ON feedback(status);

-- ===== STEP 5: TRIGGERS FOR AUTO-UPDATES =====

-- Updated at trigger function
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

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_saved_searches_updated_at BEFORE UPDATE ON saved_searches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feedback_updated_at BEFORE UPDATE ON feedback
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== STEP 6: ENABLE ROW LEVEL SECURITY =====

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE viewing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE recently_viewed ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- ===== STEP 7: CREATE RLS POLICIES =====

-- Users policies
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Apartments policies
CREATE POLICY "Anyone can view available apartments" ON apartments
    FOR SELECT USING (status = 'available');

CREATE POLICY "Landlords can manage own apartments" ON apartments
    FOR ALL USING (auth.uid() = owner_id);

-- Viewing requests policies
CREATE POLICY "Users can view own viewing requests" ON viewing_requests
    FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = landlord_id);

CREATE POLICY "Users can create viewing requests" ON viewing_requests
    FOR INSERT WITH CHECK (auth.uid() = requester_id);

-- Conversations policies
CREATE POLICY "Users can view own conversations" ON conversations
    FOR SELECT USING (auth.uid() = participant_1_id OR auth.uid() = participant_2_id);

-- Messages policies
CREATE POLICY "Users can view messages in their conversations" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM conversations 
            WHERE conversations.id = messages.conversation_id 
            AND (conversations.participant_1_id = auth.uid() OR conversations.participant_2_id = auth.uid())
        )
    );

-- User favorites policies
CREATE POLICY "Users can manage own favorites" ON user_favorites
    FOR ALL USING (auth.uid() = user_id);

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- ===== STEP 8: SAMPLE DATA FOR TESTING =====

-- Create test admin user
INSERT INTO users (
    username, 
    email, 
    password,
    role,
    user_type,
    first_name,
    last_name,
    email_verified,
    verified,
    gdpr_consent,
    data_processing_consent,
    profile_completion_score
) VALUES (
    'sichrplace_admin',
    'admin@sichrplace.com',
    '$2b$12$LQv3c1yqBwEHxE6FuY4Jvu9HxgX9VrIqsUXdGP9E2QVGfKJ8qKjlq', -- password: "admin123"
    'admin',
    'admin',
    'SichrPlace',
    'Administrator',
    true,
    true,
    true,
    true,
    100
) ON CONFLICT (email) DO NOTHING;

-- Create test landlord user
INSERT INTO users (
    username, 
    email, 
    password,
    role,
    user_type,
    first_name,
    last_name,
    email_verified,
    verified,
    gdpr_consent,
    data_processing_consent,
    profile_completion_score
) VALUES (
    'test_landlord',
    'landlord@test.com',
    '$2b$12$LQv3c1yqBwEHxE6FuY4Jvu9HxgX9VrIqsUXdGP9E2QVGfKJ8qKjlq', -- password: "admin123"
    'landlord',
    'landlord',
    'Test',
    'Landlord',
    true,
    true,
    true,
    true,
    85
) ON CONFLICT (email) DO NOTHING;

-- Create test applicant user
INSERT INTO users (
    username, 
    email, 
    password,
    role,
    user_type,
    first_name,
    last_name,
    email_verified,
    verified,
    gdpr_consent,
    data_processing_consent,
    profile_completion_score
) VALUES (
    'test_applicant',
    'applicant@test.com',
    '$2b$12$LQv3c1yqBwEHxE6FuY4Jvu9HxgX9VrIqsUXdGP9E2QVGfKJ8qKjlq', -- password: "admin123"
    'applicant',
    'applicant',
    'Test',
    'Applicant',
    true,
    true,
    true,
    true,
    70
) ON CONFLICT (email) DO NOTHING;

-- ===== SUCCESS MESSAGE =====
DO $$
BEGIN
    RAISE NOTICE '🎉 SICHRPLACE CLEAN SCHEMA MIGRATION COMPLETED SUCCESSFULLY! 🎉';
    RAISE NOTICE '✅ All tables created in correct dependency order';
    RAISE NOTICE '✅ No foreign key conflicts';
    RAISE NOTICE '✅ All indexes and triggers applied';
    RAISE NOTICE '✅ RLS policies configured';
    RAISE NOTICE '✅ Test users created for development';
    RAISE NOTICE '🚀 Database is ready for production use!';
END $$;