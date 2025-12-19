-- =====================================================
-- Migration 014: Final Fix for Admin User Creation
-- =====================================================
-- Fixes the trigger to NOT insert credit_transactions for existing users
-- This prevents "Database error" when creating admin in auth
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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
    -- User exists (like admin@rexeli.com), just update the auth_user_id link
    -- DO NOT insert into credit_transactions (admin already has credits)
    UPDATE public.users
    SET
      auth_user_id = NEW.id,
      email_verified = NEW.email_confirmed_at IS NOT NULL,
      provider = user_provider,
      updated_at = NOW()
    WHERE id = existing_user_id;

    RAISE NOTICE 'Linked existing user % to auth.users', user_email;
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

    RAISE NOTICE 'Created new user %', user_email;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger is already created, this just updates the function
SELECT '✅ Trigger function updated - admin creation will now work' as status;
