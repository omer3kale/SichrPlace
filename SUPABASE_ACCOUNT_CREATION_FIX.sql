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