# Gap Action Plan

## 1. Documentation Indexing
- **Scope**: Newly added guides (`docs/*` set) overlap and lack a canonical entry point.
- **Actions**:
  1. Inventory and categorize all documentation titles.
  2. Merge duplicate guides (e.g., onboarding vs. quick start) or cross-link them.
  3. Update `README.md` (or create `docs/README.md`) as the authoritative index.
  4. Archive or delete outdated status reports once incorporated.

## 2. Backend Directory Duplication
- **Scope**: Parallel code under `backend/` and `js/backend/` (routes, services, tests).
- **Actions**:
  1. Compare package.json scripts and dependency versions.
  2. Choose the canonical directory and migrate missing code/tests.
  3. Remove or deprecate the redundant tree after validation.
  4. Run migrations and tests to confirm the chosen structure works end to end.

## 3. Tooling & Automation Alignment
- **Scope**: Lint/test configs (`.eslintignore`, `.eslintrc.cjs`, `babel.config.cjs`, `jest.config.cjs`, `scripts/generate-eslint-md-report.mjs`, `tests/package.json`).
- **Actions**:
  1. Decide on flat vs. legacy ESLint config and consolidate.
  2. Wire lint/test commands into root `package.json` scripts.
  3. Validate that Jest runs across backend, netlify, and frontend suites.
  4. Document the workflow in `PROJECT_STATUS_TRACKER.md` or the README.

## 4. Netlify & Frontend Integration
- **Scope**: Netlify functions (`netlify/functions/*.mjs`) and frontend scripts (`frontend/js/*.js`, `frontend/__tests__`).
- **Actions**:
  1. Ensure new JS files load in HTML templates or bundler manifests.
  2. Confirm Netlify `package.json` installs/test commands align with CI.
  3. Add integration tests or smoke tests for new functions.
  4. Review build pipeline so functions ship with deploy previews.

## 5. Supabase & Database Operations
- **Scope**: `supabase/migrations/*`, `supabase_clean_schema.sql`, helper scripts.
- **Actions**:
  1. Arrange migrations sequentially and verify dependencies.
  2. Run migrations locally plus apply `_data.sql` seeds.
  3. Update `RUN_DATABASE_MIGRATION.md` with tested commands.
  4. Automate schema verification via CI if possible.

## 6. Marketplace & Payments Flow
- **Scope**: Backend routes (`marketplace.js`, `payments.js`), SQL tables, frontend CTA updates.
- **Actions**:
  1. Map the end-to-end flow (UI → API → DB).
  2. Write Postman/automated integration tests covering marketplace ops.
  3. Validate UI translations and CTAs (desktop/mobile).
  4. Capture outcomes in `PROJECT_STATUS_TRACKER.md` once verified.

## 7. Compliance & Monitoring Hooks
- **Scope**: GDPR/CSRF documentation, analytics scripts, uptime setup.
- **Actions**:
  1. Align documentation claims with implemented middleware/routes.
  2. Integrate consent/analytics scripts into build with environment guards.
  3. Execute `scripts/setup-uptimerobot.sh` and log configuration steps.
  4. Add recurring checks (CI or cron) to ensure compliance tooling stays active.

## 8. General Follow-Through
- **Scope**: Track resolution and avoid drift.
- **Actions**:
  1. Use `PROJECT_STATUS_TRACKER.md` to log owner + status per gap.
  2. Schedule verification steps (tests, lint, deploy preview) before merging.
  3. Communicate progress in team stand-ups and issue tracker.
