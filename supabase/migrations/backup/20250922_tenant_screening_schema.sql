-- =====================================================
-- SICHRPLACE TENANT SCREENING DATABASE MIGRATION
-- =====================================================
-- Migration: 20250922_tenant_screening_schema
-- Description: Add German tenant screening tables and functionality
-- Dependencies: Initial schema migration (users, apartments tables)

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- =====================================================
-- TENANT SCREENING TABLES
-- =====================================================

-- 1. SCHUFA Credit Checks
CREATE TABLE IF NOT EXISTS schufa_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,
    schufa_request_id VARCHAR(100) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    address TEXT NOT NULL,
    postal_code VARCHAR(10) NOT NULL,
    city VARCHAR(100) NOT NULL,
    credit_score INTEGER CHECK (credit_score >= 0 AND credit_score <= 1000),
    risk_category VARCHAR(20) CHECK (risk_category IN ('VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH')),
    credit_rating VARCHAR(5),
    negative_entries INTEGER DEFAULT 0,
    payment_defaults INTEGER DEFAULT 0,
    open_debts DECIMAL(10,2) DEFAULT 0,
    meets_requirements BOOLEAN DEFAULT false,
    risk_assessment JSONB,
    recommendations TEXT[],
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
    schufa_response_date TIMESTAMP WITH TIME ZONE,
    valid_until TIMESTAMP WITH TIME ZONE,
    data_protection_consent BOOLEAN DEFAULT false,
    schufa_consent_date TIMESTAMP WITH TIME ZONE,
    schufa_raw_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Employment Verifications
CREATE TABLE IF NOT EXISTS employment_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,
    employer_name VARCHAR(255) NOT NULL,
    employer_address TEXT,
    position_title VARCHAR(255) NOT NULL,
    employment_type VARCHAR(50) NOT NULL CHECK (employment_type IN ('permanent', 'temporary', 'freelance', 'self_employed', 'student', 'unemployed')),
    employment_start_date DATE,
    gross_monthly_salary DECIMAL(10,2) NOT NULL,
    net_monthly_salary DECIMAL(10,2),
    monthly_rent DECIMAL(10,2) NOT NULL,
    income_to_rent_ratio DECIMAL(5,2),
    meets_three_times_rule BOOLEAN DEFAULT false,
    employment_stability_score INTEGER CHECK (employment_stability_score >= 0 AND employment_stability_score <= 100),
    employment_risk_level VARCHAR(20) CHECK (employment_risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    risk_factors TEXT[],
    employment_contract_verified BOOLEAN DEFAULT false,
    payslip_verified BOOLEAN DEFAULT false,
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'in_review', 'verified', 'rejected', 'expired')),
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    verification_date TIMESTAMP WITH TIME ZONE,
    existing_debts DECIMAL(10,2) DEFAULT 0,
    monthly_expenses DECIMAL(10,2) DEFAULT 0,
    has_guarantor BOOLEAN DEFAULT false,
    guarantor_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '6 months')
);

-- 3. Landlord Reference Checks
CREATE TABLE IF NOT EXISTS landlord_reference_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,
    total_references_requested INTEGER DEFAULT 0,
    references_received INTEGER DEFAULT 0,
    references_verified INTEGER DEFAULT 0,
    overall_reference_score INTEGER CHECK (overall_reference_score >= 0 AND overall_reference_score <= 100),
    reference_quality VARCHAR(20) CHECK (reference_quality IN ('EXCELLENT', 'GOOD', 'AVERAGE', 'POOR', 'INADEQUATE')),
    positive_references INTEGER DEFAULT 0,
    neutral_references INTEGER DEFAULT 0,
    negative_references INTEGER DEFAULT 0,
    average_tenancy_duration DECIMAL(4,2),
    rent_payment_reliability_score INTEGER CHECK (rent_payment_reliability_score >= 0 AND rent_payment_reliability_score <= 100),
    property_maintenance_score INTEGER CHECK (property_maintenance_score >= 0 AND property_maintenance_score <= 100),
    late_payments_reported INTEGER DEFAULT 0,
    damage_reports INTEGER DEFAULT 0,
    eviction_history BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'collecting' CHECK (status IN ('collecting', 'pending_responses', 'completed', 'insufficient_data', 'expired')),
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    collection_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    collection_deadline TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '14 days'),
    completed_at TIMESTAMP WITH TIME ZONE,
    reference_summary TEXT,
    recommendation TEXT,
    red_flags TEXT[],
    positive_highlights TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Individual Landlord References
