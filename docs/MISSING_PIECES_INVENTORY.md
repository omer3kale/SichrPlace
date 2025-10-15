# Missing Pieces Inventory

This document captures the outstanding files and work items that appeared in the latest repository status output. It is intended as a single place to track what still needs to be reviewed, merged, or fully integrated into the project.

## 1. Linting & Configuration
- `.eslintignore`, `.eslintrc.cjs`, `babel.config.cjs`, `jest.config.cjs`
- `js/backend/eslint.config.js`
- `scripts/generate-eslint-md-report.mjs`
- `tests/package.json`

**Gap**: Lint/Testing baselines were uploaded but not yet wired into the main toolchain. Confirm package scripts, align ESM/CommonJS config, and determine canonical lint/test entry points.

## 2. CI/CD & Automation
- `.github/workflows/nightly-backup.yml`
- `scripts/seo-validation.sh`, `scripts/setup-uptimerobot.sh`

**Gap**: New automation scripts and workflow require validation, secrets, and documentation.

## 3. Environment & Setup Guides
- `ENVIRONMENT_SETUP_GUIDE.md`, `ENV_SETUP_GUIDE.md`, `PRODUCTION_CHECKLIST.md`, `PROJECT_STATUS_TRACKER.md`, `RUN_DATABASE_MIGRATION.md`, `QUICK_START_DATABASE.md`

**Gap**: Multiple guides overlap. Consolidate, deduplicate content, and reference an authoritative onboarding flow.

## 4. Backend Updates
- `backend/package.json`, `backend/package-lock.json`
- `backend/migrations/add_login_tracking_columns.sql`
- `backend/sql` additions: `DATABASE_SCHEMA_REFERENCE.md`, `QUICK_SETUP.sql`, `create_marketplace_tables.sql`, `verify_required_tables.sql`
- `backend/tests/` additions and rewrites (including mocks & integration coverage)
- `js/backend` mirrored structure for CommonJS builds, routes (booking, marketplace, payments, integration health), services (Cloudinary, EmailLog, IntegrationHealth), plus test suites & helpers

**Gap**: Uploaded backend refactor still exists outside the core `backend/` folder (duplicate `js/backend`). Decide on canonical source, run migrations, and ensure new tests are runnable via root scripts.

## 5. Netlify Functions & Frontend Hooks
- `netlify/functions/add-property-legacy.mjs`, `netlify/functions/feedback.mjs`, `netlify/functions/utils/email.mjs`
- `netlify/functions/__tests__/` (new smoke/unit coverage)
- `netlify/package.json`, `netlify/package-lock.json`
- Frontend assets: `frontend/__tests__/`, `frontend/js/feedback-widget.js`, `frontend/js/location-services.js`, `frontend/js/pwa-init.js`

**Gap**: Functions & frontend scripts coexist but require bundler alignment, environment variables, and inclusion in deploy builds. Verify Netlify package scripts and ensure new JS files load in HTML entries.

## 6. Documentation Wave
- `docs/` additions (coverage plans, GDPR progress, backend/marketplace issue logs, implementation checklists, workspace audits)

**Gap**: Rich documentation uploaded without index. Cross-link from `README.md` or `docs/README` and archive obsolete entries.

## 7. Supabase & Database Artifacts
- New migrations under `supabase/migrations/*` including initial schema, advanced search seed, verification utilities, `_data.sql`
- Top-level `supabase_clean_schema.sql` and helper scripts (`scripts/listSupabaseTables.mjs`, `scripts/replaceGermanFields.mjs`)

**Gap**: Ensure migration chain is sequential, update Supabase CLI instructions, and validate data imports.

## 8. Market & Payments Surface
- `js/backend/routes/marketplace.js`, `payments.js`, related tests
- `backend/sql/create_marketplace_tables.sql`
- Frontend marketplace CTA (requires new label translation) — verify after recent UI tweaks

**Gap**: Confirm end-to-end marketplace flow: database tables, API routes, Netlify functions, and frontend entry points.

## 9. Analytics & Monitoring
- `docs/GDPR_*` series, `docs/CSRF_ENFORCEMENT_GUIDE.md`
- `scripts/setup-uptimerobot.sh`

**Gap**: Integrate compliance documentation with implementation status, ensure monitoring scripts run via CI/CD or deployment checklist.

---

### Immediate Follow-Up
1. Decide which configuration and documentation files are authoritative; remove or merge duplicates.
2. Run `npm install` in `backend/` and `netlify/`, execute lint/tests to confirm the uploaded scaffolding works.
3. Validate Supabase migrations locally using the new helper scripts and update `README.md` with the confirmed workflow.
4. Ensure Netlify functions and frontend scripts are referenced in production builds; add automated tests where gaps remain.
5. Track progress in `PROJECT_STATUS_TRACKER.md` once each section is resolved.
