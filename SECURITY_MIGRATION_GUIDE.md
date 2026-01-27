# 🔐 Security Migration Guide - Credential Hashing

## Overview
This guide walks you through the process of migrating from hardcoded credentials to secure, environment-variable-based authentication with bcrypt password hashing.

## ⚠️ Critical Security Issue Addressed

### Vulnerabilities Found
1. **Hardcoded passwords** in `js/backend/quickTestApartment.js`
2. **Plaintext test credentials** in `js/backend/app.js`
3. **Exposed JWT secret** with fallback to hardcoded value
4. **No encryption** for sensitive API keys

### Impact
- **HIGH RISK**: Credentials exposed in version control
- **HIGH RISK**: Potential unauthorized access to admin accounts
- **MEDIUM RISK**: JWT tokens could be forged if secret is compromised

## 🛠️ Migration Steps

### Step 1: Generate Secure Hashes

Run the hash generation script:

```bash
cd scripts
npm install
node hash-all-secrets.js
```

This will:
- Generate bcrypt hashes for all known passwords
- Create a new JWT secret
- Generate a master encryption key
- Save results to `tmp/hashed-secrets.json`
- Create SQL migration file in `tmp/password-migration.sql`

**Output files:**
- `tmp/hashed-secrets.json` - All hashed passwords and secrets
- `tmp/password-migration.sql` - Database migration script
- `tmp/env-template.txt` - Environment variable template

### Step 2: Update Environment Variables

1. **Copy the template:**
   ```bash
   cp .env.example .env
   ```

2. **Update your `.env` file:**
   
   Open `.env` and set these values from `tmp/env-template.txt`:
   
   ```bash
   # Admin password (for test environments)
   ADMIN_PASSWORD=Gokhangulec29*
   
   # Test user password
   TEST_USER_PASSWORD=Test123!@#
   
   # JWT Secret (from generated output)
   JWT_SECRET=<paste_from_tmp/env-template.txt>
   
   # Master encryption key (optional)
   MASTER_KEY=<paste_from_tmp/env-template.txt>
   
   # Other required variables
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   # ... etc
   ```

3. **Production/Staging environments:**
   
   Add these environment variables to your hosting platform:
   
   **Netlify:**
   ```bash
   # In Netlify dashboard: Site settings > Environment variables
   ADMIN_PASSWORD=Gokhangulec29*
   TEST_USER_PASSWORD=Test123!@#
   JWT_SECRET=<generated_value>
   ```
   
   **Railway:**
   ```bash
   # In Railway dashboard: Variables tab
   ADMIN_PASSWORD=Gokhangulec29*
   TEST_USER_PASSWORD=Test123!@#
   JWT_SECRET=<generated_value>
   ```

### Step 3: Run Database Migration

1. **Backup your database first:**
   ```bash
   # Example for Supabase
   # Export via Supabase Dashboard > Database > Backups
   ```

2. **Run the migration:**
   
   Open Supabase SQL Editor and execute `tmp/password-migration.sql`:
   
   ```sql
   -- Review the script first
   -- Then run section by section
   -- Check verification queries before committing
   ```

3. **Verify the migration:**
   
   Run the verification query:
   ```sql
   SELECT email, 
          CASE 
            WHEN password_hash LIKE '$2a$%' OR password_hash LIKE '$2b$%' 
            THEN 'Bcrypt Hash ✓'
            ELSE 'Plain Text ✗'
          END as password_status
   FROM users
   WHERE email IN ('sichrplace@gmail.com', 'omer3kale@gmail.com')
      OR email LIKE 'test_%@sichrplace.com';
   ```

### Step 4: Test the Changes

1. **Test local authentication:**
   ```bash
   npm run backend:dev
   ```

2. **Test login with environment variables:**
   ```bash
   # Start the server
   npm run backend:dev
   
   # In another terminal, test the endpoint
   cd js/backend
   node quickTestApartment.js
   ```

