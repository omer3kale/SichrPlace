-- Drop legacy plaintext token columns and related indexes, if present
DO $$
BEGIN
  -- Drop indexes that reference legacy columns (if any)
  BEGIN
    EXECUTE 'DROP INDEX IF EXISTS idx_users_email_verification_token';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Index idx_users_email_verification_token not dropped (may not exist)';
  END;

  BEGIN
    EXECUTE 'DROP INDEX IF EXISTS idx_users_reset_password_token';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Index idx_users_reset_password_token not dropped (may not exist)';
  END;

  -- Drop columns if they exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'verification_token'
  ) THEN
    ALTER TABLE users DROP COLUMN verification_token;
    RAISE NOTICE 'Dropped users.verification_token';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'email_verification_token'
  ) THEN
    ALTER TABLE users DROP COLUMN email_verification_token;
    RAISE NOTICE 'Dropped users.email_verification_token';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'reset_token'
  ) THEN
    ALTER TABLE users DROP COLUMN reset_token;
    RAISE NOTICE 'Dropped users.reset_token';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'reset_password_token'
  ) THEN
    ALTER TABLE users DROP COLUMN reset_password_token;
    RAISE NOTICE 'Dropped users.reset_password_token';
  END IF;
END $$;

SELECT 'Legacy token columns and indexes dropped where present' AS status;
