# CSRF Protection Enforcement Guide

## Current Implementation Status

### ✅ What's Already Implemented

1. **CSRF Middleware**: `lusca.csrf()` is configured in `backend/server.js`
2. **Token Generation**: `/api/csrf-token` endpoint provides CSRF tokens
3. **Session Management**: Express sessions are configured for CSRF token storage
4. **Conditional Activation**: CSRF protection enabled via `ENABLE_CSRF=true` env variable

### 🔧 Implementation Details

**Location**: `js/backend/server.js` (Lines 154-168)

```javascript
// Session middleware (required for CSRF)
app.use(session({
  secret: process.env.JWT_SECRET || 'your_super_secret_jwt_key_here',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true in production with HTTPS
}));

// CSRF Protection
if (process.env.ENABLE_CSRF === 'true') {
  app.use(lusca.csrf());
  const csrfTokenRoute = require('./api/csrf-token');
  app.use('/api/csrf-token', csrfTokenRoute);
}
```

---

## 🚀 Production Deployment Checklist

### Step 1: Enable CSRF Protection

Add to your `.env` file:
```bash
ENABLE_CSRF=true
```

For production environments (Heroku, Railway, Netlify, etc.):
```bash
heroku config:set ENABLE_CSRF=true
# or
railway variables set ENABLE_CSRF=true
```

### Step 2: Update Frontend to Include CSRF Tokens

All POST/PUT/PATCH/DELETE requests must include the CSRF token.

**Option A: Fetch Token Once and Reuse**
```javascript
// At app initialization
let csrfToken = null;

async function initCSRF() {
  const response = await fetch('/api/csrf-token');
  const data = await response.json();
  csrfToken = data.token;
}

// In your fetch calls
async function createListing(data) {
  const response = await fetch('/api/listings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken  // <-- Add this
    },
    body: JSON.stringify(data)
  });
}
```

**Option B: Fetch Token Per Request (More Secure)**
```javascript
async function createListing(data) {
  // Get CSRF token
  const csrfRes = await fetch('/api/csrf-token');
  const { token: csrfToken } = await csrfRes.json();

  // Make request with token
  const response = await fetch('/api/listings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken
    },
    body: JSON.stringify(data)
  });
}
```

### Step 3: Update All Forms

For traditional HTML forms:
```html
<form id="listing-form" action="/api/listings" method="POST">
  <input type="hidden" name="_csrf" id="csrf-token" />
  <!-- other form fields -->
</form>

<script>
  // Populate CSRF token
  fetch('/api/csrf-token')
    .then(res => res.json())
    .then(data => {
      document.getElementById('csrf-token').value = data.token;
    });
</script>
```

### Step 4: Configure HTTPS Cookies (Production Only)

Update session configuration in `server.js` for production:
```javascript
app.use(session({
  secret: process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
```

---

## 🧪 Testing CSRF Protection

### Test 1: Verify Token Generation
```bash
curl http://localhost:3000/api/csrf-token
# Expected: {"token":"some-csrf-token"}
```

### Test 2: Test Protected Endpoint Without Token
```bash
curl -X POST http://localhost:3000/api/listings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Listing"}'

# Expected: 403 Forbidden (CSRF token missing)
```

### Test 3: Test Protected Endpoint With Token
```bash
# Get token first
TOKEN=$(curl -s http://localhost:3000/api/csrf-token | jq -r '.token')

# Use token in request
curl -X POST http://localhost:3000/api/listings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $TOKEN" \
  -d '{"title":"Test Listing"}'

# Expected: 200/201 Success
```

---

## 📋 Routes Requiring CSRF Protection

### Already Protected (when ENABLE_CSRF=true)
All routes using `POST`, `PUT`, `PATCH`, `DELETE` methods:

- ✅ `/api/admin/*` - Admin endpoints
- ✅ `/api/listings` - Create/update listings
- ✅ `/api/viewing-requests` - Create/update viewing requests
- ✅ `/api/marketplace/*` - Marketplace transactions
- ✅ `/api/payment/*` - Payment processing
- ✅ `/api/auth/register` - User registration
- ✅ `/api/user/profile` - Profile updates

### Excluded from CSRF (GET requests)
- `/api/csrf-token` - Token generation
- All GET endpoints - Read-only operations

---

## 🔒 Security Best Practices

### 1. **Always Use HTTPS in Production**
```javascript
// server.js
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}
```

