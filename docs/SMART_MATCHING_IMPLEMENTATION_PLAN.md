# Smart Matching Implementation Plan

## Objectives
- Deliver an operational smart matching backend service that replaces the current placeholder endpoints.
- Leverage existing Supabase tables (`matching_preferences`, `apartments`, `users`) to calculate relevant matches for tenants and landlords.
- Provide REST endpoints for retrieving matches and managing matching preferences, secured with the existing JWT middleware.
- Supply deterministic, testable scoring logic so the feature remains verifiable even when Supabase credentials are absent in local environments.

## Scope
- Service layer: `SmartMatchingService` responsible for fetching data, normalising preferences, scoring matches, and handling fallbacks.
- API layer: `/api/matching` route group exposing:
  - `GET /tenant` – tenant-centric apartment recommendations.
  - `GET /landlord` – landlord-centric tenant recommendations.
  - `GET /preferences` & `POST /preferences` – retrieve and upsert the authenticated user’s matching preferences.
- Documentation & tests: unit tests for scoring logic and service behaviour under mocked Supabase responses; update bug tracker once endpoints verified.

## Data Sources
- `matching_preferences`: stores persisted JSON preference payload plus numeric filters (budget, distance, etc.).
- `apartments`: source dataset for available listings (fields: price, rooms, amenities, geo coordinates, availability, etc.).
- `users` & optional tenant signals (saved searches, viewing history) for future refinement – not required for initial milestone but keep interface extensible.

## Implementation Steps
1. **Service Layer**
   - Create `SmartMatchingService.js` with helpers to normalise preference payloads (tenant vs landlord) and compute match scores with explainability metadata.
   - Implement Supabase queries with graceful handling when credentials are missing (return mock-friendly fallbacks, emit telemetry logs).
   - Support preference upsert/read operations using Supabase `upsert`.
2. **Routing Layer**
   - Add `routes/smartMatching.js` guarded by `auth` middleware for all endpoints.
   - Wire new router in `server.js` under `/api/matching`.
   - Ensure responses follow `{ success, data, meta, warnings }` convention used across newer endpoints.
3. **Testing**
   - Add Jest tests under `js/backend/tests` covering:
     - Scoring helper – deterministic outputs for sample preferences/apartments.
     - Service fallback when Supabase client is mocked or returns errors.
     - Route-level smoke test using Supertest with mocked Supabase.
4. **Documentation**
   - Update `docs/GOOGLE_FEEDBACK_BUG_STATUS.md` (B03) after endpoints verified.
   - Add API usage notes to `docs/API_ENDPOINTS_COMPLETE_STATUS.md` if required.

## Risks & Mitigations
- **Incomplete Supabase schema**: guard against missing columns by defensive checks and broad JSON parsing.
- **Performance**: initial version limits candidate sets (default ≤ 100 rows) before scoring; revisit for pagination later.
- **Data absence**: if preferences missing, return curated defaults with `fallbackUsed` flag in response.

## Deliverables
- `SmartMatchingService.js`
- `routes/smartMatching.js`
- Updated `server.js`
- Jest test suite (`smart-matching.service.test.js`)
- Status update in documentation once validated.
