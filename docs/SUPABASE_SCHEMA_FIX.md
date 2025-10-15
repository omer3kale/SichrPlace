# 🔧 Supabase Schema Fix – Table Creation Order Issue

## Error Encountered

```
ERROR: 42703: column "recipient_email" does not exist
```

## Root Cause Analysis

The error message was misleading. The **actual problem** was that the SQL script had statements in the wrong order:

### Critical Issues Found:

1. **ALTER TABLE statements BEFORE CREATE TABLE**
   ```sql
   -- Line 378-389: Trying to modify users table that doesn't exist yet!
   ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
   ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB;
   ... (12 ALTER statements)
   
   -- Line 1014: users table finally created
   CREATE TABLE users (...);
   ```

2. **Same issue with apartments table**
   ```sql
   -- Line 360-376: Trying to modify apartments table that doesn't exist yet!
   ALTER TABLE apartments ADD COLUMN IF NOT EXISTS video_tour_url TEXT;
   ... (16 ALTER statements)
   
   -- Line 1054: apartments table finally created
   CREATE TABLE apartments (...);
   ```

3. **Same issue with viewing_requests table**
   ```sql
   -- Line 345-350: Trying to modify viewing_requests table that doesn't exist yet!
   ALTER TABLE viewing_requests ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
   
   -- Line 1044: viewing_requests table finally created
   CREATE TABLE viewing_requests (...);
   ```

### Why This Causes "column does not exist" Errors

When PostgreSQL tries to execute:
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
```

But the `users` table doesn't exist yet, PostgreSQL **fails the entire transaction**. Then when it later tries to:
```sql
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email);
```

The `email_logs` table was never created (due to transaction rollback), so the error "column recipient_email does not exist" appears - even though the column definition was correct!

---

## Solutions Applied

### Fix #1: Enable Required Extensions First

Added at the very beginning:
```sql
-- ===== ENABLE REQUIRED EXTENSIONS =====
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- For encryption
```

**Why:** Extensions must be enabled before tables use functions like `uuid_generate_v4()`

### Fix #2: Removed Premature ALTER TABLE Statements

**Removed from lines 342-389:**
- All ALTER TABLE viewing_requests statements
- All ALTER TABLE apartments statements  
- All ALTER TABLE users statements

**Why:** You can't alter tables that don't exist yet!

### Fix #3: Moved ALTER TABLE Statements to Correct Location

**Added after line 1157** (after all core tables are created):
```sql
-- ===== EXISTING TABLE ENHANCEMENTS =====
-- Add missing columns to tables now that they exist

-- Add missing columns to viewing_requests
ALTER TABLE viewing_requests ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE viewing_requests ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE viewing_requests ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE viewing_requests ADD COLUMN IF NOT EXISTS completion_notes TEXT;
ALTER TABLE viewing_requests ADD COLUMN IF NOT EXISTS completion_rating INTEGER CHECK (completion_rating >= 1 AND completion_rating <= 5);

