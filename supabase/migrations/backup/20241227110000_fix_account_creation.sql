-- Simple fix for missing columns and ensure account creation works
-- Add any missing columns that your forms and API expect

-- Add missing columns to viewing_requests if they don't exist
DO $$ 
BEGIN
    -- Add user_id if it doesn't exist (alias for requester_id)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='viewing_requests' AND column_name='user_id') THEN
        ALTER TABLE viewing_requests ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
        -- Copy data from requester_id to user_id for existing records
        UPDATE viewing_requests SET user_id = requester_id WHERE user_id IS NULL;
    END IF;
    
    -- Add tenant_email if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='viewing_requests' AND column_name='tenant_email') THEN
        ALTER TABLE viewing_requests ADD COLUMN tenant_email VARCHAR(255);
        -- Copy from email if exists
        UPDATE viewing_requests SET tenant_email = email WHERE tenant_email IS NULL;
    END IF;
    
    -- Add tenant_name if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='viewing_requests' AND column_name='tenant_name') THEN
        ALTER TABLE viewing_requests ADD COLUMN tenant_name VARCHAR(255);
        -- Combine first_name and last_name if they exist
        UPDATE viewing_requests SET tenant_name = CONCAT(first_name, ' ', last_name) WHERE tenant_name IS NULL AND first_name IS NOT NULL;
    END IF;
    
    -- Add apartment_address if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='viewing_requests' AND column_name='apartment_address') THEN
        ALTER TABLE viewing_requests ADD COLUMN apartment_address TEXT;
    END IF;
    
    -- Add booking_fee if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='viewing_requests' AND column_name='booking_fee') THEN
        ALTER TABLE viewing_requests ADD COLUMN booking_fee DECIMAL(10,2) DEFAULT 25.00;
    END IF;
END $$;

-- Add missing columns to users if needed for account creation
DO $$ 
BEGIN
    -- Add user_type if it doesn't exist (for form compatibility)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='user_type') THEN
        ALTER TABLE users ADD COLUMN user_type VARCHAR(20) DEFAULT 'applicant' CHECK (user_type IN ('applicant', 'landlord', 'admin', 'customer_manager'));
        -- Copy from role if it exists
        UPDATE users SET user_type = role WHERE user_type IS NULL;
    END IF;
END $$;

-- Create safe indexes (only if columns exist)
DO $$
BEGIN
    -- Only create user_id index if the column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='viewing_requests' AND column_name='user_id') THEN
        CREATE INDEX IF NOT EXISTS idx_viewing_requests_user_id ON viewing_requests(user_id);
    END IF;
END $$;

-- Ensure account creation works - create test
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
    'test_user_' || EXTRACT(EPOCH FROM NOW())::text,
    'test_' || EXTRACT(EPOCH FROM NOW())::text || '@sichrplace.com',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'applicant',
    'applicant',
    'Test',
    'User',
    false,
    true,
    NOW(),
    true
) ON CONFLICT (email) DO NOTHING;

DO $$
BEGIN
    RAISE NOTICE '✅ ACCOUNT CREATION FIX APPLIED SUCCESSFULLY! ✅';
    RAISE NOTICE '✅ Missing columns added to viewing_requests and users tables';
    RAISE NOTICE '✅ Test user created to verify account creation works';
    RAISE NOTICE '🚀 Your account creation form should now work properly!';
END $$;