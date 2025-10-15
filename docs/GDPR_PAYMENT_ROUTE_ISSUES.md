# 📌 GDPR & Payment Route Mismatches (October 13, 2025)

## 🔍 What We Observed
- **GDPR integration tests** (`backend/tests/integration/gdpr.test.js`) depend on endpoints such as `/api/gdpr/data`, `/api/gdpr/delete`, `/api/gdpr/consents`, `/api/gdpr/consent-purposes`, and `/api/gdpr/consents/:purposeId`.
- **Payment integration tests** (`backend/tests/integration/payment.test.js`) target a `/api/payments` namespace (`/create`, `/history`, `/refund`, `/:id`).
- **Actual server routes** defined in `js/backend/routes/gdpr.js` and `js/backend/routes/payment.js` do not expose these paths:
  - GDPR router only registers `/api/gdpr/consent`, `/api/gdpr/request`, `/api/gdpr/export`, `/api/gdpr/account`, `/api/gdpr/withdraw-consent`, `/api/gdpr/consent-status`, etc.
  - Payment router is mounted at `/api/payment` (singular) with `/checkout`, `/webhook`, `/status/:userId` endpoints.
- Because the expected endpoints are missing, Jest records **HTTP 404 Not Found** responses for every GDPR and payment test.

## 📁 Source of Truth
| Area | Test File | Implemented Routes | Mount Path |
| --- | --- | --- | --- |
| GDPR | `backend/tests/integration/gdpr.test.js` | `js/backend/routes/gdpr.js` | `app.use('/api/gdpr', gdprRoutes)` |
| Payment | `backend/tests/integration/payment.test.js` | `js/backend/routes/payment.js` | `app.use('/api/payment', paymentRoutes)` |

## 🚨 Impact on Test Suite
- **GDPR suite:** All eight tests fail with 404 because `/api/gdpr/data`, `/api/gdpr/delete`, `/api/gdpr/consents`, and `/api/gdpr/consent-purposes` do not exist.
- **Payment suite:** Two critical tests fail with 404 because `/api/payments/create` and related paths are not implemented; the router currently only supports checkout/webhook/status.

## ✅ Recommended Fix Options
1. **Align Routes to Tests**  
   Implement the missing endpoints so they match the integration specs. This means:
   - Add handlers for `/api/gdpr/data`, `/api/gdpr/delete`, `/api/gdpr/consents`, `/api/gdpr/consent-purposes`, and `/api/gdpr/consents/:purposeId` in `js/backend/routes/gdpr.js`.
   - Extend `js/backend/routes/payment.js` (and related services) to provide `/api/payments/create`, `/history`, `/refund`, and `/:id` endpoints. Mount the router on `/api/payments` or add aliases.

2. **Adjust Tests to Current API**  
   If the implemented API is canonical, update the integration tests to exercise the existing routes (`/api/gdpr/consent`, `/api/gdpr/request`, `/api/payment/checkout`, etc.). This requires coordinated documentation updates to keep the test expectations clear.

3. **Provide Compatibility Adapters**  
   Add lightweight "bridge" routes that translate the integration test paths to the existing business logic while you finalise the production endpoints.

## 🛠 Suggested Next Steps
- Decide whether the tests or the routes represent the desired public API surface.
- Once the direction is chosen, either implement the missing handlers or update the test suite accordingly.
- After adjustments, rerun `npm test` to confirm the GDPR and payment suites pass.

---
*Document generated to track GDPR & payment route discrepancies detected on October 13, 2025.*
