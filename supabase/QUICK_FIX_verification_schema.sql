-- Complete Database Schema Updates for Email Verification
-- Run this directly in Supabase SQL Editor

-- 1. Add verification columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS verification_token_hash VARCHAR(255);

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;

-- 2. Update existing users to have verified status based on email_verified
UPDATE users 
SET verified = COALESCE(email_verified, false) 
WHERE verified IS NULL;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_verification_token_hash ON users(verification_token_hash);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email, verified);

-- 4. Add any missing activity_logs table (if not exists)
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Verify the changes
SELECT 
    'users table columns' as check_type,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
    AND column_name IN ('verification_token_hash', 'verified_at', 'verified', 'email_verified')
ORDER BY column_name;

-- 6. Show sample of current users table structure
SELECT 
    id,
    email,
    username,
    verified,
    email_verified,
    verification_token_hash IS NOT NULL as has_token,
    created_at
FROM users 
LIMIT 3;