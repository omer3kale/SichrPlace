# Backend Integration Tests

This directory contains integration tests for the SichrPlace backend API.

## 🚀 Quick Start

### 1. Seed Test Users (One-Time Setup)

Before running tests, you need to create test users in your Supabase database:

```bash
# Open Supabase SQL Editor
# Navigate to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql

# Copy and run the contents of:
backend/tests/seed_test_users.sql
```

This creates 5 test users:
- `admin@sichrplace.com` / `Admin123!`
- `tenant1@example.com` / `Tenant123!`
- `tenant2@example.com` / `Tenant123!`
- `landlord1@example.com` / `Landlord123!`
- `landlord2@example.com` / `Landlord123!`

### 2. Run Tests

```bash
cd backend
npm test
```

## 📁 Test Coverage

### 🏥 Health Check (`health.test.js`)
- Tests the `/api/health` endpoint
- Verifies API is running and database connection
- Response time validation

### 🔐 Authentication (`auth.test.js`)
- User registration
- User login
- User logout
- Password validation
- Error handling for invalid credentials

### 👨‍💼 Admin Endpoints (`admin.test.js`)
- Admin payment management
- Refund request handling
- Support ticket management
- Permission-based access control

### 🛍️ Marketplace (`marketplace.test.js`)
- Listing creation and retrieval
- Category and status filtering
- Contact messaging
- Chat functionality
- Authentication requirements

### 📋 GDPR Compliance (`gdpr.test.js`)
- User data export
- Data deletion requests
- Consent management
- Consent purpose retrieval

### 💳 Payments (`payment.test.js`)
- Payment transaction creation
- Payment history
- Refund requests
- Amount validation

## Running Tests

### Run all tests
```bash
cd backend
npm test
```

### Run specific test file
```bash
npm test -- health.test.js
npm test -- auth.test.js
npm test -- admin.test.js
npm test -- marketplace.test.js
npm test -- gdpr.test.js
npm test -- payment.test.js
```

### Run with coverage
```bash
npm run test:coverage
```

### Run in watch mode
```bash
npm test -- --watch
```

## Prerequisites

Before running tests, ensure:

1. **Environment variables are set** in `backend/.env`:
   ```bash
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   DATABASE_URL=your_database_url
   JWT_SECRET=your_jwt_secret
   ```

2. **Database is populated with test data**:
   - Run migration: `supabase/migrations/20251006_create_all_required_tables.sql`
   - Ensure test users exist (admin, tenants, landlords)

3. **Backend dependencies are installed**:
   ```bash
   npm install
   ```

## Test User Credentials

The tests expect these test users to exist in your database:

- **Admin**: `admin@sichrplace.com` / `Admin123!`
- **Tenant 1**: `tenant1@example.com` / `Tenant123!`
- **Landlord 1**: `landlord1@example.com` / `Landlord123!`

These should be created via your database migration scripts.

## Test Structure

Each test file follows this pattern:

1. **Setup**: Login to get authentication tokens
2. **Tests**: Execute API calls and verify responses
3. **Cleanup**: Remove test data created during tests

## Expected Results

All tests should pass if:
- ✅ Database is properly configured
- ✅ All tables exist (31 tables)
- ✅ RLS policies are applied
- ✅ Test data is populated
- ✅ Environment variables are set
- ✅ Backend server can connect to database

## Troubleshooting

### Tests fail with "401 Unauthorized"
- Check that test user credentials exist in database
- Verify JWT_SECRET is set correctly
- Ensure auth endpoints are working

### Tests fail with "500 Internal Server Error"
- Check backend logs for detailed errors
- Verify database connection
- Ensure all environment variables are set

### Tests fail with "Cannot find module"
- Run `npm install` in backend directory
- Check that all dependencies are installed

### Tests skip with "⚠️ Skipping test"
- Test user credentials not available
- Required data not in database
- This is normal for optional tests

## Writing New Tests

When adding new endpoints, create tests following this template:

```javascript
describe('Your Endpoint', () => {
  let userToken;

  beforeAll(async () => {
    // Login to get token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'Test123!' });
    userToken = loginResponse.body.access_token;
  });

  describe('GET /api/your-endpoint', () => {
    it('should return expected data', async () => {
      const response = await request(app)
        .get('/api/your-endpoint')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('expectedField');
    });
  });
});
```

## CI/CD Integration

These tests can be integrated into your CI/CD pipeline:

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: |
    cd backend
    npm install
    npm test
```

## Test Reports

Test results are output to:
- Console (for local development)
- JUnit XML format (for CI/CD)
- Coverage reports in `backend/coverage/`

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Supabase Testing Guide](https://supabase.com/docs/guides/testing)

---

**Last Updated**: October 12, 2025  
**Status**: ✅ All test files created and ready to run
