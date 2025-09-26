# Deployment Configuration Files

This directory contains platform-specific deployment configuration files for the SichrPlace application.

## 📁 Files

### ⚡ **Procfile**
Heroku deployment configuration:
```
web: node backend/server.js
```
- Specifies the web process command for Heroku dynos
- Points to the main server entry point
- Used by Heroku's process model for scaling

### 🟢 **.nvmrc**
Node Version Manager configuration:
```
20
```
- Specifies Node.js version 20 for consistent environments
- Used by NVM, Netlify, Vercel, and other platforms
- Ensures deployment consistency across environments

### 📦 **.npmrc**
NPM configuration for security and performance:
```
audit-level=moderate
fund=false
registry=https://registry.npmjs.org/
legacy-peer-deps=false
```

**Configuration Details:**
- **audit-level=moderate**: Security auditing threshold
- **fund=false**: Disables funding messages for cleaner builds
- **registry**: Ensures official NPM registry usage
- **legacy-peer-deps=false**: Enforces modern dependency resolution

## 🚀 **Platform Support**

### 🟣 **Heroku**
- Uses `Procfile` for process definition
- Respects `.nvmrc` for Node.js version
- Applies `.npmrc` settings during build

### 🟢 **Netlify**
- Uses `.nvmrc` for build environment
- Applies `.npmrc` for package installation
- Supports Edge Functions and static hosting

### ▲ **Vercel**
- Respects `.nvmrc` for serverless functions
- Uses `.npmrc` during dependency installation
- Optimized for Next.js and static deployments

### 🔵 **Railway**
- Supports all configuration files
- Uses `Procfile` for process management
- Automatic environment detection

## 📋 **Deployment Best Practices**

1. **Version Consistency**: Use `.nvmrc` to lock Node.js version
2. **Security**: Configure `.npmrc` for audit and registry settings
3. **Process Management**: Define clear start commands in `Procfile`
4. **Environment Variables**: Use platform-specific secret management
5. **Build Optimization**: Configure `.npmrc` for performance

## ⚠️ **Important Notes**

- Original files remain in project root for platform detection
- These are reference copies for documentation and backup
- Modify root files to change actual deployment behavior
- Test changes in staging environments before production

## 🔗 **Related Documentation**

- Environment variables: See `/organized/env/README.md`
- Docker deployment: See `/organized/docker/README.md`
- Configuration files: See `/organized/config/README.md`