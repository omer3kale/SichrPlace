/**
 * Generate Test User Password Hashes
 * 
 * Run this script to generate bcrypt hashes for test user passwords.
 * Then copy the hashes to seed_test_users.sql
 * 
 * Usage: node backend/tests/generate_test_hashes.js
 */

const bcrypt = require('bcryptjs');

async function generateHashes() {
  console.log('🔐 Generating bcrypt password hashes for test users...\n');
  
  const passwords = {
    'Admin123!': 'admin@sichrplace.com',
    'Tenant123!': 'tenant1@example.com, tenant2@example.com',
    'Landlord123!': 'landlord1@example.com, landlord2@example.com'
  };

  for (const [password, users] of Object.entries(passwords)) {
    const hash = await bcrypt.hash(password, 12);
    console.log(`Password: ${password}`);
    console.log(`Users: ${users}`);
    console.log(`Hash: ${hash}`);
    console.log('---\n');
  }

  console.log('✅ Copy these hashes to backend/tests/seed_test_users.sql');
  console.log('📝 Then run the SQL file in Supabase SQL Editor');
}

generateHashes().catch(console.error);