3. **Test admin login:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/login-test \
     -H "Content-Type: application/json" \
     -d '{"email":"sichrplace@gmail.com","password":"Gokhangulec29*"}'
   ```

### Step 5: Clean Up

1. **Secure the generated files:**
   ```bash
   # Move sensitive files to password manager
   # Then delete them from filesystem
   rm -rf tmp/hashed-secrets.json
   rm -rf tmp/password-migration.sql
   rm -rf tmp/env-template.txt
   ```

2. **Verify .gitignore:**
   ```bash
   git status
   # Ensure no .env files or tmp/ files are staged
   ```

3. **Update documentation:**
   - Document the new environment variables in your deployment guide
   - Update team wiki/docs with security procedures

## 🔒 Security Best Practices

### Password Management
- **Use strong passwords**: Minimum 12 characters, mix of upper/lower/numbers/symbols
- **Rotate credentials**: Change passwords every 90 days
- **Use password manager**: Store production credentials securely
- **Never commit secrets**: Always check before committing

### Environment Variables
- **Different per environment**: Use separate secrets for dev/staging/production
- **Access control**: Limit who can view production environment variables
- **Audit logging**: Track who accesses secrets
- **Backup securely**: Keep encrypted backups of production secrets

### JWT Secrets
- **Long and random**: Use cryptographically secure random generation
- **Rotate regularly**: Generate new secrets quarterly
- **Invalidate old tokens**: When rotating, invalidate existing JWT tokens
- **Monitor usage**: Track unusual JWT generation patterns

### API Keys
- **Encrypt at rest**: Use the provided encryption utility
- **Rotate on breach**: Immediately rotate if exposure suspected
- **Scope appropriately**: Use minimum required permissions
- **Monitor usage**: Track API key usage and rate limits

## 📋 Testing Checklist

- [ ] Script `hash-all-secrets.js` runs successfully
- [ ] All passwords have bcrypt hashes in database
- [ ] Test user can login with `TEST_USER_PASSWORD` env var
- [ ] Admin accounts work correctly with `ADMIN_PASSWORD` env var
- [ ] JWT secret is loaded from `JWT_SECRET` env var
- [ ] No hardcoded passwords in committed code
- [ ] `.env` files are in `.gitignore`
- [ ] SQL migration completes without errors
- [ ] Verification queries show all bcrypt hashes
- [ ] `tmp/` directory is not committed to git

## 🚨 Rollback Procedure

If issues occur after migration:

1. **Database rollback:**
   ```sql
   -- If you ran in a transaction and haven't committed:
   ROLLBACK;
   
   -- If already committed, restore from backup:
   -- Use Supabase Dashboard > Database > Restore
   ```

2. **Code rollback:**
   ```bash
   git checkout HEAD~1 -- js/backend/app.js
   git checkout HEAD~1 -- js/backend/quickTestApartment.js
   ```

3. **Test before redeploying:**
   ```bash
   npm run backend:dev
   # Verify login functionality
   ```

## 📞 Support

If you encounter issues:

1. **Check logs:**
   ```bash
   # Server logs
   tail -f backend/logs/error.log
   
   # Database logs
   # Check Supabase Dashboard > Logs
   ```

2. **Common issues:**
   - **JWT_SECRET not set**: Server won't start or returns 500 errors
   - **Wrong password hash**: Login fails with 401 error
   - **Database migration failed**: Check SQL syntax and permissions

3. **Get help:**
   - Review this guide again
   - Check `.env.example` for required variables
   - Verify database connection settings

## 📚 Additional Resources

- [bcrypt npm package](https://www.npmjs.com/package/bcryptjs)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [Node.js Crypto Module](https://nodejs.org/api/crypto.html)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/security)

## 📝 Migration Completion Checklist

- [ ] All scripts executed successfully
- [ ] Database passwords migrated to bcrypt hashes
- [ ] Environment variables configured in all environments
- [ ] Application tested and working correctly
- [ ] Sensitive files deleted from filesystem
- [ ] Documentation updated
- [ ] Team notified of changes
- [ ] Security audit completed
- [ ] Backup of production secrets stored securely

---

**Migration Date:** 2026-01-27  
**Migration Status:** ✅ Ready to Execute  
**Security Level:** 🔴 CRITICAL - Execute Immediately
