# 🔒 Production Environment Variables Security Guide

## 🎯 **CRITICAL: Secure Environment Configuration**

### **📋 Current Security Risk Analysis**
- ⚠️ Environment variables partially configured
- ❌ **RISKS**: Exposed secrets, insecure storage, no rotation
- ❌ **VULNERABILITIES**: API keys in code, no encryption

## 🛡️ **Environment Variables Inventory**

### **🔐 CRITICAL SECRETS (Must Be Secured)**
```bash
# Database
SUPABASE_URL=https://cgkumwtibknfrhyiicoo.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Payment Processing
PAYPAL_CLIENT_ID=AW_live_production_key
PAYPAL_CLIENT_SECRET=EL_live_production_secret

# Email Service  
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GMAIL_APP_PASSWORD=zbtr_fcsc_tqyf_nxhp

# Security
JWT_SECRET=super_secure_random_string_256_chars
ENCRYPTION_KEY=another_super_secure_key_for_data_encryption

# External APIs
GOOGLE_MAPS_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxx
```

### **🌍 NON-SENSITIVE CONFIGURATION**
```bash
# Application Settings
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://sichrplace.com
BACKEND_URL=https://api.sichrplace.com

# Feature Flags
ENABLE_ANALYTICS=true
ENABLE_CHAT=true
ENABLE_NOTIFICATIONS=true
```

## 🔧 **Secure Storage Solutions**

### **Option 1: Hosting Platform Secrets (Recommended)**

#### **Vercel Environment Variables**
```bash
# Vercel CLI setup
npm i -g vercel
vercel login

# Add secrets via CLI
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add PAYPAL_CLIENT_SECRET production
vercel env add JWT_SECRET production

# Or via Vercel Dashboard:
# Project Settings > Environment Variables
```

#### **Railway Environment Variables**  
```bash
# Railway CLI setup
npm install -g @railway/cli
railway login

# Add environment variables
railway variables set SUPABASE_SERVICE_ROLE_KEY=your_secret_key
railway variables set PAYPAL_CLIENT_SECRET=your_secret_key
railway variables set JWT_SECRET=your_secret_key
```

#### **Netlify Environment Variables**
```bash
# Netlify CLI setup
npm install -g netlify-cli
netlify login

# Add environment variables
netlify env:set SUPABASE_SERVICE_ROLE_KEY your_secret_key
netlify env:set PAYPAL_CLIENT_SECRET your_secret_key
netlify env:set JWT_SECRET your_secret_key
```

### **Option 2: Docker Secrets (Advanced)**
```yaml
# docker-compose.production.yml
version: '3.8'
services:
  app:
    image: sichrplace:latest
    environment:
      - NODE_ENV=production
    secrets:
      - supabase_key
      - paypal_secret
      - jwt_secret
    ports:
      - "3000:3000"

secrets:
  supabase_key:
    external: true
  paypal_secret:
    external: true
  jwt_secret:
    external: true
```

### **Option 3: HashiCorp Vault (Enterprise)**
```javascript
// backend/config/vault.js
const vault = require('node-vault')({
  endpoint: process.env.VAULT_ENDPOINT,
  token: process.env.VAULT_TOKEN
});

class SecretManager {
  async getSecret(path) {
    try {
      const result = await vault.read(\`secret/data/\${path}\`);
      return result.data.data;
    } catch (error) {
      console.error('Failed to fetch secret:', error);
      throw error;
    }
  }

  async getSupabaseCredentials() {
    return this.getSecret('supabase');
  }

  async getPayPalCredentials() {
    return this.getSecret('paypal');
  }
}

module.exports = new SecretManager();
```

## 🔐 **Secret Generation & Rotation**

### **Strong Secret Generation**
```javascript
// scripts/generate-secrets.js
const crypto = require('crypto');

function generateSecrets() {
  const secrets = {
    JWT_SECRET: crypto.randomBytes(64).toString('hex'),
    ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
    SESSION_SECRET: crypto.randomBytes(32).toString('hex'),
    API_KEY_SALT: crypto.randomBytes(16).toString('hex')
  };

  console.log('🔐 Generated Production Secrets:');
  console.log('================================');
  Object.entries(secrets).forEach(([key, value]) => {
    console.log(\`\${key}=\${value}\`);
  });

  return secrets;
}

if (require.main === module) {
  generateSecrets();
}

module.exports = { generateSecrets };
```

