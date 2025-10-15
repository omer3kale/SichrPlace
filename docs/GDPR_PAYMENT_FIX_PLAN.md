# ✅ GDPR & Payment Route Fix Plan

## Goal
Resolve the 404 responses in the GDPR and payment integration suites while keeping the backend API consistent and discoverable.

---

## Option A · Implement Missing Endpoints (Preferred)
Align backend routes with the expectations coded into the integration tests. This keeps the tests untouched and adds the functionality the frontend likely needs.

### Step-by-step
1. **GDPR routes** (`js/backend/routes/gdpr.js`)
   - Add handlers for:
     - `GET /api/gdpr/data`
     - `POST /api/gdpr/delete`
     - `GET /api/gdpr/consents`
     - `PUT /api/gdpr/consents/:purposeId`
     - `GET /api/gdpr/consent-purposes`
   - Use existing service helpers such as `GdprService.getUserConsents`, `createRequest`, etc., and fall back to mock responses if persistence logic is still pending.
2. **Payment routes** (`js/backend/routes/payment.js`)
   - Add new router mounted on `/api/payments` (plural) or create aliases from `/api/payment`.
   - Implement endpoints expected by the tests:
     - `POST /create`
     - `GET /history`
     - `POST /refund`
     - `GET /:id`
   - For now, mock responses (e.g., fixed JSON structure) until Supabase tables and services are wired.
3. **Document the API**
   - Update `docs/` with the new public endpoints.
   - Regenerate `swagger.json` if used.
4. **Run tests**
   ```bash
   cd backend
   npm test -- gdpr
   npm test -- payment
   ```

### Pros
- Test expectations remain intact.
- Clarifies backend contract for future frontend work.

### Cons
- Requires additional implementation effort (mock data if live data unavailable).

---

## Option B · Adjust Tests to Current API
If the current backend design is already final, adapt the integration tests so they target the existing endpoints.

### Steps
1. Update `gdpr.test.js` to use the current routes:
   - `/api/gdpr/consent`
   - `/api/gdpr/request`
   - `/api/gdpr/export`
   - `/api/gdpr/withdraw-consent`
2. Update `payment.test.js` to use `/api/payment/checkout`, `/webhook`, `/status/:userId`.
3. Document the deviations from the original test plan for future reference.

### Pros
- Minimal code changes in the backend.
- Keeps tests green if the existing API is the intended contract.

### Cons
- Diverges from the more RESTful paths the tests originally anticipated.
- Future consumers may still expect the `/payments` namespace.

---

## Option C · Create Compatibility Adapters
This hybrid approach keeps existing logic while exposing the expected routes as thin wrappers.

### Example
```javascript
// In server.js (after base routers)
const paymentRouter = require('./routes/payment');
app.use('/api/payment', paymentRouter);
app.use('/api/payments', paymentRouter); // compatibility alias
```
Similarly, create wrapper handlers in a `routes/gdpr-compat.js` file that map the expected endpoints to the current service calls.

---

## Recommended Path
1. **Adopt Option A** for long-term clarity. Add the missing routes with minimal responses (even if backed by mock data) to unblock tests and document the API.
2. **Use Option C** as a stop-gap if timeline is tight—alias the routes so the tests pass, then incrementally flesh out the logic.
3. Only choose **Option B** if the test suite was written against outdated specs.

---

## Verification Checklist
- [ ] `npm test -- gdpr` passes
- [ ] `npm test -- payment` passes
- [ ] API documentation updated
- [ ] Any new environment variables or Supabase tables documented in the README

---

*Compiled October 13, 2025 to guide GDPR & payment endpoint alignment.*
