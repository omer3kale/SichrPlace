-- ================================================
-- Migration: Add Login Tracking Columns
-- Created: October 13, 2025
-- Purpose: Add failed login attempt tracking columns to users table
-- ================================================

-- Add columns if they don't exist
DO $$
BEGIN
    -- Add failed_login_attempts column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'users' 
        AND column_name = 'failed_login_attempts'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN failed_login_attempts INTEGER DEFAULT 0 NOT NULL;
        
        RAISE NOTICE '✅ Added column: failed_login_attempts';
    ELSE
        RAISE NOTICE '⚠️ Column already exists: failed_login_attempts';
    END IF;

    -- Add last_failed_login column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'users' 
        AND column_name = 'last_failed_login'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN last_failed_login TIMESTAMP WITH TIME ZONE;
        
        RAISE NOTICE '✅ Added column: last_failed_login';
    ELSE
        RAISE NOTICE '⚠️ Column already exists: last_failed_login';
    END IF;
END $$;

-- Add comments to document the columns
COMMENT ON COLUMN users.failed_login_attempts IS 'Number of consecutive failed login attempts. Resets to 0 on successful login. Auto-suspend account after 5 attempts.';
COMMENT ON COLUMN users.last_failed_login IS 'Timestamp of the most recent failed login attempt.';

-- Create index for performance (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_users_failed_login_attempts 
ON users(failed_login_attempts) 
WHERE failed_login_attempts > 0;

COMMENT ON INDEX idx_users_failed_login_attempts IS 'Index for quickly finding users with failed login attempts';

-- Verify the migration
DO $$
DECLARE
    col_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name IN ('failed_login_attempts', 'last_failed_login');
    
    IF col_count = 2 THEN
        RAISE NOTICE '✅ Migration successful! Both columns exist.';
    ELSE
        RAISE WARNING '❌ Migration incomplete! Expected 2 columns, found %', col_count;
    END IF;
END $$;

-- Display final column information
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable,
    character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'users'
AND column_name IN ('failed_login_attempts', 'last_failed_login', 'last_login')
ORDER BY column_name;
