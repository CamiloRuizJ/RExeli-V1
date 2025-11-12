-- Migration: User Management and Credit System
-- Description: Adds credit tracking, subscription management, usage logs, and user documents
-- Credit Model: 1 credit = 1 page (not 1 document)

-- ============================================
-- 1. Extend users table with credit and subscription fields
-- ============================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS credits INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS subscription_type VARCHAR(50) DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS monthly_usage INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS lifetime_usage INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS billing_cycle_start DATE,
ADD COLUMN IF NOT EXISTS billing_cycle_end DATE,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add constraint for subscription types (using DO block to handle IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_subscription_type'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT check_subscription_type CHECK (
      subscription_type IN (
        'free',
        'entrepreneur_monthly',
        'professional_monthly',
        'business_monthly',
        'entrepreneur_annual',
        'professional_annual',
        'business_annual',
        'one_time'
      )
    );
  END IF;
END $$;

-- Add constraint for subscription status (using DO block to handle IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_subscription_status'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT check_subscription_status CHECK (
      subscription_status IN ('active', 'inactive', 'cancelled', 'expired')
    );
  END IF;
END $$;

-- Add index on credits for performance
CREATE INDEX IF NOT EXISTS idx_users_credits ON users(credits);
CREATE INDEX IF NOT EXISTS idx_users_subscription_type ON users(subscription_type);

-- NOTE: idx_users_is_active already created in migration 001, skip it

-- Create trigger to auto-update updated_at (skip if already exists from migration 001)
-- The trigger from migration 001 already handles this

-- ============================================
-- 2. Create usage_logs table
-- ============================================

CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type VARCHAR(100),
  file_name TEXT,
  file_path TEXT,
  page_count INT NOT NULL, -- Actual pages in document
  credits_used INT NOT NULL, -- Should equal page_count (1 credit = 1 page)
  processing_status VARCHAR(20) DEFAULT 'success',
  tokens_used INT,
  processing_time_ms INT,
  error_message TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add constraint to ensure credits_used matches page_count (using DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_credits_match_pages'
  ) THEN
    ALTER TABLE usage_logs ADD CONSTRAINT check_credits_match_pages CHECK (credits_used = page_count);
  END IF;
END $$;

-- Add constraint for processing status (using DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_processing_status'
  ) THEN
    ALTER TABLE usage_logs ADD CONSTRAINT check_processing_status CHECK (
      processing_status IN ('success', 'failed', 'pending')
    );
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_timestamp ON usage_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_usage_logs_status ON usage_logs(processing_status);

-- ============================================
-- 3. Create user_documents table
-- ============================================

CREATE TABLE IF NOT EXISTS user_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  document_type VARCHAR(100),
  extracted_data JSONB,
  page_count INT NOT NULL, -- Store page count for history
  credits_used INT NOT NULL, -- Should equal page_count
  processing_status VARCHAR(20) DEFAULT 'completed',
  download_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add constraint to ensure credits_used matches page_count (using DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_doc_credits_match_pages'
  ) THEN
    ALTER TABLE user_documents ADD CONSTRAINT check_doc_credits_match_pages CHECK (credits_used = page_count);
  END IF;
END $$;

-- Add constraint for processing status (using DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_doc_processing_status'
  ) THEN
    ALTER TABLE user_documents ADD CONSTRAINT check_doc_processing_status CHECK (
      processing_status IN ('completed', 'failed', 'processing')
    );
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_documents_user_id ON user_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_documents_created_at ON user_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_documents_doc_type ON user_documents(document_type);

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_user_documents_updated_at BEFORE UPDATE ON user_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. Create credit_transactions table
-- ============================================

CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INT NOT NULL, -- Can be positive (addition) or negative (deduction)
  transaction_type VARCHAR(50) NOT NULL,
  description TEXT,
  admin_id UUID REFERENCES users(id), -- If admin added credits
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add constraint for transaction types (using DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_transaction_type'
  ) THEN
    ALTER TABLE credit_transactions ADD CONSTRAINT check_transaction_type CHECK (
      transaction_type IN (
        'purchase',
        'deduction',
        'admin_add',
        'subscription_reset',
        'refund',
        'bonus',
        'initial_signup'
      )
    );
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_timestamp ON credit_transactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(transaction_type);

-- ============================================
-- 5. Create subscription_history table
-- ============================================

CREATE TABLE IF NOT EXISTS subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add constraint for plan types (using DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_history_plan_type'
  ) THEN
    ALTER TABLE subscription_history ADD CONSTRAINT check_history_plan_type CHECK (
      plan_type IN (
        'free',
        'entrepreneur_monthly',
        'professional_monthly',
        'business_monthly',
        'entrepreneur_annual',
        'professional_annual',
        'business_annual',
        'one_time'
      )
    );
  END IF;
END $$;

