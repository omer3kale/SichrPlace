# 🔐 Environment Setup Guide - SichrPlace

## ⚡ Quick Setup (5 Minutes)

Follow these steps to configure your environment variables and get the backend running.

---

## 📋 Step 1: Get Your Supabase Credentials

### 1.1 Open Supabase Dashboard
1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your **SichrPlace** project
3. Click on **Settings** (⚙️ icon in left sidebar)
4. Click on **API** section

### 1.2 Copy These Values
You'll see these on the API settings page:

| Field | Description | Example |
|-------|-------------|---------|
| **Project URL** | Your Supabase project URL | `https://xxxxxxxxxxxxx.supabase.co` |
| **anon public** | Public API key (safe for frontend) | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| **service_role** | Secret key (backend only!) | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

⚠️ **IMPORTANT**: Never commit `service_role` key to git! It has admin privileges.

---

## 📝 Step 2: Get Your Database URL

### 2.1 Navigate to Database Settings
1. In Supabase Dashboard, click **Settings** → **Database**
2. Scroll down to **Connection String** section
3. Select **URI** tab
4. Copy the connection string

### 2.2 Update the Password
The connection string looks like:
```
postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxxx.supabase.co:5432/postgres
```

**Replace `[YOUR-PASSWORD]`** with your actual database password (the one you set when creating the project).

---

## 🔑 Step 3: Update Your `.env` File

### 3.1 Open `.env` in VS Code
Location: `SichrPlace/.env`

### 3.2 Fill In These Required Values

```bash
# === SUPABASE (REQUIRED) ===
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-service-role-key-here
DATABASE_URL=postgresql://postgres:your-password@db.xxxxxxxxxxxxx.supabase.co:5432/postgres

# === JWT SECRET (REQUIRED) ===
# Generate a random string (min 32 characters)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars-long

# === SESSION & CSRF (REQUIRED) ===
SESSION_SECRET=your-session-secret-key-min-32-chars
CSRF_SECRET=your-csrf-secret-key-min-32-chars

# === EMAIL (REQUIRED for authentication) ===
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password
ADMIN_EMAIL=admin@sichrplace.com

# === PAYPAL (OPTIONAL - use sandbox for testing) ===
PAYPAL_CLIENT_ID=your-paypal-sandbox-client-id
PAYPAL_CLIENT_SECRET=your-paypal-sandbox-secret
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_WEBHOOK_ID=your-webhook-id

# === CLOUDINARY (OPTIONAL - for image uploads) ===
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# === GOOGLE MAPS (OPTIONAL) ===
GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# === RUNTIME (DO NOT CHANGE) ===
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

---

## 🎲 Step 4: Generate Random Secrets

### Option A: Using Node.js (Recommended)
```powershell
# Run this in PowerShell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run this 3 times to generate:
1. `JWT_SECRET`
2. `SESSION_SECRET`
3. `CSRF_SECRET`

### Option B: Using PowerShell
```powershell
# Generate random secret
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

### Option C: Online Generator
Visit: [https://randomkeygen.com/](https://randomkeygen.com/)
- Use **Fort Knox Passwords** section
- Copy 3 different passwords

---

## 📧 Step 5: Setup Gmail for Emails (Optional but Recommended)

### 5.1 Enable 2-Factor Authentication
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable **2-Step Verification**

### 5.2 Generate App Password
1. Go to [App Passwords](https://myaccount.google.com/apppasswords)
2. Select **Mail** and **Other (Custom name)**
3. Enter "SichrPlace Backend"
4. Click **Generate**
5. Copy the 16-character password (format: `xxxx xxxx xxxx xxxx`)

### 5.3 Update `.env`
```bash
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=xxxxyyyyzzzzwwww  # Remove spaces
ADMIN_EMAIL=your-email@gmail.com
```

---

## 💳 Step 6: Setup PayPal Sandbox (Optional)

### 6.1 Create PayPal Developer Account
1. Go to [PayPal Developer](https://developer.paypal.com/)
2. Sign up or log in
3. Go to **Dashboard** → **Apps & Credentials**

### 6.2 Create Sandbox App
1. Click **Create App**
2. App Name: "SichrPlace Sandbox"
3. Select **Sandbox** environment
4. Click **Create App**

### 6.3 Get Credentials
Copy these from your app page:
- **Client ID**: Starts with `AV...` or `AY...`
- **Secret**: Click "Show" to reveal

### 6.4 Update `.env`
```bash
PAYPAL_CLIENT_ID=your-sandbox-client-id
PAYPAL_CLIENT_SECRET=your-sandbox-secret
PAYPAL_ENVIRONMENT=sandbox
```

---

## ✅ Step 7: Verify Configuration

### 7.1 Check `.env` File
Run this command to verify your configuration:

```powershell
Get-Content .env | Select-String -Pattern "SUPABASE|JWT|GMAIL" | Where-Object { $_ -notmatch "^#" }
```

**Expected output:** All values should be filled (not empty).

### 7.2 Test Backend Connection
```powershell
cd backend
npm run dev
```

**Expected output:**
```
🚀 Initializing Redis Cache Service...
✅ Successfully connected to Supabase
Server running on port 3000
Database connected successfully
```

### 7.3 Test Database Query
Open a new terminal and run:
```powershell
curl http://localhost:3000/api/health
```

**Expected response:**
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2025-10-06T12:00:00.000Z"
}
```

---

## 🐛 Troubleshooting

### Issue: "Invalid API key" or "Invalid JWT"
**Solution:** Check that you copied the FULL key without any spaces or line breaks.

### Issue: "Database connection failed"
**Solution:** 
1. Verify `DATABASE_URL` has the correct password
2. Check if your IP is allowed in Supabase (Settings → Database → Connection pooling)
3. Confirm your Supabase project is not paused

### Issue: "SMTP authentication failed"
**Solution:**
1. Verify you enabled 2FA on your Google account
2. Generate a NEW app password
3. Remove ALL spaces from the app password

### Issue: "Port 3000 already in use"
**Solution:**
```powershell
# Find process using port 3000
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess

# Kill it
Stop-Process -Id <ProcessId> -Force

# Or use a different port
$env:PORT=3001
npm run dev
```

---

## 🔒 Security Checklist

Before deploying to production:

- [ ] `.env` file is in `.gitignore`
- [ ] All secrets are unique and random (min 32 characters)
- [ ] `service_role` key is NEVER committed to git
- [ ] Database password is strong (16+ characters)
- [ ] Gmail app password is used (not regular password)
- [ ] PayPal is set to `sandbox` for development
- [ ] `NODE_ENV` is set to `production` on server
- [ ] All secrets are stored in deployment platform (Railway, Netlify, etc.)

---

## 📚 Next Steps

After completing this setup:

1. ✅ **Run Test Data Script**
   ```powershell
   # In Supabase SQL Editor, run:
   # supabase/migrations/create_test_data.sql
   ```

2. ✅ **Configure RLS Policies**
   ```powershell
   # In Supabase SQL Editor, run:
   # supabase/migrations/configure_rls_policies.sql
   ```

3. ✅ **Test All Endpoints**
   ```powershell
   npm run test:ci
   ```

4. ✅ **Start Development**
   ```powershell
   npm run dev
   ```

---

## 🆘 Need Help?

- **Supabase Issues**: [Supabase Support](https://supabase.com/docs/guides/platform)
- **Gmail Issues**: [Google App Passwords](https://support.google.com/accounts/answer/185833)
- **PayPal Issues**: [PayPal Developer Support](https://developer.paypal.com/support/)

---

**Created:** October 6, 2025  
**Version:** 1.0  
**Status:** Production Ready 🚀
