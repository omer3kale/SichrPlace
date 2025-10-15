# ESLint ESM Audit Report

Generated on 2025-10-14T09:59:03.528Z using `npx eslint`

## Summary

- Total files with findings: **132**
- Total errors: **34**
- Total warnings: **247**

### Top Files by Finding Count

| File | Errors | Warnings | Total |
| --- | ---: | ---: | ---: |
| `netlify/functions/advanced-search.mjs` | 0 | 16 | 16 |
| `netlify/functions/notifications.mjs` | 1 | 13 | 14 |
| `netlify/functions/email-management.mjs` | 5 | 8 | 13 |
| `netlify/functions/revenue-analytics.mjs` | 0 | 11 | 11 |
| `netlify/functions/email-notifications.mjs` | 0 | 10 | 10 |
| `netlify/functions/cache-management.mjs` | 6 | 3 | 9 |
| `netlify/functions/gdpr-compliance.mjs` | 0 | 8 | 8 |
| `netlify/functions/paypal-integration.mjs` | 0 | 8 | 8 |
| `netlify/functions/content-moderation.mjs` | 0 | 6 | 6 |
| `netlify/functions/favorites.mjs` | 3 | 3 | 6 |
| `netlify/functions/recently-viewed.mjs` | 0 | 6 | 6 |
| `netlify/functions/system-health-check.mjs` | 0 | 6 | 6 |
| `netlify/functions/add-property-legacy.mjs` | 0 | 5 | 5 |
| `netlify/functions/add-property.mjs` | 0 | 5 | 5 |
| `netlify/functions/apartments.mjs` | 1 | 4 | 5 |

### Most Frequent Rules

| Rule | Errors | Warnings | Total |
| --- | ---: | ---: | ---: |
| no-unused-vars | 0 | 247 | 247 |
| no-case-declarations | 9 | 0 | 9 |
| no-useless-catch | 9 | 0 | 9 |
| n/a | 7 | 0 | 7 |
| no-undef | 4 | 0 | 4 |
| no-useless-escape | 2 | 0 | 2 |
| no-dupe-keys | 1 | 0 | 1 |
| no-unreachable | 1 | 0 | 1 |
| no-extra-semi | 1 | 0 | 1 |

## Detailed Findings

### netlify/functions/advanced-search.mjs

- Errors: **0**, Warnings: **16**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 141 | 7 | warning | no-unused-vars | 'amenities' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 149 | 7 | warning | no-unused-vars | 'radius' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 279 | 31 | warning | no-unused-vars | 'queryParams' is defined but never used. Allowed unused args must match /^_/u. |
| 299 | 30 | warning | no-unused-vars | 'queryParams' is defined but never used. Allowed unused args must match /^_/u. |
| 314 | 31 | warning | no-unused-vars | 'queryParams' is defined but never used. Allowed unused args must match /^_/u. |
| 329 | 30 | warning | no-unused-vars | 'queryParams' is defined but never used. Allowed unused args must match /^_/u. |
| 376 | 34 | warning | no-unused-vars | 'queryParams' is defined but never used. Allowed unused args must match /^_/u. |
| 432 | 41 | warning | no-unused-vars | 'queryParams' is defined but never used. Allowed unused args must match /^_/u. |
| 486 | 32 | warning | no-unused-vars | 'queryParams' is defined but never used. Allowed unused args must match /^_/u. |
| 501 | 32 | warning | no-unused-vars | 'queryParams' is defined but never used. Allowed unused args must match /^_/u. |
| 519 | 29 | warning | no-unused-vars | 'queryParams' is defined but never used. Allowed unused args must match /^_/u. |
| 534 | 33 | warning | no-unused-vars | 'userId' is defined but never used. Allowed unused args must match /^_/u. |
| 534 | 41 | warning | no-unused-vars | 'queryParams' is defined but never used. Allowed unused args must match /^_/u. |
| 549 | 34 | warning | no-unused-vars | 'queryParams' is defined but never used. Allowed unused args must match /^_/u. |
| 564 | 48 | warning | no-unused-vars | 'queryParams' is defined but never used. Allowed unused args must match /^_/u. |
| 592 | 19 | warning | no-unused-vars | 'profile' is assigned a value but never used. Allowed unused vars must match /^_/u. |

### netlify/functions/notifications.mjs

