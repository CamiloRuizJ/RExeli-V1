-- =====================================================
-- Migration 013: Fix Security Warnings & Enable Admin Creation
-- =====================================================
-- This migration fixes:
-- 1. RLS performance issues (auth functions need SELECT wrapper)
-- 2. Multiple permissive policies (consolidate duplicate policies)
-- 3. Admin user creation trigger issue
-- =====================================================

-- =====================================================
-- PART 1: Fix RLS Performance - Wrap auth functions in SELECT
-- =====================================================

-- Fix: users table
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
CREATE POLICY "Users can view their own data"
  ON public.users FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
CREATE POLICY "Users can update their own data"
  ON public.users FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()));

-- Fix: usage_logs table
DROP POLICY IF EXISTS "Users can view their own usage logs" ON public.usage_logs;
CREATE POLICY "Users can view their own usage logs"
  ON public.usage_logs FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Fix: user_documents table
DROP POLICY IF EXISTS "Users can view their own documents" ON public.user_documents;
CREATE POLICY "Users can view their own documents"
  ON public.user_documents FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Fix: credit_transactions table
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.credit_transactions;
CREATE POLICY "Users can view their own transactions"
  ON public.credit_transactions FOR SELECT
  TO authenticated
  USING (user_id IN (
    SELECT id FROM public.users WHERE auth_user_id = (SELECT auth.uid())
  ));

-- Fix: subscription_history table
DROP POLICY IF EXISTS "Users can view their own subscription history" ON public.subscription_history;
CREATE POLICY "Users can view their own subscription history"
  ON public.subscription_history FOR SELECT
  TO authenticated
  USING (user_id IN (
    SELECT id FROM public.users WHERE auth_user_id = (SELECT auth.uid())
  ));

-- Fix: training_triggers table
DROP POLICY IF EXISTS "Authenticated users can view training_triggers" ON public.training_triggers;
CREATE POLICY "Authenticated users can view training_triggers"
  ON public.training_triggers FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- Fix: verification_edits table
DROP POLICY IF EXISTS "Authenticated users can view verification_edits" ON public.verification_edits;
CREATE POLICY "Authenticated users can view verification_edits"
  ON public.verification_edits FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- Fix: training_documents table
DROP POLICY IF EXISTS "Authenticated users can view training_documents" ON public.training_documents;
CREATE POLICY "Authenticated users can view training_documents"
  ON public.training_documents FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- Fix: training_metrics table
DROP POLICY IF EXISTS "Authenticated users can view training_metrics" ON public.training_metrics;
CREATE POLICY "Authenticated users can view training_metrics"
  ON public.training_metrics FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- Fix: training_runs table
DROP POLICY IF EXISTS "Authenticated users can view training_runs" ON public.training_runs;
CREATE POLICY "Authenticated users can view training_runs"
  ON public.training_runs FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- Fix: fine_tuning_jobs table
DROP POLICY IF EXISTS "Authenticated users can view fine_tuning_jobs" ON public.fine_tuning_jobs;
CREATE POLICY "Authenticated users can view fine_tuning_jobs"
  ON public.fine_tuning_jobs FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- Fix: model_versions table
DROP POLICY IF EXISTS "Authenticated users can view model_versions" ON public.model_versions;
CREATE POLICY "Authenticated users can view model_versions"
  ON public.model_versions FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================
-- PART 2: Fix Multiple Permissive Policies
-- =====================================================

-- Remove duplicate service_role policies (service_role bypasses RLS anyway)
DROP POLICY IF EXISTS "Allow service role full access to credit_transactions" ON public.credit_transactions;
DROP POLICY IF EXISTS "Allow service role full access to fine_tuning_jobs" ON public.fine_tuning_jobs;
DROP POLICY IF EXISTS "Allow service role full access to model_versions" ON public.model_versions;
DROP POLICY IF EXISTS "Allow service role full access to subscription_history" ON public.subscription_history;
DROP POLICY IF EXISTS "Allow service role full access to training_documents" ON public.training_documents;
DROP POLICY IF EXISTS "Allow service role full access to training_metrics" ON public.training_metrics;
DROP POLICY IF EXISTS "Allow service role full access to training_runs" ON public.training_runs;
DROP POLICY IF EXISTS "Allow service role full access to training_triggers" ON public.training_triggers;

-- =====================================================
-- PART 3: Fix Admin User Creation Trigger
-- =====================================================

-- Update trigger to handle existing users (use UPSERT instead of INSERT)
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
    -- User exists, just update the auth_user_id link
    UPDATE public.users
    SET
      auth_user_id = NEW.id,
      email_verified = NEW.email_confirmed_at IS NOT NULL,
      provider = user_provider,
      updated_at = NOW()
    WHERE id = existing_user_id;
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

    -- Log free trial credits transaction
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
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- PART 4: Make password column nullable & Create Admin User
-- =====================================================

-- Make password column nullable (using Supabase Auth now, not local passwords)
ALTER TABLE public.users ALTER COLUMN password DROP NOT NULL;

-- Ensure admin@rexeli.com exists in public.users
-- This allows the trigger to link it when you create in auth
INSERT INTO public.users (
  email,
  name,
  role,
  credits,
  subscription_type,
  subscription_status,
  email_verified,
  provider,
  is_active,
  password,
  created_at,
  updated_at
) VALUES (
  'admin@rexeli.com',
  'RExeli Administrator',
  'admin',
  10000, -- Admin gets 10,000 credits
  'business_annual', -- Admin gets highest tier subscription
  'active',
  true,
  'email',
  true,
  NULL, -- Password handled by Supabase Auth
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  role = 'admin',
  credits = GREATEST(public.users.credits, 10000),
  subscription_type = 'business_annual',
  password = NULL, -- Clear old password hash
  updated_at = NOW();

-- =====================================================
-- Verification
-- =====================================================

-- Check admin user exists
DO $$
DECLARE
  admin_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO admin_count
  FROM public.users
  WHERE email = 'admin@rexeli.com' AND role = 'admin';

  IF admin_count = 0 THEN
    RAISE EXCEPTION 'Admin user not created successfully';
  END IF;

  RAISE NOTICE '✅ Admin user exists in public.users';
END $$;
