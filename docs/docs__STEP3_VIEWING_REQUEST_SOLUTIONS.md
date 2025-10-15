# Step 3 Viewing Request Solutions

Concrete steps to launch an end-to-end viewing request workflow spanning APIs, dashboards, automation, and payments.

## 1. API Completion & Hardening
- Implement the remaining REST endpoints in `backend/routes/viewing-requests.js`, following Express routing patterns and HTTP verbs (`GET`, `POST`, `PATCH`, `DELETE`) so tenants, landlords, and admins can manage the full lifecycle.[^express-routing]
- Add query parameter parsing for filters (status, date range, property ID) and apply pagination defaults to protect against unbounded Supabase scans.
- Guard each route with JWT middleware and role checks—tenants view their own requests, landlords interact with their properties, admins access the global collection.

## 2. Status & Payment Transitions
- Create controller helpers that change status (`approve`, `reject`, `complete`) and emit consistent activity logs; store previous status and timestamp for auditing.
- Integrate PayPal capture callbacks so `PATCH /api/viewing-requests/:id/payment` updates the request only when the capture webhook validates the payment.
- Expose summary endpoints (counts by status, upcoming appointments) consumed by dashboards for quick overviews.

## 3. Tenant & Landlord Interfaces
- Wire `viewing-request.html` to load available apartments, pre-fill context, and submit requests with bearer tokens; show readable validation errors when required fields are missing.
- Build tenant dashboards that list requests with status chips, next steps, and ability to cancel or reschedule when allowed.
- Deliver landlord dashboards summarizing incoming requests, with in-place approve/reject controls and quick links to contact the tenant.

## 4. Email & Notification Automation
- Use the existing email service to dispatch confirmation, approval, rejection, and reminder emails; customize the templates so links route back to the correct domain and include fallback OTP tokens if provider prefetch is a risk.[^supabase-email]
- Schedule reminder jobs (cron or queue) to notify both parties 24 hours before confirmed appointments, skipping reminders when status changes to cancelled.
- Log all outbound notifications with correlation IDs so support can troubleshoot “missing email” reports quickly.

## 5. Calendar & Availability Enhancements
- Add availability endpoints for landlords to declare open slots; enforce conflict detection when tenants request overlapping times.
- Provide ICS calendar downloads and optional Google Calendar deep links to increase attendance rates.
- Store follow-up notes after appointments (e.g., recommended next steps) to aid post-viewing workflows.

## 6. Quality Gates & Documentation
- Cover the new endpoints with integration tests (success + failure paths) and persist fixtures for Supabase so CI reproduces real data scenarios.
- Update `docs__STEP3_VIEWING_REQUEST_PLAN.md` with route signatures, UI screenshot references, and email template file paths.
- Add a runbook to `docs/PROJECT_STATUS_TRACKER.md` describing who monitors appointment volumes, payment reconciliation, and email delivery metrics.

[^express-routing]: Express.js Guide, "Routing" – <https://expressjs.com/en/guide/routing.html>
[^supabase-email]: Supabase Docs, "Auth Email Templates" – <https://supabase.com/docs/guides/auth/auth-email-templates>
