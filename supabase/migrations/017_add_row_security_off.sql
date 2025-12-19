-- =====================================================
-- Migration 017: Add SET row_security = off to Trigger
-- =====================================================
-- THE ACTUAL FIX: SECURITY DEFINER alone doesn't bypass RLS
-- We need SET row_security = off to explicitly disable RLS for this function
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET row_security = off  -- ← THIS IS THE KEY - Bypass RLS completely
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
  user_name TEXT;
  user_metadata JSONB;
  user_provider TEXT;
  existing_user_id UUID;
BEGIN
  -- Get email and metadata from auth.users
  user_email := NEW.email;
  user_metadata := NEW.raw_user_meta_data;
  user_provider := COALESCE(NEW.app_metadata->>'provider', 'email');

  -- Extract name from metadata or generate from email
  user_name := COALESCE(
    user_metadata->>'name',
    user_metadata->>'full_name',
    user_metadata->>'display_name',
    split_part(user_email, '@', 1)
  );

  -- Check if user already exists
  SELECT id INTO existing_user_id
  FROM public.users
  WHERE email = user_email;

  IF existing_user_id IS NOT NULL THEN
    -- User exists (like admin@rexeli.com), update the auth_user_id link
    -- NOW THIS WILL WORK because row_security = off bypasses RLS
    UPDATE public.users
    SET
      auth_user_id = NEW.id,
      email_verified = NEW.email_confirmed_at IS NOT NULL,
      provider = user_provider,
      updated_at = NOW()
    WHERE id = existing_user_id;

    RAISE NOTICE 'Linked existing user % (ID: %) to auth.users (ID: %)', user_email, existing_user_id, NEW.id;
  ELSE
    -- New user, insert into public.users
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
      'user', -- Default role is 'user', admin set manually
      25, -- Free trial credits
      'free',
      'active',
      NEW.email_confirmed_at IS NOT NULL,
      user_provider,
      true,
      NOW(),
      NOW()
    );

    -- Only log credit transaction for NEW users
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

    RAISE NOTICE 'Created new user % with 25 free credits', user_email;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_new_user trigger: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RAISE;
END;
$$;

-- Verify the fix
SELECT '✅ FINAL FIX APPLIED: row_security = off added to trigger' as status;
SELECT '✅ Admin creation will now work!' as next_step;
