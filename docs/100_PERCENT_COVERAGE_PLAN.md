# 🎯 Plan to Achieve 100% Test Coverage

## Current Status
- **Statements**: 98.78% (1136/1150) - **14 uncovered**
- **Branches**: 79.82% (182/228) - **46 uncovered**
- **Functions**: 94.44% (34/36) - **2 uncovered**
- **Lines**: 98.78% (1136/1150) - **14 uncovered**

---

## Strategy to Reach 100%

### Phase 1: Add Missing Tests ✅

#### 1. Profile & Tenant Tests
- [x] Profile endpoints (`tests/integration/profile.test.js`)
- [x] Tenant endpoints (`tests/integration/tenant.test.js`)

#### 2. Error Path Testing
Add tests for error scenarios:
- Database connection failures
- Invalid input validation
- Authentication edge cases
- Rate limiting scenarios

#### 3. Missing Route Tests
- [ ] Admin routes (`admin.test.js` exists but may need expansion)
- [ ] Health check routes
- [ ] Logout endpoint (currently skipped)

### Phase 2: Branch Coverage (79.82% → 100%)

#### Target: 46 uncovered branches

**Common uncovered branches:**
1. **Error handlers** - catch blocks not triggered
2. **Validation branches** - edge cases in input validation
3. **Conditional logic** - if/else paths not tested
4. **Default values** - optional parameter handling

**Action Items:**

```javascript
// Example: Test error paths
describe('Error Handling', () => {
  it('should handle database connection failure', async () => {
    // Mock Supabase to throw error
    supabase.from = jest.fn().mockRejectedValue(new Error('DB Error'));
    const response = await request(app).get('/api/endpoint');
    expect(response.status).toBe(500);
  });

  it('should handle missing required fields', async () => {
    const response = await request(app)
      .post('/api/endpoint')
      .send({}); // Empty body
    expect(response.status).toBe(400);
  });

  it('should handle invalid data types', async () => {
    const response = await request(app)
      .post('/api/endpoint')
      .send({ price: 'not-a-number' });
    expect(response.status).toBe(400);
  });
});
```

### Phase 3: Function Coverage (94.44% → 100%)

#### Target: 2 uncovered functions

**Likely candidates:**
- Utility functions in `/utils`
- Helper methods in services
- Error formatters
- Middleware functions

**Action:** Create unit tests for uncovered functions

```javascript
// tests/unit/utils.test.js
const { helperFunction } = require('../../utils/helpers');

describe('Utility Functions', () => {
  it('should format data correctly', () => {
    expect(helperFunction(input)).toBe(expected);
  });
});
```

### Phase 4: Line Coverage (98.78% → 100%)

#### Target: 14 uncovered lines

**Common uncovered lines:**
- Unreachable error handlers
- Console.log statements in production code
- Dead code that should be removed
- Edge case returns

**Action:** Review and either:
1. Add tests to cover the lines
2. Remove dead code
3. Add `/* istanbul ignore next */` for unreachable code

---

## Implementation Plan

### Step 1: Add Logout Endpoint Test ✅
```javascript
// In auth.test.js
it('should logout successfully', async () => {
  const response = await request(app)
    .post('/auth/logout')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  
  expect(response.body.success).toBe(true);
});
```

### Step 2: Expand Error Testing
Create `tests/integration/error-handling.test.js`:
- Test all 500 error responses
- Test all 400 validation errors
- Test authentication edge cases

### Step 3: Add Unit Tests
Create `tests/unit/` directory:
- `services.test.js` - Test service methods
- `utils.test.js` - Test utility functions
- `middleware.test.js` - Test middleware functions

### Step 4: Mock External Dependencies
- Mock email service properly
- Mock Supabase for error scenarios
- Mock Redis cache

### Step 5: Edge Cases
Test edge cases for each endpoint:
- Empty arrays
- Null values
- Undefined parameters
- Maximum length strings
- Special characters
- SQL injection attempts
- XSS attempts

---

## Quick Wins (Est. 2-4 hours)

### 1. Add Error Tests (50% of missing branches)
```javascript
describe('Error Scenarios', () => {
  it('handles Supabase errors', async () => { /* ... */ });
  it('handles validation errors', async () => { /* ... */ });
  it('handles missing auth token', async () => { /* ... */ });
  it('handles expired token', async () => { /* ... */ });
});
```

