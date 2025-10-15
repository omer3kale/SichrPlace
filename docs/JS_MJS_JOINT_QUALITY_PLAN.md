# Unified JS/ESM Quality Stabilization Plan

## Quick Snapshot
- Combined files in scope: 993 JavaScript/ESM modules (755 `.js`, 238 `.mjs`) across serverless, frontend, backend, and automation paths.
- Current automated coverage: 4 legacy CommonJS backend files only; zero `.mjs` handlers are exercised.
- Highest risk areas: production Netlify functions (222 total), frontend widgets (9 critical UX scripts), shared security/util utilities (6 modules), automation scripts (12 `.mjs` + `.js`).

## Top-Priority Fix Sequence (execute in order)
- **Stabilize tooling:** add `.netlify/` and generated coverage folders to `.gitignore`, clean repo, and ensure CI deletes `.netlify/functions-serve` before testing.
- **ESLint + Jest foundations:** configure unified lint (`eslint` with ESM import rules) and testing stacks (`jest` projects for Node + jsdom, ESM support via `@swc/jest`), with npm scripts `lint:esm`, `lint:js`, `test:netlify`, `test:frontend`.
- **Smoke coverage:** implement auto-discovery smoke tests verifying every Netlify handler exports `handler(event, context)` and every frontend widget attaches safely to DOM.
- **Critical path tests:** cover auth, feedback, monitoring, payments workflows (Netlify + backend services) with mocked Supabase, Slack, UptimeRobot, PayPal.
- **Security utilities:** unit-test `utils/` rate limiter, secure logger, secret manager, token hashing to prevent regressions.
- **Document + gate:** update QA playbooks and CI docs, enforce minimum coverage thresholds (≥80% statements for runtime-critical directories) once baseline tests pass.

## Suggested Fix Bundles
- **Tooling & Infrastructure**
  - Configure multi-project Jest (Node + jsdom + ESM) and add global setup for env var injection.
  - Extend ESLint configs to cover `netlify/**/*.mjs`, `frontend/js`, `utils`, `scripts` with import order and security plugins.
  - Create shared test helpers for Supabase, Slack webhook, UptimeRobot, PayPal mocks (lives in `netlify/functions/__tests__/helpers`).

- **Serverless Functions (netlify/) + Legacy duplicates**
  - Build targeted unit tests for auth, feedback, monitoring handlers; assert schema validation and error routing.
  - Identify `.js` duplicates under `js/netlify/functions`; migrate remaining usage to `.mjs` or archive to avoid split logic.
  - Create change-detection script ensuring each new function has a matching test stub.

- **Frontend Widgets & Analytics**
  - Implement jsdom-based tests for `feedback-widget.js`, `language-switcher.js`, `logo-cookie-manager.js`, `availability-monitor.js` with DOM snapshot/a11y checks.
  - Integrate Lighthouse smoke runs (reuse `scripts/seo-validation.sh`) into CI to validate GA/lazy-loading instrumentation.

- **Backend Services & APIs**
  - Use Supertest to exercise `backend/server.js` routes paralleling Netlify handlers; align on single server entrypoint and deprecate unused variants.
  - Add unit coverage for `js/backend/services/*.js` using existing mocks, focusing on GDPR, payments, messaging, analytics services.

- **Automation & Orchestration Scripts (scripts/, organized/)**
  - Add dry-run integration tests to ensure scripts exit cleanly and respect Windows paths.
  - Verify secret-scan and security validators redact sensitive data; add regression cases.

- **Documentation & Tracking**
  - Produce `docs/QA_PLAYBOOK.md` outlining manual fallbacks until automation coverage meets thresholds.
  - Update `docs/CRITICAL_FOLLOWUP_STATUS.md` and `PROJECT_STATUS_TRACKER.md` with new test/lint milestones.
  - List new npm commands and required env vars inside `ENVIRONMENT_SETUP_GUIDE.md`.

## Risk Controls
- Enforce CI pipeline to run lint + test suites; fail on uncovered file introduction.
- Require test stub alongside any new Netlify handler or frontend widget via git hook or review checklist.
- Schedule periodic `npm run audit:js` (optional script) to detect untested modules and stale duplicates.

## Expected Outcome
Completing the above sequence brings parity between CommonJS and ESM testing, eliminates duplicate serverless code, and ensures all production-critical paths (auth, feedback, monitoring, payments, analytics, frontend UI) are validated automatically before deployment.