CREATE TABLE IF NOT EXISTS individual_landlord_references (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference_check_id UUID NOT NULL REFERENCES landlord_reference_checks(id) ON DELETE CASCADE,
    landlord_name VARCHAR(255) NOT NULL,
    landlord_email VARCHAR(255) NOT NULL,
    landlord_phone VARCHAR(50),
    property_address TEXT NOT NULL,
    tenancy_start_date DATE NOT NULL,
    tenancy_end_date DATE,
    monthly_rent DECIMAL(10,2) NOT NULL,
    lease_type VARCHAR(50) CHECK (lease_type IN ('fixed_term', 'periodic', 'student', 'short_term')),
    tenancy_duration_months INTEGER,
    rent_payment_punctuality INTEGER CHECK (rent_payment_punctuality >= 1 AND rent_payment_punctuality <= 5),
    property_condition_maintained INTEGER CHECK (property_condition_maintained >= 1 AND property_condition_maintained <= 5),
    communication_quality INTEGER CHECK (communication_quality >= 1 AND communication_quality <= 5),
    would_rent_again BOOLEAN,
    positive_comments TEXT,
    negative_comments TEXT,
    reason_for_leaving VARCHAR(255),
    late_payment_instances INTEGER DEFAULT 0,
    property_damage_reported BOOLEAN DEFAULT false,
    damage_description TEXT,
    lease_violations TEXT[],
    verification_status VARCHAR(20) DEFAULT 'sent' CHECK (verification_status IN ('sent', 'reminded', 'responded', 'verified', 'expired', 'declined')),
    verification_token VARCHAR(100) UNIQUE NOT NULL,
    email_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    response_received_at TIMESTAMP WITH TIME ZONE,
    response_ip_address INET,
    individual_reference_score INTEGER CHECK (individual_reference_score >= 0 AND individual_reference_score <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days')
);

-- 5. Financial Qualifications
CREATE TABLE IF NOT EXISTS financial_qualifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,
    monthly_rent DECIMAL(10,2) NOT NULL,
    total_gross_income DECIMAL(10,2) NOT NULL,
    estimated_net_income DECIMAL(10,2) NOT NULL,
    disposable_income DECIMAL(10,2) NOT NULL,
    income_breakdown JSONB NOT NULL,
    existing_debts DECIMAL(10,2) DEFAULT 0,
    monthly_expenses DECIMAL(10,2) DEFAULT 0,
    debt_to_income_ratio DECIMAL(5,2),
    meets_three_times_rule BOOLEAN DEFAULT false,
    income_ratio DECIMAL(5,2) NOT NULL,
    required_income DECIMAL(10,2),
    has_guarantor BOOLEAN DEFAULT false,
    guarantor_income DECIMAL(10,2),
    income_type VARCHAR(50) NOT NULL CHECK (income_type IN ('permanent_employment', 'temporary_employment', 'freelance', 'self_employed', 'mixed', 'student', 'benefits')),
    stability_score INTEGER CHECK (stability_score >= 0 AND stability_score <= 150),
    affordability_score INTEGER CHECK (affordability_score >= 0 AND affordability_score <= 150),
    qualification_level VARCHAR(20) NOT NULL CHECK (qualification_level IN ('EXCELLENT', 'GOOD', 'ACCEPTABLE', 'REVIEW_REQUIRED', 'REJECTED')),
    financial_risk_level VARCHAR(20) CHECK (financial_risk_level IN ('VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    risk_factors TEXT[],
    recommendations TEXT[],
    documentation_required TEXT[],
    status VARCHAR(20) DEFAULT 'calculated' CHECK (status IN ('calculated', 'under_review', 'approved', 'rejected', 'expired')),
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approval_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valid_until TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '3 months')
);

-- 6. Tenant Screening Logs
CREATE TABLE IF NOT EXISTS tenant_screening_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,
    screening_type VARCHAR(50) NOT NULL CHECK (screening_type IN ('schufa_check', 'employment_verification', 'landlord_references', 'financial_qualification', 'document_upload', 'admin_review')),
    action VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('initiated', 'in_progress', 'completed', 'failed', 'cancelled', 'expired')),
    result_summary JSONB,
    processing_time_seconds INTEGER,
    error_code VARCHAR(50),
    error_message TEXT,
    ip_address INET,
    user_agent TEXT,
    admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    admin_action VARCHAR(100),
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    severity_level VARCHAR(20) DEFAULT 'info' CHECK (severity_level IN ('debug', 'info', 'warning', 'error', 'critical'))
);

-- =====================================================
-- INDEXES
-- =====================================================

-- SCHUFA Checks
CREATE INDEX IF NOT EXISTS idx_schufa_checks_user_id ON schufa_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_schufa_checks_apartment_id ON schufa_checks(apartment_id);
CREATE INDEX IF NOT EXISTS idx_schufa_checks_status ON schufa_checks(status);