- Errors: **1**, Warnings: **13**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 86 | 7 | warning | no-unused-vars | 'extractBearerToken' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 94 | 7 | warning | no-unused-vars | 'parseRequestBody' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 138 | 7 | warning | no-unused-vars | 'clampNumber' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 154 | 7 | warning | no-unused-vars | 'sanitizeUrl' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 189 | 7 | warning | no-unused-vars | 'normalizePriority' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 261 | 7 | warning | no-unused-vars | 'authorizeInternalRequest' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 344 | 7 | warning | no-unused-vars | 'safeCount' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 356 | 2 | error | no-extra-semi | Unnecessary semicolon. |
| 359 | 7 | warning | no-unused-vars | 'shouldSkipNotificationForPreferences' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 400 | 7 | warning | no-unused-vars | 'mapNotificationRecord' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 413 | 7 | warning | no-unused-vars | 'insertNotificationRecord' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 431 | 7 | warning | no-unused-vars | 'maybeSendPushNotification' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 616 | 16 | warning | no-unused-vars | 'record' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 645 | 10 | warning | no-unused-vars | 'profile' is assigned a value but never used. Allowed unused vars must match /^_/u. |

### netlify/functions/email-management.mjs

- Errors: **5**, Warnings: **8**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 39 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |
| 434 | 38 | warning | no-unused-vars | 'categoriesError' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 618 | 19 | warning | no-unused-vars | 'template' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 701 | 33 | warning | no-unused-vars | 'statsError' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 1075 | 9 | error | no-case-declarations | Unexpected lexical declaration in case block. |
| 1112 | 9 | error | no-case-declarations | Unexpected lexical declaration in case block. |
| 1162 | 7 | warning | no-unused-vars | 'reply_to_email' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 1163 | 7 | warning | no-unused-vars | 'bounce_handling_enabled' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 1164 | 7 | warning | no-unused-vars | 'tracking_enabled' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 1165 | 7 | warning | no-unused-vars | 'unsubscribe_link_enabled' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 1378 | 9 | error | no-case-declarations | Unexpected lexical declaration in case block. |
| 1404 | 9 | error | no-case-declarations | Unexpected lexical declaration in case block. |
| 1424 | 9 | error | no-case-declarations | Unexpected lexical declaration in case block. |

### netlify/functions/revenue-analytics.mjs

- Errors: **0**, Warnings: **11**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 2 | 10 | warning | no-unused-vars | 'mapArrayToFrontend' is defined but never used. Allowed unused vars must match /^_/u. |
| 13 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |
| 237 | 11 | warning | no-unused-vars | 'fee' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 340 | 59 | warning | no-unused-vars | 'users' is defined but never used. Allowed unused args must match /^_/u. |
| 427 | 47 | warning | no-unused-vars | 'users' is defined but never used. Allowed unused args must match /^_/u. |
| 631 | 36 | warning | no-unused-vars | 'startDate' is defined but never used. Allowed unused args must match /^_/u. |
| 631 | 47 | warning | no-unused-vars | 'endDate' is defined but never used. Allowed unused args must match /^_/u. |
| 639 | 41 | warning | no-unused-vars | 'startDate' is defined but never used. Allowed unused args must match /^_/u. |
| 639 | 52 | warning | no-unused-vars | 'endDate' is defined but never used. Allowed unused args must match /^_/u. |
| 646 | 35 | warning | no-unused-vars | 'startDate' is defined but never used. Allowed unused args must match /^_/u. |
| 646 | 46 | warning | no-unused-vars | 'endDate' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/email-notifications.mjs

- Errors: **0**, Warnings: **10**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 55 | 7 | warning | no-unused-vars | 'parseRequestBody' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 67 | 7 | warning | no-unused-vars | 'isUuid' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 71 | 7 | warning | no-unused-vars | 'clampNumber' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 117 | 7 | warning | no-unused-vars | 'safeInsert' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 133 | 7 | warning | no-unused-vars | 'safeUpdate' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 149 | 7 | warning | no-unused-vars | 'safeDelete' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 228 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |
| 622 | 40 | warning | no-unused-vars | 'countError' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 785 | 7 | warning | no-unused-vars | 'template_type' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 953 | 73 | warning | no-unused-vars | 'type' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/cache-management.mjs

