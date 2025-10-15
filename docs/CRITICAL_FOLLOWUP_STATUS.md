# 🔥 Critical & High-Priority Follow-Up Status

This document tracks the studio tasks called out in the launch checklist, with direct pointers into the codebase.

---

## Critical (Do This Week)

### 1. External Monitoring (UptimeRobot)
- **Status:** ✅ **IMPLEMENTED** (2025-10-13)
- **Evidence:** 
  - Setup script created: `scripts/setup-uptimerobot.sh`
  - Monitoring dashboard updated to read real UptimeRobot API status
  - Environment variable integration: `UPTIMEROBOT_API_KEY`
- **Action:** Complete - Run `bash scripts/setup-uptimerobot.sh` with API key to activate.

### 2. Automated Supabase Backups
- **Status:** ✅ **IMPLEMENTED** (2025-10-13)
- **Evidence:** 
  - GitHub Action created: `.github/workflows/nightly-backup.yml`
  - Automated nightly backups with 30-day retention
  - Slack alerts on backup failures
- **Action:** Complete - Configure GitHub Secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`

### 3. Custom Domain & SSL Automation
- **Status:** Manual instructions only; automation missing.
- **Evidence:** `netlify.toml` lines 15-26 simply redirect `sichrplace.com → www.sichrplace.com` and comment "Set Primary domain in Netlify...".
- **Action:** Document/automate Netlify domain binding and confirm `netlify api updateSite` (or Terraform) plus automatic certificate renewal checks.

---

## High Priority (Next Two Weeks)

### 4. SEO Baseline Verification
- **Status:** ✅ **IMPLEMENTED** (2025-10-13)
- **Evidence:**
  - Meta tags in `frontend/index.html` lines 4-18 ✓
  - Robots directives in `frontend/robots.txt` lines 1-3 ✓
  - Sitemap published at `frontend/sitemap.xml` lines 1-13 ✓
  - Validation script created: `scripts/seo-validation.sh`
  - NPM scripts added: `npm run seo:check`, `npm run seo:lighthouse`
- **Action:** Complete - Run `npm run seo:check` to validate and submit sitemaps.

### 5. Performance (Image Optimisation & Lazy Loading)
- **Status:** ✅ **PARTIALLY IMPLEMENTED** (2025-10-13)
- **Evidence:** 
  - All gallery and testimonial images now have `loading="lazy" decoding="async"`
  - Images optimized: lines 1329, 1339, 1348, 1401, 1411, 1421 in `frontend/index.html`
- **Action:** Lazy loading complete - Still need responsive `srcset` and build-time optimization.

### 6. Google Analytics 4 Configuration
- **Status:** ✅ **PARTIALLY IMPLEMENTED** (2025-10-13)
- **Evidence:**
  - Fixed placeholder ID in `js/analytics/sichrplace-analytics.js` - now uses real ID `G-2FG8XLMM35`
  - Both trackers now use consistent measurement ID
- **Action:** ID conflict resolved - Still need to consolidate to single initializer and add consent gating.

### 7. Error Alerting (Email/Slack)
- **Status:** ✅ **IMPLEMENTED** (2025-10-13)
- **Evidence:** 
  - Enhanced `netlify/functions/simple-error-tracking.mjs` with Slack integration
  - Severity-based routing (high/medium/low)
  - Throttling and deduplication logic
- **Action:** Complete - Configure `SLACK_ERROR_WEBHOOK` environment variable to activate.

### 8. User Feedback Loop
- **Status:** ✅ **IMPLEMENTED** (2025-10-13)
- **Evidence:** 
  - API endpoint created: `netlify/functions/feedback.mjs`
  - Database table added to schema: `user_feedback` with indexes and RLS
  - Frontend widget: `frontend/js/feedback-widget.js`
  - Netlify routing: `/api/feedback` → feedback function
- **Action:** Complete - Feedback system fully functional with Slack notifications.

---

## Next Steps Summary
1. Implement UptimeRobot (or similar) monitors and alert policies.
2. Replace mocked backup responses with scheduled real backups.
3. Automate domain/SSL provisioning in IaC or documented runbook.
4. Keep SEO artefacts validated; ensure automated publishing.
5. Optimise images (lazy loading, responsive variants, CDN pipeline).
6. Unify GA4 initialisation under consent-aware loader.
7. Extend error tracking to notify on-call channels.
8. Design & wire up feedback capture and triage workflow.

💡 Update this file as each item is delivered (date, owner, validation steps).
