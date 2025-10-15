-- 🎯 CORE SICHRPLACE PLATFORM MIGRATION
-- Essential tables for apartment rental platform functionality
-- Based on actual workspace analysis - NO MARKETPLACE

-- ===== ENABLE EXTENSIONS =====
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ===== CORE PLATFORM TABLES =====

-- 1. USERS TABLE (Primary authentication and profiles)
CREATE TABLE IF NOT EXISTS users (
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
    email_verification_token VARCHAR(255),
    email_verified_at TIMESTAMP WITH TIME ZONE,
    reset_password_token VARCHAR(255),
    reset_password_expires TIMESTAMP WITH TIME ZONE,
    profile_image_url TEXT,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. APARTMENTS TABLE (Core rental listings)
CREATE TABLE IF NOT EXISTS apartments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    location TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    size INTEGER NOT NULL,
    rooms INTEGER NOT NULL,
    bathrooms INTEGER DEFAULT 1,
    available_from DATE,
    available_until DATE,
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    images TEXT[] DEFAULT '{}',
    amenities TEXT[] DEFAULT '{}',
    pet_friendly BOOLEAN DEFAULT false,
    furnished BOOLEAN DEFAULT false,
    balcony BOOLEAN DEFAULT false,
    parking BOOLEAN DEFAULT false,
    elevator BOOLEAN DEFAULT false,
    internet BOOLEAN DEFAULT false,
    city VARCHAR(100),
    postal_code VARCHAR(10),
    country VARCHAR(100) DEFAULT 'Germany',
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'rented', 'pending', 'unavailable', 'draft')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. VIEWING REQUESTS TABLE (Core booking functionality)
CREATE TABLE IF NOT EXISTS viewing_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    requester_id UUID REFERENCES users(id) ON DELETE CASCADE,
    landlord_id UUID REFERENCES users(id) ON DELETE CASCADE,
    preferred_date_1 TIMESTAMP WITH TIME ZONE NOT NULL,
    preferred_date_2 TIMESTAMP WITH TIME ZONE,
    preferred_date_3 TIMESTAMP WITH TIME ZONE,
    requested_date TIMESTAMP WITH TIME ZONE NOT NULL,
    alternative_date_1 TIMESTAMP WITH TIME ZONE,
    alternative_date_2 TIMESTAMP WITH TIME ZONE,
    message TEXT,
    phone VARCHAR(20),
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    tenant_email VARCHAR(255),
    tenant_name VARCHAR(255),
    apartment_address TEXT,
    booking_fee DECIMAL(10,2) DEFAULT 25.00,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
    confirmed_date TIMESTAMP WITH TIME ZONE,
    customer_manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
    payment_required BOOLEAN DEFAULT true,
    payment_amount DECIMAL(10,2) DEFAULT 25.00,
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. CONVERSATIONS TABLE (Messaging between users)
CREATE TABLE IF NOT EXISTS conversations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    participant_1_id UUID REFERENCES users(id) ON DELETE CASCADE,
    participant_2_id UUID REFERENCES users(id) ON DELETE CASCADE,
    apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,
    landlord_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. MESSAGES TABLE (Chat messages)
CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    message TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
    attachment_url TEXT,
    read_at TIMESTAMP WITH TIME ZONE,
    is_read BOOLEAN DEFAULT false,
    edited_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. USER FAVORITES TABLE (Saved apartments)
CREATE TABLE IF NOT EXISTS user_favorites (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, apartment_id)
);

-- 7. REVIEWS TABLE (Apartment reviews)
CREATE TABLE IF NOT EXISTS reviews (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
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
    UNIQUE(apartment_id, user_id)
);

-- 8. NOTIFICATIONS TABLE (User notifications)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    related_entity_type VARCHAR(50),
    related_entity_id UUID,
    action_url TEXT,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- 9. SAVED SEARCHES TABLE (User search preferences)
