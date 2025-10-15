# Step 4 Completion Solutions

This rollout checklist converts the Step 4 implementation plan into concrete backend, frontend, and infrastructure tasks so dashboards, profiles, personalization, and notifications ship together.

## 1. Dashboards & Profile Management
- Wire the existing profile routes in `js/backend/api/profile.js` into the dashboards: expose `PUT /api/profile` and `PUT /api/profile/notifications` through a shared `frontend/js/profile-client.js`, and ensure tenant/landlord dashboards request `GET /api/profile/stats` on load to hydrate KPI cards with Supabase-backed counts.[^supabase]
- Finalize the avatar flow by keeping the `POST /api/profile/upload-avatar` multipart implementation (Multer disk storage) and mirroring it on the frontend via a form with `enctype="multipart/form-data"`, drag/drop previews, and retry UI.[^multer]
- Persist notification preferences alongside UI toggles; on save, debounce the PUT call and render optimistic success/failure alerts so users understand preference state without reloading.
- Document profile API contract updates in `docs__STEP4_COMPLETE_IMPLEMENTATION_PLAN.md`, linking to the exact JS client helpers once they land.

## 2. Favorites, Saved Searches, and Recently Viewed
- Centralize favorites and recently viewed logic by consuming `GET /api/favorites`, `GET /api/recently-viewed`, and the respective POST/DELETE endpoints; reuse the shared auth guard from the integration guide so anonymous users are redirected cleanly.
- Ship a saved-search drawer that posts to `POST /api/saved-searches`, renders the list via `GET /api/saved-searches`, and exposes edit/delete actions; paginate if the count exceeds 10 to keep the UI responsive.
- Schedule saved-search alert execution with a lightweight scheduler (e.g., `node-cron`) that hits `POST /api/saved-searches/:id/execute`, piping wins into notification creation jobs and email templates.[^node-cron]
- Track recently viewed apartments client-side (local cache) and sync to `POST /api/recently-viewed` when online so that dashboards show up-to-date browsing history even after device switches.

## 3. Reviews & Ratings Delivery
- Promote the `js/backend/api/reviews.js` endpoints by exposing them in the API docs, then connect the apartment detail page to `GET /api/reviews?apartmentId=…` and the review composer to `POST /api/reviews` with validation feedback under each field.
- Build the moderation queue UI in `admin-dashboard.html` reading `GET /api/reviews?status=pending`; include approve/reject actions that call `PUT /api/reviews/:id/status` and propagate results to landlords/tenants through the notifications service.
- Compute aggregates server-side with `GET /api/reviews/apartment/:id/stats`, cache the response for 5 minutes, and surface the rating histogram alongside testimonials to boost social proof.
- Add Jest/Supertest coverage that exercises happy paths, duplicate-review conflicts, and moderation denial branches before enabling the route in production CI.

## 4. Real-Time Notifications & Activity Tracking
- Stand up Socket.IO alongside the Express app (`server.js`) so `notifications.js` can emit `notification:created` events when new records are inserted; initialize the server with the documented `new Server(httpServer)` pattern to avoid double listeners.[^socketio]
- Update dashboards to subscribe to the websocket channel and merge live alerts with the REST response from `GET /api/notifications`, keeping unread counts in sync.
- Extend activity tracking by inserting structured events (page, verb, entity) into a `user_activity` Supabase table via the existing client, then surface the timeline in `frontend/landlord-dashboard.html` with filters for the last 7/30 days.[^supabase]
- Expose verification badge status by adding a `GET /api/profile/:id/verification` endpoint, rendering badge state in profile cards, and gating review submission for unverified landlords per product requirements.

## 5. QA, Telemetry, and Documentation
- Add Playwright flows that cover: profile update (text + avatar), saved-search creation, review submission + moderation, and real-time notification receipt to guard regressions.
- Emit structured logs (`logger.info('profile.update', { userId, fieldsChanged })`) so product analytics can correlate activity with feature adoption; surface log links in the deployment checklist.
- Refresh `docs__STEP4_COMPLETE_IMPLEMENTATION_PLAN.md` with code pointers, publish a snippet in `PROJECT_STATUS_TRACKER.md`, and highlight new env vars (cron toggle, Socket.IO origin) inside `ENV_SETUP_GUIDE.md` before release.

## 6. Timeline & Ownership

| Window | Deliverable | Owner |
| --- | --- | --- |
| Day 1 | Ship profile dashboard integration, avatar flow, and notification preference UI | Frontend Team |
| Day 2 | Complete saved-search scheduler, favorites/recently viewed sync, and review moderation endpoints/tests | Backend Team |
| Day 3 | Enable Socket.IO notifications, activity tracking analytics, end-to-end tests, and documentation updates | Full Stack + QA |

## 7. Exit Criteria
- Tenant and landlord dashboards load live Supabase-backed stats, with upload avatars and notification preferences persisting reliably.
- Saved searches trigger scheduled alerts, dashboards show recently viewed items, and reviews appear with moderation + aggregate stats.
- Real-time notifications and activity timelines update without refresh, with regression tests covering the critical flows.
- Documentation, environment guides, and status trackers all reflect the finished Step 4 scope with clear handoffs for future maintenance.

[^supabase]: Supabase Docs, "JavaScript Client Library – select()/insert()/update()" – <https://supabase.com/docs/reference/javascript/select>
[^multer]: Multer README, "Usage" – <https://github.com/expressjs/multer#readme>
[^node-cron]: node-cron README, "Getting Started" – <https://github.com/node-cron/node-cron#readme>
[^socketio]: Socket.IO Docs, "Server Initialization" – <https://socket.io/docs/v4/server-initialization/>