- Errors: **6**, Warnings: **3**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 10 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |
| 171 | 3 | error | no-useless-catch | Unnecessary try/catch wrapper. |
| 224 | 3 | error | no-useless-catch | Unnecessary try/catch wrapper. |
| 249 | 3 | error | no-useless-catch | Unnecessary try/catch wrapper. |
| 295 | 3 | error | no-useless-catch | Unnecessary try/catch wrapper. |
| 302 | 17 | warning | no-unused-vars | 'key' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 351 | 3 | error | no-useless-catch | Unnecessary try/catch wrapper. |
| 359 | 17 | warning | no-unused-vars | 'key' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 441 | 3 | error | no-useless-catch | Unnecessary try/catch wrapper. |

### netlify/functions/gdpr-compliance.mjs

- Errors: **0**, Warnings: **8**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 12 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |
| 577 | 11 | warning | no-unused-vars | 'password' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 577 | 21 | warning | no-unused-vars | 'auth_tokens' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 582 | 11 | warning | no-unused-vars | 'internal_notes' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 591 | 11 | warning | no-unused-vars | 'deleted_at' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 605 | 11 | warning | no-unused-vars | 'internal_notes' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 605 | 27 | warning | no-unused-vars | 'admin_notes' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 610 | 11 | warning | no-unused-vars | 'raw_payment_data' is assigned a value but never used. Allowed unused vars must match /^_/u. |

### netlify/functions/paypal-integration.mjs

- Errors: **0**, Warnings: **8**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 56 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |
| 405 | 19 | warning | no-unused-vars | 'updatedPayment' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 469 | 23 | warning | no-unused-vars | 'capture_id' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 512 | 19 | warning | no-unused-vars | 'payment' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 706 | 19 | warning | no-unused-vars | 'refund' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 841 | 19 | warning | no-unused-vars | 'subscription' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 1008 | 19 | warning | no-unused-vars | 'payment' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 1133 | 9 | warning | no-unused-vars | 'refundId' is assigned a value but never used. Allowed unused vars must match /^_/u. |

### netlify/functions/content-moderation.mjs

- Errors: **0**, Warnings: **6**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 3 | 10 | warning | no-unused-vars | 'mapApartmentToFrontend' is defined but never used. Allowed unused vars must match /^_/u. |
| 3 | 34 | warning | no-unused-vars | 'mapReviewToFrontend' is defined but never used. Allowed unused vars must match /^_/u. |
| 23 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |
| 384 | 7 | warning | no-unused-vars | 'feedback' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 617 | 19 | warning | no-unused-vars | 'user' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 678 | 19 | warning | no-unused-vars | 'user' is assigned a value but never used. Allowed unused vars must match /^_/u. |

### netlify/functions/favorites.mjs

- Errors: **3**, Warnings: **3**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 98 | 7 | warning | no-unused-vars | 'safeInsert' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 110 | 7 | warning | no-unused-vars | 'safeDelete' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 167 | 13 | warning | no-unused-vars | 'user' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 207 | 3 | error | no-useless-catch | Unnecessary try/catch wrapper. |
| 247 | 3 | error | no-useless-catch | Unnecessary try/catch wrapper. |
| 322 | 3 | error | no-useless-catch | Unnecessary try/catch wrapper. |

### netlify/functions/recently-viewed.mjs

- Errors: **0**, Warnings: **6**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 122 | 7 | warning | no-unused-vars | 'safeInsert' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 138 | 7 | warning | no-unused-vars | 'safeUpdate' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 154 | 7 | warning | no-unused-vars | 'safeDelete' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 170 | 7 | warning | no-unused-vars | 'getAuthContext' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 227 | 7 | warning | no-unused-vars | 'getAuthenticatedUser' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 255 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/system-health-check.mjs

- Errors: **0**, Warnings: **6**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 30 | 7 | warning | no-unused-vars | 'respond' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 55 | 7 | warning | no-unused-vars | 'safeCount' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 65 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |
| 79 | 11 | warning | no-unused-vars | 'includeHealth' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 95 | 19 | warning | no-unused-vars | 'dbTest' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 302 | 17 | warning | no-unused-vars | 'check' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/add-property-legacy.mjs

