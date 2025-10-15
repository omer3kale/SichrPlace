# Tooling & Automation Alignment Plan

## Current State
- **Root `package.json`**: Provides high-level scripts (`test:backend`, `test:netlify`, `lint`, etc.), but relies on nested packages and assumes ESLint/Jest configs exist.
- **`backend/package.json`**: Defines its own full suite of lint/test scripts, yet `backend/` contains almost no source files.
- **`js/backend/`**: Hosts the real backend code and Jest suites, but lacks its own `package.json` or tooling configuration.
- **`netlify/package.json`**: Minimal scripts, no Jest setup; Netlify function tests currently live under `netlify/functions/__tests__` but rely on root Jest projects.
- **`tests/` package**: Adds another layer (`tests/package.json`) for function testing utilities.
- Multiple ESLint configs (`.eslintrc.cjs`, `js/backend/eslint.config.js`), plus `scripts/generate-eslint-md-report.mjs` that aren’t wired into CI.

## Pain Points
1. Running `npm run lint` or `npm test` from different directories yields inconsistent results because code and configs are split.
2. `backend/package.json` scripts operate on empty directories, so lint/test commands can pass despite missing coverage of real code.
3. Netlify functions rely on root Jest configuration but have an isolated `package.json`; dependency drift is likely.
4. `tests/` utilities introduce yet another package boundary without integration points.

## Alignment Goals
- Single authoritative lint/test command per layer (backend, frontend, functions) triggered from the repository root.
- Canonical ESLint configuration (flat or legacy) shared across all relevant directories.
- Jest projects defined once, with clear mapping to code under test.
- Minimal duplicated `package.json` files; subscripts only when absolutely necessary (e.g., Netlify CLI).

## Proposed Actions
1. **Choose Canonical Backend Folder** (see `BACKEND_DUPLICATION_AUDIT.md`).
2. **Consolidate ESLint Configs**:
   - Decide between `.eslintrc.*` and `eslint.config.js` (flat config).
   - Remove redundant configs; ensure root `eslint` command targets actual code folders.
3. **Unify Jest Configuration**:
   - Create a root `jest.config.cjs` referencing projects (backend, netlify, frontend) with explicit `testMatch` globs.
   - Remove unused per-package Jest configs unless required for tooling.
4. **Normalize Scripts**:
   - Update root `package.json` scripts to invoke the canonical directories.
   - For runtime-specific scripts (e.g., Netlify deploy), keep them in the root with scoped commands (e.g., `npm run functions:test`).
   - Remove or simplify `backend/package.json` if the directory no longer contains the code.
5. **Dependency Management**:
   - Ensure dependencies for backend and functions live in the root unless isolated for deployment reasons.
   - Run `npm dedupe` and align versions.
6. **CI Updates**:
   - Adjust GitHub Actions / CI scripts to call the new consolidated commands.
   - Wire `scripts/generate-eslint-md-report.mjs` into lint pipeline if still useful.

## Next Steps
- [ ] Decide config strategy with maintainers.
- [ ] Document the new workflow in `PROJECT_STATUS_TRACKER.md` and `README.md`.
- [ ] Update CI/CD pipeline once local runs succeed.
- [ ] Archive or delete outdated configs (`backend/package.json`, `js/backend/eslint.config.js`) post-migration.
