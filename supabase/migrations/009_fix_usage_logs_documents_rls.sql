-- Migration 009: Fix RLS Policies for usage_logs and user_documents
-- Description: Add INSERT policies to allow service role to write to these tables
-- Issue: Only SELECT policies existed, causing silent write failures

-- ============================================
-- Fix usage_logs table RLS policies
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own usage logs" ON usage_logs;
DROP POLICY IF EXISTS "Allow service role full access to usage_logs" ON usage_logs;
DROP POLICY IF EXISTS "Service role can insert usage logs" ON usage_logs;

-- Create comprehensive policy for service role operations
-- This allows the backend API (using service role key) to insert records
CREATE POLICY "Allow service role full access to usage_logs" ON usage_logs
  USING (true)
  WITH CHECK (true);

-- Also create a user-specific SELECT policy for frontend queries if needed
CREATE POLICY "Users can view their own usage logs" ON usage_logs
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- ============================================
-- Fix user_documents table RLS policies
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own documents" ON user_documents;
DROP POLICY IF EXISTS "Allow service role full access to user_documents" ON user_documents;
DROP POLICY IF EXISTS "Service role can insert user documents" ON user_documents;

-- Create comprehensive policy for service role operations
CREATE POLICY "Allow service role full access to user_documents" ON user_documents
  USING (true)
  WITH CHECK (true);

-- Also create a user-specific SELECT policy for frontend queries if needed
CREATE POLICY "Users can view their own documents" ON user_documents
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- ============================================
-- Fix credit_transactions table RLS policies
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own transactions" ON credit_transactions;
DROP POLICY IF EXISTS "Allow service role full access to credit_transactions" ON credit_transactions;

-- Create comprehensive policy for service role operations
CREATE POLICY "Allow service role full access to credit_transactions" ON credit_transactions
  USING (true)
  WITH CHECK (true);

-- Also create a user-specific SELECT policy for frontend queries
CREATE POLICY "Users can view their own transactions" ON credit_transactions
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- ============================================
-- Enable REPLICA IDENTITY FULL for real-time subscriptions (optional)
-- This allows real-time listeners to receive full row data on updates/deletes
-- ============================================

-- Uncomment if you want real-time updates to work properly
-- ALTER TABLE usage_logs REPLICA IDENTITY FULL;
-- ALTER TABLE user_documents REPLICA IDENTITY FULL;
-- ALTER TABLE credit_transactions REPLICA IDENTITY FULL;
-- ALTER TABLE users REPLICA IDENTITY FULL;

-- ============================================
-- Add comments
-- ============================================

COMMENT ON POLICY "Allow service role full access to usage_logs" ON usage_logs IS
'Allows service role (backend API routes) full access for inserting usage logs during document processing';

COMMENT ON POLICY "Allow service role full access to user_documents" ON user_documents IS
'Allows service role (backend API routes) full access for saving processed documents';

COMMENT ON POLICY "Allow service role full access to credit_transactions" ON credit_transactions IS
'Allows service role (backend API routes) full access for logging credit transactions';
