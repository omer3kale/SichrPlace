# B03 Landing Content Verification Plan

## Current Messaging
- Homepage hero, feature blocks, and footer state that **Smart Matching** and **Secure Payments** are live platform capabilities.
- Marketing copy in `frontend/index.html`, `frontend/about.html`, and `frontend/faq.html` reinforces these claims.
- Operational documents reference these features as complete, but no recent validation evidence is linked.

## Reality Check Tasks
1. **Inventory implemented functionality**
   - Review backend services: Payment routes (`js/backend/routes/payments.js`) currently mocked, no production PSP integration detected.
   - Search for smart matching services/cron jobs. No code in `services/` or `controllers/` implementing tenant/landlord matching logic found.
   - Confirm feature flags or Supabase tables (`matching_preferences`, etc.) to assess readiness.
2. **Interview product/ops**
   - Confirm whether smart matching or secure payments are in staging/pilot or still roadmap.
   - Gather target launch timelines if any work is underway (refer to Step 8 plan for payments).
3. **Collect evidence**
   - If features exist in another branch/env, capture API endpoints, database records, or UI screenshots demonstrating functionality.
   - If not implemented, log blockers or dependencies preventing rollout.

## Content Remediation Options
- **Option A (preferred if features incomplete):**
  - Update homepage to describe these capabilities as "coming soon" or move them into a roadmap section.
  - Focus current messaging on verified functionality (e.g., verified listings, viewing service, tenant screening roadmap).
  - Mirror updates on `about.html`, `faq.html`, and language files.
- **Option B (if partially live):**
  - Qualify statements with context ("Pilot program," "Beta for select partners") and link to documentation explaining scope.
  - Create CTA for users to join waiting list rather than advertising as universally available.

## Deliverables
1. `docs/SMART_MATCHING_SECURE_PAYMENTS_STATUS.md` (status report with evidence, owners, timeline).
2. Content updates (homepage, about, FAQ, translation strings) aligned with real feature status.
3. Slack/email summary to stakeholders clarifying what changed and why.

## Acceptance Criteria
- Homepage and related pages no longer over-promise functionality; copy matches actual platform capabilities.
- Each claim links to implementation proof or explicitly states roadmap status.
- Stakeholders sign off on messaging change and backlog items created for feature delivery.
