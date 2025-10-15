# 🔍 NETLIFY FUNCTION MAPPING ANALYSIS

## FILES WE HAVE vs ROUTES WE NEED

### ✅ Authentication Functions (ALL EXIST!)

| Frontend Needs | Function File Exists | Redirect Needed |
|----------------|---------------------|-----------------|
| `/auth/login` | ✅ `auth-login.mjs` | ✅ ADDED |
| `/auth/verify` | ✅ `auth-verify.mjs` | ❌ MISSING |
| `/auth/resend-verification` | ✅ `auth-resend-verification.mjs` | ❌ MISSING |
| `/auth/health` | ✅ `auth-health.mjs` | ✅ ADDED |
| `/api/auth/verify` | ✅ `auth-verify.mjs` | ❌ MISSING |
| `/api/auth/forgot-password` | ✅ `auth-forgot-password.mjs` | ✅ EXISTS |
| `/api/auth/reset-password` | ✅ `auth-reset-password.mjs` | ✅ EXISTS |
| `/api/auth/me` | ✅ `auth-me.mjs` | ✅ EXISTS |

**SOLUTION:** We have ALL the auth functions! Just need to add the missing redirects.

---

### ✅ PayPal Functions (EXIST!)

| Frontend Needs | Function File | Notes |
|----------------|---------------|-------|
| `/api/paypal/config` | ❓ Check `paypal-integration.mjs` or `paypal-payments.mjs` | Need to look inside |
| `/api/paypal/create` | ❓ Check `paypal-payments.mjs` | Need to look inside |
| `/api/paypal/execute` | ❓ Check `paypal-payments.mjs` | Need to look inside |
| `/api/paypal/marketplace/capture` | ❓ Check `paypal-enterprise.mjs` | Need to look inside |

**Available Files:**
- `paypal-integration.mjs`
- `paypal-payments.mjs`
- `paypal-enterprise.mjs`

**ACTION NEEDED:** Check if these functions handle the routes internally, or if we need separate functions.

---

### ✅ Email Functions (EXIST!)

| Frontend Needs | Function File Exists |
|----------------|---------------------|
| `/api/emails/send-request-confirmation` | ✅ `email-service.mjs` or `email-notifications.mjs` |
| `/api/emails/test-email-config` | ✅ `email-management.mjs` |
| `/api/emails/send-viewing-confirmation` | ✅ `email-notifications.mjs` |
| `/api/emails/send-viewing-results` | ✅ `email-notifications.mjs` |

**Available Files:**
- `email-service.mjs`
- `email-notifications.mjs`
- `email-management.mjs`

**SOLUTION:** Need to check which function handles which route, then add redirects.

---

### ✅ Viewing Requests (EXISTS!)

| Frontend Needs | Function File |
|----------------|---------------|
| `/api/viewing-requests` | ✅ `viewing-requests.mjs` |
| `/api/viewing-requests/my-requests` | ✅ `viewing-requests.mjs` (likely handles sub-routes) |
| `/api/viewing-requests/my-properties` | ✅ `viewing-requests.mjs` (likely handles sub-routes) |

**SOLUTION:** Function exists! Need to add wildcard redirect for sub-routes.

---

### ✅ GDPR Functions (EXIST!)

| Frontend Needs | Function File |
|----------------|---------------|
| `/api/gdpr/consent` | ✅ `gdpr-compliance.mjs` or `consent-management.mjs` |
| `/api/gdpr/export` | ✅ `gdpr-compliance.mjs` |
| `/api/gdpr/account` | ✅ `gdpr-compliance.mjs` |
| `/api/gdpr/tracking-log` | ✅ `gdpr-tracking.mjs` |

**Available Files:**
- `gdpr-compliance.mjs`
- `gdpr-tracking.mjs`
- `consent-management.mjs`
- `privacy-controls.mjs`

---

### ✅ Performance Functions (EXIST!)

| Frontend Needs | Function File |
|----------------|---------------|
| `/api/performance/*` | ✅ `performance-optimization.mjs` or `performance-overview.mjs` |

**Available Files:**
- `performance-optimization.mjs`
- `performance-overview.mjs`
- `monitoring-dashboard.mjs`

---

### ✅ Admin Functions (EXIST!)

| Frontend Needs | Function File |
|----------------|---------------|
| `/api/admin/*` | ✅ `admin.mjs` |
| `/api/check-admin` | ✅ `admin.mjs` |

**Available Files:**
- `admin.mjs`
- `user-management.mjs`
- `system-administration.mjs`

---

## 🎯 KEY FINDINGS

### WE HAVE ALL THE FUNCTIONS! 🎉

The problem is **NOT missing functions**.  
The problem is **missing or incorrect REDIRECTS in netlify.toml**.

### What We Need to Do:

1. ✅ Check inside each function to see what routes it handles
2. ✅ Add the correct redirects in `netlify.toml`
3. ❌ DO NOT create new functions (they all exist!)

---

## 📋 NEXT STEPS

1. Check `paypal-payments.mjs` to see what routes it handles
2. Check `email-service.mjs` to see what routes it handles
3. Check `viewing-requests.mjs` to see if it handles sub-routes
4. Check `gdpr-compliance.mjs` to see what routes it handles
5. Add ALL missing redirects to `netlify.toml`
6. Deploy!
