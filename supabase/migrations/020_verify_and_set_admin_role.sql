-- =====================================================
-- Migration 020: Verify and Set Admin Role
-- =====================================================
-- Check if admin@rexeli.com is properly linked and has admin role
-- =====================================================

-- Check current state of admin user
DO $$
DECLARE
  admin_rec RECORD;
  auth_rec RECORD;
BEGIN
  -- Check public.users
  SELECT * INTO admin_rec
  FROM public.users
  WHERE email = 'admin@rexeli.com';

  IF admin_rec IS NULL THEN
    RAISE EXCEPTION 'Admin user does not exist in public.users!';
  END IF;

  RAISE NOTICE 'Admin in public.users: ID=%, auth_user_id=%, role=%',
    admin_rec.id, admin_rec.auth_user_id, admin_rec.role;

  -- Check auth.users
  SELECT * INTO auth_rec
  FROM auth.users
  WHERE email = 'admin@rexeli.com';

  IF auth_rec IS NULL THEN
    RAISE EXCEPTION 'Admin user does not exist in auth.users!';
  END IF;

  RAISE NOTICE 'Admin in auth.users: ID=%', auth_rec.id;

  -- Check if they're linked
  IF admin_rec.auth_user_id = auth_rec.id THEN
    RAISE NOTICE '✅ Admin is properly linked';
  ELSE
    RAISE WARNING '❌ Admin is NOT linked! Fixing now...';
  END IF;
END $$;

-- Update admin user to ensure proper role and linking
UPDATE public.users
SET
  role = 'admin',
  credits = GREATEST(credits, 10000),
  subscription_type = 'business_annual',
  subscription_status = 'active',
  is_active = true,
  email_verified = true,
  auth_user_id = (SELECT id FROM auth.users WHERE email = 'admin@rexeli.com'),
  updated_at = NOW()
WHERE email = 'admin@rexeli.com';

-- Verify the update
DO $$
DECLARE
  admin_rec RECORD;
BEGIN
  SELECT * INTO admin_rec
  FROM public.users
  WHERE email = 'admin@rexeli.com';

  RAISE NOTICE '====== FINAL STATE ======';
  RAISE NOTICE 'Email: %', admin_rec.email;
  RAISE NOTICE 'Name: %', admin_rec.name;
  RAISE NOTICE 'Role: %', admin_rec.role;
  RAISE NOTICE 'Credits: %', admin_rec.credits;
  RAISE NOTICE 'Subscription: %', admin_rec.subscription_type;
  RAISE NOTICE 'Auth User ID: %', admin_rec.auth_user_id;
  RAISE NOTICE 'Email Verified: %', admin_rec.email_verified;
  RAISE NOTICE 'Is Active: %', admin_rec.is_active;

  IF admin_rec.role = 'admin' AND admin_rec.auth_user_id IS NOT NULL THEN
    RAISE NOTICE '✅✅✅ Admin user is ready!';
  ELSE
    RAISE EXCEPTION 'Admin user setup incomplete!';
  END IF;
END $$;

SELECT '✅ Admin role verified and set' as status;
