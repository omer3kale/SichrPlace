# 🔑 SUPABASE_SERVICE_ROLE_KEY Setup Guide

## How to Find Your Supabase Service Role Key

### Step 1: Go to Supabase Dashboard
1. Visit: https://supabase.com/dashboard/projects
2. Sign in to your account
3. Select your SichrPlace project

### Step 2: Navigate to API Settings
1. Click on **Settings** in the left sidebar
2. Click on **API** 

### Step 3: Copy the Service Role Key
1. Look for the **Project API keys** section
2. Find **service_role** key (NOT the anon key)
3. Click the eye icon to reveal the key
4. Copy the entire key (it starts with `eyJ...`)

### Step 4: Add to Netlify Environment Variables
1. Go to: https://app.netlify.com/projects/sichrplace
2. Go to: Site settings → Environment variables
3. Click **Add a variable**
4. Add these variables:

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ... (the service role key you copied)
JWT_SECRET=your-jwt-secret-key (create a random 32+ character string)
```

### Step 5: Redeploy
After adding the environment variables, redeploy your site:
```bash
netlify deploy --prod
```

## ⚠️ IMPORTANT SECURITY NOTES

- **NEVER commit the service role key to your repository**
- The service role key bypasses Row Level Security (RLS)
- Only use it in secure server environments (like Netlify Functions)
- For frontend code, use the `anon` key instead

## 🧪 Test Your Setup

After adding the environment variables, test with:
```bash
curl https://www.sichrplace.com/api/auth-register
```

You should see:
```json
{
  "status": "ready",
  "message": "Registration endpoint is ready"
}
```

## 🚨 If You Don't Have a Supabase Project Yet

1. Go to: https://supabase.com
2. Click "Start your project"
3. Create a new project
4. Wait for it to initialize (2-3 minutes)
5. Follow steps above to get your keys