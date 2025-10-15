# 📊 SichrPlace Database Schema Reference

**Last Updated**: October 6, 2025  
**Database**: Supabase PostgreSQL  
**Total Required Tables**: 35+

---

## 🎯 Quick Start

### Verify Your Database
```sql
-- Run this in Supabase SQL Editor
\i backend/sql/verify_required_tables.sql
```

### Create Missing Marketplace Tables
```sql
-- If verification shows missing marketplace tables
\i backend/sql/create_marketplace_tables.sql
```

---

## 📋 Complete Table Inventory

### 1. **Core Tables** (7 tables) - ⚠️ CRITICAL

| Table | Purpose | Used By |
|-------|---------|---------|
| `users` | User accounts and profiles | All endpoints |
| `apartments` | Property listings | Property routes, search |
| `viewing_requests` | Viewing appointment requests | Viewing dashboard, booking |
| `conversations` | Chat threads between users | Messaging system |
| `messages` | Individual chat messages | Messaging endpoints |
| `offers` | Rental offers/applications | Application workflow |
| `feedback` | User feedback submissions | Feedback endpoint |

**Missing any?** Run `backend/migrations/001_initial_supabase_setup.sql`

---

### 2. **Payment & Transactions** (2 tables) - ⚠️ CRITICAL

| Table | Purpose | Used By |
|-------|---------|---------|
| `payment_transactions` | All payment records | Admin dashboard, payment endpoints |
| `refund_requests` | Refund request tracking | Admin refund endpoints |

**Missing any?** Run `backend/migrations/002_enhanced_api_support.sql`

---

### 3. **Marketplace Tables** (5 tables) - ⚠️ CRITICAL

| Table | Purpose | Used By |
|-------|---------|---------|
| `marketplace_listings` | User-to-user item listings | `/api/marketplace/*` endpoints |
| `marketplace_contacts` | Initial buyer-seller contacts | `/api/marketplace/contact` |
| `marketplace_chats` | Persistent chat sessions | `/api/marketplace/chat` |
| `chat_messages` | Individual chat messages | Chat functionality |
| `marketplace_payments` | Marketplace payment tracking | `/api/marketplace/payment` |

**Missing any?** Run `backend/sql/create_marketplace_tables.sql`

---

### 4. **Admin & Support** (4 tables) - ⚠️ CRITICAL

| Table | Purpose | Used By |
|-------|---------|---------|
| `admin_audit_log` | Admin action tracking | All admin endpoints |
| `support_tickets` | User support requests | `/api/admin/messages/:id/resolve` |
| `support_ticket_messages` | Ticket conversation history | Support system |
| `trust_safety_reports` | User-reported issues | `/api/admin/reports/:id/resolve` |

**Missing any?** Run `backend/migrations/002_enhanced_api_support.sql` or `backend/sql/create_marketplace_tables.sql`

---

### 5. **GDPR Compliance** (7 tables) - ✅ Required for Legal Compliance

| Table | Purpose | Used By |
|-------|---------|---------|
| `gdpr_requests` | Data access/deletion requests | GDPR endpoints |
| `gdpr_tracking_logs` | Compliance audit trail | `gdpr-tracking.mjs` |
| `consent_purposes` | Available consent types | Consent management |
| `consents` | User consent records | GDPR compliance |
| `data_processing_logs` | Data processing audit | GDPR tracking |
| `data_breaches` | Breach incident tracking | Security compliance |
| `dpias` | Data protection assessments | Privacy impact analysis |

**Missing any?** Run `backend/migrations/001_initial_supabase_setup.sql`

---

### 6. **Notifications & Email** (2 tables) - ✅ Recommended

| Table | Purpose | Used By |
|-------|---------|---------|
| `notifications` | In-app notification system | Marketplace, admin routes |
| `email_logs` | Email delivery tracking | Email service |

**Missing any?** Run `supabase/migrations/20250929000002_german_rental_platform_schema.sql`

---

### 7. **User Activity** (4 tables) - ℹ️ Optional

| Table | Purpose | Used By |
|-------|---------|---------|
| `user_favorites` | Saved property favorites | Frontend favorites feature |
| `saved_searches` | Saved search criteria | Search functionality |
| `recently_viewed` | User browsing history | Recommendations |
| `reviews` | Property/user reviews | Rating system |

**Missing any?** Run `supabase/migrations/20250929000002_german_rental_platform_schema.sql`

---

## 🔍 Table Dependencies Map

```
users (root)
  ├── apartments (owner_id)
  │     ├── viewing_requests (apartment_id)
  │     ├── conversations (apartment_id)
  │     ├── offers (apartment_id)
  │     └── marketplace_listings (user_id)
  │
  ├── marketplace_listings (user_id)
  │     ├── marketplace_contacts (listing_id)
  │     ├── marketplace_chats (listing_id)
  │     └── marketplace_payments (listing_id)
  │
  ├── marketplace_chats (buyer_id, seller_id)
  │     └── chat_messages (chat_id)
  │
  ├── payment_transactions (user_id)
  ├── refund_requests (user_id)
  ├── support_tickets (user_id)
  ├── trust_safety_reports (reporter_id, reported_user_id)
  ├── admin_audit_log (admin_id)
  └── gdpr_requests (user_id)
```

---

## 🚨 Critical Tables for Each Feature

### Admin Dashboard Endpoints
**Required Tables:**
- ✅ `payment_transactions` - GET /api/admin/payments
- ✅ `refund_requests` - POST /api/admin/refunds/:id/approve|deny
- ✅ `support_tickets` - POST /api/admin/messages/:id/resolve
- ✅ `trust_safety_reports` - POST /api/admin/reports/:id/resolve
- ✅ `admin_audit_log` - All admin actions
- ✅ `users` - User management