- Errors: **0**, Warnings: **5**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 11 | 7 | warning | no-unused-vars | 'supabase' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 93 | 9 | warning | no-unused-vars | 'utilities_included' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 99 | 9 | warning | no-unused-vars | 'washing_machine' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 100 | 9 | warning | no-unused-vars | 'dishwasher' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 101 | 9 | warning | no-unused-vars | 'microwave' is assigned a value but never used. Allowed unused vars must match /^_/u. |

### netlify/functions/add-property.mjs

- Errors: **0**, Warnings: **5**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 304 | 5 | warning | no-unused-vars | 'utilities_included' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 310 | 5 | warning | no-unused-vars | 'washing_machine' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 311 | 5 | warning | no-unused-vars | 'dishwasher' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 312 | 5 | warning | no-unused-vars | 'microwave' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 454 | 43 | warning | no-unused-vars | 'authContext' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/apartments.mjs

- Errors: **1**, Warnings: **4**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 2 | 34 | warning | no-unused-vars | 'mapArrayToFrontend' is defined but never used. Allowed unused vars must match /^_/u. |
| 11 | 7 | warning | no-unused-vars | 'supabase' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 103 | 5 | error | no-dupe-keys | Duplicate key 'total_rent'. |
| 134 | 13 | warning | no-unused-vars | 'user' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 134 | 19 | warning | no-unused-vars | 'profile' is assigned a value but never used. Allowed unused vars must match /^_/u. |

### netlify/functions/email-service.mjs

- Errors: **0**, Warnings: **4**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 51 | 7 | warning | no-unused-vars | 'respond' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 88 | 7 | warning | no-unused-vars | 'safeInsert' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 98 | 7 | warning | no-unused-vars | 'safeUpdate' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 108 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/paypal-enterprise.mjs

- Errors: **0**, Warnings: **4**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 64 | 61 | warning | no-unused-vars | 'webhookId' is defined but never used. Allowed unused args must match /^_/u. |
| 574 | 32 | warning | no-unused-vars | 'description' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 755 | 44 | warning | no-unused-vars | 'captureResult' is defined but never used. Allowed unused args must match /^_/u. |
| 850 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/privacy-controls.mjs

- Errors: **0**, Warnings: **4**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 12 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |
| 138 | 38 | warning | no-unused-vars | 'processingError' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 216 | 19 | warning | no-unused-vars | 'updatedUser' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 289 | 41 | warning | no-unused-vars | 'eventsError' is assigned a value but never used. Allowed unused vars must match /^_/u. |

### netlify/functions/realtime-chat.mjs

- Errors: **0**, Warnings: **4**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 108 | 7 | warning | no-unused-vars | 'safeInsert' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 124 | 7 | warning | no-unused-vars | 'safeUpdate' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 140 | 7 | warning | no-unused-vars | 'safeDelete' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 211 | 7 | warning | no-unused-vars | 'httpErrorOld' is assigned a value but never used. Allowed unused vars must match /^_/u. |

### netlify/functions/system-administration.mjs

- Errors: **0**, Warnings: **4**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 22 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |
| 343 | 19 | warning | no-unused-vars | 'backup' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 517 | 29 | warning | no-unused-vars | 'metric' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 783 | 29 | warning | no-unused-vars | 'metric_type' is assigned a value but never used. Allowed unused vars must match /^_/u. |

### netlify/functions/viewing-requests.mjs

- Errors: **0**, Warnings: **4**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 144 | 7 | warning | no-unused-vars | 'safeInsert' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 160 | 7 | warning | no-unused-vars | 'safeUpdate' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 176 | 7 | warning | no-unused-vars | 'safeDelete' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 234 | 7 | warning | no-unused-vars | 'fetchUserProfile' is assigned a value but never used. Allowed unused vars must match /^_/u. |

### netlify/functions/webhook-management.mjs

- Errors: **1**, Warnings: **3**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 5 | 7 | warning | no-unused-vars | 'supabase' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 7 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |
| 83 | 11 | error | no-case-declarations | Unexpected lexical declaration in case block. |
| 128 | 27 | warning | no-unused-vars | 'updates' is assigned a value but never used. Allowed unused vars must match /^_/u. |

### netlify/functions/advanced-logging.mjs

- Errors: **2**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |
| 76 | 11 | error | no-case-declarations | Unexpected lexical declaration in case block. |
| 96 | 11 | error | no-case-declarations | Unexpected lexical declaration in case block. |