### **Secret Rotation Strategy**
```javascript
// backend/middleware/secretRotation.js
class SecretRotationManager {
  constructor() {
    this.rotationSchedule = {
      JWT_SECRET: 90, // days
      ENCRYPTION_KEY: 180, // days
      API_KEYS: 365 // days
    };
  }

  async checkRotationNeeded() {
    const lastRotation = await this.getLastRotationDate();
    const now = new Date();
    
    Object.entries(this.rotationSchedule).forEach(([secret, days]) => {
      const rotationDate = new Date(lastRotation[secret]);
      const daysSinceRotation = (now - rotationDate) / (1000 * 60 * 60 * 24);
      
      if (daysSinceRotation >= days) {
        console.warn(\`⚠️ Secret \${secret} needs rotation!\`);
        // Trigger rotation workflow
        this.scheduleRotation(secret);
      }
    });
  }

  async rotateJWTSecret() {
    const newSecret = crypto.randomBytes(64).toString('hex');
    
    // Update environment
    await this.updateEnvironmentVariable('JWT_SECRET', newSecret);
    
    // Invalidate existing tokens (optional)
    await this.invalidateAllTokens();
    
    console.log('✅ JWT Secret rotated successfully');
  }
}
```

## 🛠️ **Environment Configuration Templates**

### **Production .env Template**
```bash
# .env.production
# =================================
# 🔒 PRODUCTION ENVIRONMENT CONFIG
# =================================

# Application
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://sichrplace.com
BACKEND_URL=https://api.sichrplace.com

# 🗄️ Database (Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...

# 🔐 Security
JWT_SECRET=GENERATE_WITH_CRYPTO_RANDOMBYTES_64_HEX
ENCRYPTION_KEY=GENERATE_WITH_CRYPTO_RANDOMBYTES_32_HEX
SESSION_SECRET=GENERATE_WITH_CRYPTO_RANDOMBYTES_32_HEX

# 💳 PayPal (Live)
PAYPAL_CLIENT_ID=AW_LIVE_CLIENT_ID_HERE
PAYPAL_CLIENT_SECRET=EL_LIVE_SECRET_HERE
PAYPAL_ENVIRONMENT=live
PAYPAL_BASE_URL=https://api-m.paypal.com

# 📧 SendGrid Email
SENDGRID_API_KEY=SG.SENDGRID_API_KEY_HERE
SENDGRID_FROM_EMAIL=noreply@sichrplace.com
SENDGRID_FROM_NAME=SichrPlace

# 🗺️ Google Maps
GOOGLE_MAPS_API_KEY=AIzaSy_GOOGLE_MAPS_API_KEY_HERE

# 📊 Analytics
GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
HOTJAR_ID=YOUR_HOTJAR_ID

# 🔔 Push Notifications
VAPID_PUBLIC_KEY=BCxxxxxxxxxxxxxxxx
VAPID_PRIVATE_KEY=xxxxxxxxxxxxxxxx
VAPID_SUBJECT=mailto:admin@sichrplace.com

# 🛡️ Security Headers
CORS_ORIGIN=https://sichrplace.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# 📈 Monitoring
SENTRY_DSN=https://xxxxxx@sentry.io/xxxxxx
LOG_LEVEL=info
```

### **Development .env Template**
```bash
# .env.development
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3000

# Use development/sandbox credentials
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_CLIENT_ID=AW_SANDBOX_CLIENT_ID
PAYPAL_CLIENT_SECRET=EL_SANDBOX_SECRET

# Development email (can use Gmail)
GMAIL_USER=sichrplace@gmail.com
GMAIL_APP_PASSWORD=zbtr_fcsc_tqyf_nxhp

# Weaker secrets for development (but still secure)
JWT_SECRET=dev_jwt_secret_still_should_be_strong
```