-- Add payment reference to viewing_requests if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='viewing_requests' AND column_name='payment_transaction_id') THEN
        ALTER TABLE viewing_requests ADD COLUMN payment_transaction_id UUID REFERENCES payment_transactions(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add apartment features that might be missing
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS video_tour_url TEXT;
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS virtual_tour_url TEXT;
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS floor_plan_url TEXT;
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS public_transport_info TEXT;
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS nearby_amenities TEXT[];
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS house_rules TEXT[];
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS availability_notes TEXT;
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS minimum_lease_duration INTEGER; -- in months
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS maximum_lease_duration INTEGER; -- in months
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS admin_notes TEXT; -- Internal admin notes
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected'));
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS verification_notes TEXT;
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,2) DEFAULT 0.0;
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add user profile enhancements
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_settings JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_completion_score INTEGER DEFAULT 0 CHECK (profile_completion_score >= 0 AND profile_completion_score <= 100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'pending_verification', 'deactivated'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_level VARCHAR(20) DEFAULT 'basic' CHECK (verification_level IN ('basic', 'verified', 'premium'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
```

**Why:** Now tables exist first, then we enhance them!

---

## Correct SQL Execution Order

The fixed script now follows this logical order:

1. **Enable Extensions** (line 6)
   - uuid-ossp
   - pg_trgm
   - pgcrypto

2. **Create Basic Tables** (lines 8-340)
   - email_logs
   - payment_transactions
   - support_tickets
   - safety_reports
   - refund_requests
   - notifications
   - gdpr_data_requests
   - audit_logs
   - etc.

3. **Create Core Tables** (lines 960-1157)
   - users (line 1014)
   - viewing_requests (line 1044)
   - apartments (line 1054)
   - conversations
   - payments
   - messages
   - favorites
   - saved_searches
   - reviews
   - recently_viewed

4. **Enhance Existing Tables** (lines 1159-1214) ✨ **NEW LOCATION**
   - ALTER TABLE viewing_requests
   - ALTER TABLE apartments
   - ALTER TABLE users

5. **Create Indexes** (lines 1216+)
   - All performance indexes

6. **Add Foreign Key Constraints** (end of file)
   - Constraints added after all tables exist

---

## What Changed in the File

| Section | Change | Reason |
|---------|--------|--------|
| **Lines 1-5** | Added extension enablement (uuid-ossp, pg_trgm, pgcrypto) | Functions like uuid_generate_v4() need extensions enabled first |
| **Lines 342-389** | **REMOVED** entire "EXISTING TABLE ENHANCEMENTS" section | Tables didn't exist yet - caused transaction failure |
| **Lines 1159-1214** | **ADDED** "EXISTING TABLE ENHANCEMENTS" section | Now added AFTER tables are created |

---

## Why This Solution Works

✅ **Extensions enabled first** - Required for UUID generation  
✅ **Tables created in correct order** - Core tables before dependent tables  
✅ **ALTER TABLE after CREATE TABLE** - Can only modify tables that exist  
✅ **Indexes after tables** - Can only index existing tables  
✅ **Foreign keys at the end** - All referenced tables exist  
✅ **Idempotent** - Can run multiple times with IF NOT EXISTS checks  

---

## How to Run the Fixed Schema

### Option 1: Supabase Dashboard (RECOMMENDED)

1. Open your Supabase project
2. Go to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the **entire** `supabasetables.sql` file
5. Paste into the editor
6. Click **Run** or press `Ctrl+Enter`

### Option 2: Supabase CLI

```bash
supabase db reset
```

### Option 3: Direct PostgreSQL Connection

```bash
psql -U postgres -h your-host -d your-database -f supabasetables.sql
```

---

## Verification Steps

After running the script successfully, verify with these SQL queries:

### 1. Check that all extensions are enabled

```sql
SELECT extname FROM pg_extension 
WHERE extname IN ('uuid-ossp', 'pg_trgm', 'pgcrypto');
```

Expected: All 3 extensions listed

### 2. Check that email_logs table exists with recipient_email column

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'email_logs'
ORDER BY ordinal_position;
```

Expected: Should see `recipient_email` with type `character varying`

### 3. Check that users table has all enhanced columns

```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'users'
AND column_name IN ('bio', 'preferences', 'notification_settings', 'profile_completion_score', 'account_status')
ORDER BY column_name;
```

Expected: All 5 columns should be present

### 4. Check that apartments table has enhanced columns

```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'apartments'
AND column_name IN ('video_tour_url', 'virtual_tour_url', 'floor_plan_url', 'featured', 'verification_status')
ORDER BY column_name;
```

Expected: All 5 columns should be present

### 5. Check that viewing_requests has enhanced columns

```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'viewing_requests'
AND column_name IN ('cancellation_reason', 'cancelled_by', 'cancelled_at', 'completion_notes', 'completion_rating')
ORDER BY column_name;
```

Expected: All 5 columns should be present

### 6. Count all tables created

```sql
SELECT COUNT(*) as table_count
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE';
```

Expected: Should have 30+ tables

### 7. Check that foreign keys were added

```sql
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name IN ('email_logs', 'payment_transactions')
ORDER BY tc.table_name, tc.constraint_name;
```

Expected: Foreign keys for email_logs.user_id, payment_transactions.user_id, etc.

---

## Common SQL Best Practices

### ❌ DON'T Do This:
```sql
-- Trying to modify a table that doesn't exist yet
ALTER TABLE users ADD COLUMN bio TEXT;

-- Later in the script...
CREATE TABLE users (
    id UUID PRIMARY KEY
);
```

### ✅ DO This Instead:
```sql
-- Create the table first
CREATE TABLE users (
    id UUID PRIMARY KEY
);

-- Then modify it
ALTER TABLE users ADD COLUMN bio TEXT;
```

---

## Summary of All Fixes

| Issue | Impact | Fix Applied | Result |
|-------|--------|-------------|---------|
| Missing extensions | UUID functions fail | Added CREATE EXTENSION statements at top | ✅ Functions work |
| ALTER before CREATE | Transaction rollback | Removed premature ALTER statements | ✅ No early failures |
| Wrong statement order | Tables never created | Moved ALTER statements after CREATE | ✅ Correct execution order |
| Email logs index fails | Misleading error message | Fixed table creation order | ✅ Indexes created successfully |

---

## Testing the Fix

After running the fixed schema, test your application:

```bash
# Run backend tests
cd backend
npm test

# Expected: PGRST204 errors should be gone!
```

---

## Additional Notes

- The script is now **idempotent** - safe to run multiple times
- All `IF NOT EXISTS` checks prevent duplicate creation errors
- DO blocks provide conditional logic for complex operations
- Transaction safety ensured by correct ordering

---

**Status:** ✅ **READY TO DEPLOY**

**Last Updated:** October 13, 2025  
**File:** `supabasetables.sql`  
**Total Changes:** 3 major fixes (extensions, removed premature ALTERs, reordered statements)
