# 🗄️ Tenant Screening Database Migration Guide

## 📋 **Migration Overview**

This migration adds comprehensive German tenant screening capabilities to your SichrPlace platform, including SCHUFA credit checks, employment verification, landlord references, and financial qualification assessment.

## 🎯 **What This Migration Adds**

### **📊 New Database Tables**
- `schufa_checks` - SCHUFA credit verification and scoring
- `employment_verifications` - Income and employment validation  
- `landlord_reference_checks` - Reference collection management
- `individual_landlord_references` - Individual landlord responses
- `financial_qualifications` - Financial assessment and 3x rent rule
- `tenant_screening_logs` - Comprehensive audit trail

### **🔧 Performance Optimizations**
- **20+ Strategic Indexes** for query performance
- **Automated Triggers** for timestamp updates
- **Utility Functions** for screening status checks
- **Data Cleanup Functions** for expired records

### **🔒 Security Features**
- **Row Level Security (RLS)** policies for data protection
- **GDPR Compliance** structures and logging
- **Audit Trail** for all screening activities
- **German Privacy Laws** compliance

---

## 🚀 **STEP 1: Pre-Migration Checklist**

### **✅ Prerequisites**
- [ ] Supabase project is set up and accessible
- [ ] Initial schema migration (`001_initial_supabase_setup.sql`) is complete
- [ ] You have admin access to Supabase SQL Editor
- [ ] Environment variables are configured
- [ ] Backup of existing data (if any)

### **📁 Required Files**
- `backend/migrations/002_tenant_screening_schema.sql` (Main migration)
- `supabase/migrations/20250922_tenant_screening_schema.sql` (Supabase format)
- `scripts/verify-tenant-screening-migration.js` (Verification script)

---

## 🗄️ **STEP 2: Run Database Migration**

### **Option A: Supabase Dashboard (Recommended)**

1. **Open Supabase Dashboard**
   ```
   https://app.supabase.com/project/[YOUR-PROJECT-ID]
   ```

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Run Migration Script**
   ```sql
   -- Copy and paste the contents of:
   -- backend/migrations/002_tenant_screening_schema.sql
   
   -- OR copy from:
   -- supabase/migrations/20250922_tenant_screening_schema.sql
   ```

4. **Execute Migration**
   - Click "Run" button
   - Wait for completion (should take 10-30 seconds)
   - Verify no errors in output

### **Option B: Supabase CLI (Advanced)**

```bash
# Navigate to project directory
cd /path/to/sichrplace

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-id

# Push migration
supabase db push
```

---

## ✅ **STEP 3: Verify Migration Success**

### **🔧 Run Verification Script**

```bash
# Set environment variables
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"

# Run verification
node scripts/verify-tenant-screening-migration.js
```

### **Expected Output:**
```
🔍 SICHRPLACE TENANT SCREENING MIGRATION VERIFICATION
═══════════════════════════════════════════════════════════
🔌 Testing Supabase Connection...
✅ Supabase connection successful

📋 Verifying Tenant Screening Tables...
✅ Table 'schufa_checks' exists and accessible
✅ Table 'employment_verifications' exists and accessible
✅ Table 'landlord_reference_checks' exists and accessible
✅ Table 'individual_landlord_references' exists and accessible
✅ Table 'financial_qualifications' exists and accessible
✅ Table 'tenant_screening_logs' exists and accessible

🏗️ Verifying Table Structure...
✅ SCHUFA checks table structure verified
✅ Employment verifications table structure verified
✅ Landlord reference checks table structure verified
✅ Financial qualifications table structure verified

🔐 Testing Row Level Security Policies...
✅ Row Level Security policies are active

⚙️ Testing Utility Functions...
✅ Tenant screening status function is working

🎉 MIGRATION VERIFICATION SUCCESSFUL!
✅ Your German tenant screening database is ready for production
```

---

## 🔧 **STEP 4: Test Database Connectivity**

### **Test Tenant Screening APIs**

```bash
# Test SCHUFA API connectivity
curl -X POST http://localhost:8888/.netlify/functions/tenant-screening/schufa-credit-check/check-connection \
  -H "Content-Type: application/json"

# Test Employment API connectivity  
curl -X POST http://localhost:8888/.netlify/functions/tenant-screening/employment-verification/check-connection \
  -H "Content-Type: application/json"

# Test References API connectivity
curl -X POST http://localhost:8888/.netlify/functions/tenant-screening/landlord-references/check-connection \
  -H "Content-Type: application/json"

# Test Financial API connectivity
curl -X POST http://localhost:8888/.netlify/functions/tenant-screening/salary-requirements/check-connection \
  -H "Content-Type: application/json"
```

---

## 📊 **STEP 5: Verify Table Creation**

### **Check Tables in Supabase Dashboard**

1. Go to **Table Editor** in Supabase Dashboard
2. Verify these tables exist:
   - ✅ `schufa_checks`
   - ✅ `employment_verifications`
   - ✅ `landlord_reference_checks`
   - ✅ `individual_landlord_references`
   - ✅ `financial_qualifications`
   - ✅ `tenant_screening_logs`

### **Check Key Columns**

**SCHUFA Checks Table:**
- `id`, `user_id`, `apartment_id`, `schufa_request_id`
- `credit_score`, `risk_category`, `status`
- `valid_until`, `created_at`

