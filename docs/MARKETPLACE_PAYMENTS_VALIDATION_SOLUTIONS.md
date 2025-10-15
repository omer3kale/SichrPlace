# Marketplace & Payments Validation Solutions

This playbook converts the validation plan into concrete actions synchronized with PayPal Checkout, sandbox, and webhook guidance.

## 1. Align Schema & API Contracts
- Run `backend/sql/verify_required_tables.sql` against both local and Supabase instances before every release; reconcile differences with `supabase/migrations/*` so API code never references columns that migrations lack.
- Promote `create_marketplace_tables.sql` changes into timestamped Supabase migrations, then delete ad-hoc SQL copies to avoid drift between Netlify functions, Express routes, and the database structures they assume.
- Extend the verification script with assertions around PayPal-specific fields (transaction IDs, fee columns) to catch missing indexes or improperly typed columns before tests run.

## 2. Deterministic End-to-End Coverage
- Use Playwright or Cypress to automate CTA → API → DB checks: trigger the CTA in `frontend/marketplace.html`, wait for the PayPal sandbox approval redirect, then assert against Supabase that the requested booking row exists.
- Reuse `js/backend/tests/marketplace-routes-complete.test.js` as a template for Jest integration tests that cover `/api/marketplace`, `/api/payments`, and `/api/viewing-requests`; mock PayPal only when end-to-end sandbox tests are not feasible.
- Wire these tests into CI so regressions block merges; failed tests should surface database verification output to speed triage.

## 3. PayPal Environment Hardening
- Maintain separate `.env.marketplace` (Express) and `netlify/.env` (functions) files populated with `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, and `PAYPAL_MODE`; rotate secrets via secure vaults rather than committing to git (PayPal Sandbox Testing Guide, "The testing process").
- Document the sandbox-to-production go-live step: update endpoints from `https://api-m.sandbox.paypal.com` to `https://api-m.paypal.com`, swap credentials, and verify all integration tests against the sandbox before promotion (same guide).
- Require the `PayPal-Request-Id` header on capture requests to guarantee idempotency, per the Orders API reference (`orders.capture` specifies the header requirement); surface this header in both Netlify handlers and Express middleware.

## 4. Canonical Checkout Flow Implementation
- Follow Orders v2 best practices: create orders with `intent: 'CAPTURE'`, redirect users to the returned `rel:approve` link, then call `POST /v2/checkout/orders/{id}/capture` after approval to finalize payment (Orders API reference, "operation/orders.create" and "operation/orders.capture").
- Ensure backend handlers propagate purchase-unit references into the database so the booking ID maps back to PayPal’s `purchase_units[].reference_id`.
- Enforce proper error handling on capture responses by checking `purchase_units[].payments.captures[].status`; only mark orders fulfilled when status is `COMPLETED` or `PENDING` with acceptable `status_details`.

## 5. Webhook & Post-Transaction Observability
- Subscribe a dedicated listener URL for the PayPal REST app (Webhooks Guide, "Initial configuration"); scope the subscription to `CHECKOUT.ORDER.APPROVED` and `PAYMENT.CAPTURE.COMPLETED`.
- Implement signature validation by calling PayPal’s verify endpoint with the webhook ID and headers (same guide, "Verifying the message received"); abort processing when verification fails to block spoofed payloads.
- Pipe webhook deliveries, Express logs, and Netlify console output into a shared logging destination (e.g., Logtail or CloudWatch) tagged with correlation IDs so failed payments can be traced end to end.

## 6. UX & Content Verification Loop
- Build a manual regression checklist for CTA labels, translations, and responsive layout; include screenshots from desktop, tablet, and mobile once per release.
- Add automated Lighthouse runs targeting `frontend/index.html` and `frontend/marketplace.html` to validate load performance and confirm required PayPal SDK scripts load without console errors.
- Confirm that localized strings point to the same checkout routes and that fallback text exists for unsupported languages.

## 7. Failure Simulation & Alerting
- Script negative tests that drop or corrupt PayPal credentials to assert user-facing errors remain actionable and no sensitive data leaks to the UI.
- Mock PayPal capture failures (e.g., force a `422` response) and verify retries respect the Orders API guidance on idempotent capture attempts (Orders API reference notes `200` responses for idempotent retries).
- Configure alerting on webhook failure retries (PayPal reattempts delivery up to 25 times over three days per the Webhooks Guide); escalate when the retry queue exceeds a threshold.

## 8. Documentation & Ownership
- Add a Marketplace Payments section to `PROJECT_STATUS_TRACKER.md` summarizing latest sandbox test IDs, webhook endpoints, and release owners.
- Version `docs/MARKETPLACE_PAYMENTS_VALIDATION_SOLUTIONS.md` alongside evidence (screenshots, sandbox transaction IDs) so auditors can trace validation history.
- Link the playbook to compliance artifacts (e.g., `docs/GDPR_PAYMENT_FIX_PLAN.md`) to ensure payment flow changes trigger required privacy reviews.
