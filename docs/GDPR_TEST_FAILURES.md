# GDPR Test Failures – 2025-10-08

All 32 failing cases from `npm test -- --runInBand --testPathPattern=gdpr` are catalogued below. Each entry captures the assertion that failed, what Jest reported, and the most immediate diagnosis pulled from the implementation.

## js/backend/tests/gdpr-clean.test.js

1. **Service Integration › should integrate with real GdprService**  
   • *Observed:* `typeof GdprService` resolves to `'function'`.  
   • *Expected:* `'object'`.  
   • *Diagnosis:* `GdprService` is exported as a class (function constructor). The test either needs to instantiate `new GdprService()` or update the expectation to accept the class.

## js/backend/tests/frontend-gdpr.test.js

2. **GDPR Request Form › should handle form submission errors gracefully**  
   • *Observed:* `result.success` came back `true` even after `fetch.mockRejectedValueOnce`.  
   • *Diagnosis:* The helper `simulateGdprRequestSubmission` only returns `{ success: false }` when the mocked `fetch` rejects. A previous mock left `fetch.mockResolvedValue` in place; we need to reset mocks between tests or explicitly mock `.reject` for this case.

3. **Privacy Settings Management › should load current consent preferences**  
   • *Observed:* The test threw `Network error` before assertions.  
   • *Diagnosis:* The rejected fetch from the previous test leaks into this one; `fetch.mockRejectedValueOnce` is still active when `loadUserPreferences()` runs.

4. **Privacy Settings Management › should update consent preferences**  
   • *Observed:* `result.success` is `undefined`.  
   • *Diagnosis:* The helper `saveConsentPreferences` returns the parsed JSON only when `response.ok` is truthy. The fetch mock should resolve with `{ ok: true, json: () => ({ success: true }) }`, but the mock appears to short-circuit because the preceding rejection was never cleared.

## js/backend/tests/routes-advanced-gdpr.test.js

The advanced routes suite has 18 discrete failures. Core themes: routes missing (404), mismatched endpoint names (tests hit `/breaches` while the router exposes `/data-breaches`), and response shape differences (tests expect `total`, `timestamp` as `Date`, etc.).

| # | Test description | Jest message | Diagnosis |
|---|------------------|--------------|-----------|
| 5 | GET consent purposes › should return consent purposes with pagination | `response.body.total` is `undefined` | Actual route returns `pagination.totalItems`; test needs to read from `pagination` or route must add a `total` alias. |
| 6 | GET consent purposes › should handle invalid pagination parameters | *(passes)* | — |
| 7 | GET requests › should return all GDPR requests for admin | Received 404 | No `router.get('/requests')` implementation inside `advancedGdpr.js`; endpoint missing. |
| 8 | GET requests › should filter requests by status | Received 404 | Same missing endpoint. |
| 9 | PUT request status › should update request status successfully | Received 404 | No matching `PUT /requests/:id/status` route. |
| 10 | PUT request status › should validate status field | Expected 400, received 404 | Same missing route. |
| 11 | PUT request status › should handle non-existent request | Expected 500, received 404 | Same missing route. |
| 12 | POST breach › should report data breach successfully | Expected 201, received 404 | Router exposes `POST /data-breaches`; tests call `/breach`. Update route or test. |
| 13 | POST breach › should validate breach data | Expected 400, received 404 | Same mismatch. |
| 14 | GET breaches › should return data breaches | Expected 200, received 404 | Router exposes `/data-breaches`; test uses `/breaches`. |
| 15 | GET breaches › should filter breaches by severity | Expected 200, received 404 | Same mismatch. |
| 16 | POST DPIA › should create DPIA successfully | Expected 201, received 400 | Route expects body compatible with Mongoose model; test payload likely violates schema (e.g., missing `processName`, `riskLevel`). |
| 17 | POST DPIA › should validate DPIA data | `response.body.errors` undefined | Validation logic absent; route returns generic 400 without error payload. |
| 18 | GET compliance scan › should run compliance scan successfully | Timestamp type mismatch (`Date` vs `string`) | Route serialises timestamp with `toISOString`; test expects raw Date object. |
| 19 | GET compliance scan › should handle compliance scan errors | *(passes)* | — |
| 20 | GET compliance dashboard › should return compliance dashboard data | Expected 200, received 500 | Downstream service throws; route currently wraps everything in `try/catch` and returns 500 with generic message. |
| 21 | GET compliance report JSON | Expected 200, received 404 | Route exposes `/compliance/report` only under admin namespace in Netlify layer; Express router doesn’t implement it. |
| 22 | GET compliance report CSV | Expected 200, received 404 | Same as above. |
| 23 | POST compliance daily check | Timestamp type mismatch (`Date` vs string) | Mock expects a `Date` instance; route serialises to ISO string. |
| 24 | Error handling › should handle unauthorized access | Expected 401, received 404 | Because the target route (`/requests`) is missing, Express falls back to 404 before auth runs.

