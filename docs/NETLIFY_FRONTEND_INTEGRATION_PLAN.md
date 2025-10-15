# Netlify & Frontend Integration Plan

## Netlify Functions Snapshot
- `netlify/functions/` contains 90+ handlers (auth, marketplace, analytics, tenant screening, etc.).
- Only two smoke tests exist (`cache-management.smoke.test.mjs`, `email-notifications.smoke.test.mjs`).
- Supporting utilities (`utils/email.mjs`) and new handlers (`feedback.mjs`, `add-property-legacy.mjs`) are not yet covered by automated tests.
- `netlify/package.json` only provides basic CLI scripts; tests are wired through the root Jest config.

**Risks**:
1. Large function surface without test coverage or deploy validation (risk of runtime errors).
2. No shared configuration for environment variables (PayPal, Supabase, SMTP) across functions.
3. Duplicate or legacy functions (`add-property` vs `add-property-legacy`, backups directory) require pruning.

**Actions**:
1. Catalogue each function, identify active endpoints, and remove deprecated placeholders.
2. Expand smoke/integration tests using `netlify/functions/__tests__/` (e.g., feedback, payment flows, tenant screening).
3. Define an `.env` or Netlify `_redirects/headers` mapping to ensure required environment variables are declared.
4. Update `netlify/package.json` to include `npm test` alias that calls the root Jest project.
5. Document deployment steps (Netlify CLI command, environment variable list, rollback strategy).

## Frontend Asset Integration
- New scripts under `frontend/js/`:
  - `feedback-widget.js`, `location-services.js`, `pwa-init.js`, `availability-monitor.js`, etc.
- Only `pwa-init.js`, `location-services.js`, `language-switcher.js`, `logo-cookie-manager.js` are loaded in HTML pages; `feedback-widget.js` is never referenced.
- `frontend/__tests__/` only contains `setup.js`; no actual test suites.

**Risks**:
1. Deployed pages might miss newly developed widgets (feedback, monitoring), leading to feature gaps.
2. Without bundling or module management, adding many `<script>` tags increases load time and order dependency issues.
3. Lack of frontend tests means regressions go unnoticed.

**Actions**:
1. Audit every HTML page to confirm necessary `<script>` tags exist, or consolidate with a bundler (Vite/Webpack) if moving to modular imports.
2. Decide if the project should adopt a build step (e.g., `npm run build:frontend`) to combine/minify scripts.
3. Implement Jest + `jsdom` or Cypress tests in `frontend/__tests__/` covering critical flows (language switcher, forms, marketplace CTA).
4. Update documentation (e.g., `FRONTEND_INTEGRATION_GUIDE.md`) with script loading order, testing strategy, and performance considerations.

## Coordinated Deployment Checklist
1. **Environment Variables**: Align backend, functions, and frontend configs (Supabase, PayPal, SMTP, analytics).
2. **CI Pipeline**: Ensure `test:netlify` and upcoming frontend tests run on every commit.
3. **Bundle Verification**: For each release, verify that Netlify functions bundle correctly and HTML pages include required JS.
4. **Monitoring**: Hook Netlify deploy logs into the analytics/monitoring plan (see compliance gap).

## Tracking
- Owner: _TBD_
- Dependencies: `TOOLING_ALIGNMENT_PLAN.md` (for Jest config), `GAP_ACTION_PLAN.md` (overall roadmap).
- Status: _Open_.
