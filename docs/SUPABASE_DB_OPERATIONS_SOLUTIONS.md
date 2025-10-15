# Supabase & Database Operations Solutions

These fixes convert the operations plan into actionable steps backed by Supabase’s CLI documentation and testing guides.

## 1. Canonical Migration Chain
- Follow Supabase’s local development workflow by generating migrations with `supabase migration new <name>` so each file has a unique timestamped prefix (Supabase local development guide, “Database migrations”). Rename the existing `20251006…` duplicates to full `YYYYMMDDHHMMSS` values and retain a single `supabase/migrations/` source of truth.
- Merge duplicate SQL (“clean schema”, “quick start verification”) into dedicated migrations or helper scripts and delete the root-level copies to avoid drift. Where RLS policies currently live in loose scripts, capture them inside an ordered migration (the same guide shows subsequent migrations for schema changes).

## 2. Embed RLS and Seeds in Automation
- Append the contents of `configure_rls_policies.sql` as a migration so policies are applied automatically after schema objects are created. Supabase recommends diffing or writing SQL directly into migrations rather than relying on manual scripts.
- Move seed data into `supabase/seed.sql` and call it from `supabase db reset` so local resets and CI environments start with consistent fixtures (local development guide, “Add sample data” and “Reset your database”). Document optional scenario seeds separately if they should not run in every environment.

## 3. One-Click Verification
- Add a root `npm run db:verify` script that chains:
  1. `supabase db reset --linked --env-file .env.local` *(or a designated URL)*
  2. `psql "$SUPABASE_DB_URL" -f supabase/scripts/verify_tables_quick.sql`
  3. `supabase test db` to execute pgTAP checks (Supabase “Testing your database” guide).
- Store verification SQL and pgTAP tests under `supabase/scripts/` and `supabase/tests/database/` respectively, matching the CLI’s expected layout (`supabase/tests/database/*.test.sql`).

## 4. Documentation Single Source
- Collapse the setup instructions into `SUPABASE_SETUP_GUIDE.md`, linking to the new `db:verify` script and the canonical migration naming rules. Reference Supabase commands directly (e.g., `supabase db push` for deploying to the hosted project, “Deploy database changes” section).
- Update ancillary docs (`QUICK_START_DATABASE.md`, `SUPABASE_SCHEMA_FIX.md`) to point to the setup guide instead of duplicating instructions. Highlight that manual SQL files outside `supabase/migrations/` are deprecated once the merge completes.

## 5. Environment Management
- List required variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`) in `.env.example` and ensure they propagate to backend and Netlify functions. The Supabase CLI automatically substitutes values from `.env` during local runs (“Use Auth locally” section notes best practice for secrets).
- For CI, inject a temporary database URL via environment variables and reuse the same `db:verify` script. Document the expectation that secrets must be supplied through secure CI configuration, not committed files.

## 6. CI Pipeline Enforcement
- Create a GitHub Actions/CI job that starts a PostgreSQL service, sets `SUPABASE_DB_URL`, and runs `npm run db:verify`. This mirrors Supabase’s recommendation to rely on CLI automation for schema validation (“Testing using the Supabase CLI”).
- Fail the pipeline if migrations or pgTAP tests fail so schema regressions are caught before deployment.

## 7. Backup & Rollback Playbook
- Keep curated backups in `supabase/backup/` with metadata (timestamp, originating environment, Postgres version). Use Supabase’s “Restoring a downloaded backup” workflow to document how to load a dump locally with `supabase db start --from-backup <file>`.
- Pair each backup with a short README noting the matching migration hash so teams can reconcile restored data with the current migration chain before pushing changes upstream.