-- Add constraint for status (using DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_history_status'
  ) THEN
    ALTER TABLE subscription_history ADD CONSTRAINT check_history_status CHECK (
      status IN ('active', 'cancelled', 'expired', 'upgraded', 'downgraded')
    );
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subscription_history_user_id ON subscription_history(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_started_at ON subscription_history(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_history_status ON subscription_history(status);

-- ============================================
-- 6. Create views for easy querying
-- ============================================

-- View: User credit summary
CREATE OR REPLACE VIEW user_credit_summary AS
SELECT
  u.id,
  u.email,
  u.name,
  u.credits,
  u.subscription_type,
  u.subscription_status,
  u.monthly_usage,
  u.lifetime_usage,
  u.billing_cycle_start,
  u.billing_cycle_end,
  u.is_active,
  u.created_at,
  COALESCE(SUM(CASE WHEN ul.processing_status = 'success' THEN 1 ELSE 0 END), 0) as total_successful_documents,
  COALESCE(SUM(CASE WHEN ul.processing_status = 'failed' THEN 1 ELSE 0 END), 0) as total_failed_documents,
  COALESCE(AVG(ul.page_count), 0) as avg_pages_per_document
FROM users u
LEFT JOIN usage_logs ul ON u.id = ul.user_id
GROUP BY u.id, u.email, u.name, u.credits, u.subscription_type, u.subscription_status,
         u.monthly_usage, u.lifetime_usage, u.billing_cycle_start, u.billing_cycle_end,
         u.is_active, u.created_at;

-- View: Monthly usage summary
CREATE OR REPLACE VIEW monthly_usage_summary AS
SELECT
  user_id,
  DATE_TRUNC('month', timestamp) as month,
  COUNT(*) as documents_processed,
  SUM(page_count) as pages_processed,
  SUM(credits_used) as credits_consumed,
  AVG(page_count) as avg_pages_per_doc,
  COUNT(CASE WHEN processing_status = 'success' THEN 1 END) as successful_count,
  COUNT(CASE WHEN processing_status = 'failed' THEN 1 END) as failed_count
FROM usage_logs
GROUP BY user_id, DATE_TRUNC('month', timestamp);

-- View: Document type analytics
CREATE OR REPLACE VIEW document_type_analytics AS
SELECT
  user_id,
  document_type,
  COUNT(*) as document_count,
  SUM(page_count) as total_pages,
  AVG(page_count) as avg_pages,
  SUM(credits_used) as total_credits_used
FROM usage_logs
WHERE processing_status = 'success'
GROUP BY user_id, document_type;

-- ============================================
-- 7. Create functions for common operations
-- ============================================

-- Function: Get user credit balance
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
$$ LANGUAGE plpgsql;

-- Function: Deduct credits from user (with validation)
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
END;
$$ LANGUAGE plpgsql;

-- Function: Add credits to user
CREATE OR REPLACE FUNCTION add_user_credits(p_user_id UUID, p_amount INT, p_transaction_type VARCHAR, p_admin_id UUID DEFAULT NULL, p_description TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
  -- Add credits
  UPDATE users
  SET
    credits = credits + p_amount,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_user_id;

  -- Log the transaction
  INSERT INTO credit_transactions (user_id, amount, transaction_type, admin_id, description)
  VALUES (p_user_id, p_amount, p_transaction_type, p_admin_id, p_description);

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function: Reset monthly usage for users
CREATE OR REPLACE FUNCTION reset_monthly_usage()
RETURNS INT AS $$
DECLARE
  reset_count INT;
BEGIN
  -- Reset monthly_usage for users whose billing cycle has ended
  WITH updated AS (
    UPDATE users
    SET monthly_usage = 0
    WHERE billing_cycle_end <= CURRENT_DATE
      AND subscription_status = 'active'
      AND subscription_type != 'free'
    RETURNING id
  )
  SELECT COUNT(*) INTO reset_count FROM updated;

  RETURN reset_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. Insert initial data / update existing users
-- ============================================

-- Set default values for existing users
UPDATE users
SET
  credits = 0,
  subscription_type = 'free',
  subscription_status = 'inactive',
  monthly_usage = 0,
  lifetime_usage = 0,
  is_active = true,
  created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
  updated_at = CURRENT_TIMESTAMP
WHERE credits IS NULL;

-- ============================================
-- 9. Grant necessary permissions
-- ============================================

-- Grant permissions to authenticated users (read their own data)
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Policies for usage_logs
CREATE POLICY "Users can view their own usage logs" ON usage_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Policies for user_documents
CREATE POLICY "Users can view their own documents" ON user_documents
  FOR SELECT USING (auth.uid() = user_id);

-- Policies for credit_transactions
CREATE POLICY "Users can view their own transactions" ON credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- Migration complete
-- ============================================

-- Add comment
COMMENT ON TABLE usage_logs IS 'Tracks document processing usage with page-based credit system (1 credit = 1 page)';
COMMENT ON TABLE user_documents IS 'Stores user document history with page counts and extracted data';
COMMENT ON TABLE credit_transactions IS 'Logs all credit additions and deductions';
COMMENT ON TABLE subscription_history IS 'Tracks subscription plan changes over time';
