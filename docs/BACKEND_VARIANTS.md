# Backend Variants — SichrPlace Frontend

> How to point the frontend at different backend environments.

---

## Available Backends

| Variant | API URL | Spring Profile | Database | Env File |
|---------|---------|---------------|----------|----------|
| **Local MSSQL** | `http://localhost:8080` | `local-mssql` | Docker MSSQL 2025 on `localhost:1433` | [`.env.development.mssql`](../.env.development.mssql) |
| **Beta MSSQL** (droplet) | `https://api.sichrplace.com` | `beta-mssql` | Docker MSSQL 2025 on `206.189.53.163:1433` | [`.env.beta.mssql`](../.env.beta.mssql) |
| **Local PostgreSQL** | `http://localhost:8080` | `local` | Docker PostgreSQL 16 on `localhost:5432` | *(default)* |

---

## How the frontend resolves the API URL

The frontend auto-detects the environment by hostname. When `config.js`
is present, it follows this logic:

```javascript
ENVIRONMENT: window.location.hostname.includes('localhost') ? 'development' : 'production',
DEVELOPMENT_API_URL: 'http://localhost:8080',      // ← Spring Boot default port
PRODUCTION_API_URL:  'https://api.sichrplace.com', // ← Caddy reverse proxy on VPS
```

- **Localhost** → calls `http://localhost:8080` (Spring Boot on local-mssql or local profile)
- **Production domain** → calls `https://api.sichrplace.com` (Caddy → Spring Boot on beta-mssql)

No config change needed for the common case.

---

## Overriding the API URL

To serve the frontend locally but point at the **droplet backend**, set an
override before the config loads:

```html
<script>
  window.__SICHRPLACE_API_OVERRIDE__ = 'https://api.sichrplace.com';
</script>
```

---

## Seed user credentials (all MSSQL backends)

All MSSQL environments use the same `DataSeeder.java`, so these credentials
work on local-mssql and beta-mssql alike:

| Role | Email | Password |
|------|-------|----------|
| **TENANT** | `charlie.student@rwth-aachen.de` | `password123` |
| **TENANT** | `diana.student@rwth-aachen.de` | `password123` |
| **LANDLORD** | `alice.landlord@sichrplace.com` | `password123` |
| **LANDLORD** | `bob.vermieter@sichrplace.com` | `password123` |
| **ADMIN** | `admin@sichrplace.com` | `password123` |
| **ADMIN** | `eva.admin@sichrplace.com` | `password123` |

---

## Starting the Spring Boot backend

```bash
# Clone (or use existing checkout)
git clone --branch v1.0.0-mssql-workplace https://github.com/omer3kale/sichrplace-backend.git
cd sichrplace-backend

# Start MSSQL + backend
docker compose -f docker-compose.local-mssql.yml up -d
./gradlew bootRun --args='--spring.profiles.active=local-mssql'
```

Full setup guide: [`sichrplace-backend/docs/ENV_SETUP_GUIDE.MD`](https://github.com/omer3kale/sichrplace-backend/blob/main/docs/ENV_SETUP_GUIDE.MD)

---

## Related documentation

| Document | Repo | Purpose |
|----------|------|---------|
| [`FULLSTACK_GOLDEN_PATH.md`](https://github.com/omer3kale/sichrplace-backend/blob/main/docs/FULLSTACK_GOLDEN_PATH.md) | Backend | End-to-end trace: browser → API → MSSQL |
| [`THESIS_OVERVIEW_BACKEND.md`](https://github.com/omer3kale/sichrplace-backend/blob/main/THESIS_OVERVIEW_BACKEND.md) | Backend | Thesis architecture overview |
| [`API_ENDPOINTS_BACKEND.md`](https://github.com/omer3kale/sichrplace-backend/blob/main/docs/API_ENDPOINTS_BACKEND.md) | Backend | All 55 endpoints with curl examples |
| [`ENV_SETUP_GUIDE.MD`](https://github.com/omer3kale/sichrplace-backend/blob/main/docs/ENV_SETUP_GUIDE.MD) | Backend | MSSQL setup, Spring profiles |
