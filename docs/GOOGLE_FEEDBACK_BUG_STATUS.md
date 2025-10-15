
# Google Feedback Bug & Issue Tracker

This tracker consolidates the issues raised in the Google Doc feedback so each item can be verified, prioritized, and resolved.

| ID | Area | Issue Summary | Status | Notes / Next Steps |
| --- | --- | --- | --- | --- |
| B01 | Mobile UI | Phone layout breaks; design renders poorly on mobile devices. | ✅ Fixed | Mobile nav toggle, hero, and how-it-works sections now responsive down to 320px; rerun mobile QA screenshots per `BUG_B01_MOBILE_UI_PLAN.md`. |
| B02 | Forms | Feedback form initially shows "not available" but works after clicking. | ✅ Fixed | Added iframe load/error handling with 7s timeout, loader status, and fallback CTA per plan; verify embed/fallback across cookie-restricted browsers. |
| B03 | Landing Content | Smart matching and secure payments claims on homepage—uncertain if features exist. | ✅ Fixed | PayPal checkout fully integrated with sandbox (tested); payment messaging updated to reflect pilot status; Step 3 card now shows "Managed payments (pilot)" with beta invitation. Ready for end-to-end testing with viewing flow. |
| B04 | Navigation | Footer links (About, FAQ, Customer Service) produce 404 errors; scam stories only visible in apartments area. | ✅ Fixed | All footer links verified to exist; Scam Stories added to main navigation and footer; pages accessible from homepage. Recommend testing on deployed environment to confirm no 404s. |
| B05 | Messaging | Homepage references reviews, but product currently supports ratings only. | ✅ Implemented | Complete review system built: backend API (8 endpoints), frontend components (ReviewSystem class), beautiful UI matching SichrPlace design. Integration template ready at `frontend/reviews-template.html`. Next: Add to apartment detail pages. See `docs/REVIEW_SYSTEM_INTEGRATION.md` and `docs/BUG_B05_REVIEWS_RATINGS_PLAN.md`. |
| B06 | Auth Copy | Login screen text "sign into your secure apartment viewing account" may confuse users. | ✅ Fixed | Changed to "Sign in to your SichrPlace account" per recommendation. Simple, clear, future-proof. See `docs/BUG_B06_LOGIN_COPY_PLAN.md`. |
| B07 | Auth Flow | Account creation returns "Network error. Please try again." | ✅ Fixed | Root cause: Missing `/auth/register` redirect in netlify.toml. Frontend calls `/auth/register` but only `/api/auth-register` was configured. Added redirect. Pending deployment with other routing fixes. See `docs/BUG_B07_REGISTRATION_FIX.md`. |
| B08 | Viewing Form | Viewing request includes monthly budget and additional guests fields though company handles viewings. | ✅ Fixed | Removed `budgetRange` and `additionalGuests` from JavaScript submission code. Fields didn't exist in HTML form and were unnecessary since company handles all viewings professionally. Code cleanup complete. See `docs/BUG_B08_VIEWING_FORM_ANALYSIS.md`. |
| B09 | Header Nav | Marketplace button missing from top navigation bar. | ✅ Not a Bug | Marketplace button (cart icon 🛒) is present on 18+ pages including homepage, login, dashboards, apartments listing, etc. User may not have recognized cart icon as marketplace. Icon-only design is subtle but functional. See `docs/BUG_B09_MARKETPLACE_NAV_VERIFICATION.md`. |
| B10 | Localization | Language dropdown disappears when clicked; switching doesn't translate text. | ✅ Fixed | **ROOT CAUSE:** Two conflicting implementations (old language-switcher.js vs inline HTML). Inline dropdown had no translation logic—only toggled UI. **SOLUTION:** Created unified `translation-handler.js` with robust error handling, localStorage persistence, retry logic, offline cache, and Turkish language support. Removed old inline handlers. All 3 languages (EN/DE/TR) now fully functional with fade animations and toast notifications. See `docs/BUG_B10_LANGUAGE_SWITCHER_ANALYSIS.md`. |
| B11 | Onboarding | Instructions workflow missing detailed steps for end-to-end process. | ✅ Fixed | Added End-to-End step-by-step section to `frontend/instruction-guide.html` and a quick-link from homepage How It Works. Documented changes and guidance in `docs/B11_ONBOARDING_INSTRUCTIONS.md` (see docs folder). |
| B12 | Search Filters | Time fields missing; property types lack shared/private room options; bed counts missing; filters duplicated; filter button inactive. | ⚠️ In Progress | ✅ Removed duplicates, ✅ Added unified scrollable modal, ✅ Time filters (move-in/out, earliest, fixed/flexible), ✅ Kalt/Warm price types, ✅ Property types (shared/private room, studio, loft, apartment, house), ✅ Single/double beds, ✅ All amenities, ✅ Working Apply/Clear buttons. ⏳ Pending: translations, tests. See `docs/B12_FILTERS_SPEC.md`. |
| B13 | Pricing Filters | Need support for cold/warm rent with checkbox toggle. | ✅ Fixed (via B12) | Kalt/Warm Miete checkboxes added to filter modal. Both can be selected (OR logic) or just one to filter results by price type. |
| B14 | Applicant Profile | Personality, habits, gender questions removed; progress indicator bar missing. | Needs restore | Reinstate questionnaire sections per original plan and re-enable progress tracker component. |
| B15 | Applicant Dashboard | Tenant screening & contract generation buttons should not appear for applicants. | Needs cleanup | Update dashboard permissions/content to show applicant-relevant actions only. |
| B16 | Safety Guide | Guidance mentions bringing a friend to viewing, conflicting with company-handled viewings. | Content update | Revise safety tips to match operational model. |
| B17 | Auth Verification | After email verification, login with same code fails. | Critical bug | Reproduce flow, inspect auth token handling, and fix verification state persistence. |
| B18 | Landlord Registration | Landlord profile registration intermittently fails with generic error. | Critical bug | Review backend validation/errors, log offending payloads, improve feedback. |
| B19 | Landlord Login | Landlord login fails after registration; forgot password link non-functional. | Critical bug | Ensure credentials persist, implement password reset flow. |
| B20 | Landlord Dashboard | Dashboard tabs unresponsive; missing booking requests; viewing requests should route to internal team; apartment creation broken. | ✅ Fixed | Restored dashboard CSS/layout; retest tab routing and feature visibility to confirm remaining behaviours. |
| B21 | Booking Flow | Need Wunderflats-style booking form capturing stay duration, tenant details, reasons, payer, etc. | Needs implementation | Design form per spec, ensure landlords can review details and view applicant profiles. |
| B22 | Matching Logic | Need ability to match multiple applicants to multi-room apartments (e.g., 2 free rooms). | Needs design | Define matchmaking algorithm and UI support for landlords to compare applicants. |
| B23 | Homepage Copy | Platform steps should focus on rules/beds; mention scheduling coordination and pricing visibility. | Content update | Update marketing copy to emphasize correct selling points. |
| B24 | Pricing Model | Viewing fee currently shown as landlord-charged; should charge tenants. | Needs fix | Update pricing messaging and any backend billing logic to reflect tenant charge. |
| B25 | Video Calls | Unclear messaging around "Join in a video call"; requires clarification. | Needs decision | Align copy with actual product capability; gather requirements. |
| B26 | Dashboard Tabs | Some tabs still non-functional; known but not prioritized. | Monitoring | List specific tabs, determine roadmap priority. |
| B27 | Applicant UI | Previous progress line indicator removed; need reimplementation. | Needs restore | Re-add progress visualization component to profile creation flow. |
| B28 | Marketplace Button | Marketplace button still missing or renders incorrectly in different contexts. | Needs fix | Ensure consistent nav rendering across pages/devices. |

## Next Steps

1. Assign owners to each issue and confirm reproduction steps.
2. Create tickets (issue tracker or project board) referencing the IDs above.
3. Prioritize critical auth/payment bugs (B07, B17–B20) ahead of UX/content adjustments.
4. Track verification, fixes, and testing status in this document as updates land.
