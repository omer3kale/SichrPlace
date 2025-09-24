-- Cleanup legacy plaintext token columns by nulling their values if present
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'verification_token'
    ) THEN
        UPDATE users SET verification_token = NULL WHERE verification_token IS NOT NULL;
        RAISE NOTICE 'Cleared users.verification_token';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'email_verification_token'
    ) THEN
        UPDATE users SET email_verification_token = NULL WHERE email_verification_token IS NOT NULL;
        RAISE NOTICE 'Cleared users.email_verification_token';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'reset_token'
    ) THEN
        UPDATE users SET reset_token = NULL WHERE reset_token IS NOT NULL;
        RAISE NOTICE 'Cleared users.reset_token';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'reset_password_token'
    ) THEN
        UPDATE users SET reset_password_token = NULL WHERE reset_password_token IS NOT NULL;
        RAISE NOTICE 'Cleared users.reset_password_token';
    END IF;
END $$;

SELECT 'Legacy plaintext token columns have been nulled (where present)' AS status;
