# Step 7 Mobile Optimization & PWA Solutions

This execution guide transforms the Step 7 overview into concrete tasks so SichrPlace delivers a polished mobile-first Progressive Web App experience.

## 1. Progressive Web App Foundation

**Backend Tasks**
- Serve a `manifest.json` and point the root HTML `<link rel="manifest" href="/manifest.json">`; ensure icons (192, 512) and theme colors align with brand palette.
- Register a service worker (`/sw.js`) via Express static middleware; force HTTPS by reusing existing HSTS configuration and redirect rules.

**Frontend Tasks**
- Add service worker bootstrap in `frontend/js/pwa.js` that registers on load, handles update prompts, and exposes an offline fallback route.
- Configure the manifest for standalone display, App Id, start URL with UTM suppression, and short name <= 12 chars for install banners.
- Implement Add-to-Home-Screen UX: listen for `beforeinstallprompt`, show custom install toast, and log adoption analytics.

## 2. Offline-First Architecture

**Service Worker & Caching**
- Use Workbox `workbox-cli` to generate precache manifest for shell assets (`index.html`, CSS, JS bundles, fonts).[^workbox]
- Set up runtime caching strategies: `StaleWhileRevalidate` for API GETs, `CacheFirst` for images, `NetworkOnly` for POST/PUT with background sync fallbacks.
- Ship an offline fallback page `offline.html` plus cached SVG placeholders for property cards when network is unavailable.

**Data Sync**
- Implement IndexedDB storage (via `idb` library) for saved searches, favorite listings, and pending inquiries so actions queue offline and sync when reconnected.
- Use Background Sync or periodic sync API (where available) to flush pending mutations; gracefully degrade on unsupported browsers.

## 3. Mobile UI Optimization

**Responsive Layouts**
- Audit key screens (home, property detail, dashboard) for mobile breakpoints; adjust layout using CSS Grid/Flexbox and 44px tap targets per Material guidelines.[^material]
- Introduce mobile navigation patterns: bottom nav bar or hamburger menu with accessible focus states.
- Optimize property cards with lazy-loaded images (`loading="lazy"`) and skeleton placeholders.

**Performance Enhancements**
- Split JS bundles using dynamic imports for dash-heavy routes; leverage tree shaking to keep mobile payload under 200 KB.
- Compress images via responsive `srcset` and WebP generation in the build pipeline.
- Add viewport meta tags with `viewport-fit=cover` for iOS notch support.

## 4. Device Capabilities

- Integrate Geolocation API: request permission on demand, cache last known coordinates, and feed coordinates into search/filter flows.
- Enable camera/photo upload for property listings using `<input type="file" accept="image/*" capture="environment">`; provide image compression before upload.
- Hook push notifications using existing Step 5 FCM infrastructure; prompt users after demonstrating value and surface notification preference toggles in settings.

## 5. Quality, Compliance & Monitoring

- Run Lighthouse PWA audits targeting scores ≥90 for PWA, Performance, Accessibility, and Best Practices; capture results in `docs__STEP7_TESTING_DOCUMENTATION.md`.[^lighthouse]
- Add automated tests (Playwright) simulating offline mode, add-to-home-screen flow, and push opt-in to prevent regressions.
- Monitor service worker errors via Sentry breadcrumbs and expose a "refresh app" button when updates fail.

## Timeline & Ownership

| Window | Deliverable | Owner |
| --- | --- | --- |
| Week 1 | Manifest, service worker scaffolding, offline fallback | Frontend |
| Week 2 | Runtime caching, background sync, IndexedDB storage | Frontend + Backend |
| Week 3 | Mobile UI polish, device integrations, push opt-in | Frontend |
| Week 4 | Lighthouse optimization, automated tests, rollout docs | QA + DevOps |

## Exit Criteria

- Service worker installed with precache and runtime caching; offline fallback renders core UI and queued actions sync on reconnection.
- Mobile layouts pass responsive checks with performant bundle size and optimized media delivery.
- Geolocation, camera uploads, and push notifications function across major mobile browsers with graceful fallbacks.
- Lighthouse and Playwright suites confirm PWA compliance; documentation and runbooks cover installation, updates, and issue handling.

[^workbox]: Workbox Docs – https://developer.chrome.com/docs/workbox
[^material]: Material Design Guidelines – https://m3.material.io/foundations/layout/mobile
[^lighthouse]: Google Lighthouse – https://developer.chrome.com/docs/lighthouse/pwa