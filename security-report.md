# 🔒 Security Audit Report

**Generated:** Wed Nov  5 03:09:24 UTC 2025
**Workflow:** 🔒 Automated Security & Dependency Management
**Commit:** 96358c8cfdd9b384d96de10cd1249e875f135538

## 📋 Audit Results
```
INFO: Starting comprehensive security audit...
gh: To use GitHub CLI in a GitHub Actions workflow, set the GH_TOKEN environment variable. Example:
  env:
    GH_TOKEN: ${{ github.token }}
ERROR: Failed to fetch GitHub alerts: Command failed: gh api repos/omer3kale/sichrplace/dependabot/alerts
gh: To use GitHub CLI in a GitHub Actions workflow, set the GH_TOKEN environment variable. Example:
  env:
    GH_TOKEN: ${{ github.token }}

INFO: Found 0 total GitHub alerts
INFO: Found 0 open GitHub alerts
INFO: Identified 0 high-risk packages
INFO: Generated 0 immediate fixes
INFO: Security report generated: /home/runner/work/SichrPlace/SichrPlace/security-report-1762312154454.json

=== SECURITY AUDIT COMPLETE ===
Total alerts: 0
Open alerts: 0
Critical/High: 0
Next audit: 2025-11-12T03:09:14.454Z

✅ All security vulnerabilities resolved!
```

## 🔄 Version Tracking Results
```
[2025-11-05T03:09:14.498Z] INFO: Starting automated version tracking...
[2025-11-05T03:09:15.132Z] INFO: tar-fs not found in direct dependencies
[2025-11-05T03:09:15.133Z] INFO: next not found in direct dependencies
[2025-11-05T03:09:15.133Z] INFO: esbuild not found in direct dependencies
[2025-11-05T03:09:15.133Z] INFO: http-proxy-middleware not found in direct dependencies
[2025-11-05T03:09:15.133Z] INFO: tmp not found in direct dependencies
[2025-11-05T03:09:15.133Z] INFO: on-headers not found in direct dependencies
[2025-11-05T03:09:15.133Z] INFO: ipx not found in direct dependencies
[2025-11-05T03:09:15.133Z] INFO: Found 0 vulnerabilities
[2025-11-05T03:09:15.133Z] INFO: Found 0 version mismatches
file:///home/runner/work/SichrPlace/SichrPlace/scripts/version-tracker.mjs:382
        .then(report => {
         ^

TypeError: tracker.run(...).then is not a function
    at file:///home/runner/work/SichrPlace/SichrPlace/scripts/version-tracker.mjs:382:10
    at ModuleJob.run (node:internal/modules/esm/module_job:325:25)
    at async ModuleLoader.import (node:internal/modules/esm/loader:606:24)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:5)

Node.js v20.19.5
```

## 🎯 Summary
- ✅ **Vulnerabilities Found:** NO
- 🛠️ **Fixes Applied:** YES

---
*This report was generated automatically by the SichrPlace Security System*
