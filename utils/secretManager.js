import crypto from 'crypto';

/**
 * SecretManager - Enterprise-grade secret management utility
 * Provides encryption, decryption, and validation for sensitive data
 */
class SecretManager {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32;
    this.ivLength = 16;
    this.tagLength = 16;
    
    // Use environment-specific master key
    this.masterKey = this.getMasterKey();
  }

  /**
   * Get or generate master encryption key
   */
  getMasterKey() {
    const envKey = process.env.MASTER_SECRET_KEY;
    if (envKey && envKey.length === 64) { // 32 bytes = 64 hex chars
      return Buffer.from(envKey, 'hex');
    }
    
    // Generate a new key for development (should be set in production)
    const newKey = crypto.randomBytes(this.keyLength);
    console.warn('⚠️  Using generated master key. Set MASTER_SECRET_KEY in production!');
    return newKey;
  }

  /**
   * Encrypt sensitive data with authentication
   * @param {string} plaintext - Data to encrypt
   * @param {string} additionalData - Additional authenticated data (optional)
   * @returns {object} Encrypted data with metadata
   */
  encrypt(plaintext, additionalData = 'sichrplace-auth') {
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipher(this.algorithm, this.masterKey);
      
      if (additionalData) {
        cipher.setAAD(Buffer.from(additionalData, 'utf8'));
      }
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        algorithm: this.algorithm
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt sensitive data with authentication verification
   * @param {object} encryptedData - Data object from encrypt()
   * @param {string} additionalData - Additional authenticated data (must match encryption)
   * @returns {string} Decrypted plaintext
   */
  decrypt(encryptedData, additionalData = 'sichrplace-auth') {
    try {
      const { encrypted, iv, authTag, algorithm } = encryptedData;
      
      if (algorithm !== this.algorithm) {
        throw new Error('Algorithm mismatch');
      }
      
      const decipher = crypto.createDecipher(algorithm, this.masterKey);
      
      if (additionalData) {
        decipher.setAAD(Buffer.from(additionalData, 'utf8'));
      }
      
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Hash API keys for secure storage and comparison
   * @param {string} apiKey - API key to hash
   * @param {string} salt - Optional salt (generated if not provided)
   * @returns {object} Hash and salt
   */
  hashApiKey(apiKey, salt = null) {
    const actualSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(apiKey, actualSalt, 100000, 32, 'sha256').toString('hex');
    
    return {
      hash,
      salt: actualSalt,
      algorithm: 'pbkdf2',
      iterations: 100000
    };
  }

  /**
   * Verify API key against stored hash
   * @param {string} apiKey - API key to verify
   * @param {object} storedHash - Hash object from hashApiKey()
   * @returns {boolean} True if key matches
   */
  verifyApiKey(apiKey, storedHash) {
    try {
      const { hash: computedHash } = this.hashApiKey(apiKey, storedHash.salt);
      return computedHash === storedHash.hash;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate cryptographically secure random strings
   * @param {number} length - Length in bytes (default 32)
   * @param {string} encoding - Encoding format (default 'hex')
   * @returns {string} Random string
   */
  generateSecureSecret(length = 32, encoding = 'hex') {
    return crypto.randomBytes(length).toString(encoding);
  }

  /**
   * Validate secret strength according to security requirements
   * @param {string} secret - Secret to validate
   * @returns {object} Validation result
   */
  validateSecretStrength(secret) {
    const requirements = {
      minLength: 32,
      hasNumbers: /\d/.test(secret),
      hasLowerCase: /[a-z]/.test(secret),
      hasUpperCase: /[A-Z]/.test(secret),
      hasSpecialChars: /[!@#$%^&*(),.?":{}|<>-_=+]/.test(secret)
    };

    const score = Object.values(requirements).filter(req => req === true).length;
    const isValid = secret.length >= requirements.minLength && score >= 4;

    return {
      isValid,
      score: score,
      length: secret.length,
      requirements,
      recommendation: !isValid ? 'Use at least 32 characters with numbers, letters, and special characters' : 'Strong secret'
    };
  }

  /**
   * Generate JWT-compatible secret
   * @returns {string} Strong JWT secret
   */
  generateJWTSecret() {
    return this.generateSecureSecret(32, 'hex');
  }

  /**
   * Generate VAPID keys for push notifications
   * @returns {object} VAPID key pair
   */
  generateVAPIDKeys() {
    // This would integrate with web-push library
    // For now, return a placeholder structure
    return {
      publicKey: this.generateSecureSecret(65, 'base64url'),
      privateKey: this.generateSecureSecret(32, 'base64url')
    };
  }

  /**
   * Secure environment variable loader with validation
   * @param {string} varName - Environment variable name
   * @param {object} options - Loading options
   * @returns {string} Environment variable value
   */
  loadEnvSecret(varName, options = {}) {
    const { required = false, defaultValue = null, validate = false } = options;
    
    const value = process.env[varName] || defaultValue;
    
    if (required && !value) {
      throw new Error(`Required environment variable ${varName} is not set`);
    }
    
    if (validate && value) {
      const validation = this.validateSecretStrength(value);
      if (!validation.isValid) {
        console.warn(`⚠️  Weak secret detected for ${varName}: ${validation.recommendation}`);
      }
    }
    
    return value;
  }

  /**
   * Create secure headers for API responses
   * @param {string} origin - Allowed origin
   * @returns {object} Security headers
   */
  createSecurityHeaders(origin = 'https://www.sichrplace.com') {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.paypal.com https://js.paypal.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://cgkumwtibknfrhyiicoo.supabase.co https://api.paypal.com;",
      'X-Permitted-Cross-Domain-Policies': 'none',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
  }
}

// Export singleton instance
export default new SecretManager();

// Named exports for specific functions
export {
  SecretManager
};