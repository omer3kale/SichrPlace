# GDPR Test Fix Solutions

This solution guide captures how the plan’s remediation steps translate into stable Express routes, Jest coverage, and compliance evidence.

## 1. Preserve Authentication Semantics in Tests and Runtime
- Keep the adjusted auth middleware behaviour: in test runs, only inject a faux user when `x-test-user-id` is present or `req.user` was pre-populated. All other requests should go through the real token/session flow so 401 status checks remain meaningful across environments.[^auth]
- Extend test helpers to expose `setTestUser(app, id)` for routes that require authentication. For negative tests, omit the header so the middleware returns `{ success: false, error: 'Unauthorized' }` instead of crashing on `req.user.id`.

## 2. Harden GDPR Route Implementations
- Finish wiring `routes/gdpr.js` so every handler guards against missing `req.user` before touching service calls. These guards should standardise responses on `{ success: false, error: 'Unauthorized' }` with HTTP 401.
- The withdraw consent handler should prefer `consentId` when present, falling back to consent type updates otherwise. Wrap service calls in `try/catch`, returning 404 for unknown IDs and 500 with `{ error: 'Internal server error' }` for unexpected failures.
- Align all success responses with the contract used in the tests: `201` for resource creation (`POST /api/gdpr/request`), `200` for fetches, and include `success: true` plus the relevant data payload.

## 3. Service Layer Reliability
- Keep the runtime guard in place to ensure `logDataProcessing` and `createConsent` exist before invocation. When the service is not configured, throw a descriptive error and return a 503 response so the frontend can show "Service unavailable" without exposing stack traces.
- Expand `GdprService` unit coverage. Use Jest to mock Supabase queries so the service-level logic (duplicate request detection, consent reconciliation) is validated without relying solely on route integration tests.

## 4. Jest Setup & Mock Strategy
- Maintain the ordering: call `jest.mock()` for `GdprService` and related dependencies **before** requiring the modules under test. Document this rule in `tests/README.md` to prevent future regressions.
- Reset fetch mocks in `afterEach` within frontend-facing tests so cross-test pollution does not reappear. Provide helper factories that return the expected `{ ok, json }` shape to make tests concise.

## 5. Coverage & Reporting
- Continue tracking coverage baselines (`routes/gdpr.js` ~65%, `middleware/auth.js` ~42%). Use these figures as gates in CI; if coverage dips, require a diff justification.[^jest]
- Surface test run metadata (suites executed, pass/fail count) in the compliance evidence folder so auditors can corroborate the "All tests passing" claim.

## 6. Advanced Route Follow-up
- Implement the missing advanced GDPR endpoints enumerated in the historical section of the plan (`GET /requests`, `PUT /requests/:id/status`, breach aliases, compliance exports). Mirror the same auth guards and response envelope used in the standard routes to keep behaviour consistent.
- Update Jest integration suites for the advanced routes once the aliases exist; ensure severity filters, pagination, and CSV exports are exercised with deterministic fixtures.

## 7. Documentation & Communication
- Update `docs/API_ENDPOINTS_COMPLETE_STATUS.md` and the GDPR README to show the new route definitions, required headers, and typical responses.
- Record the October 09, 2025 green test run in `docs/compliance/evidence/` with the Jest result JSON or terminal log, satisfying Article 7’s proof-of-consent requirement when combined with audit logging.

## 8. Verification Checklist
- [ ] Auth middleware guards unauthenticated requests without throwing.
- [ ] `routes/gdpr.js` aligns with the test expectations for status codes and payloads.
- [ ] Jest mocks reset between tests; coverage thresholds enforced in CI.
- [ ] Compliance evidence updated with the latest passing run.
- [ ] Advanced GDPR routes planned in the historical section have owners and status notes.

[^auth]: Guarding Express routes and middleware to return consistent 401 responses prevents runtime `undefined` crashes and keeps tests meaningful.
[^jest]: Jest best practices recommend restoring mocks between tests and ordering `jest.mock` calls before imports to avoid hoisting pitfalls.
