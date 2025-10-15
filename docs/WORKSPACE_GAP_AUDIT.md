# Workspace Ga### PayPal payment flow ✅ **PRODUCTION-READY**
- **File**: `netlify/functions/paypal-payments.mjs`
- **Status**: All critical features implemented and verified (2025-10-06)
- **Completed features**:
  - ✅ Webhook signature validation via PayPal REST API `/v1/notifications/verify-webhook-signature` (`verifyPayPalWebhookSignature`).
  - ✅ Payment persistence to Supabase with idempotency on `resource.id` (`recordPaymentEvent` → `updatePaymentTransaction`).
  - ✅ User notifications for payment events (`createPaymentNotification`) covering success, failure, and refund scenarios.
_Last updated: 2025-10-06_

## Command recap

| Timestamp | Action |
|-----------|--------|
| 2025-10-06 | Repository-wide scan for markers (`TODO`, `FIXME`, `TBD`, `NOT IMPLEMENTED`) to surface incomplete implementation areas. |

The previous command history was empty in the active shell, so this audit begins with the above search sweep.

## High-priority runtime gaps

### PayPal payment flow
- **File**: `netlify/functions/paypal-payments.mjs`
- **Issues**:
  - Missing production-grade webhook signature validation (`paypal-transmission-*` headers are read but not verified).
  - Capture/denial/refund branches only log activity; persistence and user/admin notifications are undeveloped.
- **Risk**: Spoofed webhooks could manipulate subscription state, and real transactions never reconcile with Supabase, leading to billing disputes.
- **Actions**:
  - Integrate PayPals webhook validation (`paypal-checkout-server-sdk` or REST `verify-webhook-signature`).
  - Persist payment outcomes in Supabase with idempotency on `resource.id`.
  - Trigger notification workflows (email, in-app alerts) for success, failure, and refunds.

### User registration verification ✅ **PRODUCTION-READY**
- **Files**: `netlify/functions/auth-register.mjs`, `netlify/functions/utils/email.mjs`
- **Status**: Complete email verification system implemented (2025-10-06)
- **Completed features**:
  - ✅ Transactional email helper using Nodemailer (`sendVerificationEmail`).
  - ✅ Professional HTML/text templates with 24h token expiry and branded design.
  - ✅ Graceful soft-failure handling (registration proceeds even if email dispatch fails).
  - ✅ Send status tracked; verification link includes token and redirects to `/verify-email.html`.

## Legacy backend placeholders (Express `js/backend`)

| Endpoint | Location | Gap | Suggested remediation |
|----------|----------|-----|------------------------|
| `/api/admin/messages/:idx/resolve` | `routes/admin.js` | Uses canned response; no DB updates. | Wire to real ticket table and mark as resolved with actor + timestamp. |
| `/api/admin/reports/:idx/resolve` | `routes/admin.js` | Placeholder logic. | Hook into trust & safety reports storage. |
| `/api/admin/refunds/:idx/approve` | `routes/admin.js` | No integration with payment records. | Connect to payments service and log audit trail. |
| `/api/admin/refunds/:idx/deny` | `routes/admin.js` | Same as above. | Same remediation as approval endpoint. |
| `/api/admin/payments` | `routes/admin.js` | Returns static data. | Fetch real metrics from Supabase/PayPal datasets. |
| `/api/admin/payments/:id/refund` | `routes/admin.js` | Always succeeds; no refund API call. | Call PayPal/Supabase service layer and handle errors gracefully. |

Additional gap: Lines 184 & 198 highlight broader payment/refund persistence still pending.

## Notification backlog

- **File**: `js/backend/routes/viewing-requests.js`
- **Lines**: 311 & 354
- **Missing pieces**: Email (or push) notifications to tenants when viewing requests are approved or rejected.
- **Next steps**: Connect to notification service, ensure templates exist, and add integration tests to confirm dispatch.

## Frontend stubs

| File | Line(s) | Description |
|------|---------|-------------|
| `frontend/marketplace.html` | 658, 683 | Chat/contact flows not wired to backend APIs. |
| `frontend/marketplace.html` | 1039 | Payment submission not routed to backend. |
| `frontend/marketplace.html` | 12021214 | Sale workflow lacks backend calls and confirmation modal. |
| `frontend/viewing-requests-dashboard.html` | 955 | Request details modal not implemented. |
| `frontend/viewing-requests-dashboard.html` | 10711076 | Filtering UI missing behavior. |
| `frontend/index.html` & variants (`temp`, `.tmp`) | ~1943 | `assignedManager: 'TBD'` placeholder leaking into UI. |

### Advanced search filter compliance

The advanced search UI (`frontend/advanced-search.html`) diverges from the documented spec in `docs/SEARCH_API_DOCUMENTATION.md`. The matrix below reflects every required field.

