# 🤝 Contributing to SichrPlace

Welcome! We're excited that you're interested in contributing to SichrPlace. This document outlines the guidelines for contributing to our apartment viewing platform.

## 📋 Table of Contents
- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Submitting Changes](#submitting-changes)
- [Security Guidelines](#security-guidelines)

## 🤝 Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before contributing.

## 🚀 Getting Started

### Prerequisites
- Node.js 18.x or higher
- npm 8.x or higher
- Supabase account (for database and backend services)
- Railway account (for deployment)
- Gmail account (for email service)

### Local Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YOUR-USERNAME/SichrPlace77.git
   cd SichrPlace77
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Access the application**
   - Frontend: `http://localhost:3000`
   - Backend API: `http://localhost:5000`

## 🔄 Development Workflow

### Branch Strategy
- `main` - Production-ready code
- `develop` - Development branch
- `feature/feature-name` - New features
- `bugfix/bug-description` - Bug fixes
- `hotfix/urgent-fix` - Urgent production fixes

### Workflow Steps
1. Create a new branch from `develop`
2. Make your changes
3. Write/update tests
4. Run tests locally
5. Submit a pull request
6. Address review feedback
7. Merge after approval

## 💻 Coding Standards

### JavaScript/Node.js Guidelines
- Use ES6+ features
- Follow ESLint configuration
- Use meaningful variable names
- Add JSDoc comments for functions
- Handle errors properly
- Use async/await over promises

### File Organization
```
backend/
├── api/           # API endpoints
├── middleware/    # Express middleware
├── models/        # Database models
├── routes/        # Route definitions
├── services/      # Business logic
├── utils/         # Utility functions
└── tests/         # Test files

frontend/
├── css/           # Stylesheets
├── js/            # JavaScript files
└── *.html         # HTML pages
```

### Code Style
- Use 2 spaces for indentation
- Use semicolons
- Use single quotes for strings
- Maximum line length: 100 characters
- Use camelCase for variables and functions
- Use PascalCase for classes

## 🧪 Testing Guidelines

### Backend Testing
- Write unit tests for all services
- Write integration tests for API endpoints
- Use Jest as the testing framework
- Aim for >80% code coverage

### Test Structure
```javascript
describe('EmailService', () => {
  describe('sendRequestConfirmation', () => {
    it('should send confirmation email successfully', async () => {
      // Test implementation
    });
  });
});
```

### Running Tests
```bash
# Backend tests
cd backend
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 📝 Submitting Changes

### Pull Request Guidelines
1. **Use the PR template** - Fill out all sections
2. **Write clear titles** - Use conventional commit format
3. **Provide context** - Explain what and why
4. **Include tests** - All new code should be tested
5. **Update documentation** - Keep README and docs current

### Conventional Commit Format
```
type(scope): description

feat(auth): add two-factor authentication
fix(email): resolve SMTP connection issues
docs(readme): update installation instructions
```

### Types
- `feat` - New features
- `fix` - Bug fixes
- `docs` - Documentation changes
- `style` - Code style changes
- `refactor` - Code refactoring
- `test` - Test additions/modifications
- `chore` - Maintenance tasks

## 🔒 Security Guidelines

### Security Best Practices
- Never commit sensitive data (API keys, passwords)
- Use environment variables for configuration
- Validate all user inputs
- Follow OWASP security guidelines
- Report security vulnerabilities privately

### Sensitive Data
❌ **Never commit:**
- Database credentials
- API keys
- JWT secrets
- Email passwords
- Payment gateway credentials

✅ **Always use:**
- Environment variables
- `.env.example` templates
- Encrypted secrets in CI/CD

## 🎯 Areas for Contribution

### High Priority
- **Security improvements** - Authentication, authorization
- **Performance optimization** - Database queries, caching
- **Email system enhancements** - Templates, delivery
- **Payment integration** - PayPal improvements
- **Video system** - Upload, streaming, security

### Medium Priority
- **UI/UX improvements** - Responsive design, accessibility
- **API documentation** - Swagger/OpenAPI specs
- **Monitoring** - Logging, metrics, alerts
- **Testing** - Increase coverage, E2E tests

### Low Priority
- **Mobile app** - React Native implementation
- **Analytics** - User behavior tracking
- **Internationalization** - Multi-language support

## 📞 Getting Help

### Communication Channels
- **Issues** - Bug reports and feature requests
- **Discussions** - General questions and ideas
- **Email** - sichrplace@gmail.com for urgent matters

### Project Maintainers
- [@omer3kale](https://github.com/omer3kale) - Project Lead

## 📜 License

By contributing to SichrPlace, you agree that your contributions will be licensed under the same license as the project.

---

Thank you for contributing to SichrPlace! 🏠❤️
