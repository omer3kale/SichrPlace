# 100% Coverage Execution Solutions

This playbook translates the coverage plan into tooling, test authoring, and enforcement tasks that close the final gaps across statements, branches, functions, and lines.

## 1. Coverage Guardrails
- Enforce `100/100/100/100` thresholds in `jest.config.cjs` (or project override) so CI fails immediately when regressions appear, using Jest's `coverageThreshold` support for global targets.[^jest-threshold]
- Extend `collectCoverageFrom` patterns to include serverless functions, frontend scripts, and utilities that currently load indirectly, ensuring instrumentation covers all runtime entry points.[^jest-collect]
- Add a pre-commit hook (Husky or Lefthook) that runs `npm test -- --coverage --changedSince=origin/main` to catch regressions before review.

## 2. Branch Gap Remediation
- Triage `coverage-final.json` to list the 46 uncovered branches and map each to the owning team (backend API, Netlify function, frontend widget); store the mapping in `PROJECT_STATUS_TRACKER.md`.
- For each API branch, write Supertest cases that assert both success and failure paths—mock Supabase to throw errors and validate that HTTP 4xx/5xx responses match the documented schema.
- For Netlify and frontend modules, create lightweight smoke tests that toggle feature flags or optional parameters to hit default, conditional, and fallback logic.

## 3. Function & Utility Completion
- Add unit test suites under `backend/tests/unit/` to cover helper modules (`utils/`, `services/`, `middleware/`) that currently lack direct execution; use dependency injection to mock outbound calls so each exported function is invoked.
- Mirror the same approach for shared JS/ESM utilities consumed by Netlify functions—import the `.mjs` modules inside Jest via the ESM transformer and validate formatting, authorization, and serialization helpers return the correct structures.
- For pure data mappers, prefer snapshot tests with strict assertions to guarantee structural stability when new properties are introduced.

## 4. Error-Path & Resilience Coverage
- Create `tests/integration/error-handling.test.js` that simulates database outages, invalid payloads, expired tokens, and rate limits; assert that the API returns actionable error messages without leaking stack traces.
- Add logout and session lifecycle tests that prove token revocation works for both browser and mobile clients, covering the final uncovered statements in authentication flows.
- Annotate genuinely unreachable lines (e.g., environment-guarded console logs) with `/* istanbul ignore next */` only after code review approval, keeping a ledger in the status tracker explaining each exclusion.

## 5. Reporting & Observability
- Publish HTML coverage reports (`coverage/lcov-report`) as a CI artifact and link the latest URL inside `docs/docs__API_TEST_RESULTS.md` so stakeholders can verify progress release-by-release.
- Add a GitHub status check that parses `coverage-summary.json` and comments on pull requests with the delta per folder, highlighting any drop below 0.1%.
- Schedule a weekly job that runs the full suite with `--runInBand` to detect flaky coverage (race conditions can hide missing branches when tests finish prematurely).

## 6. Timeline & Ownership

| Window | Focus | Owner |
| --- | --- | --- |
| Day 1 | Configure Jest thresholds, regenerate coverage reports, and file branch-gap checklist | QA Lead |
| Day 2 | Author missing API and error-path tests; land new unit suites for utilities | Backend Team |
| Day 3 | Finish Netlify/frontend smoke tests, document exclusions, and enable CI gates | Frontend & DevOps |

## 7. Exit Criteria
- CI enforces coverage thresholds with no optional bypasses.
- All 46 historical uncovered branches and 2 functions show as covered in `coverage-final.json`.
- Error-path tests reliably produce deterministic outcomes (no flaky retries or intermittent timeouts).
- `PROJECT_STATUS_TRACKER.md` reflects the updated owners, test locations, and any intentional exclusions approved by tech leads.

[^jest-threshold]: Jest documentation, "coverageThreshold" option – <https://jestjs.io/docs/configuration#coveragethreshold-object>
[^jest-collect]: Jest documentation, "collectCoverageFrom" option – <https://jestjs.io/docs/configuration#collectcoveragefrom-array>
