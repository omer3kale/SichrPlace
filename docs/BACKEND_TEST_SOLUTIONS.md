# Backend Test Failures – Possible Solutions

These options address the blockers documented in `BACKEND_TEST_ISSUES.md` and aim to get `npm test` passing inside `backend/`.

## 1. Fix Authentication Suite

### A. Align Test Payload With Current Validator (Recommended)
- Update `backend/tests/integration/auth.test.js` registration payload to include all required fields:
  ```json
  {
    "firstName": "Test",
    "lastName": "User",
    "username": "testuser-${Date.now()}",
    "email": "test-${Date.now()}@sichrplace.test",
    "password": "TestPassword123!",
    "role": "tenant",
    "terms": "true"
  }
  ```
- Add optional `phone` if validation changes demand it.
- Keep `afterAll` Supabase cleanup or replace with custom delete logic if needed.

### B. Relax Registration Validator (Alternative)
- In `js/backend/routes/auth.js`, adjust `validateRegistration` to accept legacy payloads:
  ```javascript
  body('full_name').optional().isString(),
  body('firstName').optional(),
  body('lastName').optional(),
  body('terms').optional().toBoolean()
  ```
- Map `full_name` to `first_name`/`last_name` server-side if provided.
- Trade-off: reduces strictness; ensure product requirement allows it.

### C. Seed Pre-Approved Test Users (Fallback)
- Instead of relying on registration, provision test accounts directly in Supabase (see section 2).
- Adjust tests to skip registration and only test login + negative cases.

## 2. Seed Consistent Test Accounts

To unblock admin, marketplace, GDPR, and payment suites:

1. Create seed script or SQL migration ensuring the following users exist with known passwords:
   - `admin@sichrplace.com` / `Admin123!`
   - `tenant1@example.com` / `Tenant123!`
   - `tenant2@example.com` / `Tenant123!`
   - `landlord1@example.com` / `Landlord123!`
2. Use Supabase Admin API or SQL `INSERT` with bcrypt-hashed passwords.
3. Document the seeding step in README and ensure CI sets the same state.

## 3. Stabilize Auth-Dependent Suites

Once login succeeds:

### Marketplace Tests
- Confirm schema: if `/api/marketplace/listings` requires additional fields (`location`, `images`, etc.), update POST payload accordingly.
- Ensure cleanup removes created listings to keep DB tidy.

### GDPR Tests
- If `/api/gdpr/delete` or `/api/gdpr/consents` require specific data relationships, seed minimal consent purposes.
- Consider wrapping destructive requests (`/delete`) in conditional skips for shared environments.

### Payment Tests
- Validate `/api/payment/create` expects `amount` as string or number; adjust accordingly.
- Seed at least one payment transaction so `/history` and `/refund` have realistic data.

## 4. Testing Workflow Improvements

- **Add Jest setup hook**: place login helpers/shared data in `tests/utils/auth.js` to avoid duplication.
- **Use `.env.test`**: ensure Supabase keys and SMTP configs for test runs don’t rely on production secrets.
- **Silence noisy logs**: wrap `console.log` in server code with `if (process.env.NODE_ENV !== 'test')` to declutter output.
- **Introduce data reset step**: e.g., run a `supabase` SQL script before tests to reset fixtures.

## 5. Long-Term Enhancements

- Add CI job that provisions Supabase test instance, runs seeding, executes `npm test`.
- Consider using Supabase local emulator for faster, isolated test runs.
- Expand coverage to include edge cases (invalid roles, blocked accounts, rate limits).

---

**Suggested Execution Order**
1. Update test payloads (Section 1A).
2. Seed required users (Section 2).
3. Re-run `cd backend && npm test`.
4. Tweak endpoint payloads per suite (Section 3).
5. Implement workflow improvements (Section 4/5).

With these steps, the backend integration suite should reach 100% pass rate and be ready for CI automation.
