# Backend Test Failures – 12 Oct 2025

This report captures the problems surfaced while running `npm test` inside `backend/`.

```
Test Suites: 4 failed / 2 passed
Tests:       18 failed / 31 passed (49 total)
Command:     cd backend && npm test
```

## Quick Summary

| Suite | File | Status | Root Cause |
|-------|------|--------|------------|
| Health | `backend/tests/integration/health.test.js` | ✅ Pass | Works as expected |
| Admin | `backend/tests/integration/admin.test.js` | ⚠️ Skips auth-only cases | Admin & tenant credentials unavailable |
| Auth | `backend/tests/integration/auth.test.js` | ❌ Fail | Payload does not satisfy `/auth/register` validation |
| Marketplace | `backend/tests/integration/marketplace.test.js` | ❌ Fail/Skip | Depends on auth login that currently fails |
| GDPR | `backend/tests/integration/gdpr.test.js` | ❌ Fail/Skip | Depends on auth login that currently fails |
| Payment | `backend/tests/integration/payment.test.js` | ❌ Fail/Skip | Depends on auth login that currently fails |

---

## Detailed Findings

### 1. Authentication Suite (`backend/tests/integration/auth.test.js`)
- **Failure:** `POST /auth/register` returns **400 Bad Request** instead of expected 201.
- **Why:** The test sends `{ email, password, full_name, role }`, but `js/backend/routes/auth.js` requires:
  - `firstName`, `lastName`, `username`, and `phone` (optional) fields.
  - `terms` field set to string `'true'`.
  - Password length ≥ 8 (satisfied) but other fields missing.
- **Fix:** Update the test payload to match current validators or adjust the validator to match the desired contract.
  ```json
  {
    "firstName": "Test",
    "lastName": "User",
    "username": "testuser123",
    "email": "...",
    "password": "...",
    "role": "tenant",
    "terms": "true"
  }
  ```
- **Downstream impact:** Because registration fails, the login test that expects to authenticate the newly created user also fails with **401 Unauthorized**.

### 2. Admin Suite (`backend/tests/integration/admin.test.js`)
- **Observation:** Every admin/tenant login attempt fails; suite logs `⚠️ Skipping test: Admin credentials not available`.
- **Why:** The test expects predefined accounts (`admin@sichrplace.com` with `Admin123!`, `tenant1@example.com` with `Tenant123!`). These are not present in the current database (or the passwords differ).
- **Current behaviour:** Tests do not fail hard; they skip the admin-protected assertions when tokens are missing.
- **Fix:** Seed predictable credentials in the Supabase project (or provide env vars with valid logins) before running tests.

### 3. Marketplace / GDPR / Payment Suites
- **Shared symptom:** `beforeAll` login using `tenant1@example.com` / `Tenant123!` fails → `userToken` stays `undefined` → most cases either skip (with warning) or receive **401 Unauthorized**.
- **Root cause:** Same as Admin suite—no seeded tenants with the expected credentials.
- **Secondary risk:** Even once login works, the POST assertions assume minimal payloads. Verify they match current route validators (e.g., marketplace listing creation may require fields beyond `title`, `description`, `category`, `price`, `condition`).

### 4. Test Environment Notes
- Gmail/Redis/Supabase startup logs flood the Jest output but are harmless; server boot completes successfully (`✅ Supabase connection successful`).
- Supabase Admin API cleanup in `auth.test.js` will throw if the service role key is missing; ensure env vars are set when fixing registration.

---

## Recommended Next Steps

1. **Decide on contract:** Align `/auth/register` validations with test expectations or vice versa.
2. **Seed test credentials:** Add SQL migration or Supabase seed script for admin & tenant accounts with known passwords.
3. **Re-run tests:** `cd backend && npm test` once users exist and registration payload matches validators.
4. **Tighten assertions post-auth:** After authentication succeeds, confirm each suite’s payload matches the live route requirements to avoid new 400s.

When the above blockers are addressed, all dependent suites should start executing real assertions instead of skipping.
