# Compliance & Monitoring Solutions

This guide operationalizes the compliance plan with verifiable artefacts, automated monitoring, and shared observability.

## 1. Evidence-Backed Compliance Claims
- Create `docs/compliance/evidence/` with subfolders per control (e.g., `gdpr`, `csrf`, `security`). Store latest test output, signed screenshots, and configuration exports for every claim. Art. 7 GDPR explicitly requires the controller to demonstrate valid consent, so archive cookie banner logs and withdrawal records alongside the consent tests.[^gdpr]
- Extend CI jobs to upload artefacts (e.g., Jest `--json` reports, OWASP dependency scans) to the evidence folder or attach them as pipeline artefacts so reviewers can trace every "complete" status back to proof.

## 2. Automated Compliance Checks
- Add a `npm run compliance:ci` script that chains `npm run security:check`, `npm run security:comprehensive`, consent E2E tests, and the `scripts/setup-uptimerobot.sh` dry run. Wire this script into GitHub Actions so every PR surfaces pass/fail signals.
- Store environment variables for API-driven tooling in GitHub Secrets and `.env.example`, then inject them at runtime. UptimeRobot’s public API supports treating monitors and alert contacts as code, enabling us to validate webhook targets directly from CI without manual UI steps.[^uptimerobot]

## 3. Consent & Analytics Validation
- Build Playwright tests that toggle consent categories and assert that analytics scripts in `frontend/js/analytics-verification.js` and related files respect the state (no network calls before approval, removal after opt-out). Capture HAR files as artefacts for evidence.
- Add Jest unit tests for consent utilities (local storage flags, cookie helpers). Failing tests should block deploys to prevent "consent drift" after marketing updates.

## 4. Unified Security Controls
- Review Express GDPR routes and Netlify functions together. Implement shared middleware (rate limiting, CSRF tokens) and log access decisions to a centralized logger. Use correlation IDs so a GDPR export request can be traced through Express, Netlify, and database layers.
- Expand audit logging schema with fields for timestamp, actor, route/function name, and outcome (granted/denied). Ship logs to a managed sink (e.g., Logtail, CloudWatch) for retention beyond Netlify’s window.

## 5. Observability & Incident Response
- Enable Netlify Function logs for `gdpr-*.mjs` and `monitoring-*.mjs`, and configure filters for ERROR/WARN levels. Netlify retains at least 24 hours (up to 7 days on higher tiers) and surfaces invocation metadata; link the Function Logs UI in the runbook so responders know where to pull evidence.[^netlify]
- Evaluate Netlify Log Drains or Function Metrics (available on higher plans) to stream structured logs into the same sink as backend logs, giving the team a single pane for incidents.
- Configure UptimeRobot monitors via API for the compliance endpoints (e.g., `/api/gdpr/status`, `/netlify/functions/security-monitoring`). Store monitor IDs in IaC (Terraform or simple JSON) and document rotation of alert contacts.

## 6. Documentation Consolidation
- Replace status sprawl with `docs/Compliance_README.md`, summarizing policies, audit outcomes, evidence links, and review cadence. Include a change log table (date, owner, artefact) so auditors can track updates.
- Cross-link related docs (e.g., `GDPR_PAYMENT_FIX_PLAN.md`, `CSRF_ENFORCEMENT_GUIDE.md`) from the README and retire duplicated status files once their insights are merged.

## 7. Runbooks & Ownership
- Publish a quarterly review checklist covering: evidence refresh, CI audit, consent regression tests, security log archive, and monitor status. Assign DRI/backup in the README.
- Maintain an incident template (who/what/when/impact) and ensure logs from Netlify, Express, and UptimeRobot are attached during retrospectives.

[^gdpr]: Art. 7 GDPR, "Conditions for consent" – controllers must be able to demonstrate that the data subject has consented. Retrieved from https://gdpr-info.eu/art-7-gdpr/
[^uptimerobot]: UptimeRobot API overview emphasizes treating monitors, alert contacts, and webhook alerts as programmable resources, enabling CI-driven validation. Retrieved from https://uptimerobot.com/api/
[^netlify]: Netlify Function Logs document real-time access, search filters, log retention (24 hours+), and optional log drains for external monitoring. Retrieved from https://docs.netlify.com/functions/logs/
