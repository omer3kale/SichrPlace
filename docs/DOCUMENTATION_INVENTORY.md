# Documentation Inventory & Overlap Map

This catalog groups every file under `docs/`, highlights duplicates, and flags next actions so we can curate an authoritative knowledge base.

## 1. Onboarding & Setup
- `QUICK_START_GUIDE.md`
- `HOW_TO_CREATE_ALL_TABLES.md`
- `SUPABASE_SETUP_GUIDE.md`
- `TENANT_SCREENING_MIGRATION_GUIDE.md`
- `ENVIRONMENT_SETUP_GUIDE.md`, `ENV_SETUP_GUIDE.md`
- `SUPABASE_SCHEMA_FIX.md`, `SUPABASE_CONFIGURATION_STATUS.md`, `SUPABASE_ENTITIES_LOCATION.md`
- `docs__open-source-docs__README.md`, `docs__README.md`

**Overlap**: Multiple quick-start and setup guides, plus near-identical open-source versions. 
**Action**: Merge into a single “Getting Started” chapter with per-role subpages.

## 2. Deployment & Infrastructure
- `DEPLOYMENT_CHECKLIST.md`, `NEXT_STEPS_TESTING_DEPLOYMENT.md`
- `PRODUCTION_CHECKLIST.md`, `PRODUCTION_DATABASE_BACKUP.md`, `PRODUCTION_DOMAIN_SSL_SETUP.md`, `PRODUCTION_EMAIL_SETUP.md`, `PRODUCTION_ENVIRONMENT_SECURITY.md`, `PRODUCTION_PAYPAL_SETUP.md`
- `NETLIFY_CUSTOM_DOMAIN_ROADMAP.md`
- Open-source duplicates: `docs__DEPLOYMENT_GUIDE.md`, `docs__NETLIFY_DEPLOYMENT.md`, `docs__NETLIFY_STATUS.md`, `docs__MANUAL_DEPLOYMENT.md`, `docs__open-source-docs__DEPLOYMENT_GUIDE.md`, `docs__open-source-docs__QUICK_DEPLOY.md`

**Overlap**: Several deployment guides with slight variations. 
**Action**: Create a single deployment playbook with environment-specific appendices; archive redundant status reports after extracting key steps.

## 3. Compliance, Security & GDPR
- `GDPR_PAYMENT_FIX_PLAN.md`, `GDPR_PAYMENT_ROUTE_ISSUES.md`
- `GDPR_PROGRESS_2025-10-09.md`, `GDPR_TEST_FAILURES.md`, `GDPR_TEST_FIX_PLAN.md`
- `CSRF_ENFORCEMENT_GUIDE.md`, `PRODUCTION_ENVIRONMENT_SECURITY.md`
- `docs__ADVANCED_GDPR_README.md`, `docs__GDPR_README.md`, `docs__SECURITY_AUDIT_COMPLETE.md`, `docs__GMAIL_OAUTH2_SETUP.md`
- `docs__open-source-docs__ADVANCED_GDPR_README.md`, `docs__open-source-docs__SECURITY_AUDIT_COMPLETE.md`

**Overlap**: Distinct updates covering the same compliance areas. 
**Action**: Consolidate into a single “Compliance Handbook” with changelog entries.

## 4. Testing & Quality Assurance
- Coverage plans: `100_PERCENT_COVERAGE_PLAN.md`, `TEST_COVERAGE_PROGRESS_REPORT.md`, `TEST_COVERAGE_SUMMARY.md`, `TEST_SUITE_RATIONALIZATION.md`
- Failure/issue tracking: `TEST_ERROR_ANALYSIS.md`, `TEST_RESULTS_CURRENT.md`, `TEST_RESULTS_REPORT.md`, `BACKEND_TEST_FAILURES_MARKETPLACE.md`, `BACKEND_TEST_ISSUES.md`, `BACKEND_TEST_SOLUTIONS.md`
- Status docs: `docs__API_TESTING_GUIDE.md`, `docs__API_TEST_RESULTS.md`, `docs__FRONTEND_INTEGRATION_TEST_RESULTS.md`, `docs__STEP7_TESTING_COMPLETE.md`, `docs__STEP_7_COMPLETION.md`
- Tooling: `JS_CODE_QUALITY_OPERATIONS.md`, `JS_MJS_JOINT_QUALITY_PLAN.md`, `MJS_CODE_QUALITY_OPERATIONS.md`, `ESLINT_ESM_AUDIT.md`

**Overlap**: Many retrospective reports and final status claims. 
**Action**: Build a current QA dashboard referencing living documents only; move historical success reports to an archive folder.

