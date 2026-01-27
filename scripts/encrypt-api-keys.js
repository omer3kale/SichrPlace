#!/usr/bin/env node
/**
 * Security Toolkit - API Key Encryption Utility
 * 
 * This script encrypts sensitive API keys using AES-256-GCM encryption
 * for secure storage and transmission.
 * 
 * Usage: node scripts/encrypt-api-keys.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Configuration
const ALGORITHM = 'aes-256-gcm';
const OUTPUT_DIR = path.join(__dirname, '../', 'tmp');

/**
 * Encrypt data using AES-256-GCM
 */
function encrypt(text, masterKey) {
  try {
    // Convert base64 master key to buffer
    const key = Buffer.from(masterKey, 'base64');
    
    // Generate random IV
    const iv = crypto.randomBytes(16);
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt the text
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get auth tag
    const authTag = cipher.getAuthTag();
    
    // Return encrypted data with IV and auth tag
    return {
      encrypted: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw error;
  }
}

/**
 * Decrypt data using AES-256-GCM
 */
function decrypt(encryptedData, masterKey) {
  try {
    // Convert base64 master key to buffer
    const key = Buffer.from(masterKey, 'base64');
    
    // Convert hex strings back to buffers
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');
    const encrypted = encryptedData.encrypted;
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt the text
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw error;
  }
}

/**
 * Generate a master encryption key
 */
function generateMasterKey() {
  return crypto.randomBytes(32).toString('base64');
}

/**
 * Main execution function
 */
async function main() {
  console.log('🔐 SichrPlace Security Toolkit - API Key Encryptor');
  console.log('='.repeat(60));
  console.log('');

  // Create output directory if it doesn't exist
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Generate or use existing master key
  console.log('🔑 Checking for master key...');
  let masterKey;
  const hashedSecretsPath = path.join(OUTPUT_DIR, 'hashed-secrets.json');
  
  if (fs.existsSync(hashedSecretsPath)) {
    const hashedSecrets = JSON.parse(fs.readFileSync(hashedSecretsPath, 'utf8'));
    masterKey = hashedSecrets.secrets.MASTER_KEY;
    console.log('  ✅ Using existing master key from hashed-secrets.json\n');
  } else {
    masterKey = generateMasterKey();
    console.log('  ✅ Generated new master key\n');
  }

  // Example API keys to encrypt (placeholder values)
  const apiKeys = {
    SUPABASE_URL: process.env.SUPABASE_URL || 'https://example.supabase.co',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'your_supabase_anon_key_here',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'your_supabase_service_role_key_here',
    GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || 'your_google_maps_api_key_here',
    EMAIL_PASS: process.env.EMAIL_PASS || 'your_email_app_password_here'
  };

  const results = {
    timestamp: new Date().toISOString(),
    algorithm: ALGORITHM,
    masterKey: masterKey,
    encryptedKeys: {}
  };

  console.log('🔒 Encrypting API keys...\n');

  // Encrypt each API key
  for (const [key, value] of Object.entries(apiKeys)) {
    if (value && !value.startsWith('your_')) {
      console.log(`  Processing ${key}...`);
      const encrypted = encrypt(value, masterKey);
      results.encryptedKeys[key] = encrypted;
      console.log(`  ✅ Encrypted\n`);
    } else {
      console.log(`  ⏭️  Skipping ${key} (placeholder value)\n`);
    }
  }

  // Save encrypted results
  const outputFile = path.join(OUTPUT_DIR, 'encrypted-api-keys.json');
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`💾 Encrypted keys saved to: ${outputFile}\n`);

  // Test encryption/decryption
  console.log('🧪 Testing encryption/decryption...');
  const testKey = 'TEST_KEY';
  const testValue = 'test-secret-value-12345';
  const testEncrypted = encrypt(testValue, masterKey);
  const testDecrypted = decrypt(testEncrypted, masterKey);
  
  if (testValue === testDecrypted) {
    console.log('  ✅ Encryption/Decryption test PASSED\n');
  } else {
    console.log('  ❌ Encryption/Decryption test FAILED\n');
    process.exit(1);
  }

  // Generate decryption example
  const decryptionExample = generateDecryptionExample(masterKey);
  const exampleFile = path.join(OUTPUT_DIR, 'decryption-example.js');
  fs.writeFileSync(exampleFile, decryptionExample);
  console.log(`📝 Decryption example saved to: ${exampleFile}\n`);

  // Display summary
  console.log('='.repeat(60));
  console.log('✅ API Key Encryption Complete!\n');
  console.log('📌 Next Steps:');
  console.log('   1. Store MASTER_KEY in a secure location (password manager)');
  console.log('   2. Use encrypted keys in secure storage systems');
  console.log('   3. Implement decryption in your application code');
  console.log('   4. Review decryption-example.js for implementation guide');
  console.log('');
  console.log('⚠️  SECURITY WARNING:');
  console.log('   - Keep MASTER_KEY absolutely secure');
  console.log('   - Encrypted keys are useless without the master key');
  console.log('   - Rotate master key and re-encrypt periodically');
  console.log('   - Delete tmp/ directory after secure backup');
  console.log('='.repeat(60));
}

/**
 * Generate decryption example code
 */
function generateDecryptionExample(masterKey) {
  return `/**
 * API Key Decryption Example
 * 
 * This example shows how to decrypt API keys in your application
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const MASTER_KEY = process.env.MASTER_KEY; // Store securely!

function decrypt(encryptedData, masterKey) {
  try {
    const key = Buffer.from(masterKey, 'base64');
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');
    const encrypted = encryptedData.encrypted;
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw error;
  }
}

// Usage example:
// const encryptedApiKey = {
//   encrypted: '...',
//   iv: '...',
//   authTag: '...'
// };
//
// const apiKey = decrypt(encryptedApiKey, MASTER_KEY);
// console.log('Decrypted API Key:', apiKey);

module.exports = { decrypt };
`;
}

// Run the script
main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
