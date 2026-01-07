-- Migration: User Groups System
-- Description: Adds user groups with shared credit pools for multi-user packages
-- Credit Model: Group members share credits from group pool

-- ============================================
-- 1. Create user_groups table
-- ============================================

CREATE TABLE IF NOT EXISTS user_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Group Information
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Owner Reference (must be a user in users table)
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Credit Pool (shared by all members)
  credits INT DEFAULT 0 NOT NULL,
  monthly_usage INT DEFAULT 0,
  lifetime_usage INT DEFAULT 0,

  -- Subscription (mirrors user subscription model)
  subscription_type VARCHAR(50) DEFAULT 'professional_monthly',
  subscription_status VARCHAR(20) DEFAULT 'active',
  billing_cycle_start DATE,
  billing_cycle_end DATE,

  -- Group Settings
  document_visibility VARCHAR(20) DEFAULT 'shared' NOT NULL,  -- 'shared' or 'private'
  max_members INT DEFAULT 3 NOT NULL,  -- Professional: 3, Business: 10

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id)  -- Admin who created the group
);

-- Add constraint for group subscription types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_group_subscription_type'
  ) THEN
    ALTER TABLE user_groups ADD CONSTRAINT check_group_subscription_type CHECK (
      subscription_type IN (
        'professional_monthly',
        'professional_annual',
        'business_monthly',
        'business_annual'
      )
    );
  END IF;
END $$;

-- Add constraint for group subscription status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_group_subscription_status'
  ) THEN
    ALTER TABLE user_groups ADD CONSTRAINT check_group_subscription_status CHECK (
      subscription_status IN ('active', 'inactive', 'cancelled', 'expired')
    );
  END IF;
END $$;

-- Add constraint for document visibility
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_group_document_visibility'
  ) THEN
    ALTER TABLE user_groups ADD CONSTRAINT check_group_document_visibility CHECK (
      document_visibility IN ('shared', 'private')
    );
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_groups_owner ON user_groups(owner_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_subscription_type ON user_groups(subscription_type);
CREATE INDEX IF NOT EXISTS idx_user_groups_is_active ON user_groups(is_active);
CREATE INDEX IF NOT EXISTS idx_user_groups_created_at ON user_groups(created_at DESC);

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_user_groups_updated_at BEFORE UPDATE ON user_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. Create group_members table
-- ============================================

CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  group_id UUID NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Member Role
  role VARCHAR(20) DEFAULT 'member' NOT NULL,  -- 'owner', 'member'

  -- Status
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  invited_by UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT true,

  -- Unique constraint: user can only be in one group
  UNIQUE(user_id)
);

-- Add constraint for member role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_group_member_role'
  ) THEN
    ALTER TABLE group_members ADD CONSTRAINT check_group_member_role CHECK (
      role IN ('owner', 'member')
    );
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_role ON group_members(role);
CREATE INDEX IF NOT EXISTS idx_group_members_is_active ON group_members(is_active);

-- ============================================
-- 3. Create group_credit_transactions table
-- ============================================

CREATE TABLE IF NOT EXISTS group_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  group_id UUID NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),  -- Who triggered the transaction (null for admin/system)

  amount INT NOT NULL,  -- Positive = add, Negative = deduct
  transaction_type VARCHAR(50) NOT NULL,
  description TEXT,

  admin_id UUID REFERENCES users(id),  -- If admin action

  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add constraint for transaction types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_group_transaction_type'
  ) THEN
    ALTER TABLE group_credit_transactions ADD CONSTRAINT check_group_transaction_type CHECK (
      transaction_type IN (
        'purchase',
        'deduction',
        'admin_add',
        'subscription_reset',
        'refund',
        'bonus',
        'initial_creation'
      )
    );
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_group_credit_transactions_group ON group_credit_transactions(group_id);
CREATE INDEX IF NOT EXISTS idx_group_credit_transactions_user ON group_credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_group_credit_transactions_timestamp ON group_credit_transactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_group_credit_transactions_type ON group_credit_transactions(transaction_type);

