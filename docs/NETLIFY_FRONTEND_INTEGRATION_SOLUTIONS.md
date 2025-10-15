# Netlify & Frontend Integration Solutions

The following remediation items translate the integration plan into actions grounded in official Netlify guidance and modern frontend performance practices.

## 1. Rationalize the Functions Inventory
- Use the Netlify Functions dashboard to review every deployed handler and retire duplicates (`add-property` vs `add-property-legacy`) or unused prototypes. Netlify keeps an immutable history per deploy, so pruning in Git cleanly deprecates obsolete endpoints while still allowing rollbacks when needed (see Netlify Functions overview, 2025-09-09).
- Group related handlers into subdirectories (`marketplace/*`, `auth/*`) and add `config.path` metadata where routes need friendly URLs. This keeps routing explicit and prevents accidental shadowing of static assets (Netlify Functions get started doc, sections "Route requests" and `preferStatic`).

## 2. Expand Automated Coverage for Functions
- Extend the Jest project that targets `netlify/functions` to cover high-risk handlers (feedback, tenant screening, payments). Add scenario tests that validate required headers, environment lookups, and downstream error handling before deploying to production.
- Adopt Netlify Dev (`netlify dev`) inside CI smoke jobs to simulate the production gateway locally, ensuring redirects, environment scoping, and geo flags behave as expected prior to merge (Netlify Get Started doc, "Test locally").
- Promote test utilities (`__tests__/setup.js`, mock contexts) so they are shared across all new suites, and wire `npm run test:functions` from the root to call the consolidated project (depends on tooling alignment solutions).

## 3. Formalize Environment Variable Management
- Declare PayPal, Supabase, SMTP, and analytics secrets through the Netlify UI/CLI with the Functions scope enabled. Values defined in `netlify.toml` are not exposed to runtime handlers, so they must be registered via the environment management API (Netlify environment variables doc, "Declare variables").
- Document read-only values (`SITE_NAME`, `URL`, etc.) that handlers can rely on, and enforce a validation helper at function startup to fail fast when required variables are missing (same doc, "Netlify read-only variables").
- Include an `.env.example` illustrating local fallback keys used by Netlify Dev. The actual secrets stay in Netlify but developers can override them with `netlify env:import` during onboarding.

## 4. Tighten Deployment and Monitoring Workflow
- Update `netlify/package.json` to expose `npm run functions:deploy` (wrapping `netlify deploy` with the appropriate flags) and `npm run functions:logs` (streaming via `netlify logs functions`). Encourage release managers to verify bundles and tail logs immediately after each production deploy (Netlify Get Started doc, "Next steps").
- Capture function metrics and logs inside the existing compliance dashboard so runtime errors are surfaced alongside backend alerts (Netlify Functions overview references the Functions tab for per-deploy history).

## 5. Align Frontend Asset Loading with Performance Guidance
- Inventory every `<script>` tag across HTML templates and ensure new widgets (`feedback-widget.js`, `availability-monitor.js`) are either referenced or intentionally excluded. Remove dead files to avoid drift.
- Introduce a lightweight bundler (e.g., Vite or Rollup) with code-splitting so that only the entry scripts required for initial rendering are shipped on first paint. Google’s web.dev guidance shows that reducing initial JavaScript payloads lowers INP and LCP by freeing the main thread ("Reduce JavaScript payloads with code splitting").
- Configure the bundler to produce hashed filenames and emit preload hints for critical chunks. Add a smoke test that loads each built HTML page in headless Chrome to verify the presence of required widgets and absence of blocking errors.

## 6. Establish Frontend Test Coverage
- Stand up a Jest + JSDOM suite (or Playwright if DOM APIs are insufficient) under `frontend/__tests__` that validates language switching, form submission, and PWA initialization. This complements the Netlify smoke tests and ensures widget regressions are caught.
- Tie the new suite into the root `npm test` pipeline, keeping parity with the tooling alignment recommendations so the entire Netlify + frontend surface runs on every pull request.