## 🔍 **Environment Validation**

### **Startup Validation Script**
```javascript
// backend/config/validateEnv.js
const requiredEnvVars = {
  production: [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'JWT_SECRET',
    'PAYPAL_CLIENT_ID',
    'PAYPAL_CLIENT_SECRET',
    'SENDGRID_API_KEY'
  ],
  development: [
    'SUPABASE_URL',
    'JWT_SECRET'
  ]
};

function validateEnvironment() {
  const env = process.env.NODE_ENV || 'development';
  const required = requiredEnvVars[env] || requiredEnvVars.development;
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(\`  - \${key}\`));
    process.exit(1);
  }

  // Validate secret strength
  if (env === 'production') {
    validateSecretStrength();
  }

  console.log('✅ Environment validation passed');
}

function validateSecretStrength() {
  const jwtSecret = process.env.JWT_SECRET;
  
  if (jwtSecret.length < 32) {
    console.error('❌ JWT_SECRET too short (minimum 32 characters)');
    process.exit(1);
  }

  if (jwtSecret === 'your_jwt_secret_here' || jwtSecret.includes('dev')) {
    console.error('❌ JWT_SECRET appears to be a default/development value');
    process.exit(1);
  }
}

module.exports = { validateEnvironment };
```

### **Runtime Security Checks**
```javascript
// backend/middleware/securityCheck.js
const crypto = require('crypto');

class SecurityCheck {
  static checkEnvironmentSecurity() {
    const checks = [
      this.checkJWTSecretStrength(),
      this.checkHTTPSInProduction(),
      this.checkSecretExposure(),
      this.checkDefaultPasswords()
    ];

    const failures = checks.filter(check => !check.passed);
    
    if (failures.length > 0) {
      console.error('🚨 Security checks failed:');
      failures.forEach(failure => console.error(\`  - \${failure.message}\`));
      
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    }

    console.log('🛡️ Security checks passed');
  }

  static checkJWTSecretStrength() {
    const secret = process.env.JWT_SECRET;
    const isStrong = secret && secret.length >= 32 && !/^(test|dev|demo)/.test(secret);
    
    return {
      passed: isStrong,
      message: 'JWT secret is too weak or uses default value'
    };
  }

  static checkHTTPSInProduction() {
    if (process.env.NODE_ENV !== 'production') return { passed: true };
    
    const frontendUrl = process.env.FRONTEND_URL;
    const backendUrl = process.env.BACKEND_URL;
    const hasHTTPS = frontendUrl?.startsWith('https://') && backendUrl?.startsWith('https://');
    
    return {
      passed: hasHTTPS,
      message: 'Production environment must use HTTPS'
    };
  }

  static checkSecretExposure() {
    // Check for common secret exposure patterns
    const secrets = ['JWT_SECRET', 'PAYPAL_CLIENT_SECRET', 'SENDGRID_API_KEY'];
    const exposed = secrets.find(secret => {
      const value = process.env[secret];
      return value && (value.includes('example') || value.includes('your_') || value.includes('xxx'));
    });
    
    return {
      passed: !exposed,
      message: \`Detected exposed or example secret: \${exposed}\`
    };
  }
}

module.exports = SecurityCheck;
```

## 🚀 **Deployment Scripts**

### **Secure Deployment Script**
```bash
#!/bin/bash
# deploy-production.sh

set -e

echo "🚀 Starting secure production deployment..."

# 1. Validate environment
echo "🔍 Validating environment variables..."
node scripts/validate-env.js

# 2. Generate missing secrets
echo "🔐 Generating missing secrets..."
node scripts/generate-secrets.js --check

# 3. Test database connection
echo "🗄️ Testing database connection..."
node scripts/test-db-connection.js

# 4. Test external services
echo "🧪 Testing external services..."
node scripts/test-services.js

# 5. Deploy to platform
echo "📦 Deploying to production..."
if [ "$PLATFORM" = "vercel" ]; then
    vercel --prod
elif [ "$PLATFORM" = "railway" ]; then
    railway up
elif [ "$PLATFORM" = "netlify" ]; then
    netlify deploy --prod
fi

# 6. Post-deployment verification
echo "✅ Verifying deployment..."
node scripts/post-deploy-check.js

echo "🎉 Production deployment complete!"
```