-- ============================================
-- 4. Modify existing tables to support groups
-- ============================================

-- Add group_id to users table (for quick lookup)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES user_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_group_id ON users(group_id);

COMMENT ON COLUMN users.group_id IS 'Reference to user group if user is part of a group. Credits deducted from group pool when set.';

-- Add group_id to user_documents table (for shared document visibility)
ALTER TABLE user_documents
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES user_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_documents_group_id ON user_documents(group_id);

COMMENT ON COLUMN user_documents.group_id IS 'Group ID for document visibility. Set when document created by group member.';

-- ============================================
-- 5. Create helper functions
-- ============================================

-- Function: Get effective credits for a user (individual or group)
CREATE OR REPLACE FUNCTION get_effective_credits(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_group_id UUID;
  effective_credits INT;
BEGIN
  -- Check if user is in a group
  SELECT group_id INTO user_group_id
  FROM users
  WHERE id = p_user_id AND is_active = true;

  IF user_group_id IS NOT NULL THEN
    -- Return group credits
    SELECT credits INTO effective_credits
    FROM user_groups
    WHERE id = user_group_id AND is_active = true;
  ELSE
    -- Return individual credits
    SELECT credits INTO effective_credits
    FROM users
    WHERE id = p_user_id AND is_active = true;
  END IF;

  RETURN COALESCE(effective_credits, 0);
END;
$$;

-- Function: Deduct credits (handles both individual and group)
CREATE OR REPLACE FUNCTION deduct_effective_credits(
  p_user_id UUID,
  p_page_count INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_group_id UUID;
  current_credits INT;
BEGIN
  -- Check if user is in a group
  SELECT group_id INTO user_group_id
  FROM users
  WHERE id = p_user_id AND is_active = true;

  IF user_group_id IS NOT NULL THEN
    -- Deduct from group
    SELECT credits INTO current_credits
    FROM user_groups
    WHERE id = user_group_id AND is_active = true
    FOR UPDATE;  -- Lock row for atomic operation

    IF current_credits >= p_page_count THEN
      UPDATE user_groups
      SET
        credits = credits - p_page_count,
        monthly_usage = monthly_usage + p_page_count,
        lifetime_usage = lifetime_usage + p_page_count,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = user_group_id;

      -- Log group transaction
      INSERT INTO group_credit_transactions
        (group_id, user_id, amount, transaction_type, description)
      VALUES
        (user_group_id, p_user_id, -p_page_count, 'deduction', 'Document processing');

      RETURN true;
    ELSE
      RETURN false;
    END IF;
  ELSE
    -- Use existing individual deduction logic
    SELECT credits INTO current_credits
    FROM users
    WHERE id = p_user_id AND is_active = true
    FOR UPDATE;

    IF current_credits >= p_page_count THEN
      UPDATE users
      SET
        credits = credits - p_page_count,
        monthly_usage = monthly_usage + p_page_count,
        lifetime_usage = lifetime_usage + p_page_count,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = p_user_id;

      -- Log individual transaction
      INSERT INTO credit_transactions
        (user_id, amount, transaction_type, description)
      VALUES
        (p_user_id, -p_page_count, 'deduction', 'Document processing');

      RETURN true;
    ELSE
      RETURN false;
    END IF;
  END IF;
END;
$$;

-- Function: Add credits to group
CREATE OR REPLACE FUNCTION add_group_credits(
  p_group_id UUID,
  p_amount INT,
  p_transaction_type VARCHAR,
  p_admin_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_groups
  SET
    credits = credits + p_amount,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_group_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO group_credit_transactions
    (group_id, amount, transaction_type, admin_id, description)
  VALUES
    (p_group_id, p_amount, p_transaction_type, p_admin_id, p_description);

  RETURN true;
END;
$$;

-- Function: Get user's group ID (if any)
CREATE OR REPLACE FUNCTION get_user_group_id(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_group_id UUID;
BEGIN
  SELECT group_id INTO user_group_id
  FROM users
  WHERE id = p_user_id AND is_active = true;

  RETURN user_group_id;
END;
$$;

-- ============================================
-- 6. Create views for groups
-- ============================================

-- View: Group summary with member count
CREATE OR REPLACE VIEW group_summary AS
SELECT
  g.id,
  g.name,
  g.description,
  g.owner_id,
  o.email as owner_email,
  o.name as owner_name,
  g.credits,
  g.monthly_usage,
  g.lifetime_usage,
  g.subscription_type,
  g.subscription_status,
  g.billing_cycle_start,
  g.billing_cycle_end,
  g.document_visibility,
  g.max_members,
  g.is_active,
  g.created_at,
  g.updated_at,
  COUNT(gm.id) as member_count
FROM user_groups g
LEFT JOIN users o ON g.owner_id = o.id
LEFT JOIN group_members gm ON g.id = gm.group_id AND gm.is_active = true
GROUP BY g.id, g.name, g.description, g.owner_id, o.email, o.name,
         g.credits, g.monthly_usage, g.lifetime_usage, g.subscription_type,
         g.subscription_status, g.billing_cycle_start, g.billing_cycle_end,
         g.document_visibility, g.max_members, g.is_active, g.created_at, g.updated_at;

-- ============================================
-- 7. Row Level Security Policies
-- ============================================

-- Enable RLS on new tables
ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_credit_transactions ENABLE ROW LEVEL SECURITY;

-- Service role policies (for admin/server operations)
CREATE POLICY "Service role full access on user_groups" ON user_groups
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on group_members" ON group_members
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on group_credit_transactions" ON group_credit_transactions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Users can view their own group
CREATE POLICY "Users can view their own group" ON user_groups
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT group_id FROM users
      WHERE auth_user_id = auth.uid()
    )
  );

-- Group members can view membership
CREATE POLICY "Users can view their group membership" ON group_members
  FOR SELECT TO authenticated
  USING (
    group_id IN (
      SELECT group_id FROM users
      WHERE auth_user_id = auth.uid()
    )
  );

-- Users can view their group's credit transactions
CREATE POLICY "Users can view their group credit transactions" ON group_credit_transactions
  FOR SELECT TO authenticated
  USING (
    group_id IN (
      SELECT group_id FROM users
      WHERE auth_user_id = auth.uid()
    )
  );

-- ============================================
-- 8. Update user_documents RLS for shared visibility
-- ============================================

-- Drop existing policy if it exists and recreate
DROP POLICY IF EXISTS "Users can view their own documents" ON user_documents;
DROP POLICY IF EXISTS "Users can view accessible documents" ON user_documents;

-- Create new policy that handles both individual and group shared documents
CREATE POLICY "Users can view accessible documents" ON user_documents
  FOR SELECT TO authenticated
  USING (
    -- Own documents (always visible)
    user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR
    -- Group shared documents (when group has shared visibility)
    (
      group_id IS NOT NULL
      AND group_id IN (
        SELECT g.id
        FROM user_groups g
        JOIN users u ON u.group_id = g.id
        WHERE u.auth_user_id = auth.uid()
        AND g.document_visibility = 'shared'
        AND g.is_active = true
      )
    )
  );

-- Policy for inserting documents
DROP POLICY IF EXISTS "Users can insert their own documents" ON user_documents;
CREATE POLICY "Users can insert their own documents" ON user_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- Policy for updating documents
DROP POLICY IF EXISTS "Users can update their own documents" ON user_documents;
CREATE POLICY "Users can update their own documents" ON user_documents
  FOR UPDATE TO authenticated
  USING (
    user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- ============================================
-- 9. Grant permissions
-- ============================================

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_effective_credits(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_effective_credits(UUID) TO service_role;

GRANT EXECUTE ON FUNCTION deduct_effective_credits(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_effective_credits(UUID, INT) TO service_role;

GRANT EXECUTE ON FUNCTION add_group_credits(UUID, INT, VARCHAR, UUID, TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION get_user_group_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_group_id(UUID) TO service_role;

-- Grant access to view
GRANT SELECT ON group_summary TO service_role;