**Employment Verifications Table:**
- `id`, `user_id`, `apartment_id`, `employer_name`
- `gross_monthly_salary`, `meets_three_times_rule`
- `verification_status`, `expires_at`

**Financial Qualifications Table:**
- `id`, `user_id`, `apartment_id`, `monthly_rent`
- `qualification_level`, `affordability_score`
- `meets_three_times_rule`, `status`

---

## 🔒 **STEP 6: Security Verification**

### **Row Level Security Check**
```sql
-- In Supabase SQL Editor, verify RLS is enabled:
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN (
  'schufa_checks', 
  'employment_verifications', 
  'landlord_reference_checks',
  'individual_landlord_references',
  'financial_qualifications',
  'tenant_screening_logs'
);
```

**Expected Result:** All tables should show `rowsecurity = true`

### **Policy Verification**
```sql
-- Check RLS policies exist:
SELECT schemaname, tablename, policyname, cmd, roles 
FROM pg_policies 
WHERE tablename LIKE '%schufa%' OR tablename LIKE '%employment%' OR tablename LIKE '%landlord%' OR tablename LIKE '%financial%';
```

---

## 🧪 **STEP 7: Sample Data Testing (Optional)**

### **Insert Test Data (Admin Only)**

```sql
-- Test SCHUFA check insertion (will be blocked by RLS for regular users)
INSERT INTO schufa_checks (
  user_id, schufa_request_id, first_name, last_name, 
  date_of_birth, address, postal_code, city, status
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'TEST_001',
  'Max',
  'Mustermann', 
  '1990-01-01',
  'Musterstraße 1',
  '12345',
  'Berlin',
  'pending'
);
```

**Expected:** Insert will fail due to RLS policies (this is correct!)

---

## ⚠️ **Troubleshooting**

### **Common Issues & Solutions**

#### **Issue: Migration Script Fails**
```
ERROR: relation "users" does not exist
```
**Solution:** Run the initial schema migration first (`001_initial_supabase_setup.sql`)

#### **Issue: Permission Denied**
```
ERROR: permission denied for table schufa_checks
```
**Solution:** RLS policies are working correctly. Use authenticated requests.

#### **Issue: Function Not Found**
```
ERROR: function get_tenant_screening_status does not exist
```
**Solution:** Re-run the migration script to create utility functions.

#### **Issue: Verification Script Fails**
```
SUPABASE_ANON_KEY environment variable is required
```
**Solution:** Set your environment variables:
```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"
```

---

## 📈 **Performance Optimization**

### **Indexes Created**
- `idx_schufa_checks_user_id` - Fast user lookups
- `idx_employment_verifications_status` - Status filtering
- `idx_landlord_reference_checks_apartment_id` - Apartment queries
- `idx_financial_qualifications_level` - Qualification filtering
- `idx_tenant_screening_logs_created_at` - Time-based queries

### **Expected Performance**
- **User Screening Lookup:** < 50ms
- **Apartment Screening Summary:** < 100ms
- **Screening History Query:** < 200ms
- **Status Updates:** < 30ms

---

## 🎯 **Next Steps After Migration**

### **Immediate Tasks**
1. ✅ **Database Migration Complete**
2. 🔄 **Frontend Interface Creation** - Next priority
3. 🔄 **API Integration Testing**
4. 🔄 **Admin Dashboard Development**
5. 🔄 **End-to-End Workflow Testing**

### **Development Workflow**
```bash
# 1. Start development server
netlify dev --port 8888

# 2. Test screening APIs
npm run test:screening

# 3. Verify database connectivity
node scripts/verify-tenant-screening-migration.js

# 4. Deploy to staging
netlify deploy

# 5. Production deployment
netlify deploy --prod
```

---

## 📞 **Support & Documentation**

### **Migration Files Location**
- **Main Migration:** `backend/migrations/002_tenant_screening_schema.sql`
- **Supabase Migration:** `supabase/migrations/20250922_tenant_screening_schema.sql`
- **Verification Script:** `scripts/verify-tenant-screening-migration.js`

### **API Documentation**
- **SCHUFA API:** `/netlify/functions/tenant-screening/schufa-credit-check.mjs`
- **Employment API:** `/netlify/functions/tenant-screening/employment-verification.mjs`
- **References API:** `/netlify/functions/tenant-screening/landlord-references.mjs`
- **Financial API:** `/netlify/functions/tenant-screening/salary-requirements.mjs`

---

## ✅ **Migration Success Confirmation**

When you see this output from the verification script:

```
🎉 MIGRATION VERIFICATION SUCCESSFUL!
✅ Your German tenant screening database is ready for production

📊 Migration Status Report
═══════════════════════════════════════════════════════════
✅ Tables Created: 6
✅ Database Schema: Ready for German tenant screening
✅ Security Policies: Row Level Security enabled
✅ Utility Functions: Screening status checking available

🚀 Next Steps:
   1. Your tenant screening APIs can now connect to the database
   2. Create frontend interfaces for tenant screening workflow  
   3. Integrate with existing apartment booking system
   4. Test complete screening workflow end-to-end
```

**🎉 Your German tenant screening database migration is complete and ready for production!**