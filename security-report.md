# 🔒 Security Audit Report

**Generated:** Mon Nov 17 03:13:59 UTC 2025
**Workflow:** 🔒 Automated Security & Dependency Management
**Commit:** e6beca5f9af635953d4776351b7d95d19380ca4c

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
INFO: Security report generated: /home/runner/work/SichrPlace/SichrPlace/security-report-1763349229513.json

=== SECURITY AUDIT COMPLETE ===
Total alerts: 0
Open alerts: 0
Critical/High: 0
Next audit: 2025-11-24T03:13:49.513Z

✅ All security vulnerabilities resolved!
```

## 🔄 Version Tracking Results
```
[2025-11-17T03:13:49.556Z] INFO: Starting automated version tracking...
[2025-11-17T03:13:50.175Z] INFO: tar-fs not found in direct dependencies
[2025-11-17T03:13:50.175Z] INFO: next not found in direct dependencies
[2025-11-17T03:13:50.175Z] INFO: esbuild not found in direct dependencies
[2025-11-17T03:13:50.175Z] INFO: http-proxy-middleware not found in direct dependencies
[2025-11-17T03:13:50.175Z] INFO: tmp not found in direct dependencies
[2025-11-17T03:13:50.175Z] INFO: on-headers not found in direct dependencies
[2025-11-17T03:13:50.175Z] INFO: ipx not found in direct dependencies
[2025-11-17T03:13:50.175Z] INFO: Found 0 vulnerabilities
[2025-11-17T03:13:50.176Z] INFO: Found 0 version mismatches
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