| Spec requirement | Status | Notes |
| --- | --- | --- |
| City (`city`) | ✅ | Separate `#city` field captured and forwarded in query payload. |
| Area (`area`) | ✅ | Added dedicated `#area` input mapped to German `stadtteil`. |
| Move-in date (`moveInDate`) | ✅ | `input#move-in-date` present and passed to query. |
| Move-out date (`moveOutDate`) | ✅ | `input#move-out-date` present. |
| Earliest move-in (`earliestMoveIn`) | ✅ | Compact checkbox appended with query flag. |
| Time-slot type (`timeSlotType`) | ✅ | New timing select with flexible/fixed values. |
| Cold rent min/max (`minKaltmiete`/`maxKaltmiete`) | ✅ | Added dedicated Kaltmiete inputs feeding backend params. |
| Warm rent min/max (`minWarmmiete`/`maxWarmmiete`) | ✅ | Added Warmmiete fields in form and query. |
| Price preference (`priceType`) | ✅ | Dropdown controlling cold/warm/both filter logic. |
| Property type (`propertyType`) | ✅ | Options expanded (apartment, studio, loft, house, shared/private room). |
| Room count (`rooms`/`minRooms`/`maxRooms`) | ✅ | Numeric fields for min/max/exact room counts wired to query. |
| Single beds (`singleBeds`) | ✅ | Numeric input `#single-beds` mapped to Supabase filter. |
| Double beds (`doubleBeds`) | ✅ | Numeric input `#double-beds` mapped to Supabase filter. |
| Bathrooms (`bathrooms`) | ✅ | Select present. |
| Bedrooms (`bedrooms`) | ✅ | Numeric input replaces legacy select, allowing direct min bedroom filter. |
| Min size (`minSize`) | ✅ | Preserved min area input mapped as `minSize`. |
| Max size (`maxSize`) | ✅ | Added `#max-area` numeric input. |
| Furnished status (`furnishedStatus`) | ✅ | Select values normalized to `furnished`, `semi_furnished`, `unfurnished`. |
| Pet policy (`petsAllowed`) | ✅ | Boolean select emits `true`/`false` flags. |
| Exclude exchange offers (`excludeExchange`) | ✅ | Checkbox pushes `excludeExchange=true` into query string. |
| Sort order | ✅ | Client sort state feeds backend; service maps to `kaltmiete`/`available_from` as needed.

**Amenity coverage**

| Spec amenity | Status | Notes |
| --- | --- | --- |
| washing_machine | ✅ | Checkbox value switched to `washing_machine`. |
| dryer | ✅ | Added dedicated checkbox. |
| dishwasher | ✅ | Checkbox present. |
| tv | ✅ | Added checkbox with value `tv`. |
| lift | ✅ | Elevator checkbox now sends `lift`. |
| kitchen | ✅ | Checkbox present. |
| air_conditioning | ✅ | Checkbox present. |
| wifi | ✅ | Checkbox present. |
| heating | ✅ | Checkbox present. |
| private_bathroom | ✅ | Added checkbox value `private_bathroom`. |
| wheelchair_accessible | ✅ | Added checkbox value `wheelchair_accessible`. |
| balcony | ✅ | Distinct balcony checkbox retained. |
| terrace | ✅ | New dedicated terrace checkbox. |
| petsAllowed | ✅ | Boolean select replaces old string-based dropdown. |

**Immediate remediation tasks**

- ~~Add automated coverage (frontend integration + API tests) for the expanded advanced-search filter set.~~ ✅ Covered via `js/backend/tests/advanced-search-german-filters.test.js` & `routes-advanced-search-german.test.js` (2025-10-06).
- ~~Backfill Supabase seed data with the new schema fields (beds, rent bands, timeslot) to enable realistic demos.~~ ✅ Delivered in `supabase/migrations/202510060001_advanced_search_seed.sql` (2025-10-06).
- ~~Wire the updated filter metadata into the frontend dropdowns and add a regression test to ensure parity with `/api/search/filters`.~~ ✅ Completed: `loadFilterMetadata()` function added to `frontend/advanced-search.html` and regression test `js/backend/tests/routes-filters-metadata.test.js` passing (2025-10-06).

## Additional references

- **Docs**: `docs/docs__SUPABASE_MIGRATION.md` (and the open-source mirror) still list a "TODO" section cross-check after backend migration completes.
- **Security note**: `organized/md/BULLETPROOF_SECURITY_AUDIT.md` reports "Generated CSRF secret but not implemented"  ensure CSRF protection is live wherever forms remain.
- **GDPR tooling**: `netlify/functions/gdpr-tracking.mjs` flags certain compliance checks as "not implemented"; prioritize audit of those decision branches if GDPR workflows are in scope.

## Recommended next actions

1. **Lock down payments**: Implement PayPal webhook validation + persistence to eliminate spoofing risk.
2. **Restore onboarding email**: Connect verification mailer so new accounts progress to active.
3. **Replace admin placeholders**: Migrate each `/api/admin/*` stub to Supabase-backed services, logging actor IDs for compliance.
4. **Wire notifications**: Send transactional emails for viewing-request decisions.
5. **Close UI loops**: Ensure marketplace interactions (chat, payments, sales) reach backend APIs and provide feedback to users.
6. **Sweep documentation TODOs**: Update migration/security docs once code fixes land to avoid future drift.

Addressing the above will clear the outstanding "unbugged" items surfaced by this pass and bring parity between the modernized Netlify functions and legacy Express/frontend layers.
