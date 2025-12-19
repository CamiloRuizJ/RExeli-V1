-- =====================================================
-- Migration 018: Diagnostic & Final Fix for Admin Creation
-- =====================================================
-- Add comprehensive error handling and check all constraints
-- =====================================================

-- First, let's verify admin exists and check its current state
DO $$
DECLARE
  admin_rec RECORD;
BEGIN
  SELECT * INTO admin_rec FROM public.users WHERE email = 'admin@rexeli.com';

  IF admin_rec IS NOT NULL THEN
    RAISE NOTICE 'Admin exists: ID=%, auth_user_id=%, role=%',
      admin_rec.id, admin_rec.auth_user_id, admin_rec.role;
  ELSE
    RAISE NOTICE 'Admin does NOT exist in public.users';
  END IF;
END $$;

-- Check if there's already an auth.users record for admin
DO $$
DECLARE
  auth_admin_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO auth_admin_count
  FROM auth.users
  WHERE email = 'admin@rexeli.com';

  IF auth_admin_count > 0 THEN
    RAISE WARNING 'Admin already exists in auth.users! Delete it first before recreating.';
    RAISE NOTICE 'Run: DELETE FROM auth.users WHERE email = ''admin@rexeli.com'';';
  ELSE
    RAISE NOTICE 'No admin in auth.users - ready to create';
  END IF;
END $$;

-- Update the trigger with even more verbose logging
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET row_security = off
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
  user_name TEXT;
  user_metadata JSONB;
  user_provider TEXT;
  existing_user_id UUID;
  update_count INTEGER;
BEGIN
  RAISE NOTICE '====== TRIGGER START ======';
  RAISE NOTICE 'NEW.id: %, NEW.email: %', NEW.id, NEW.email;

  -- Get email and metadata
  user_email := NEW.email;
  user_metadata := NEW.raw_user_meta_data;
  user_provider := COALESCE(NEW.app_metadata->>'provider', 'email');

  RAISE NOTICE 'user_email: %, user_provider: %', user_email, user_provider;

  -- Extract name
  user_name := COALESCE(
    user_metadata->>'name',
    user_metadata->>'full_name',
    user_metadata->>'display_name',
    split_part(user_email, '@', 1)
  );

  RAISE NOTICE 'user_name: %', user_name;

  -- Check if user exists
  SELECT id INTO existing_user_id
  FROM public.users
  WHERE email = user_email;

  RAISE NOTICE 'existing_user_id: %', existing_user_id;

  IF existing_user_id IS NOT NULL THEN
    RAISE NOTICE 'User EXISTS - updating auth_user_id';

    -- Update with verbose output
    UPDATE public.users
    SET
      auth_user_id = NEW.id,
      email_verified = NEW.email_confirmed_at IS NOT NULL,
      provider = user_provider,
      updated_at = NOW()
    WHERE id = existing_user_id;

    GET DIAGNOSTICS update_count = ROW_COUNT;
    RAISE NOTICE 'UPDATE affected % rows', update_count;

    IF update_count = 0 THEN
      RAISE EXCEPTION 'UPDATE failed - no rows affected!';
    END IF;

    RAISE NOTICE '✅ Successfully linked existing user % (ID: %) to auth.users (ID: %)',
      user_email, existing_user_id, NEW.id;
  ELSE
    RAISE NOTICE 'User DOES NOT exist - creating new user';

    -- Insert new user
    INSERT INTO public.users (
      auth_user_id,
      email,
      name,
      role,
      credits,
      subscription_type,
      subscription_status,
      email_verified,
      provider,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      user_email,
      user_name,
      'user',
      25,
      'free',
      'active',
      NEW.email_confirmed_at IS NOT NULL,
      user_provider,
      true,
      NOW(),
      NOW()
    );

    RAISE NOTICE '✅ Created new user %', user_email;

    -- Insert credit transaction
    INSERT INTO credit_transactions (
      user_id,
      amount,
      transaction_type,
      description
    ) VALUES (
      (SELECT id FROM public.users WHERE auth_user_id = NEW.id),
      25,
      'initial_signup',
      'Free trial credits on signup'
    );

    RAISE NOTICE '✅ Created credit transaction';
  END IF;

  RAISE NOTICE '====== TRIGGER END SUCCESS ======';
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '❌❌❌ ERROR in handle_new_user: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RAISE WARNING 'Error details: user_email=%, existing_user_id=%', user_email, existing_user_id;
    -- Re-raise to fail the auth user creation
    RAISE;
END;
$$;

-- Final check
SELECT '✅ Diagnostic migration complete' as status;
SELECT 'Check the notices above, then try creating admin user' as next_step;