**Missing?** → Admin endpoints will fail with 500 errors

---

### Marketplace Backend Endpoints
**Required Tables:**
- ✅ `marketplace_listings` - All marketplace routes
- ✅ `marketplace_contacts` - POST /api/marketplace/contact
- ✅ `marketplace_chats` - POST /api/marketplace/chat
- ✅ `chat_messages` - Chat functionality
- ✅ `marketplace_payments` - POST /api/marketplace/payment
- ✅ `notifications` - User notifications
- ✅ `users` - Buyer/seller info

**Missing?** → Marketplace features will not work

---

### Frontend Marketplace Integration
**Required Tables:**
- ✅ `marketplace_chats` - messageOwner() function
- ✅ `marketplace_payments` - processTraditionalPayment() function
- ✅ `marketplace_listings` - markAsSold() function

**Missing?** → Frontend functions will fail silently

---

### Viewing Requests Dashboard
**Required Tables:**
- ✅ `viewing_requests` - viewRequestDetails() function
- ✅ `apartments` - Property information
- ✅ `users` - Requester/landlord info

**Missing?** → Dashboard will be empty

---

## 📝 Migration Scripts Reference

### Primary Migrations (Run in Order)

1. **Initial Core Schema**
   ```bash
   File: backend/migrations/001_initial_supabase_setup.sql
   Creates: users, apartments, viewing_requests, conversations, messages, 
            offers, feedback, gdpr_* tables
   ```

2. **Enhanced API Support**
   ```bash
   File: backend/migrations/002_enhanced_api_support.sql
   Creates: support_tickets, support_ticket_messages, refund_requests,
            payment_transactions
   ```

3. **Marketplace Tables** (NEW)
   ```bash
   File: backend/sql/create_marketplace_tables.sql
   Creates: marketplace_listings, marketplace_contacts, marketplace_chats,
            chat_messages, marketplace_payments, admin_audit_log,
            trust_safety_reports
   ```

4. **German Rental Schema** (Optional - for German market features)
   ```bash
   File: supabase/migrations/20250929000002_german_rental_platform_schema.sql
   Creates: Enhanced German-specific fields, notifications, email_logs,
            user_favorites, saved_searches, recently_viewed, reviews
   ```

---

## ✅ Verification Checklist

Run this verification query in Supabase SQL Editor:

```sql
-- Count existing tables
SELECT 
    'Total Tables' as metric,
    COUNT(*) as value
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
AND table_name IN (
    -- Core
    'users', 'apartments', 'viewing_requests', 'conversations', 'messages', 'offers', 'feedback',
    -- Payments
    'payment_transactions', 'refund_requests',
    -- Marketplace
    'marketplace_listings', 'marketplace_contacts', 'marketplace_chats', 'chat_messages', 'marketplace_payments',
    -- Admin
    'admin_audit_log', 'support_tickets', 'support_ticket_messages', 'trust_safety_reports',
    -- GDPR
    'gdpr_requests', 'gdpr_tracking_logs', 'consent_purposes', 'consents', 'data_processing_logs', 'data_breaches', 'dpias',
    -- Notifications
    'notifications', 'email_logs',
    -- User Activity
    'user_favorites', 'saved_searches', 'recently_viewed', 'reviews'
);
```

**Expected Result**: Value should be **31-35 tables**

---

## 🔧 Troubleshooting

### Missing Marketplace Tables
**Symptom**: 500 errors on `/api/marketplace/*` endpoints  
**Fix**: Run `backend/sql/create_marketplace_tables.sql`

### Missing Admin Tables
**Symptom**: Admin dashboard endpoints fail  
**Fix**: Run `backend/migrations/002_enhanced_api_support.sql`

### Missing Core Tables
**Symptom**: Basic features don't work  
**Fix**: Run `backend/migrations/001_initial_supabase_setup.sql`

### Table Exists But Wrong Schema
**Symptom**: Insert/update fails with column errors  
**Fix**: Drop table and re-run migration, OR use `ALTER TABLE` to add missing columns

---

## 📊 Quick Stats Query

```sql
-- Get row counts for all tables
SELECT 
    schemaname,
    tablename,
    n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;
```

---

## 🎯 Next Steps

1. ✅ **Run verification script**: `backend/sql/verify_required_tables.sql`
2. ✅ **Create missing tables**: Use appropriate migration scripts above
3. ✅ **Verify extensions**: Ensure `uuid-ossp`, `pg_trgm`, `postgis` installed
4. ✅ **Test endpoints**: Run manual tests from `docs/NEXT_STEPS_TESTING_DEPLOYMENT.md`
5. ✅ **Configure RLS**: Set up Row Level Security policies for production
6. ✅ **Seed test data**: Add sample data for development/testing

---

## 📚 Related Documentation

- [Complete Migration Guide](../docs/DEPLOYMENT_GUIDE_COMPLETE.md)
- [Testing Guide](../docs/NEXT_STEPS_TESTING_DEPLOYMENT.md)
- [API Endpoints Documentation](../docs/MISSION_COMPLETE_FINAL_REPORT.md)
- [Database Verification Script](./verify_required_tables.sql)
- [Marketplace Tables Creation](./create_marketplace_tables.sql)

---

**Generated**: October 6, 2025  
**Database Type**: Supabase PostgreSQL 15+  
**Minimum Tables Required**: 18 (Core + Payments + Marketplace + Admin)  
**Recommended Tables**: 31+ (includes GDPR, Notifications, User Activity)