CREATE TABLE IF NOT EXISTS saved_searches (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    search_name VARCHAR(200),
    search_criteria JSONB NOT NULL,
    alerts_enabled BOOLEAN DEFAULT true,
    email_alerts BOOLEAN DEFAULT true,
    alert_frequency VARCHAR(20) DEFAULT 'daily' CHECK (alert_frequency IN ('immediate', 'daily', 'weekly')),
    last_notified_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. RECENTLY VIEWED TABLE (User browsing history)
CREATE TABLE IF NOT EXISTS recently_viewed (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, apartment_id)
);

-- 11. FEEDBACK TABLE (General platform feedback)
CREATE TABLE IF NOT EXISTS feedback (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL,
    subject VARCHAR(255),
    message TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== PERFORMANCE INDEXES =====

-- User indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);

-- Apartment indexes
CREATE INDEX IF NOT EXISTS idx_apartments_owner_id ON apartments(owner_id);
CREATE INDEX IF NOT EXISTS idx_apartments_city ON apartments(city);
CREATE INDEX IF NOT EXISTS idx_apartments_price ON apartments(price);
CREATE INDEX IF NOT EXISTS idx_apartments_status ON apartments(status);
CREATE INDEX IF NOT EXISTS idx_apartments_available_from ON apartments(available_from);
CREATE INDEX IF NOT EXISTS idx_apartments_created_at ON apartments(created_at DESC);

-- Viewing request indexes
CREATE INDEX IF NOT EXISTS idx_viewing_requests_apartment_id ON viewing_requests(apartment_id);
CREATE INDEX IF NOT EXISTS idx_viewing_requests_user_id ON viewing_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_viewing_requests_requester_id ON viewing_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_viewing_requests_landlord_id ON viewing_requests(landlord_id);
CREATE INDEX IF NOT EXISTS idx_viewing_requests_status ON viewing_requests(status);
CREATE INDEX IF NOT EXISTS idx_viewing_requests_created_at ON viewing_requests(created_at DESC);

-- Conversation indexes
CREATE INDEX IF NOT EXISTS idx_conversations_apartment_id ON conversations(apartment_id);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_1 ON conversations(participant_1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_2 ON conversations(participant_2_id);
CREATE INDEX IF NOT EXISTS idx_conversations_landlord_id ON conversations(landlord_id);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_id ON conversations(tenant_id);

-- Message indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- Other indexes
CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_apartment ON user_favorites(apartment_id);
CREATE INDEX IF NOT EXISTS idx_reviews_apartment_id ON reviews(apartment_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_recently_viewed_user_id ON recently_viewed(user_id);

-- ===== FUNCTIONS AND TRIGGERS =====

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
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

DROP TRIGGER IF EXISTS update_reviews_updated_at ON reviews;
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_saved_searches_updated_at ON saved_searches;
CREATE TRIGGER update_saved_searches_updated_at BEFORE UPDATE ON saved_searches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== ROW LEVEL SECURITY =====

-- Enable RLS on all tables
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

-- Basic RLS policies

-- Users can view their own data
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Anyone can view available apartments
DROP POLICY IF EXISTS "Anyone can view available apartments" ON apartments;
CREATE POLICY "Anyone can view available apartments" ON apartments
    FOR SELECT USING (status = 'available');

-- Landlords can manage their apartments
DROP POLICY IF EXISTS "Landlords can manage own apartments" ON apartments;
CREATE POLICY "Landlords can manage own apartments" ON apartments
    FOR ALL USING (auth.uid() = owner_id);

-- Users can view their own viewing requests
DROP POLICY IF EXISTS "Users can view own viewing requests" ON viewing_requests;
CREATE POLICY "Users can view own viewing requests" ON viewing_requests
    FOR SELECT USING (auth.uid() = user_id OR auth.uid() = requester_id OR auth.uid() = landlord_id);

-- Users can create viewing requests
DROP POLICY IF EXISTS "Users can create viewing requests" ON viewing_requests;
CREATE POLICY "Users can create viewing requests" ON viewing_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() = requester_id);

-- Users can participate in conversations
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
CREATE POLICY "Users can view own conversations" ON conversations
    FOR SELECT USING (auth.uid() = participant_1_id OR auth.uid() = participant_2_id OR auth.uid() = landlord_id OR auth.uid() = tenant_id);

-- Users can view messages in their conversations
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
CREATE POLICY "Users can view messages in their conversations" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM conversations 
            WHERE conversations.id = messages.conversation_id 
            AND (conversations.participant_1_id = auth.uid() OR conversations.participant_2_id = auth.uid() 
                 OR conversations.landlord_id = auth.uid() OR conversations.tenant_id = auth.uid())
        )
    );