> Fail numbers align with the master count; rows marked “passes” are included for continuity with the suite order but do not affect the failure tally.

## js/backend/tests/routes-gdpr.test.js

25. **POST consent › should handle consent recording errors**  
    • *Observed:* `response.body.error` is `undefined`.  
    • *Diagnosis:* The router returns `{ success: false, message: 'Internal server error' }`. Either populate an `error` field or adjust the expectation.

26. **POST withdraw-consent › should withdraw user consent successfully**  
    • *Observed:* Received HTTP 400.  
    • *Diagnosis:* Validator rejects the payload because the route expects `consentType` rather than `consentId`; request schema mismatch.

27. **POST request › should create GDPR request successfully**  
    • *Observed:* Received status 200 (test expects 201).  
    • *Diagnosis:* Route currently responds with `res.json()` (implicit 200). Update to `res.status(201)` or relax the test.

28. **POST request › should prevent duplicate pending requests**  
    • *Observed:* `response.body.error` undefined.  
    • *Diagnosis:* Route uses `message` field for errors; harmonise field naming.

29. **GET requests › should return user GDPR requests**  
    • *Observed:* Received 500.  
    • *Diagnosis:* Route references `GdprRequest` (Mongo model) but the service layer now targets Supabase; the dependency is either missing or throws.

30. **GET export-data › should export user data successfully**  
    • *Observed:* Received 500.  
    • *Diagnosis:* The data export path relies on `UserService.findById` + Supabase requests; without test doubles the real call fails. Provide mocks or refactor to use injected service.

31. **POST delete-account › should initiate account deletion request**  
    • *Observed:* Expectation mismatch on arguments passed to `GdprService.createRequest` (test wants generated metadata).  
    • *Diagnosis:* Route currently attaches `metadata` object and ISO timestamp; update expectation or strip metadata before passing to service.

32. **Middleware › should handle missing user authentication**  
    • *Observed:* Expected 401, received 500.  
    • *Diagnosis:* Without the mocked auth middleware the route still references `req.user.id`, triggering `TypeError` → 500. Need guard clause or a dedicated unauthenticated pathway.

33. **Middleware › should handle service unavailable errors**  
    • *Observed:* `response.body.error` undefined.  
    • *Diagnosis:* Error handler mirrors the consent failure above—responds with `{ success: false, message: ... }`.

## js/backend/tests/advanced-gdpr.test.js

34. **Data Breach Management › should assess breach risk correctly**  
    • *Observed:* `riskAssessment.overallRisk` returned `'high'`; test expects `'medium'`.  
    • *Diagnosis:* Assertion `toBe('medium' || 'high')` always resolves to `'medium'`. The test should use `expect([...]).toContain(riskAssessment.overallRisk)` or similar.

---

### Next steps
- Decide whether to update implementations to satisfy tests or rewrite tests to reflect the current Supabase-centric architecture.
- Prioritise the route gaps (missing `/requests`, `/breaches`, `/compliance/report`) before addressing smaller expectation tweaks.
- Stabilise frontend fetch mocks by resetting between tests (`afterEach(() => jest.restoreAllMocks())`).
