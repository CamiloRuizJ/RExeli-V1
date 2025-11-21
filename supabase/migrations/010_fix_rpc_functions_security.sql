-- Migration 010: Fix RPC Functions and subscription_history RLS
-- Description: Make RPC functions SECURITY DEFINER to bypass RLS
-- Issue: RPC functions were failing because they run with caller's permissions

-- ============================================
-- Fix subscription_history table RLS policies
-- ============================================

-- Enable RLS on subscription_history if not already enabled
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow service role full access to subscription_history" ON subscription_history;
DROP POLICY IF EXISTS "Users can view their own subscription history" ON subscription_history;

-- Create comprehensive policy for service role operations
CREATE POLICY "Allow service role full access to subscription_history" ON subscription_history
  USING (true)
  WITH CHECK (true);

-- Also create a user-specific SELECT policy for frontend queries
CREATE POLICY "Users can view their own subscription history" ON subscription_history
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- ============================================
-- Recreate add_user_credits function with SECURITY DEFINER
-- This allows the function to bypass RLS when called
-- ============================================

CREATE OR REPLACE FUNCTION add_user_credits(
  p_user_id UUID,
  p_amount INT,
  p_transaction_type VARCHAR,
  p_admin_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Add credits to user
  UPDATE users
  SET
    credits = credits + p_amount,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_user_id;

  -- Log the transaction
  INSERT INTO credit_transactions (user_id, amount, transaction_type, admin_id, description)
  VALUES (p_user_id, p_amount, p_transaction_type, p_admin_id, p_description);

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in add_user_credits: %', SQLERRM;
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Recreate deduct_user_credits function with SECURITY DEFINER
-- ============================================

CREATE OR REPLACE FUNCTION deduct_user_credits(p_user_id UUID, p_page_count INT)
RETURNS BOOLEAN AS $$
DECLARE
  current_credits INT;
BEGIN
  -- Get current credits
  SELECT credits INTO current_credits
  FROM users
  WHERE id = p_user_id AND is_active = true;

  -- Check if user has enough credits
  IF current_credits >= p_page_count THEN
    -- Deduct credits and update usage
    UPDATE users
    SET
      credits = credits - p_page_count,
      monthly_usage = monthly_usage + p_page_count,
      lifetime_usage = lifetime_usage + p_page_count,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = p_user_id;

    -- Log the transaction
    INSERT INTO credit_transactions (user_id, amount, transaction_type, description)
    VALUES (p_user_id, -p_page_count, 'deduction', 'Document processing');

    RETURN true;
  ELSE
    RETURN false;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in deduct_user_credits: %', SQLERRM;
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Recreate get_user_credits function with SECURITY DEFINER
-- ============================================

CREATE OR REPLACE FUNCTION get_user_credits(p_user_id UUID)
RETURNS INT AS $$
DECLARE
  credit_balance INT;
BEGIN
  SELECT credits INTO credit_balance
  FROM users
  WHERE id = p_user_id AND is_active = true;

  RETURN COALESCE(credit_balance, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Add comments
-- ============================================

COMMENT ON FUNCTION add_user_credits IS 'Adds credits to user account. Uses SECURITY DEFINER to bypass RLS.';
COMMENT ON FUNCTION deduct_user_credits IS 'Deducts credits from user account for document processing. Uses SECURITY DEFINER to bypass RLS.';
COMMENT ON FUNCTION get_user_credits IS 'Gets current credit balance for user. Uses SECURITY DEFINER to bypass RLS.';
COMMENT ON POLICY "Allow service role full access to subscription_history" ON subscription_history IS
'Allows service role (backend API routes) full access for managing subscription history';