-- Employment Verifications
CREATE INDEX IF NOT EXISTS idx_employment_verifications_user_id ON employment_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_employment_verifications_apartment_id ON employment_verifications(apartment_id);
CREATE INDEX IF NOT EXISTS idx_employment_verifications_status ON employment_verifications(verification_status);

-- Landlord References
CREATE INDEX IF NOT EXISTS idx_landlord_reference_checks_user_id ON landlord_reference_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_individual_landlord_references_check_id ON individual_landlord_references(reference_check_id);
CREATE INDEX IF NOT EXISTS idx_individual_landlord_references_token ON individual_landlord_references(verification_token);

-- Financial Qualifications
CREATE INDEX IF NOT EXISTS idx_financial_qualifications_user_id ON financial_qualifications(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_qualifications_apartment_id ON financial_qualifications(apartment_id);

-- Screening Logs
CREATE INDEX IF NOT EXISTS idx_tenant_screening_logs_user_id ON tenant_screening_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_screening_logs_type ON tenant_screening_logs(screening_type);
CREATE INDEX IF NOT EXISTS idx_tenant_screening_logs_created_at ON tenant_screening_logs(created_at);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS
ALTER TABLE schufa_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE employment_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE landlord_reference_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE individual_landlord_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_screening_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenant data access
CREATE POLICY "Users can manage their own screening data" ON schufa_checks
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own employment data" ON employment_verifications
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own reference data" ON landlord_reference_checks
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their reference responses" ON individual_landlord_references
    FOR SELECT USING (
        reference_check_id IN (
            SELECT id FROM landlord_reference_checks WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their own financial data" ON financial_qualifications
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own screening logs" ON tenant_screening_logs
    FOR SELECT USING (auth.uid() = user_id);

-- RLS Policies for landlord access
CREATE POLICY "Landlords can view tenant screening for their apartments" ON schufa_checks
    FOR SELECT USING (
        apartment_id IN (
            SELECT id FROM apartments WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Landlords can view employment data for their apartments" ON employment_verifications
    FOR SELECT USING (
        apartment_id IN (
            SELECT id FROM apartments WHERE owner_id = auth.uid()
        )
    );

-- =====================================================
-- UTILITY FUNCTIONS
-- =====================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_schufa_checks_updated_at BEFORE UPDATE ON schufa_checks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employment_verifications_updated_at BEFORE UPDATE ON employment_verifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_landlord_reference_checks_updated_at BEFORE UPDATE ON landlord_reference_checks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_individual_landlord_references_updated_at BEFORE UPDATE ON individual_landlord_references
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_financial_qualifications_updated_at BEFORE UPDATE ON financial_qualifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Screening status function
CREATE OR REPLACE FUNCTION get_tenant_screening_status(tenant_user_id UUID, target_apartment_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    schufa_status TEXT;
    employment_status TEXT;
    references_status TEXT;
    financial_status TEXT;
    overall_completion INTEGER;
BEGIN
    -- Check completion status
    SELECT status INTO schufa_status 
    FROM schufa_checks 
    WHERE user_id = tenant_user_id AND apartment_id = target_apartment_id
    ORDER BY created_at DESC LIMIT 1;
    
    SELECT verification_status INTO employment_status
    FROM employment_verifications
    WHERE user_id = tenant_user_id AND apartment_id = target_apartment_id
    ORDER BY created_at DESC LIMIT 1;
    
    SELECT status INTO references_status
    FROM landlord_reference_checks
    WHERE user_id = tenant_user_id AND apartment_id = target_apartment_id
    ORDER BY created_at DESC LIMIT 1;
    
    SELECT status INTO financial_status
    FROM financial_qualifications
    WHERE user_id = tenant_user_id AND apartment_id = target_apartment_id
    ORDER BY created_at DESC LIMIT 1;
    
    -- Calculate completion
    overall_completion := 0;
    IF schufa_status = 'completed' THEN overall_completion := overall_completion + 25; END IF;
    IF employment_status = 'verified' THEN overall_completion := overall_completion + 25; END IF;
    IF references_status = 'completed' THEN overall_completion := overall_completion + 25; END IF;
    IF financial_status = 'approved' THEN overall_completion := overall_completion + 25; END IF;
    
    result := jsonb_build_object(
        'tenant_id', tenant_user_id,
        'apartment_id', target_apartment_id,
        'overall_completion_percentage', overall_completion,
        'schufa_status', COALESCE(schufa_status, 'not_started'),
        'employment_status', COALESCE(employment_status, 'not_started'),
        'references_status', COALESCE(references_status, 'not_started'),
        'financial_status', COALESCE(financial_status, 'not_started'),
        'is_complete', (overall_completion = 100),
        'checked_at', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;