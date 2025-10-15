-- Add verification token column to users table
-- This enables proper email verification workflow

-- Add verification token hash column for secure token storage
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS verification_token_hash VARCHAR(255);

-- Add verified_at timestamp to track when verification occurred
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;

-- Update existing column name for consistency
-- Change email_verified to verified for consistency with auth functions
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;

-- Update existing users to use the new verified column if email_verified exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='users' AND column_name='email_verified') THEN
        UPDATE users SET verified = email_verified WHERE email_verified IS NOT NULL;
    END IF;
END $$;

-- Create index for faster token lookup
CREATE INDEX IF NOT EXISTS idx_users_verification_token_hash ON users(verification_token_hash);

-- Create index for email and verification status lookup
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email, verified);

COMMENT ON COLUMN users.verification_token_hash IS 'Hashed email verification token for security';
COMMENT ON COLUMN users.verified_at IS 'Timestamp when email was verified';
COMMENT ON COLUMN users.verified IS 'Boolean flag indicating if email is verified';