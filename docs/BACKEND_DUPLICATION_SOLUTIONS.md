# Backend Duplication Solutions

Drawing from the 2024 edition of **Node.js Best Practices** by Goldberg et al., the following steps translate industry guidance into concrete fixes for the duplicated `backend/` and `js/backend/` directories.

## 1. Promote a Component-Oriented Layout
- Align with best practice 1.1 ("Structure your solution by business components") by consolidating the Express app, routes, services, and data-access code under a single canonical `backend/` component.
- Treat support code (redis cache helper, Supabase client, marketplace utilities) as submodules of that component instead of a separate sibling tree.

## 2. Layer the Backend Explicitly
- Follow best practice 1.2 ("Layer your components, keep the web layer within its boundaries") by ensuring the canonical tree has clear `entry-points/` (API controllers), `domain/` (service logic), and `data-access/` (Supabase queries) folders.
- Move the PayPal, marketplace, and health-check logic from `js/backend/` into the appropriate layer to keep HTTP wiring isolated from business logic.

## 3. Wrap Shared Utilities as Internal Packages
- Leverage best practice 1.3 ("Wrap common utilities as packages") to extract reusable helpers (e.g., caching, logging, PayPal SDK wrappers) into `backend/libraries/<utility>` packages with their own `package.json` and public exports.
- Require these helpers via the package entry points so the code no longer depends on deep relative paths inside `js/backend/`.

## 4. Declare a Single Entry Point
- Apply best practice 3.9 ("Set an explicit entry point to a module/folder") by keeping `backend/server.js` as the official export of the Express app and removing the compatibility shim that re-exports `../js/backend/server.js`.
- Update CLI scripts, Netlify handlers, and tests to import from that single entry so future relocations do not break consumers.

## 5. Unify Tooling and Builds
- Take guidance from best practice 5.4 ("Lock dependencies") and 5.19 ("Install packages with npm ci") to standardize the `backend/package.json` scripts around the canonical path and enforce consistent installs in CI/CD.
- Ensure ESLint/Jest configs resolve only the canonical directory and drop duplicate config files left in `js/backend/`.

## 6. Guard Against Regression During Migration
- Adopt best practice 4.1 ("Write API/component tests") and 4.7 ("Check your test coverage") by running the existing Jest suites after each directory move and insisting on green coverage reports before deleting `js/backend/`.
- Add smoke tests for the unified entry point (health route, marketplace endpoints) so any future directory drift fails fast in CI.

## 7. Communicate the Change
- Reflect the new structure in onboarding docs and deployment guides, pointing contributors to the consolidated `backend/` component and highlighting that `js/backend/` is deprecated and scheduled for removal after validation.