### netlify/functions/backup-recovery.mjs

- Errors: **1**, Warnings: **2**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 5 | 7 | warning | no-unused-vars | 'supabase' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 7 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |
| 81 | 11 | error | no-case-declarations | Unexpected lexical declaration in case block. |

### netlify/functions/chats.mjs

- Errors: **0**, Warnings: **3**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 2 | 30 | warning | no-unused-vars | 'mapUserToFrontend' is defined but never used. Allowed unused vars must match /^_/u. |
| 2 | 49 | warning | no-unused-vars | 'mapApartmentToFrontend' is defined but never used. Allowed unused vars must match /^_/u. |
| 145 | 19 | warning | no-unused-vars | 'profile' is assigned a value but never used. Allowed unused vars must match /^_/u. |

### netlify/functions/conversations.mjs

- Errors: **0**, Warnings: **3**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 138 | 7 | warning | no-unused-vars | 'safeUpdate' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 250 | 7 | warning | no-unused-vars | 'getAuthenticatedUser' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 302 | 38 | warning | no-unused-vars | 'event' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/file-upload.mjs

- Errors: **0**, Warnings: **3**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 2 | 8 | warning | no-unused-vars | 'multer' is defined but never used. Allowed unused vars must match /^_/u. |
| 332 | 19 | warning | no-unused-vars | 'uploadData' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 522 | 21 | warning | no-unused-vars | 'profile' is assigned a value but never used. Allowed unused vars must match /^_/u. |

### netlify/functions/messages.mjs

- Errors: **0**, Warnings: **3**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 124 | 7 | warning | no-unused-vars | 'safeInsert' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 140 | 7 | warning | no-unused-vars | 'safeUpdate' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 156 | 7 | warning | no-unused-vars | 'safeDelete' is assigned a value but never used. Allowed unused vars must match /^_/u. |

### netlify/functions/tenant-screening-financial.mjs

- Errors: **0**, Warnings: **3**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 12 | 44 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |
| 272 | 44 | warning | no-unused-vars | 'supabase' is defined but never used. Allowed unused args must match /^_/u. |
| 272 | 54 | warning | no-unused-vars | 'user' is defined but never used. Allowed unused args must match /^_/u. |

### organized/js/test-complete-function-coverage.js

- Errors: **3**, Warnings: **0**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 77 | 52 | error | no-undef | 'window' is not defined. |
| 238 | 3 | error | no-undef | 'window' is not defined. |
| 241 | 3 | error | no-undef | 'document' is not defined. |

### netlify/functions/advanced-health-check.mjs

- Errors: **0**, Warnings: **2**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 12 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |
| 45 | 15 | warning | no-unused-vars | 'data' is assigned a value but never used. Allowed unused vars must match /^_/u. |

### netlify/functions/auth-register.mjs

- Errors: **2**, Warnings: **0**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 93 | 34 | error | no-useless-escape | Unnecessary escape character: \(. |
| 93 | 36 | error | no-useless-escape | Unnecessary escape character: \). |

### netlify/functions/cache-optimization.mjs

- Errors: **0**, Warnings: **2**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |
| 50 | 28 | warning | no-unused-vars | 'data' is assigned a value but never used. Allowed unused vars must match /^_/u. |

### netlify/functions/csrf-token.mjs

- Errors: **0**, Warnings: **2**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 11 | 7 | warning | no-unused-vars | 'supabase' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 41 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/data-migration-utilities.mjs

- Errors: **0**, Warnings: **2**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 5 | 7 | warning | no-unused-vars | 'supabase' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 7 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/database-administration.mjs

- Errors: **0**, Warnings: **2**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 5 | 7 | warning | no-unused-vars | 'supabase' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 7 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/error-tracking.mjs

- Errors: **0**, Warnings: **2**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 81 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |
| 119 | 13 | warning | no-unused-vars | 'data' is assigned a value but never used. Allowed unused vars must match /^_/u. |

### netlify/functions/financial-management.mjs

- Errors: **0**, Warnings: **2**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 5 | 7 | warning | no-unused-vars | 'supabase' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 7 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/health.mjs

- Errors: **0**, Warnings: **2**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 61 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |
| 92 | 21 | warning | no-unused-vars | 'testData' is assigned a value but never used. Allowed unused vars must match /^_/u. |

