# 🛠️ Critical & High-Priority Fix Plan

Actionable implementation notes for each gap listed in `docs/CRITICAL_FOLLOWUP_STATUS.md`.

---

## Critical (Do This Week)

### 1. External Monitoring (UptimeRobot)
- **Implementation Steps**
  1. Register a free UptimeRobot account; create monitors for:
     - `https://sichrplace.com` (HTTP(s) monitor)
     - `https://sichrplace.com/api/health`
  2. Generate alert contacts (email + optional Slack webhook).
  3. Store credentials in Netlify env (`UPTIMEROBOT_API_KEY`).
  4. Add scheduled Netlify function or GitHub Action calling UptimeRobot API weekly to verify monitors remain active.
  5. Update `netlify/functions/monitoring-dashboard.mjs` to read actual monitor state via API instead of static "recommended" flag.

### 2. Automated Supabase Backups
- **Implementation Steps**
  1. Create a service role key in Supabase with backup permissions.
  2. Add GitHub Action (`.github/workflows/nightly-backup.yml`):
     ```yaml
     - uses: supabase/cli-action@v1
       with:
         command: db dump --project-ref ${{ secrets.SUPABASE_PROJECT_REF }} --db-url ${{ secrets.SUPABASE_DB_URL }} --file backups/$(date +%F).sql
     ```
  3. Push dumps to secure storage (GitHub Releases/S3/Azure Blob) with retention policy (e.g., 30 days).
  4. Update `netlify/functions/backup-recovery.mjs` to query actual backup metadata instead of hard-coded payload.
  5. Document restore runbook in `docs/PRODUCTION_RECOVERY.md`.

### 3. Domain & SSL Automation
- **Implementation Steps**
  1. Use Netlify CLI script (`scripts/setup-domain.sh`) that runs:
     ```bash
     netlify api updateSite --data '{"site_id":"<id>","custom_domain":"www.sichrplace.com"}'
     ```
  2. Confirm DNS via IaC (Terraform/Netlify DNS) or documented manual steps.
  3. Add cron/GitHub Action that runs `netlify api getSite --data '{"site_id":"<id>"}'` and alerts if certificate near expiry.
  4. Update `netlify.toml` comment with link to script and verification steps.

---

## High Priority (Next Two Weeks)

### 4. SEO Validation
- **Implementation Steps**
  1. Add npm script `npm run seo:check` executing Lighthouse CLI (`lighthouse https://sichrplace.com --seo`).
  2. Automate sitemap deployment: after frontend deploy, run script to ping `https://www.google.com/ping?sitemap=https://www.sichrplace.com/sitemap.xml`.
  3. Register property in Google Search Console; document verification token placement.

### 5. Performance (Images & Lazy Loading)
- **Implementation Steps**
  1. Add `loading="lazy"` (and `decoding="async"`) to gallery/testimonial images in `frontend/index.html` lines 1329-1421.
  2. Introduce build script (`scripts/optimize-images.mjs`) using `sharp` to generate WebP + responsive variants (`img/apartment1-{640,1280}.webp`).
  3. Update `<img>` tags to use `srcset` / `sizes` referencing generated variants.
  4. Optionally integrate Netlify Image CDN (`<img src="/.netlify/functions/image?url=...">`).

### 6. Google Analytics 4 Consolidation
- **Implementation Steps**
  1. Keep a single loader (`js/frontend/js/google-analytics-config.js`) and remove placeholder config in `js/analytics/sichrplace-analytics.js` or refactor it to import shared manager.
  2. Gate GA initialisation behind cookie consent (`cookie-consent.js`) before calling `GoogleAnalyticsManager.init()`.
  3. Store measurement ID in environment (`GA_MEASUREMENT_ID`) and inject via build/templating to avoid hardcoding.
  4. Document event taxonomy in `docs/ANALYTICS_GUIDE.md`.

### 7. Error Alerting (Slack/Email)
- **Implementation Steps**
  1. Create Slack incoming webhook (`SLACK_ERROR_WEBHOOK`) and/or SendGrid API key.
  2. Update `netlify/functions/simple-error-tracking.mjs` to POST to webhook with severity, request URL, and user agent.
  3. Add throttling / deduplication (e.g., only alert on first N occurrences per hour).
  4. Confirm delivery via unit test hitting the function with mock payload.

### 8. User Feedback Loop
- **Implementation Steps**
  1. Create backend route (`backend/routes/feedback.js`) storing entries in Supabase table `user_feedback`.
  2. Add frontend widget (modal or footer form) posting to `/api/feedback` with consent checkbox.
  3. Notify team via same Slack webhook when high-severity feedback arrives.
  4. Expose admin dashboard page listing feedback sorted by status.

---

## Tracking
- After each item ships, update `docs/CRITICAL_FOLLOWUP_STATUS.md` with "Status: ✅ (date, owner)".
- Keep this fix plan in sync whenever implementation details change.