### 2. Test Optional Parameters (30% of missing branches)
```javascript
it('uses default values when optional params missing', async () => {
  const response = await request(app)
    .get('/api/listings'); // No query params
  expect(response.body).toBeDefined();
});

it('applies filters when provided', async () => {
  const response = await request(app)
    .get('/api/listings?category=furniture&status=available');
  expect(response.body.length).toBeGreaterThan(0);
});
```

### 3. Test Unauthorized Access (10% of missing branches)
```javascript
it('rejects requests without token', async () => {
  await request(app).get('/api/protected').expect(401);
});

it('rejects requests with invalid token', async () => {
  await request(app)
    .get('/api/protected')
    .set('Authorization', 'Bearer invalid-token')
    .expect(401);
});
```

### 4. Fix UserService Error (2 functions)
The `this.updateUser is not a function` error suggests:

```javascript
// In UserService.js line 279
// Current (broken):
await this.updateUser(userId, updates);

// Fix to:
await this.update(userId, updates);
// OR
await UserService.update(userId, updates);
```

---

## Test File Structure

```
backend/tests/
├── integration/
│   ├── admin.test.js ✅
│   ├── auth.test.js ✅
│   ├── gdpr.test.js ✅
│   ├── health.test.js ✅
│   ├── marketplace.test.js ✅
│   ├── payment.test.js ✅
│   ├── profile.test.js ✅
│   ├── tenant.test.js ✅
│   └── error-handling.test.js ⚡ NEW
├── unit/
│   ├── services/
│   │   ├── emailService.test.js ⚡ NEW
│   │   ├── userService.test.js ⚡ NEW
│   │   └── gdprService.test.js ⚡ NEW
│   ├── utils/
│   │   └── helpers.test.js ⚡ NEW
│   └── middleware/
│       ├── auth.test.js ⚡ NEW
│       └── validation.test.js ⚡ NEW
└── mocks/
    ├── supabase.js ⚡ NEW
    └── emailService.js ⚡ NEW
```

---

## Coverage Targets by Category

| Category | Current | Target | Gap | Priority |
|----------|---------|--------|-----|----------|
| Routes (Integration) | ~95% | 100% | 5% | 🔴 High |
| Services (Unit) | ~85% | 100% | 15% | 🟡 Medium |
| Utilities (Unit) | ~70% | 100% | 30% | 🟡 Medium |
| Middleware (Unit) | ~80% | 100% | 20% | 🟡 Medium |
| Error Handlers | ~50% | 100% | 50% | 🔴 High |

---

## Timeline

### Day 1 (4 hours)
- ✅ Fix UserService.updateUser bug
- ✅ Add logout endpoint + test
- ✅ Create error-handling.test.js
- ✅ Add 20+ error scenario tests

**Expected: 85% → 92% branch coverage**

### Day 2 (4 hours)
- ✅ Create unit tests for services
- ✅ Mock external dependencies
- ✅ Test all edge cases

**Expected: 92% → 98% coverage across all metrics**

### Day 3 (2 hours)
- ✅ Final cleanup
- ✅ Review uncovered lines
- ✅ Add missing function tests
- ✅ Document any intentionally uncovered code

**Expected: 98% → 100% coverage**

---

## Commands

```bash
# Run tests with coverage
npm test -- --coverage

# Run tests with detailed text report
npm test -- --coverage --coverageReporters=text

# Open HTML coverage report
start coverage/lcov-report/index.html  # Windows
open coverage/lcov-report/index.html   # Mac
xdg-open coverage/lcov-report/index.html # Linux

# Run specific test file
npm test -- tests/integration/auth.test.js

# Run in watch mode
npm test -- --watch

# Run with coverage threshold enforcement
npm test -- --coverage --coverageThreshold='{"global":{"branches":100,"functions":100,"lines":100,"statements":100}}'
```

---

## Notes

- **Mock email in tests** to avoid rate limiting
- **Use Jest spies** to test function calls
- **Test async error paths** with proper error handling
- **Don't over-test** - focus on business logic, not framework code
- **Document exceptions** - some code may be intentionally uncovered (e.g., development-only logging)

---

*Created: October 13, 2025*  
*Target: 100% coverage across all metrics*  
*Estimated Effort: 10-12 hours*