-- Users can manage their own favorites
DROP POLICY IF EXISTS "Users can manage own favorites" ON user_favorites;
CREATE POLICY "Users can manage own favorites" ON user_favorites
    FOR ALL USING (auth.uid() = user_id);

-- Users can view their notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

-- Users can update their notifications
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- ===== SAMPLE DATA FOR TESTING =====

-- Create admin user
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
    'sichrplace_admin',
    'omer3kale@gmail.com',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'admin',
    'admin',
    'SichrPlace',
    'Admin',
    true,
    true,
    NOW(),
    true
) ON CONFLICT (email) DO NOTHING;

-- Create sample landlord user
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
    'test_landlord',
    'landlord@sichrplace.com',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'landlord',
    'landlord',
    'Test',
    'Landlord',
    true,
    true,
    NOW(),
    true
) ON CONFLICT (email) DO NOTHING;

-- Create sample apartments
INSERT INTO apartments (
    title,
    description,
    location,
    price,
    size,
    rooms,
    bathrooms,
    available_from,
    owner_id,
    images,
    amenities,
    furnished,
    balcony,
    parking,
    elevator,
    internet,
    city,
    country,
    status
) VALUES (
    'Beautiful Modern Apartment in Köln',
    'Spacious and modern apartment in the heart of Cologne. Perfect for professionals or small families.',
    'Cologne City Center, Germany',
    850.00,
    75,
    3,
    1,
    CURRENT_DATE + INTERVAL '1 week',
    (SELECT id FROM users WHERE email = 'landlord@sichrplace.com' LIMIT 1),
    ARRAY['../img/koeln.jpg', '../img/koeln2.jpg'],
    ARRAY['High-speed Internet', 'Balcony', 'Elevator', 'Parking'],
    true,
    true,
    true,
    true,
    true,
    'Cologne',
    'Germany',
    'available'
),
(
    'Cozy Studio in City Center',
    'Perfect studio apartment for students or young professionals. All amenities included.',
    'Cologne Downtown, Germany', 
    650.00,
    45,
    1,
    1,
    CURRENT_DATE + INTERVAL '2 weeks',
    (SELECT id FROM users WHERE email = 'landlord@sichrplace.com' LIMIT 1),
    ARRAY['../img/studio1.jpg'],
    ARRAY['Internet', 'Furnished', 'Central Heating'],
    true,
    false,
    false,
    false,
    true,
    'Cologne',
    'Germany',
    'available'
)
ON CONFLICT DO NOTHING;

-- ===== GRANTS =====
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- ===== SUCCESS MESSAGE =====
DO $$
BEGIN
    RAISE NOTICE '🎉 CORE SICHRPLACE PLATFORM MIGRATION COMPLETE! 🎉';
    RAISE NOTICE '✅ Essential tables: users, apartments, viewing_requests, conversations';
    RAISE NOTICE '✅ Platform features: messages, reviews, notifications, favorites';
    RAISE NOTICE '✅ Security: RLS policies enabled on all tables';
    RAISE NOTICE '✅ Sample data: Admin user and test apartments created';
    RAISE NOTICE '🚀 Ready for core apartment rental functionality!';
END $$;