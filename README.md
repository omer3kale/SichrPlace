# SichrPlace — Frontend

> Secure apartment rental platform connecting landlords and tenants.

Vanilla JS (ES6+) multi-page frontend with real-time messaging,
apartment listings, viewing requests, and PayPal payments.

---

## Backend (Spring Boot + MSSQL)

The SichrPlace thesis backend is a **Spring Boot 3.2.2 (Java 21)** REST API
with 55 endpoints, JWT authentication, and JPA-based dual-database support
(PostgreSQL + MSSQL 2025).

**Backend repo:** [`github.com/omer3kale/sichrplace-backend`](https://github.com/omer3kale/sichrplace-backend)

**Expected backend tag:** `v1.0.0-mssql-workplace`

| Resource | Link |
|----------|------|
| Thesis architecture overview | [`THESIS_OVERVIEW_BACKEND.md`](https://github.com/omer3kale/sichrplace-backend/blob/main/THESIS_OVERVIEW_BACKEND.md) |
| Full-stack golden path | [`docs/FULLSTACK_GOLDEN_PATH.md`](https://github.com/omer3kale/sichrplace-backend/blob/main/docs/FULLSTACK_GOLDEN_PATH.md) |
| API endpoint reference (55 endpoints) | [`docs/API_ENDPOINTS_BACKEND.md`](https://github.com/omer3kale/sichrplace-backend/blob/main/docs/API_ENDPOINTS_BACKEND.md) |
| Backend environment setup | [`docs/ENV_SETUP_GUIDE.MD`](https://github.com/omer3kale/sichrplace-backend/blob/main/docs/ENV_SETUP_GUIDE.MD) |
| Backend variants (local vs beta) | [`docs/BACKEND_VARIANTS.md`](docs/BACKEND_VARIANTS.md) |

The frontend auto-resolves to `localhost:8080` (dev) or `api.sichrplace.com`
(production) — no config change needed to use the Spring Boot backend.

---

## Quick Start

```bash
# 1. Clone this repo
git clone https://github.com/omer3kale/sichrplace.git
cd sichrplace

# 2. Serve the frontend
cd frontend
python3 -m http.server 3000
# or: npx http-server -p 3000

# 3. Start the backend (separate terminal)
# See: https://github.com/omer3kale/sichrplace-backend/blob/main/docs/ENV_SETUP_GUIDE.MD
```

Open `http://localhost:3000` in your browser.

---

## Environment Configuration

See [`docs/BACKEND_VARIANTS.md`](docs/BACKEND_VARIANTS.md) for how to point
the frontend at local-mssql, beta-mssql, or PostgreSQL backends.

| Env File | Backend Target |
|----------|---------------|
| [`.env.development.mssql`](.env.development.mssql) | Local Spring Boot + MSSQL |
| [`.env.beta.mssql`](.env.beta.mssql) | DigitalOcean droplet (api.sichrplace.com) |