## 5. Feature Delivery & Roadmaps
- `ADVANCED_SEARCH_ALIGNMENT_REPORT.md`, `SEARCH_API_DOCUMENTATION.md`
- `MISSING_PAGES_IMPLEMENTATION.md`, `PROJECT_WEAKNESSES_2025-10-08.md`
- `MISSION_COMPLETE_FINAL_REPORT.md`, `DOCUMENTATION_FIXES_COMPLETE.md`, `DEVELOPMENT_ISSUES_RESOLUTION_COMPLETE.md`
- Series of "STEP" files (`docs__STEP*_...`, `docs__STEP4_AND_BEYOND_ROADMAP.md`, `docs__STEP4_COMPLETE_IMPLEMENTATION_PLAN.md`, etc.)
- `docs__WEBSITE_IMPROVEMENT_ROADMAP.md`, `docs__FRONTEND_INTEGRATION_PLAN.md`

**Overlap**: Multiple milestone summaries referencing the same deliverables. 
**Action**: Extract actionable backlog items and consolidate success reports into a single timeline page.

## 6. Marketplace, Payments & Viewing Requests
- `BACKEND_TEST_FAILURES_MARKETPLACE.md`, `create_marketplace_tables.sql` references
- `GDPR_PAYMENT_ROUTE_ISSUES.md`, `GDPR_PAYMENT_FIX_PLAN.md`
- `docs__STEP3_VIEWING_REQUEST_PLAN.md`, `docs__PAYPAL_INTEGRATION_STATUS.md`, `docs__PAYPAL_TEST_COVERAGE_REPORT.md`, `docs__paypalstandard__*`

**Overlap**: Payment and marketplace readiness tracked in multiple places. 
**Action**: Produce one checklist covering Smart Matching, Payment, and Viewing flows, linking to live test evidence.

## 7. Branding & Marketing Assets
- `docs__LOGO_STATUS_REPORT.md`, `docs__LOGO_UPDATE_COMPLETE.md`, `docs__LOGO_USAGE_GUIDE.md`, `docs__TRADEMARK_LOGO_STATUS.md`
- `docs__FAVICON_INTEGRATION_COMPLETE.md`, `docs__TECHNICAL_DEMO_SCRIPT.md`
- `docs__LAUNCH_STRATEGY.md`, `docs__MISSION_SUCCESS_REPORT.md`

**Overlap**: Status reports claiming completion with no single landing page. 
**Action**: Merge into a brand kit with live asset links.

## 8. Realtime, PWA, Analytics
- `docs__ENABLE_REALTIME_GUIDE.md`, `docs__REALTIME_CHAT_COMPLETE.md`
- `docs__PWA_IMPLEMENTATION_COMPLETE.md`, `docs__PWA_SETUP_GUIDE.md`, `docs__open-source-docs__PWA_SETUP_GUIDE.md`
- `docs__NETLIFY_DEPLOYMENT.md`, `docs__NETLIFY_STATUS.md`
- `docs__SECURE_VIDEO_SYSTEM.md`, `docs__ANALYTICS_DASHBOARD` (implicit via backend routes)

**Overlap**: Implementation vs status duplicates. 
**Action**: Create a single “Realtime/PWA” section with operational guidance and remove duplicate success reports once validated.

## 9. Success & Completion Reports
- `DATABASE_DEPLOYED_SUCCESS.md`, `DATABASE_VERIFICATION_COMPLETE.md`, `ALL_TABLES_READY.md`
- `AUTHENTICATION_FIXED_STATUS.md`, `API_ENDPOINTS_COMPLETE_STATUS.md`, `API_GERMAN_SCHEMA_STATUS.md`
- `DOCUMENTATION_FIXES_COMPLETE.md`, `DEVELOPMENT_ISSUES_RESOLUTION_COMPLETE.md`, `MISSION_COMPLETE_FINAL_REPORT.md`
- `docs__FINAL_DEPLOYMENT_SUCCESS.md`, `docs__FINAL_SUCCESS_REPORT.md`, `docs__MISSION_SUCCESS_REPORT.md`

**Overlap**: Many “complete” statements without date/version context. 
**Action**: Replace with a single release notes file that references actual commits/tests.

## 10. Meta Planning & Audits
- `WORKSPACE_GAP_AUDIT.md`, `MISSING_PIECES_INVENTORY.md`, `GAP_ACTION_PLAN.md`, `WEB_FIX_FINDINGS.md`
- `TODO_REVIEW.md`, `IMPLEMENTATION_CHECKLIST.md`, `VERIFICATION_TESTING_PLAN.md`
- `PROJECT_WEAKNESSES_2025-10-08.md`, `IMPLEMENTATION_PROGRESS_2025-10-06.md`

**Overlap**: Current planning documents; keep these active but ensure they link to consolidated guides.

---

### Recommended Next Steps
1. **Decide on structure**: e.g., `/docs/index.md` with categories matching sections above.
2. **Archive or deprecate** duplicates (prefix with `_archive/` or move to `docs/archive/`).
3. **Map status docs to evidence**: link each “complete” claim to tests, migrations, or deployments.
4. **Automate updates**: consider a docs README table listing owner, last update, and source of truth.
