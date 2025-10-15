# Supabase & Database Operations Plan

## Assets in Repository
- **Migration Files (`supabase/migrations/`)**
  - `20250813000001_initial_schema.sql`
  - `20250929000001_clean_schema_migration.sql`
  - `20250929000002_german_rental_platform_schema.sql`
  - `202510060001_advanced_search_seed.sql`
  - `20251006_create_all_required_tables.sql`
  - Support scripts: `configure_rls_policies.sql`, `create_test_data.sql`, `quick_start_verification.sql`, `verify_tables_quick.sql`, `backup/` dumps.
- **Top-Level SQL**
  - `supabase_clean_schema.sql`
  - `SUPABASE_ACCOUNT_CREATION_FIX.sql`
  - `SUPABASE_SCHEMA_FIX.md`
  - `clean_schema_migration.sql`
  - `supabasetables.sql`
  - `quick_start_verification.sql` (duplicate of migration helper)
- **Documentation**: `SUPABASE_SETUP_GUIDE.md`, `HOW_TO_CREATE_ALL_TABLES.md`, `QUICK_START_DATABASE.md`, etc.

## Observed Gaps
1. **Migration Ordering**: Timestamps overlap (`20251006...` without seconds). Need to confirm actual execution order to avoid missing dependencies.
2. **Duplicate Scripts**: “clean schema” appears both in root and migrations directory; `quick_start_verification.sql` exists twice.
3. **Unverified Seeds**: `create_test_data.sql` and `_data.sql` are not referenced in docs or automated tasks.
4. **Policy Configuration**: `configure_rls_policies.sql` isn’t wired into migrations—manual step risk.
5. **Doc Drift**: Multiple guides describe similar flows; none confirm the latest migration chain.
6. **Automation**: No CI job currently runs Supabase migrations or schema verification.

## Action Items
1. **Canonical Migration Chain**
   - Decide on naming convention (timestamp format, single source directory).
   - Merge duplicates (`clean_schema_migration.sql` vs `20250929000001_clean_schema_migration.sql`).
   - Ensure `configure_rls_policies.sql` is either embedded in the migration or referenced by a follow-up migration.
2. **Validation Script**
   - Create a reusable `npm run db:verify` (or similar) that runs Supabase CLI migrations against a local database and executes `verify_tables_quick.sql`.
   - Include seed scripts explicitly (optional/fixture modules).
3. **Documentation Update**
   - Produce a single setup guide referencing exact commands:
     ```
     supabase db reset --db-url <url> --schema public
     supabase db push
     psql < verify_tables_quick.sql
     ```
   - Link to the validation script in `RUN_DATABASE_MIGRATION.md` and `SUPABASE_SETUP_GUIDE.md`.
4. **Environment Management**
   - Document required Supabase env vars (anon key, service role, API URL) in `.env.example`.
   - Ensure Netlify functions and backend share consistent env names.
5. **CI Pipeline**
   - Add optional job that spins up a Postgres container, runs migrations, executes verification SQL, and reports status.
6. **Backups & Rollback**
   - Clarify usage of `backup/` dumps (e.g., baseline data restore). Provide instructions for restoring in staging/production.

## Tracking
- Owner: _TBD_
- Dependencies: `TOOLING_ALIGNMENT_PLAN.md` (for CLI integration), `GAP_ACTION_PLAN.md` (overall roadmap).
- Status: _Open_.
