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