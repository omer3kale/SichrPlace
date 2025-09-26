# Docker Configuration Files

This directory contains all Docker-related configuration files for the SichrPlace application.

## 📁 Files

### 🐳 **Dockerfile**
Production-ready multi-stage Docker build configuration:
- **Base Stage**: Node.js 18 Alpine with security hardening
- **Dependencies Stage**: Production dependency installation
- **Builder Stage**: Application build process
- **Production Stage**: Optimized runtime environment

**Key Features:**
- Multi-stage build for minimal image size
- Non-root user for security
- Health check endpoints
- Alpine Linux for reduced attack surface
- Proper signal handling with dumb-init

### 🚫 **.dockerignore**
Comprehensive Docker ignore patterns to exclude:
- Node.js artifacts (node_modules, logs, cache)
- Development files (tests, documentation, IDE files)
- Security-sensitive files (environment variables, certificates)
- Build artifacts and temporary files
- Version control and CI/CD files

### 🌐 **nginx.conf**
Production Nginx configuration for frontend serving:
- **Performance**: Gzip compression, caching, keepalive
- **Security**: Rate limiting, security headers, token hiding
- **Routing**: API proxy, static file serving, error handling
- **Monitoring**: Health check endpoints, logging

## 🚀 **Usage**

### Build Production Image
```bash
docker build -t sichrplace:latest .
```

### Run with Docker Compose
```bash
docker-compose up -d
```

### Local Development with Docker
```bash
docker run -p 3001:3001 -v $(pwd):/app sichrplace:dev
```

## 🔐 **Security Features**

1. **Multi-stage builds** - Minimize attack surface
2. **Non-root execution** - Reduced privilege escalation risk  
3. **Health checks** - Container monitoring and reliability
4. **Rate limiting** - DDoS and abuse protection
5. **Security headers** - XSS, clickjacking, and MITM protection

## 📋 **Best Practices**

- Use `.dockerignore` to exclude sensitive files
- Regular base image updates for security patches
- Health checks for container orchestration
- Proper signal handling for graceful shutdowns
- Resource limits in production deployments

## ⚠️ **Important Notes**

- Original files remain in project root for Docker functionality
- These are reference copies for documentation and backup
- Modify root files for actual container builds
- Test changes in development environment first