#!/usr/bin/env node
/**
 * Security Toolkit - Hash All Secrets
 * 
 * This script hashes all known passwords and generates bcrypt hashes
 * for secure storage in the database and environment variables.
 * 
 * Usage: node scripts/hash-all-secrets.js
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Configuration
const SALT_ROUNDS = 12;
const OUTPUT_DIR = path.join(__dirname, '../', 'tmp');

// Known credentials that need hashing
const CREDENTIALS = {
  admin: {
    email: 'sichrplace@gmail.com',
    password: 'Gokhangulec29*',
    role: 'admin'
  },
  user: {
    email: 'omer3kale@gmail.com',
    password: 'Gokhangulec29*',
    role: 'user'
  },
  test: {
    email: 'test_*@sichrplace.com',
    password: 'Test123!@#',
    role: 'test'
  }
};

/**
 * Generate a cryptographically secure JWT secret
 */
function generateJWTSecret() {
  return crypto.randomBytes(64).toString('base64');
}

/**
 * Generate a master encryption key
 */
function generateMasterKey() {
  return crypto.randomBytes(32).toString('base64');
}

/**
 * Hash a password using bcrypt
 */
async function hashPassword(password) {
  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    return hash;
  } catch (error) {
    console.error('Error hashing password:', error);
    throw error;
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🔐 SichrPlace Security Toolkit - Password Hasher');
  console.log('='.repeat(60));
  console.log('');

  // Create output directory if it doesn't exist
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const results = {
    timestamp: new Date().toISOString(),
    hashes: {},
    secrets: {}
  };

  // Hash all passwords
  console.log('📝 Hashing passwords...\n');
  
  for (const [key, cred] of Object.entries(CREDENTIALS)) {
    console.log(`  Processing ${cred.email}...`);
    const hash = await hashPassword(cred.password);
    results.hashes[key] = {
      email: cred.email,
      plaintext: cred.password,
      hash: hash,
      role: cred.role
    };
    console.log(`  ✅ Hash generated (${hash.substring(0, 20)}...)\n`);
  }

  // Generate JWT Secret
  console.log('🔑 Generating new JWT secret...');
  const jwtSecret = generateJWTSecret();
  results.secrets.JWT_SECRET = jwtSecret;
  console.log(`  ✅ JWT Secret: ${jwtSecret.substring(0, 20)}...\n`);

  // Generate Master Key
  console.log('🔐 Generating master encryption key...');
  const masterKey = generateMasterKey();
  results.secrets.MASTER_KEY = masterKey;
  console.log(`  ✅ Master Key: ${masterKey.substring(0, 20)}...\n`);

  // Save results to file
  const outputFile = path.join(OUTPUT_DIR, 'hashed-secrets.json');
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`💾 Results saved to: ${outputFile}\n`);

  // Generate SQL migration file
  console.log('📄 Generating SQL migration file...');
  const sqlFile = path.join(OUTPUT_DIR, 'password-migration.sql');
  const sqlContent = generateSQLMigration(results);
  fs.writeFileSync(sqlFile, sqlContent);
  console.log(`  ✅ SQL migration saved to: ${sqlFile}\n`);

  // Generate .env template
  console.log('📋 Generating .env example...');
  const envContent = generateEnvTemplate(results);
  const envFile = path.join(OUTPUT_DIR, 'env-template.txt');
  fs.writeFileSync(envFile, envContent);
  console.log(`  ✅ Environment template saved to: ${envFile}\n`);

  // Display summary
  console.log('='.repeat(60));
  console.log('✅ Password Hashing Complete!\n');
  console.log('📌 Next Steps:');
  console.log('   1. Review the generated files in tmp/ directory');
  console.log('   2. Update your .env file with the new values');
  console.log('   3. Run the SQL migration in your database');
  console.log('   4. Test authentication with environment variables');
  console.log('   5. Delete the tmp/ directory after deployment');
  console.log('');
  console.log('⚠️  SECURITY WARNING:');
  console.log('   - Keep hashed-secrets.json SECURE and DELETE after use');
  console.log('   - Never commit plaintext passwords to version control');
  console.log('   - Ensure .env files are in .gitignore');
  console.log('='.repeat(60));
}

/**
 * Generate SQL migration script
 */
function generateSQLMigration(results) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  let sql = `-- Password Migration Script
-- Generated: ${results.timestamp}
-- 
-- This script updates user passwords to bcrypt hashes
-- BACKUP YOUR DATABASE BEFORE RUNNING THIS SCRIPT
--

BEGIN;

-- Update admin user password
UPDATE users 
SET password_hash = '${results.hashes.admin.hash}'
WHERE email = '${results.hashes.admin.email}';

-- Update regular user password
UPDATE users 
SET password_hash = '${results.hashes.user.hash}'
WHERE email = '${results.hashes.user.email}';

-- Update all test users with the test password
UPDATE users 
SET password_hash = '${results.hashes.test.hash}'
WHERE email LIKE 'test_%@sichrplace.com';

-- Add index on email for faster lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Log migration
INSERT INTO migration_log (migration_name, executed_at, description)
VALUES (
  'password-migration-${timestamp}',
  NOW(),
  'Updated all user passwords to bcrypt hashes'
);

COMMIT;

-- Verification query
SELECT 
  email, 
  CASE 
    WHEN password_hash LIKE '$2a$%' OR password_hash LIKE '$2b$%' THEN 'Bcrypt Hash ✓'
    ELSE 'Plain Text ✗'
  END as password_status
FROM users
WHERE email IN ('${results.hashes.admin.email}', '${results.hashes.user.email}')
   OR email LIKE 'test_%@sichrplace.com';
`;

  return sql;
}

/**
 * Generate .env template
 */
function generateEnvTemplate(results) {
  return `# =================================================================
# SichrPlace Environment Variables
# Generated: ${results.timestamp}
# =================================================================

# -----------------------------
# Admin Credentials (Hashed)
# -----------------------------
# Use these hashed passwords in your database
# Admin: ${results.hashes.admin.email}
ADMIN_PASSWORD_HASH=${results.hashes.admin.hash}

# User: ${results.hashes.user.email}
USER_PASSWORD_HASH=${results.hashes.user.hash}

# Test accounts: test_*@sichrplace.com
TEST_USER_PASSWORD_HASH=${results.hashes.test.hash}

# -----------------------------
# Original Passwords (For Environment Setup Only)
# DELETE THESE AFTER INITIAL SETUP
# -----------------------------
ADMIN_PASSWORD=${results.hashes.admin.plaintext}
TEST_USER_PASSWORD=${results.hashes.test.plaintext}

# -----------------------------
# JWT Configuration
# -----------------------------
JWT_SECRET=${results.secrets.JWT_SECRET}

# -----------------------------
# Master Encryption Key
# -----------------------------
MASTER_KEY=${results.secrets.MASTER_KEY}

# -----------------------------
# Supabase Configuration
# -----------------------------
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# -----------------------------
# Google Maps API
# -----------------------------
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# -----------------------------
# Email Configuration
# -----------------------------
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# -----------------------------
# Application Settings
# -----------------------------
NODE_ENV=production
PORT=3000

# =================================================================
# SECURITY NOTES:
# 1. Keep this file secure and never commit to version control
# 2. Use different secrets for production and development
# 3. Rotate secrets regularly (every 90 days recommended)
# 4. Delete plaintext passwords after initial setup
# =================================================================
`;
}

// Run the script
main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
