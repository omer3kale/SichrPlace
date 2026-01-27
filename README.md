# 🏠 SichrPlace - Secure Apartment Rental Platform

[![Tests](https://img.shields.io/badge/tests-82%2F82-brightgreen)](https://github.com/omer3kale/sichrplace)
[![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)](https://github.com/omer3kale/sichrplace)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-green)](https://nodejs.org/)

> A modern, secure apartment rental platform connecting landlords and tenants with integrated payments, messaging, and verification systems.

## ✨ Features

### 🏡 **Core Functionality**
- **Apartment Listings** - Advanced search with filters and location-based results
- **Viewing Requests** - Schedule and manage property viewings
- **Secure Messaging** - Real-time chat between landlords and tenants  
- **Payment Processing** - Integrated PayPal payments for deposits and fees
- **User Management** - Role-based authentication and profile management

### 🔒 **Security & Compliance**
- **Enterprise-grade Security** - JWT authentication, rate limiting, input validation
- **GDPR Compliant** - Data protection and privacy controls
- **Multi-factor Authentication** - Enhanced account security
- **Audit Logging** - Complete activity tracking

### 📊 **Monitoring & Analytics**
- **Real-time Monitoring** - Application health and performance tracking
- **Error Tracking** - Comprehensive error logging and alerting
- **User Analytics** - Engagement and conversion tracking
- **Payment Analytics** - Transaction monitoring and reporting

## 🚀 Quick Start

### Prerequisites
- Node.js 20.x or higher
- PostgreSQL (via Supabase)
- PayPal Developer Account (for payments)
- Gmail Account (for email notifications)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/omer3kale/sichrplace.git
   cd sichrplace
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd backend && npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```
   
   **Required environment variables:**
   - `JWT_SECRET` - Generate with: `node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"`
   - `ADMIN_PASSWORD` - Secure admin password for test environments
   - `TEST_USER_PASSWORD` - Password for test user accounts
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
   - `EMAIL_USER` - Gmail address for sending emails
   - `EMAIL_PASS` - Gmail app password
   
   **🔒 Security Setup:**
   
   For production deployments, run the security toolkit to generate bcrypt password hashes:
   ```bash
   cd scripts
   npm install
   node hash-all-secrets.js
   ```
   
   This will:
   - Generate secure bcrypt hashes for all passwords
   - Create a new JWT secret
   - Generate SQL migration file for database updates
   - Provide environment variable template
   
   See [SECURITY_MIGRATION_GUIDE.md](SECURITY_MIGRATION_GUIDE.md) for complete setup instructions.

4. **Set up the database**
   ```bash
   # Run the clean schema in Supabase SQL Editor
   # File: supabase_clean_schema.sql
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:3000`

## 🏗️ Architecture

### Backend (Node.js/Express)
- **API Server** - RESTful API with comprehensive endpoints
- **Authentication** - JWT-based with role management
- **Database** - PostgreSQL via Supabase
- **Payments** - PayPal SDK integration
- **Email** - Gmail SMTP for notifications

### Frontend (Vanilla JS)
- **Modern ES6+** - Clean, maintainable JavaScript
- **Responsive Design** - Mobile-first approach
- **Real-time Updates** - WebSocket integration for messaging
- **PWA Ready** - Service worker and offline capabilities

### Infrastructure
- **Database** - Supabase (PostgreSQL)
- **Hosting** - Netlify (Frontend) / Railway (Backend)
- **CDN** - Netlify Edge
- **Monitoring** - Custom monitoring dashboard

## 📚 Documentation

### API Documentation
- **OpenAPI Spec** - [swagger.json](backend/swagger.json)
- **Live Docs** - Available at `/api/docs` (when running)
- **Postman Collection** - [docs/api/](docs/api/)

### Development Guides
- **Setup Guide** - [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
- **Contributing** - [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)
- **Deployment** - [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## 🧪 Testing

```bash
# Run all tests
npm test

# Backend tests only
cd backend && npm test

# Run with coverage
npm run test:coverage

# Integration tests
npm run test:integration
```

**Test Results**: 82/82 tests passing ✅

## 🚀 Deployment

### Production Deployment
```bash
# Automated deployment
./scripts/deploy-production.sh

# Manual deployment steps in docs/DEPLOYMENT.md
```

### Environment Configuration
- **Development** - Local development with hot reloading
- **Staging** - Pre-production testing environment  
- **Production** - Live platform with monitoring

## 🔧 Configuration

### Required Environment Variables
```env
# Database (Supabase)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key

# Authentication
JWT_SECRET=your_jwt_secret

# PayPal (Payments)
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_MODE=sandbox # or 'live' for production

# Email (Gmail SMTP)
GMAIL_USER=your_gmail_address
GMAIL_APP_PASSWORD=your_app_password

# Security
SESSION_SECRET=your_session_secret
```

## 📊 Monitoring

### Health Checks
- **API Health** - `GET /api/health`
- **Database** - `GET /api/health/db`
- **External Services** - `GET /api/health/services`

### Monitoring Dashboard
- **Metrics** - `GET /api/metrics`
- **Performance** - Real-time response times
- **Error Tracking** - Automated error logging
- **Payment Analytics** - Transaction monitoring

## 🛡️ Security

### Implemented Security Features
- **Authentication** - JWT with refresh tokens
- **Authorization** - Role-based access control
- **Input Validation** - Comprehensive data sanitization
- **Rate Limiting** - API endpoint protection
- **CSRF Protection** - Cross-site request forgery prevention
- **Security Headers** - Helmet.js implementation
- **SQL Injection Prevention** - Parameterized queries

### Security Auditing
```bash
# Security audit
npm run security:audit

# Dependency check
npm run security:check
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for detailed guidelines.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Getting Help
- **Documentation** - Check the [docs/](docs/) directory
- **Issues** - [GitHub Issues](https://github.com/omer3kale/sichrplace/issues)
- **Email** - omer3kale@gmail.com

### Known Issues
- See [GitHub Issues](https://github.com/omer3kale/sichrplace/issues) for current known issues

## 🎯 Roadmap

### Phase 1 - Core Platform ✅
- [x] User authentication and management
- [x] Apartment listings and search
- [x] Viewing request system
- [x] Payment integration
- [x] Messaging system

### Phase 2 - Enhanced Features 🚧
- [ ] Mobile app (React Native)
- [ ] Advanced filtering and AI recommendations
- [ ] Video tours and virtual viewing
- [ ] Multi-language support
- [ ] Advanced analytics dashboard

### Phase 3 - Scale & Optimize 📅
- [ ] Multi-tenant architecture
- [ ] API rate limiting tiers
- [ ] Advanced caching strategies
- [ ] Global CDN optimization
- [ ] Enterprise features

## 🌟 Acknowledgments

- **Supabase** - Database and authentication backend
- **PayPal** - Payment processing integration
- **Netlify** - Frontend hosting and edge functions
- **Node.js Community** - Excellent ecosystem and tools

---

**Built with ❤️ by the SichrPlace Team**

*Making apartment rental simple, secure, and transparent.*