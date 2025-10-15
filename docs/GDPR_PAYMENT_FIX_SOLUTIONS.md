# GDPR & Payment Route Fix Solutions

This playbook turns the fix plan into implementation steps that align backend routes, Jest coverage, and documentation with GDPR obligations and payment UX expectations.

## 1. Stabilize the GDPR API Surface
- Introduce an Express router (`js/backend/routes/gdpr.js`) that exposes the endpoints the test suite expects: `GET /api/gdpr/data`, `POST /api/gdpr/delete`, `GET /api/gdpr/consents`, `PUT /api/gdpr/consents/:purposeId`, and `GET /api/gdpr/consent-purposes`. Drive each handler through the existing `GdprService` methods or temporary mocks while persistence hardens.[^express]
- Log every consent mutation (purpose ID, actor, timestamp) so we can demonstrate compliance. Article 7 of the GDPR requires controllers to prove a data subject’s consent, making audit records and withdrawal logs mandatory evidence.[^gdpr]
- Ensure handlers return HTTP 404/400 when requests lack a known user or purpose. Centralize validation with middleware to keep responses consistent between Express and Netlify function implementations.

## 2. Align Payment Routes With Marketplace Flows
- Create a dedicated router (`js/backend/routes/payments.js`) mounted at `/api/payments`; add compatibility aliases from `/api/payment` if legacy clients exist. Route handlers should cover `POST /create`, `GET /history`, `POST /refund`, and `GET /:id`, mapping directly to existing service calls or sandbox stubs.
- For PayPal-driven flows, use the Orders v2 sequence: create an order with `intent: "CAPTURE"`, have the client approve, and then call `POST /v2/checkout/orders/{id}/capture`. Surface the resulting capture/order IDs in the API response and logs so downstream services can reconcile them.[^paypal]
- Return standard HTTP statuses: `201` for `create`, `200` for successful lookups, `202` or `200` for refunds depending on synchronous/asynchronous behavior, and `404` when a payment record is missing. Keep JSON payloads shape-compatible with the Jest tests to avoid brittle assertions.

## 3. Compatibility & Migration Strategy
- If existing clients still call old endpoints, add lightweight adapters: mount the same router on both `/api/payment` and `/api/payments`, or proxy deprecated paths to the new handlers. Document the deprecation timeline in `docs/API_ENDPOINTS_COMPLETE_STATUS.md` so teams can migrate on schedule.
- Refactor shared validation (auth guards, schema checks) into middleware consumed by both the compatibility layer and the new routes to prevent drift.

## 4. Tests & Tooling
- Update Jest integration suites (`backend/tests/gdpr.test.js`, `backend/tests/payment.test.js`) to target the formalized routes. Mock PayPal SDK calls where end-to-end capture is out of scope, but assert that our API carries the PayPal IDs needed for reconciliation.
- Add fixtures for consent states and payment histories so tests cover both success and failure branches. Use `supertest` for Express assertions and pgTAP or Supabase migrations for database verifications where applicable.

## 5. Documentation & Observability
- Regenerate `backend/swagger.json` (or equivalent) and extend `docs/` with the new endpoints, parameters, and example payloads. Highlight the relationship between `/api/payments/*` and the Netlify functions so frontend teams know which layer to call.
- Feed GDPR and payment routes into the logging/monitoring stack defined in the Compliance & Marketplace solution docs. Tag logs with `route`, `user`, and `correlationId` so incidents can be traced across Express, Netlify, and Supabase.

## 6. Rollout Checklist
- [ ] Implement routers and aliases
- [ ] Wire service layer (mock or live)
- [ ] Record consent/payment logs with correlation IDs
- [ ] Update Jest suites and run `npm test -- gdpr` plus `npm test -- payment`
- [ ] Refresh documentation and notify consumers of deprecated paths

[^express]: Express Router best practices for clean, modular route definitions. Retrieved from https://expressjs.com/en/guide/routing.html
[^gdpr]: GDPR Article 7, "Conditions for consent" – controllers must demonstrate data subject consent. Retrieved from https://gdpr-info.eu/art-7-gdpr/
[^paypal]: PayPal Orders API v2 documentation outlines the `create` → `approve` → `capture` sequence and required headers. Retrieved from https://developer.paypal.com/docs/api/orders/v2/
