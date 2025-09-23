-- Step 4 Database Schema: Enhanced User Experience Tables (ULTRA-SAFE VERSION)
-- Execute these SQL commands in Supabase SQL Editor
-- ULTRA-SAFE: No DROP statements, only creates what doesn't exist

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

-- 9. Create trigger function and triggers (ultra-safe - only if not exists)
DO $$
BEGIN
    -- Create the function if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $trigger$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $trigger$ language 'plpgsql';
    END IF;

    -- Create triggers only if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_saved_searches_updated_at') THEN
        CREATE TRIGGER update_saved_searches_updated_at BEFORE UPDATE ON saved_searches
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_reviews_updated_at') THEN
        CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Success message
SELECT 'Step 4 Enhanced User Experience Schema created successfully!' as status,
       'Ultra-safe version - no DROP statements used' as safety_note,
       NOW() as completed_at;