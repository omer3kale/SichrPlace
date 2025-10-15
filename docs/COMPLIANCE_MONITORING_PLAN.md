# Compliance & Monitoring Plan

## Current Assets
- **Docs**: `GDPR_*` series, `CSRF_ENFORCEMENT_GUIDE.md`, `PRODUCTION_ENVIRONMENT_SECURITY.md`, `PRODUCTION_EMAIL_SETUP.md`, `PRODUCTION_PAYPAL_SETUP.md`, `GDPR_PAYMENT_FIX_PLAN.md`, `GDPR_PAYMENT_ROUTE_ISSUES.md`.
- **Scripts**: `scripts/setup-uptimerobot.sh`, `scripts/seo-validation.sh`, analytics bridges in `frontend/js/` (e.g., `analytics-verification.js`, `clarity-config-hybrid.js`).
- **Netlify Functions**: `gdpr-compliance.mjs`, `gdpr-tracking.mjs`, `monitoring-dashboard.mjs`, `security-monitoring.mjs`.
- **Backend Routes**: GDPR controllers (`js/backend/routes/gdpr.js`, `gdpr-tracking.js`, `advancedGdpr.js`), `IntegrationHealthService.js`.

## Identified Gaps
1. **Action/Evidence Disconnect**: Documentation claims compliance steps are “complete” but no linked proof (test results, logs, or config snapshots).
2. **Monitoring Automation**: `setup-uptimerobot.sh` is not referenced in CI; unclear whether webhooks or scheduled checks run.
3. **Consent Management**: Frontend scripts integrate multiple analytics providers but rely on manual verification; no automated tests ensure consent toggles work.
4. **Security Controls**: CSRF via `lusca` requires session configuration; need to confirm Netlify functions align with same policies.
5. **Incident Logging**: No central dashboard tracking GDPR access logs, API rate limits, or audit trail.
6. **Doc Duplication**: Multiple status reports (e.g., `GDPR_TEST_FIX_PLAN.md`, `GDPR_TEST_FAILURES.md`) without a consolidated status page.

## Action Plan
1. **Compliance Evidence Repository**
   - For each claim (GDPR, CSRF, security), attach supporting files: test runs, screenshots, curl results.
   - Store under `docs/compliance/evidence/` or link to CI artifacts.
2. **Automation**
   - Update CI pipeline to run compliance checks:
     - `npm run security:check` and `npm run security:comprehensive` (root scripts).
     - Add script for consent tests (e.g., Cypress or Jest + jsdom for cookie/consent flows).
   - Integrate `setup-uptimerobot.sh` into deployment or provide instructions to run manually with examples.
3. **Consent & Analytics Testing**
   - Write automated tests verifying the Consent Manager script sets appropriate flags and event trackers respect consent state.
   - Validate fallback behavior in incognito/private browsers.
4. **Security & GDPR Routes**
   - Confirm Express routes and Netlify functions share consistent behavior (e.g., data access policies, logging).
   - Implement audit logging (timestamp, user, action) stored in DB or external logging service.
5. **Documentation Consolidation**
   - Merge overlapping docs into a single `Compliance_README.md` summarizing policies, runbooks, and sign-off history.
   - Maintain a changelog of compliance updates with owners and review dates.
6. **Monitoring Dashboard**
   - Decide on monitoring stack (UptimeRobot, Netlify Analytics, Supabase logs).
   - Document steps to access dashboards/report incidents.

## Tracking
- Owner: _TBD_
- Dependencies: Marketplace validation (for payment compliance evidence), Supabase plan (for RLS policies).
- Status: _Open_.
