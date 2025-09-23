#!/usr/bin/env node

/**
 * 🔐 SichrPlace Security Environment Validator
 * Validates environment configuration for production readiness
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SecurityValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.passed = [];
  }

  /**
   * Run complete security validation
   */
  async validate() {
    console.log('🔐 SichrPlace Security Environment Validator\n');
    
    this.checkEnvironmentFiles();
    this.checkGitIgnore();
    this.checkSecretStrength();
    this.checkNetlifyConfig();
    this.checkSecurityHeaders();
    
    this.printResults();
    
    return {
      errors: this.errors,
      warnings: this.warnings,
      passed: this.passed,
      isSecure: this.errors.length === 0
    };
  }

  /**
   * Check environment files for security issues
   */
  checkEnvironmentFiles() {
    const envPath = path.join(__dirname, '../.env');
    
    if (!fs.existsSync(envPath)) {
      this.warnings.push('No .env file found - ensure environment variables are set in Netlify');
      return;
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    
    // Check for production secrets in development env
    const dangerousPatterns = [
      { pattern: /SUPABASE_SERVICE_ROLE_KEY=eyJ/, message: 'Production Supabase service key detected in .env' },
      { pattern: /PAYPAL_CLIENT_SECRET=[A-Za-z0-9]{80,}/, message: 'Production PayPal secret detected in .env' },
      { pattern: /GMAIL_APP_PASSWORD=[a-z]{4}\s[a-z]{4}\s[a-z]{4}\s[a-z]{4}/, message: 'Production Gmail password detected in .env' },
      { pattern: /GOOGLE_MAPS_API_KEY=AIza[A-Za-z0-9_-]{35}/, message: 'Production Google Maps key detected in .env' },
      { pattern: /JWT_SECRET=.*(?!dev-)/, message: 'Check JWT secret - ensure it uses dev- prefix for development' }
    ];

    dangerousPatterns.forEach(({ pattern, message }) => {
      if (pattern.test(envContent)) {
        this.errors.push(message);
      }
    });

    // Check for missing required variables
    const requiredVars = [
      'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
      'JWT_SECRET', 'NODE_ENV', 'FRONTEND_URL'
    ];

    requiredVars.forEach(varName => {
      if (!envContent.includes(`${varName}=`)) {
        this.warnings.push(`Missing environment variable: ${varName}`);
      }
    });

    if (this.errors.length === 0) {
      this.passed.push('Environment file security check passed');
    }
  }

  /**
   * Check .gitignore for proper exclusions
   */
  checkGitIgnore() {
    const gitignorePath = path.join(__dirname, '../.gitignore');
    
    if (!fs.existsSync(gitignorePath)) {
      this.errors.push('No .gitignore file found');
      return;
    }

    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    
    const requiredExclusions = [
      '.env',
      '.env.local',
      '.env.production',
      'NETLIFY_ENV_VARS.txt'
    ];

    requiredExclusions.forEach(exclusion => {
      if (!gitignoreContent.includes(exclusion)) {
        this.warnings.push(`Missing .gitignore entry: ${exclusion}`);
      }
    });

    this.passed.push('.gitignore security check passed');
  }

  /**
   * Check secret strength and security
   */
  checkSecretStrength() {
    const envPath = path.join(__dirname, '../.env');
    
    if (!fs.existsSync(envPath)) {
      return;
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    
    // Extract JWT secret for validation
    const jwtMatch = envContent.match(/JWT_SECRET=(.+)/);
    if (jwtMatch) {
      const jwtSecret = jwtMatch[1].trim();
      
      if (jwtSecret.length < 32) {
        this.warnings.push('JWT secret should be at least 32 characters long');
      }
      
      if (jwtSecret.startsWith('dev-')) {
        this.passed.push('Development JWT secret properly prefixed');
      } else if (!jwtSecret.includes('dev') && jwtSecret.length > 50) {
        this.warnings.push('Possible production JWT secret in development environment');
      }
    }

    this.passed.push('Secret strength validation completed');
  }

  /**
   * Check Netlify configuration security
   */
  checkNetlifyConfig() {
    const netlifyTomlPath = path.join(__dirname, '../netlify.toml');
    
    if (!fs.existsSync(netlifyTomlPath)) {
      this.warnings.push('No netlify.toml found - ensure proper configuration');
      return;
    }

    const netlifyContent = fs.readFileSync(netlifyTomlPath, 'utf8');
    
    // Check for security headers
    if (netlifyContent.includes('X-Frame-Options')) {
      this.passed.push('Security headers configured in netlify.toml');
    } else {
      this.warnings.push('Consider adding security headers to netlify.toml');
    }

    // Check for proper redirects
    if (netlifyContent.includes('_redirects')) {
      this.passed.push('Redirect configuration found');
    }
  }

  /**
   * Check for security headers in functions
   */
  checkSecurityHeaders() {
    const functionsDir = path.join(__dirname, '../netlify/functions');
    
    if (!fs.existsSync(functionsDir)) {
      this.warnings.push('No Netlify functions directory found');
      return;
    }

    const functionFiles = fs.readdirSync(functionsDir).filter(f => f.endsWith('.mjs'));
    let headerCheckCount = 0;

    functionFiles.slice(0, 5).forEach(file => {
      const filePath = path.join(functionsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      if (content.includes('X-Frame-Options') || content.includes('Strict-Transport-Security')) {
        headerCheckCount++;
      }
    });

    if (headerCheckCount > 0) {
      this.passed.push(`Security headers found in ${headerCheckCount} function(s)`);
    } else {
      this.warnings.push('No security headers found in Netlify functions');
    }
  }

  /**
   * Print validation results
   */
  printResults() {
    console.log('\n📊 Security Validation Results\n');
    
    if (this.passed.length > 0) {
      console.log('✅ PASSED:');
      this.passed.forEach(item => console.log(`   ${item}`));
      console.log('');
    }

    if (this.warnings.length > 0) {
      console.log('⚠️  WARNINGS:');
      this.warnings.forEach(item => console.log(`   ${item}`));
      console.log('');
    }

    if (this.errors.length > 0) {
      console.log('❌ ERRORS:');
      this.errors.forEach(item => console.log(`   ${item}`));
      console.log('');
    }

    const totalChecks = this.passed.length + this.warnings.length + this.errors.length;
    const securityScore = Math.round((this.passed.length / totalChecks) * 100);
    
    console.log(`🛡️  Security Score: ${securityScore}%`);
    
    if (this.errors.length === 0) {
      console.log('✅ Environment is secure for production deployment!');
    } else {
      console.log('❌ Fix security errors before production deployment!');
    }
    
    console.log('\n' + '='.repeat(60));
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🔐 Starting SichrPlace Security Validation...\n');
  const validator = new SecurityValidator();
  validator.validate().then(result => {
    process.exit(result.isSecure ? 0 : 1);
  }).catch(error => {
    console.error('Validation error:', error);
    process.exit(1);
  });
}

export default SecurityValidator;