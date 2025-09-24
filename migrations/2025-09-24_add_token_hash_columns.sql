-- Add hashed token columns for security
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'verification_token_hash') THEN
        ALTER TABLE users ADD COLUMN verification_token_hash TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'reset_token_hash') THEN
        ALTER TABLE users ADD COLUMN reset_token_hash TEXT;
    END IF;
END $$;

-- Optional: keep legacy columns but stop using them; ensure indexes exist on hash columns
CREATE INDEX IF NOT EXISTS idx_users_verification_token_hash ON users(verification_token_hash);
CREATE INDEX IF NOT EXISTS idx_users_reset_token_hash ON users(reset_token_hash);

-- Backfill: if legacy tokens exist without hashes, compute hashes via database function (Postgres sha256)
-- Note: This requires pgcrypto extension for digest(); enable if not present
DO $$
BEGIN
    PERFORM 1 FROM pg_extension WHERE extname = 'pgcrypto';
    IF NOT FOUND THEN
        -- Attempt to enable; requires superuser privileges
        BEGIN
            CREATE EXTENSION IF NOT EXISTS pgcrypto;
        EXCEPTION WHEN OTHERS THEN
            -- If cannot enable, skip backfill silently
            RAISE NOTICE 'pgcrypto extension not enabled; skipping backfill of token hashes';
            RETURN;
        END;
    END IF;

        -- Backfill hashes where legacy tokens are present and hashes are null
        -- Handle multiple possible legacy column names without referencing non-existent columns
        IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'verification_token'
        ) THEN
                        EXECUTE $sql$
                            UPDATE users SET 
                                verification_token_hash = COALESCE(verification_token_hash, encode(digest(verification_token, 'sha256'), 'hex'))
                            WHERE verification_token IS NOT NULL AND (verification_token_hash IS NULL OR verification_token_hash = '')
                        $sql$;
        ELSIF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'email_verification_token'
        ) THEN
                        EXECUTE $sql$
                            UPDATE users SET 
                                verification_token_hash = COALESCE(verification_token_hash, encode(digest(email_verification_token, 'sha256'), 'hex'))
                            WHERE email_verification_token IS NOT NULL AND (verification_token_hash IS NULL OR verification_token_hash = '')
                        $sql$;
        END IF;

        IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'reset_token'
        ) THEN
                        EXECUTE $sql$
                            UPDATE users SET 
                                reset_token_hash = COALESCE(reset_token_hash, encode(digest(reset_token, 'sha256'), 'hex'))
                            WHERE reset_token IS NOT NULL AND (reset_token_hash IS NULL OR reset_token_hash = '')
                        $sql$;
        ELSIF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'reset_password_token'
        ) THEN
                        EXECUTE $sql$
                            UPDATE users SET 
                                reset_token_hash = COALESCE(reset_token_hash, encode(digest(reset_password_token, 'sha256'), 'hex'))
                            WHERE reset_password_token IS NOT NULL AND (reset_token_hash IS NULL OR reset_token_hash = '')
                        $sql$;
        END IF;
END $$;

-- Do not drop legacy columns automatically to avoid breaking older code paths
-- Consider nulling legacy token columns via app code after migration

SELECT 'Token hash columns ensured and backfill attempted' AS status;
