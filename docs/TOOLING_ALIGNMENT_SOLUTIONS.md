# Tooling Alignment Solutions

Guided by the **Node.js Best Practices (2024 edition)** compilation, these fixes translate the alignment plan into concrete actions for linting, testing, and automation.

## 1. Collapse Duplicate Package Boundaries
- Reference practice 1.1 ("Structure your solution by business components") to keep a single `package.json` per component. Promote the canonical backend directory and remove the vestigial `backend/package.json` once code is migrated.
- Retain dedicated manifests only when tooling demands isolation (e.g., Netlify CLI). Otherwise, consolidate dependencies at the repository root and run `npm dedupe` to prevent drift.

## 2. Standardize ESLint Configuration
- Practice 3.1 ("Use ESLint") and 3.2 ("Use Node.js eslint extension plugins") recommend a shared lint config. Adopt either flat `eslint.config.js` or `.eslintrc.cjs`, delete redundant per-folder configs, and extend the shared config to cover backend, functions, and scripts.
- Wire `scripts/generate-eslint-md-report.mjs` into the primary lint command so reporting happens during CI, aligning with practice 5.13 ("Use tools that automatically detect vulnerabilities").

## 3. Unify Jest Projects
- Practice 4.1 ("Write API/component tests") and 4.7 ("Check your test coverage") favor a single Jest entry point. Use the existing root `jest.config.cjs` to declare projects for backend, Netlify functions, and any frontend code, each with explicit `testMatch` patterns.
- Remove hidden Jest configs under `backend/` or `tests/` and migrate helpers (mocks, setup scripts) into the project-specific `setupFilesAfterEnv` entries.

## 4. Normalize NPM Scripts
- Practice 5.19 ("Install your packages with npm ci") underlines deterministic installs—mirror that in scripts. Expose commands like `lint`, `test:backend`, and `test:functions` from the root package, and ensure subpackages call back into those scripts rather than duplicating logic.
- Add composite scripts (`npm run verify` invoking lint + tests) to support CI pipelines, echoing practice 5.16 ("Design automated, atomic and zero-downtime deployments").

## 5. Enforce Runtime Consistency
- Practice 4.4 ("Ensure Node version is unified") suggests declaring the Node version in `.nvmrc`/`.node-version` and mirroring it in the root `package.json` `engines` field. Update CI runners and Netlify build settings to use the same version.
- Validate dependency security with `npm audit` or Snyk in CI, reinforcing practice 6.7 ("Inspect for vulnerable dependencies").

## 6. Document the Workflow
- Update onboarding docs to explain the single-source lint/test commands, the location of Jest configs, and how Netlify functions inherit tooling. Clearly mark the retirement of the legacy `backend` manifest and the `tests/` package.
- Surface the instructions in `PROJECT_STATUS_TRACKER.md` so contributors know where to run checks and how CI enforces them.
