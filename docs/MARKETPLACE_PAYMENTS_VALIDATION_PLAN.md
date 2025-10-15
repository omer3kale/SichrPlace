# Marketplace & Payments Validation Plan

## Scope
- Backend Express routes: `js/backend/routes/marketplace.js`, `js/backend/routes/payments.js`, `js/backend/routes/viewing-requests.js`, `js/backend/routes/booking-requests.js`.
- Netlify serverless handlers: `netlify/functions/paypal-*.mjs`, `netlify/functions/service-marketplace.mjs`, `netlify/functions/feedback.mjs`, `netlify/functions/notifications.mjs`.
- Database artifacts: `backend/sql/create_marketplace_tables.sql`, `backend/sql/verify_required_tables.sql`, Supabase migrations creating marketplace/payment tables.
- Frontend entry points: CTA buttons in `frontend/index.html`, `marketplace.html`, `create-account.html`, etc.

## Current Gaps
1. **End-to-End Coverage**: No automated test ties frontend CTA → API route → DB update.
2. **UI Confirmation**: Marketplace button text, translations, and links recently changed but lack UX verification across devices.
3. **Payment Flow**: PayPal integration scripts exist (`paypal-*.mjs`, backend PayPal routes) but there is no checklist confirming sandbox/production credentials or success path.
4. **Viewing Requests**: Backend includes viewing request routes with PayPal fee handling; need to confirm Netlify/Webflow combination handles payments consistently.
5. **Database Sync**: `create_marketplace_tables.sql` and Supabase migrations may diverge; need to ensure schema matches API expectations.
6. **Monitoring & Logs**: No consolidated view of payment/webhook logs; errors may go unnoticed.

## Validation Checklist
1. **Schema Verification**
   - Run `backend/sql/verify_required_tables.sql` against current database.
   - Confirm Supabase migrations include equivalent table/column definitions.
2. **API Testing**
   - Use Postman / Jest integration to hit `/api/marketplace`, `/api/payments`, `/api/viewing-requests` endpoints.
   - Validate responses, required auth, and DB writes.
3. **PayPal Flow**
   - Execute sandbox transactions through both Express and Netlify functions.
   - Confirm webhook or post-transaction handlers record results.
   - Verify environment variables (`PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, `PAYPAL_MODE`) set across backend and Netlify.
4. **Frontend UX**
   - Test CTA navigation and labels (desktop/mobile) after translation updates.
   - Ensure `marketplace` pages load required JS modules; confirm forms submit to correct endpoints.
5. **Error Handling**
   - Simulate failures (missing PayPal credentials, DB errors) to confirm user-facing messaging and logging.
   - Check logs for Express (`morgan`, custom logging) and Netlify (deploy logs) to ensure traceability.
6. **Documentation**
   - Update `PROJECT_STATUS_TRACKER.md` or create a dedicated README summarizing the validated flow.
   - Link to test evidence (screenshots, logs, CI output).

## Follow-Up Actions
- [ ] Assign owners for schema, API, frontend, and payment validation.
- [ ] Create automated integration test hitting the combined flow (can reuse `js/backend/tests/marketplace-routes-complete.test.js`).
- [ ] Document manual QA script until automated coverage is complete.
- [ ] Align with compliance documents (`GDPR_PAYMENT_FIX_PLAN.md`) once flow is verified.

## Status
- **Current**: Work pending. No comprehensive validation report exists.
- **Next Review**: After initial integration test suite runs and PayPal sandbox transaction is logged.
