# Outstanding TODO Review

_Last updated: 2024-03-17_

## Overview

A workspace scan was executed to identify pending TODO markers across critical runtime paths. The results cluster around user onboarding and the PayPal payment pipeline. This document captures the exact locations, the gap they represent, and recommended follow-up to fully harden production behavior.

## Findings

### 1. Registration Email Delivery

- **File**: `netlify/functions/auth-register.mjs`
- **Line**: 231
- **Current state**: Registration succeeds but stops short of dispatching a verification email. A try/catch wrapper exists, yet the underlying SMTP/OAuth provider call is stubbed out.
- **Impact**: New users never receive verification links, blocking account activation flows that depend on email confirmation.
- **Suggested action**:
  - Integrate the existing transactional email service (e.g., Resend, SendGrid, or Supabase SMTP).
  - Implement a `sendVerificationEmail(email, token)` helper that queues or sends the templated message and logs failures to observability tooling.
  - Update tests to assert that the email helper is called and failures are handled gracefully.

### 2. PayPal Webhook Hardening

- **File**: `netlify/functions/paypal-payments.mjs`
- **Lines**: 323–365
- **Current state**: Capture, denial, and refund events log correctly, but downstream state management and messaging are unimplemented. Production signature verification is also missing and currently only logs required headers.
- **Impact**: Without signature validation an attacker could spoof webhook notifications. Missing persistence and notifications mean subscription/payment state will fall out of sync with PayPal.
- **Suggested action**:
  - **Signature verification**: Use PayPals Webhook SDK (`@paypal/webhooks` or REST validation endpoint) to verify the transmission signature, timestamp, and certificate chain before processing events.
  - **State updates**: Connect to the Supabase/Postgres layer (likely `payments` or `subscriptions` table) to record successful, denied, and refunded captures, ensuring idempotency via PayPal `resource.id`.
  - **Notifications**: Trigger user/admin notifications (email or in-app) upon completion or failure, leveraging the projects notification service to keep stakeholders informed.
  - **Error handling**: Ensure each branch returns actionable responses or re-queues for retry when persistence fails.

## Next Steps

1. Prioritize implementing PayPal webhook verification to close the most critical security gap.
2. Wire up the email verification helper so new accounts transition to active status smoothly.
3. Add automated tests (unit/integration) covering both pathways to prevent regressions once the fixes land.

Completing the above will eliminate the remaining TODO markers surfaced by the scan and bring the payment/auth flows to production readiness.
