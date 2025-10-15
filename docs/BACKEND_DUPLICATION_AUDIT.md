# Backend Duplication Audit

## Current Layout
- `backend/` (expected production path)
  - Routes, services, and api directories are empty placeholders.
  - `server.js` is a wrapper that requires `../js/backend/server.js`.
  - Contains package scripts (`package.json`) referencing lint/test tasks but the supporting source files are missing.
- `js/backend/` (actual implementation)
  - Filled routes (`routes/*.js`), services (`services/*.js`), middleware, and utility modules.
  - Hosts the real Express server, Supabase integration, Redis cache logic, etc.
  - Includes extensive Jest suites under `tests/`, along with mocks and helpers.
  - Numerous scripts (`*.js`) to run integration checks, migrations, PayPal validation, etc.

## Evidence of Divergence
- `backend/routes/`, `backend/api/`, `backend/services/` directories have no files, while `js/backend` equivalents are populated.
- `backend/server.js` explicitly states it is a “compatibility wrapper” and exports the implementation from `js/backend/server.js`.
- `backend/tests/` contains only setup scripts and SQL fixtures; `js/backend/tests/` contains the actual Jest suites (e.g., `marketplace-routes-complete.test.js`, `integration-health.test.js`).
- No `package.json` under `js/backend/`, so tooling scripts defined in `backend/package.json` operate against empty directories unless the wrapper redirects.

## Operational Risks
1. **Deployment Confusion**: Build pipelines expecting code under `backend/` may deploy empty handlers unless they follow the wrapper.
2. **Tooling Drift**: ESLint/Jest targets (`eslint .`, `jest`) inside `backend/` ignore the real implementation unless paths are manually set to `js/backend`.
3. **Contributor Confusion**: New engineers will edit `backend/` expecting production code, creating dead files.
4. **Testing Gaps**: `backend/tests/` snapshots suggest success while true test suites live elsewhere, making CI status unreliable.

## Recommended Steps
1. **Select Canonical Directory**: Decide whether `js/backend/` should be promoted to `backend/` (recommended) or vice versa.
2. **Migrate Source Files**:
   - Move routes, services, middleware, models, and config from `js/backend/` into `backend/`.
   - Update require/import paths accordingly.
3. **Unify Tooling**:
   - Ensure `backend/package.json` scripts reference the final directory.
   - Add ESLint/Jest configs at the canonical root only.
4. **Retire Wrapper**:
   - Once migration is complete, remove the `server.js` shim or repurpose it to export the consolidated app.
5. **Update Documentation**:
   - Reflect the new structure in `README.md`, deployment guides, and onboarding docs.
   - Note the deprecation of `js/backend/` and archive or delete the folder.
6. **Validate**:
   - Run lint/tests from the canonical directory.
   - Execute integration checks (Supabase connection, PayPal routes, marketplace flows) to ensure no path regressions.

## Tracking
- Owner: _TBD_
- Status: _Open_
- Next Checkpoint: Confirm migration plan aligned with tooling consolidation (see `GAP_ACTION_PLAN.md`).