### netlify/functions/hello.mjs

- Errors: **0**, Warnings: **2**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 31 | warning | no-unused-vars | 'event' is defined but never used. Allowed unused args must match /^_/u. |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/performance-overview.mjs

- Errors: **0**, Warnings: **2**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 12 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |
| 46 | 19 | warning | no-unused-vars | 'dbTest' is assigned a value but never used. Allowed unused vars must match /^_/u. |

### netlify/functions/search.mjs

- Errors: **0**, Warnings: **2**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 72 | 7 | warning | no-unused-vars | 'isValidEmail' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 91 | 7 | warning | no-unused-vars | 'getAuthContext' is assigned a value but never used. Allowed unused vars must match /^_/u. |

### netlify/functions/security-monitoring.mjs

- Errors: **0**, Warnings: **2**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 5 | 7 | warning | no-unused-vars | 'supabase' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 7 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/system-utilities.mjs

- Errors: **0**, Warnings: **2**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |
| 65 | 23 | warning | no-unused-vars | 'data' is assigned a value but never used. Allowed unused vars must match /^_/u. |

### netlify/functions/tenant-screening-references.mjs

- Errors: **0**, Warnings: **2**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 12 | 44 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |
| 275 | 19 | warning | no-unused-vars | 'updatedRef' is assigned a value but never used. Allowed unused vars must match /^_/u. |

### netlify/functions/tenant-screening-schufa.mjs

- Errors: **0**, Warnings: **2**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 12 | 44 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |
| 283 | 34 | warning | no-unused-vars | 'personalData' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/test-apartments.mjs

- Errors: **0**, Warnings: **2**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 3 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |
| 68 | 38 | warning | no-unused-vars | 'count' is assigned a value but never used. Allowed unused vars must match /^_/u. |

### netlify/functions/third-party-integrations.mjs

- Errors: **0**, Warnings: **2**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 33 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |
| 47 | 24 | warning | no-unused-vars | 'queryParams' is assigned a value but never used. Allowed unused vars must match /^_/u. |

### organized/js/domain-security-monitor.mjs

- Errors: **0**, Warnings: **2**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 11 | 7 | warning | no-unused-vars | 'BACKUP_DOMAIN' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 249 | 13 | warning | no-unused-vars | 'url' is assigned a value but never used. Allowed unused vars must match /^_/u. |

### scripts/dependency-security-manager.mjs

- Errors: **0**, Warnings: **2**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 351 | 19 | warning | no-unused-vars | 'npmAudit' is assigned a value but never used. Allowed unused vars must match /^_/u. |
| 352 | 19 | warning | no-unused-vars | 'dependencyTree' is assigned a value but never used. Allowed unused vars must match /^_/u. |

### netlify/functions/accessibility-inclusive-design.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/admin.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 181 | 13 | warning | no-unused-vars | 'user' is assigned a value but never used. Allowed unused vars must match /^_/u. |

### netlify/functions/advanced-media-processing.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/ai-machine-learning.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/ai-ml-services.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/api-gateway.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/auth-forgot-password.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 100 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/auth-resend-verification.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 14 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/auth-reset-password.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 110 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/auth-verify-reset-token.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 15 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/auth-verify.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 94 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/blockchain-integration.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/booking-requests.mjs

- Errors: **1**, Warnings: **0**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 361 | 3 | error | no-unreachable | Unreachable code. |

### netlify/functions/business-intelligence-analytics.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/compliance-reporting.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/configuration-management.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/consent-management.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 12 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/deployment-management.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/development-debugging-tools.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/enterprise-platform-overview.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/enterprise-solutions.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/external-api-integrations.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 6 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/feedback.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 7 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/gamification-rewards.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/geolocation-analytics.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/insurance-integration.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/internationalization-localization.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/iot-device-management.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/legal-compliance.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/maps-distance.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 52 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/maps-geocode.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 49 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/maps-nearby-places.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 56 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/maps-place-types.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 7 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/maps-reverse-geocode.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 7 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/maps-search-by-location.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 17 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/media-processing-cdn.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/mobile-api-services.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/monitoring-dashboard.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 7 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/paypal-payments.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 456 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/performance-optimization.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/regulatory-compliance.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/reviews.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 149 | 7 | warning | no-unused-vars | 'safeCount' is assigned a value but never used. Allowed unused vars must match /^_/u. |

