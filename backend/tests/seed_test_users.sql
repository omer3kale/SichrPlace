-- ============================================
-- Test User Seed Data for Integration Tests
-- ============================================
-- Run this in Supabase SQL Editor to create test users
-- Password: Admin123! for admin
-- Password: Tenant123! for tenants
-- Password: Landlord123! for landlords

-- NOTE: These password hashes are bcrypt hashes with salt rounds = 12
-- Generated using: bcrypt.hash('Admin123!', 12)

-- Clean up existing test users (optional)
DELETE FROM users WHERE email IN (
  'admin@sichrplace.com',
  'tenant1@example.com', 
  'tenant2@example.com',
  'landlord1@example.com',
  'landlord2@example.com'
);

-- Insert Admin User
-- Password: Admin123!
INSERT INTO users (
  id, 
  username, 
  first_name, 
  last_name, 
  email, 
  password, 
  role, 
  email_verified, 
  account_status,
  created_at,
  updated_at
) VALUES (
  'test-admin-0001-0001-0001-000000000001',
  'testadmin',
  'Test',
  'Admin',
  'admin@sichrplace.com',
  '$2a$12$jd48h2BxqmWepnBekkt05.xcn6TFUU1r/o8sRj9KOMxRL91BYj3EO', -- Admin123!
  'admin',
  true,
  'active',
  NOW(),
  NOW()
);

-- Insert Tenant 1
-- Password: Tenant123!
INSERT INTO users (
  id,
  username,
  first_name,
  last_name,
  email,
  password,
  role,
  email_verified,
  account_status,
  created_at,
  updated_at
) VALUES (
  'test-tenant-0001-0001-0001-000000000001',
  'testtenant1',
  'Test',
  'Tenant One',
  'tenant1@example.com',
  '$2a$12$C5WHFXGoVKOWkNPix3vxcu7GMBwaqt8BtR/KV4oZ3OkfcXSin6btm', -- Tenant123!
  'tenant',
  true,
  'active',
  NOW(),
  NOW()
);

-- Insert Tenant 2
-- Password: Tenant123!
INSERT INTO users (
  id,
  username,
  first_name,
  last_name,
  email,
  password,
  role,
  email_verified,
  account_status,
  created_at,
  updated_at
) VALUES (
  'test-tenant-0002-0001-0001-000000000002',
  'testtenant2',
  'Test',
  'Tenant Two',
  'tenant2@example.com',
  '$2a$12$C5WHFXGoVKOWkNPix3vxcu7GMBwaqt8BtR/KV4oZ3OkfcXSin6btm', -- Tenant123!
  'tenant',
  true,
  'active',
  NOW(),
  NOW()
);

-- Insert Landlord 1
-- Password: Landlord123!
INSERT INTO users (
  id,
  username,
  first_name,
  last_name,
  email,
  password,
  role,
  email_verified,
  account_status,
  created_at,
  updated_at
) VALUES (
  'test-landlord-001-0001-0001-000000000001',
  'testlandlord1',
  'Test',
  'Landlord One',
  'landlord1@example.com',
  '$2a$12$R2ywSZmm9jCOtxmFWPfz3ecFHa0WlML6eXjfEW.Jh15Pue35Wfa26', -- Landlord123!
  'landlord',
  true,
  'active',
  NOW(),
  NOW()
);

-- Insert Landlord 2
-- Password: Landlord123!
INSERT INTO users (
  id,
  username,
  first_name,
  last_name,
  email,
  password,
  role,
  email_verified,
  account_status,
  created_at,
  updated_at
) VALUES (
  'test-landlord-002-0001-0001-000000000002',
  'testlandlord2',
  'Test',
  'Landlord Two',
  'landlord2@example.com',
  '$2a$12$R2ywSZmm9jCOtxmFWPfz3ecFHa0WlML6eXjfEW.Jh15Pue35Wfa26', -- Landlord123!
  'landlord',
  true,
  'active',
  NOW(),
  NOW()
);

-- Verify insertion
SELECT 
  id,
  username, 
  email, 
  role, 
  email_verified,
  account_status
FROM users 
WHERE email IN (
  'admin@sichrplace.com',
  'tenant1@example.com',
  'tenant2@example.com', 
  'landlord1@example.com',
  'landlord2@example.com'
)
ORDER BY role, email;

-- Expected result: 5 rows
-- ✅ All test users created successfully!