### **Environment Sync Script**
```javascript
// scripts/sync-env.js
const platforms = {
  vercel: {
    set: (key, value) => \`vercel env add \${key} "\${value}" production\`,
    list: () => 'vercel env ls'
  },
  railway: {
    set: (key, value) => \`railway variables set \${key}="\${value}"\`,
    list: () => 'railway variables'
  },
  netlify: {
    set: (key, value) => \`netlify env:set \${key} "\${value}"\`,
    list: () => 'netlify env:list'
  }
};

async function syncEnvironment(platform, envFile = '.env.production') {
  const fs = require('fs');
  const { execSync } = require('child_process');
  
  const envContent = fs.readFileSync(envFile, 'utf8');
  const envVars = envContent
    .split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const [key, ...valueParts] = line.split('=');
      return { key, value: valueParts.join('=') };
    });

  console.log(\`🔄 Syncing \${envVars.length} variables to \${platform}...\`);

  envVars.forEach(({ key, value }) => {
    const command = platforms[platform].set(key, value);
    console.log(\`Setting \${key}...\`);
    try {
      execSync(command, { stdio: 'inherit' });
    } catch (error) {
      console.error(\`Failed to set \${key}:`, error.message);
    }
  });

  console.log('✅ Environment sync complete!');
}

module.exports = { syncEnvironment };
```

## 📊 **Security Monitoring**

### **Secret Rotation Alerts**
```javascript
// backend/monitoring/secretMonitoring.js
class SecretMonitoring {
  constructor() {
    this.alerts = [];
  }

  async checkSecretHealth() {
    const checks = [
      await this.checkSecretAge(),
      await this.checkSecretUsage(),
      await this.checkSecretExposure()
    ];

    const alerts = checks.filter(check => check.alert);
    
    if (alerts.length > 0) {
      await this.sendSecurityAlert(alerts);
    }

    return alerts;
  }

  async checkSecretAge() {
    const jwtSecretAge = await this.getSecretAge('JWT_SECRET');
    const shouldRotate = jwtSecretAge > 90; // days

    return {
      alert: shouldRotate,
      message: \`JWT Secret is \${jwtSecretAge} days old\`,
      severity: shouldRotate ? 'warning' : 'info'
    };
  }

  async sendSecurityAlert(alerts) {
    const emailService = require('../services/emailService');
    
    const subject = '🚨 SichrPlace Security Alert';
    const html = \`
      <h2>Security Alert</h2>
      <p>The following security issues require attention:</p>
      <ul>
        \${alerts.map(alert => \`<li>\${alert.message}</li>\`).join('')}
      </ul>
    \`;

    await emailService.sendEmail(
      process.env.ADMIN_EMAIL,
      subject,
      html
    );
  }
}
```

## ✅ **Security Checklist**

### **Pre-Production Checklist**
- [ ] All secrets generated with crypto.randomBytes()
- [ ] No default or example values in production
- [ ] Environment variables stored securely (not in code)
- [ ] HTTPS enforced for all production URLs
- [ ] Secrets rotation schedule established
- [ ] Environment validation script passes
- [ ] Security monitoring alerts configured
- [ ] Backup strategy for secrets implemented

### **Post-Deployment Checklist**
- [ ] All services connecting successfully
- [ ] No secret exposure in logs
- [ ] Environment variable access restricted
- [ ] Security headers properly configured
- [ ] Monitoring alerts active
- [ ] Secret rotation documented

## 📈 **Timeline & Effort**

| **Task** | **Duration** | **Priority** |
|----------|--------------|-------------|
| Secret generation | 15 minutes | HIGH |
| Platform configuration | 30 minutes | HIGH |
| Validation scripts | 45 minutes | MEDIUM |
| Security monitoring | 30 minutes | MEDIUM |
| Documentation | 20 minutes | LOW |

**Total Time: 2 hours 20 minutes**

**🎯 Goal: 100% secure environment configuration within 1 day**