### netlify/functions/service-marketplace.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/simple-error-tracking.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 2 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/simple-health.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/social-networking.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/status-page.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 7 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/tenant-screening-employment.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 12 | 44 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/test.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/testing-utilities.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/user-activity-tracking.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 310 | 7 | warning | no-unused-vars | 'safeCount' is assigned a value but never used. Allowed unused vars must match /^_/u. |

### netlify/functions/vr-ar-integration.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### netlify/functions/workflow-automation.mjs

- Errors: **0**, Warnings: **1**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 1 | 38 | warning | no-unused-vars | 'context' is defined but never used. Allowed unused args must match /^_/u. |

### organized/js/test-account-creation.js

- Errors: **1**, Warnings: **0**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 185 | 3 | error | no-undef | 'window' is not defined. |

### organized/js/test-all-functions.js

- Errors: **1**, Warnings: **0**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 5 | 1 | error | n/a | Parsing error: 'import' and 'export' may appear only with 'sourceType: module' |

### organized/js/test-production-security.js

- Errors: **1**, Warnings: **0**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 2 | 1 | error | n/a | Parsing error: 'import' and 'export' may appear only with 'sourceType: module' |

### organized/js/test-tenant-screening-apis.js

- Errors: **1**, Warnings: **0**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 7 | 1 | error | n/a | Parsing error: 'import' and 'export' may appear only with 'sourceType: module' |

### scripts/preflight.js

- Errors: **1**, Warnings: **0**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 14 | 1 | error | n/a | Parsing error: 'import' and 'export' may appear only with 'sourceType: module' |

### scripts/secret-scan.js

- Errors: **1**, Warnings: **0**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 3 | 1 | error | n/a | Parsing error: 'import' and 'export' may appear only with 'sourceType: module' |

### scripts/validate-security.js

- Errors: **1**, Warnings: **0**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 8 | 1 | error | n/a | Parsing error: 'import' and 'export' may appear only with 'sourceType: module' |

### scripts/verify-tenant-screening-migration.js

- Errors: **1**, Warnings: **0**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
| 12 | 1 | error | n/a | Parsing error: 'import' and 'export' may appear only with 'sourceType: module' |

### netlify/functions/__tests__/setup.js

- Errors: **0**, Warnings: **0**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |

### netlify/functions/advanced-analytics.mjs

- Errors: **0**, Warnings: **0**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |

### netlify/functions/analytics-stats.mjs

- Errors: **0**, Warnings: **0**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |

### netlify/functions/auth-login.mjs

- Errors: **0**, Warnings: **0**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |

### netlify/functions/auth-me.mjs

- Errors: **0**, Warnings: **0**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |

### netlify/functions/gdpr-tracking.mjs

- Errors: **0**, Warnings: **0**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |

### netlify/functions/realtime-communication.mjs

- Errors: **0**, Warnings: **0**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |

### netlify/functions/user-engagement-analytics.mjs

- Errors: **0**, Warnings: **0**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |

### netlify/functions/user-management.mjs

- Errors: **0**, Warnings: **0**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |

### netlify/functions/user-profile.mjs

- Errors: **0**, Warnings: **0**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |

### netlify/functions/utils/email.mjs

- Errors: **0**, Warnings: **0**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |

### netlify/functions/utils/field-mapper.mjs

- Errors: **0**, Warnings: **0**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |

### organized/js/production-readiness-assessment.mjs

- Errors: **0**, Warnings: **0**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |

### organized/js/pwa-enhancement.js

- Errors: **0**, Warnings: **0**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |

### organized/js/quick-test.js

- Errors: **0**, Warnings: **0**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |

### organized/js/test-paypal-quick.mjs

- Errors: **0**, Warnings: **0**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |

### organized/js/test-registration-system.mjs

- Errors: **0**, Warnings: **0**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |

### organized/js/test-simple-api.js

- Errors: **0**, Warnings: **0**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |

### scripts/listSupabaseTables.mjs

- Errors: **0**, Warnings: **0**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |

### scripts/replaceGermanFields.mjs

- Errors: **0**, Warnings: **0**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |

### scripts/version-tracker.mjs

- Errors: **0**, Warnings: **0**

| Line | Column | Severity | Rule | Message |
| ---: | ---: | --- | --- | --- |
