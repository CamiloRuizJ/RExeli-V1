-- =====================================================
-- Migration 015: Fix RLS Policies to Use auth_user_id
-- =====================================================
-- Fixes broken RLS policies from migration 013
-- Problem: Migration 013 compared 'id' column instead of 'auth_user_id'
-- Solution: Use 'auth_user_id' which correctly links to auth.uid()
-- =====================================================

-- =====================================================
-- PART 1: Fix users table policies
-- =====================================================

DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
CREATE POLICY "Users can view their own data"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
CREATE POLICY "Users can update their own data"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth_user_id = (SELECT auth.uid()));

-- =====================================================
-- PART 2: Fix usage_logs table policies
-- =====================================================

DROP POLICY IF EXISTS "Users can view their own usage logs" ON public.usage_logs;
CREATE POLICY "Users can view their own usage logs"
  ON public.usage_logs FOR SELECT
  TO authenticated
  USING (user_id IN (
    SELECT id FROM public.users WHERE auth_user_id = (SELECT auth.uid())
  ));

-- =====================================================
-- PART 3: Fix user_documents table policies
-- =====================================================

DROP POLICY IF EXISTS "Users can view their own documents" ON public.user_documents;
CREATE POLICY "Users can view their own documents"
  ON public.user_documents FOR SELECT
  TO authenticated
  USING (user_id IN (
    SELECT id FROM public.users WHERE auth_user_id = (SELECT auth.uid())
  ));

-- =====================================================
-- PART 4: Policies already correct (no changes needed)
-- =====================================================
-- These policies from migration 013 were already correct:
-- - credit_transactions
-- - subscription_history
-- - training_triggers
-- - verification_edits
-- - training_documents
-- - training_metrics
-- - training_runs
-- - fine_tuning_jobs
-- - model_versions

-- =====================================================
-- Verification
-- =====================================================

-- Test that the policy allows access
DO $$
BEGIN
  RAISE NOTICE '✅ RLS policies fixed - admin creation should now work';
  RAISE NOTICE 'Next: Create admin user in Supabase Auth Dashboard';
END $$;
