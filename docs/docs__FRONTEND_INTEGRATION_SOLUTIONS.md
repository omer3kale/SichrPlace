# Frontend ↔ Backend Integration Solutions

This guide operationalizes the integration plan so every existing HTML surface consumes live APIs, persists auth, and handles failures gracefully.

## 1. Core Data Wiring
- Replace hard-coded apartment cards with a shared `loadApartments()` helper that calls `GET /api/apartments` via `fetch`, checks `response.ok`, and renders fallback UI on errors.[^fetch]
- Centralize API base URLs and headers in `frontend/js/api-client.js` so switching between local (`http://localhost:3001`) and production hosts only requires an environment flag.
- Add skeleton loaders and empty-state messaging so the listing and dashboard screens communicate connection status instead of showing blank content.

## 2. Authentication Flow
- Implement login and registration forms that submit JSON payloads, store the returned JWT in `localStorage`, and capture the serialized user profile for downstream views.[^localstorage]
- Wrap protected actions (favorites, viewing-request submit, dashboards) with a `requireAuth()` guard that redirects to `login.html` when tokens are missing or expired.
- Provide a logout utility that clears stored credentials and revokes refresh tokens by calling the backend logout endpoint.

## 3. Favorites & Personalization
- Initialize pages by calling `GET /api/favorites` to highlight saved apartments and render the saved items list; toggle favorites with a debounced `POST /api/favorites` call tied to button state.
- Handle optimistic updates: flip the heart button immediately, revert if the request fails, and display a toast so users know a retry is needed.
- Sync the favorites badge in navigation using a central event emitter so different pages stay in step without full reloads.

## 4. Viewing Request Workflow
- Populate the viewing request form with the selected apartment ID from `sessionStorage` or query params; submit the JSON payload with the bearer token header and show progress indicators.
- On success, redirect to `payment.html` with context in the query string; on failure, surface contextual error messages (validation vs. server issues) and log them to the console for debugging.
- In dashboards, expose request status filters (pending, approved, rejected, completed) by calling the corresponding backend endpoints with pagination parameters.

## 5. Error Handling & Observability
- Add a shared `handleApiError(error, context)` utility that parses JSON error bodies, inspects HTTP status codes, and raises user-facing notifications.
- Emit analytics or console markers (e.g., `console.warn('[frontend] viewing-request submit failed', { status, context })`) to simplify debugging across environments.
- Capture integration smoke tests in Playwright or Cypress that cover login, apartment load, favorites toggle, and viewing request submission in CI.

## 6. Documentation & Ownership
- Update `docs__FRONTEND_INTEGRATION_PLAN.md` with code locations (`frontend/js/api-client.js`, `frontend/js/auth.js`, etc.) once each feature is live.
- Add a quick-start snippet to `ENV_SETUP_GUIDE.md` describing how to run the frontend with live backend data (required ports, environment variables, and mock fallbacks).
- Track outstanding integration work in `PROJECT_STATUS_TRACKER.md`, assigning owners for each HTML page until parity is achieved.

[^fetch]: MDN Web Docs, "Using the Fetch API" – <https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch>
[^localstorage]: MDN Web Docs, "Window.localStorage" – <https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage>
