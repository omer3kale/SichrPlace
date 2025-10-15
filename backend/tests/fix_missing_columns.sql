-- ===================================================================
-- FIX MISSING COLUMNS IN USERS TABLE
-- Run this in Supabase SQL Editor to fix test failures
-- ===================================================================

-- Add account_status column (required by UserService.js)
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'active' 
  CHECK (account_status IN ('active', 'suspended', 'pending_verification', 'deactivated'));

-- Add other missing columns that might be needed
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_level VARCHAR(20) DEFAULT 'basic' 
  CHECK (verification_level IN ('basic', 'verified', 'premium'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index for account_status for better query performance
CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active_at);

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'account_status';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Users table columns updated successfully!';
  RAISE NOTICE '📝 Next step: Run seed_test_users.sql to create test users';
END $$;