### 2. **Rotate CSRF Tokens Regularly**
```javascript
// After login, force new session
req.session.regenerate((err) => {
  if (err) return next(err);
  // Continue with login
});
```

### 3. **Monitor CSRF Failures**
```javascript
// Add error handler for CSRF failures
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    console.error('CSRF Attack Detected:', {
      ip: req.ip,
      url: req.url,
      method: req.method,
      timestamp: new Date()
    });
    res.status(403).json({ error: 'Invalid CSRF token' });
  } else {
    next(err);
  }
});
```

### 4. **Rate Limit Token Requests**
```javascript
const rateLimit = require('express-rate-limit');

const csrfLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many CSRF token requests'
});

app.get('/api/csrf-token', csrfLimiter, (req, res) => {
  res.json({ token: res.locals._csrf || 'csrf-token-placeholder' });
});
```

---

## 🚨 Common Issues & Troubleshooting

### Issue 1: "CSRF token validation failed"
**Cause**: Token mismatch or expired session
**Solution**: 
- Ensure session middleware is before CSRF middleware
- Check cookie settings (secure flag, SameSite)
- Verify token is sent in correct header (`X-CSRF-Token`)

### Issue 2: "Session store not available"
**Cause**: No session store configured for production
**Solution**: Use Redis or another persistent store
```javascript
const RedisStore = require('connect-redis')(session);
const redis = require('redis');
const redisClient = redis.createClient();

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false
}));
```

### Issue 3: CORS blocking CSRF tokens
**Solution**: Ensure CSRF token endpoint allows credentials
```javascript
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true // Allow cookies
}));
```

---

## 📊 Monitoring & Compliance

### Audit CSRF Protection Status
```javascript
// Add to admin dashboard
router.get('/api/admin/security/csrf-status', adminOnly, async (req, res) => {
  const status = {
    enabled: process.env.ENABLE_CSRF === 'true',
    session_configured: !!req.session,
    https_enabled: req.secure,
    cookie_secure: req.session?.cookie?.secure || false,
    recommendations: []
  };

  if (!status.enabled) {
    status.recommendations.push('Enable CSRF protection in production');
  }
  if (!status.https_enabled && process.env.NODE_ENV === 'production') {
    status.recommendations.push('Enable HTTPS for production');
  }
  if (!status.cookie_secure && process.env.NODE_ENV === 'production') {
    status.recommendations.push('Set secure flag on session cookies');
  }

  res.json(status);
});
```

### Log CSRF Events
```javascript
// Log successful CSRF validations
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    console.log('CSRF validation passed for:', {
      method: req.method,
      path: req.path,
      user: req.user?.id,
      timestamp: new Date()
    });
  }
  next();
});
```

---

## ✅ Deployment Readiness Checklist

- [ ] Set `ENABLE_CSRF=true` in production environment
- [ ] Update all frontend POST/PUT/PATCH/DELETE requests to include CSRF tokens
- [ ] Configure HTTPS and set `cookie.secure = true`
- [ ] Implement session store (Redis/PostgreSQL) for production
- [ ] Add CSRF error monitoring and alerting
- [ ] Test all critical user flows with CSRF enabled
- [ ] Document CSRF token usage for API consumers
- [ ] Add rate limiting to `/api/csrf-token` endpoint
- [ ] Implement session rotation on authentication
- [ ] Add CSRF status to admin security dashboard

---

## 🎯 Implementation Priority

**Phase 1 (Critical - Before Launch)**
1. Enable CSRF in production (set env var)
2. Update authentication flows (login, register)
3. Update payment endpoints (high-value targets)

**Phase 2 (High Priority)**
4. Update all form submissions
5. Update AJAX/fetch calls across frontend
6. Add CSRF error handling

**Phase 3 (Medium Priority)**
7. Implement monitoring and logging
8. Add admin dashboard status check
9. Document for future developers

**Phase 4 (Nice to Have)**
10. Add rate limiting
11. Implement session rotation
12. Advanced security headers

---

## 📚 Additional Resources

- [Lusca Documentation](https://github.com/krakenjs/lusca)
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Express Session Best Practices](https://github.com/expressjs/session#compatible-session-stores)

---

**Status**: CSRF protection is **implemented but not enforced**. Enable by setting `ENABLE_CSRF=true` in production environment.

**Last Updated**: 2025-06-04  
**Maintained By**: SichrPlace Security Team
