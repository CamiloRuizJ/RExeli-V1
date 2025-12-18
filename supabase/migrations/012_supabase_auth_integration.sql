-- =====================================================
-- Migration 012: Supabase Auth Integration
-- Description: Migrate from NextAuth to Supabase Auth
-- - Link public.users to auth.users
-- - Add email verification and provider tracking
-- - Create triggers for automatic profile creation
-- - Update RLS policies for Supabase Auth
-- =====================================================

-- =====================================================
-- PART 1: Extend public.users table
-- =====================================================

-- Add columns to link to Supabase Auth
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'email',
ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMP;

-- Create unique index on auth_user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);

-- Create index on provider
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider);

-- Add comment
COMMENT ON COLUMN users.auth_user_id IS 'Links to auth.users.id - user in Supabase Auth system';
COMMENT ON COLUMN users.email_verified IS 'Synced from auth.users.email_confirmed_at';
COMMENT ON COLUMN users.provider IS 'Authentication provider: email, google, azure';
COMMENT ON COLUMN users.last_sign_in_at IS 'Last successful sign in timestamp';

-- =====================================================
-- PART 2: Create trigger function for new user signup
-- =====================================================

-- Function to create user profile after auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
  user_name TEXT;
  user_metadata JSONB;
  user_provider TEXT;
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

  -- Insert into public.users
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
    25, -- Free trial credits (25 credits = ~5 documents @ 5 pages each)
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
    'Free trial credits on signup (25 credits for document processing)'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to run after user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- PART 3: Sync email verification status
-- =====================================================

-- Function to sync email verification status
CREATE OR REPLACE FUNCTION public.handle_email_verified()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When email gets verified in auth.users, sync to public.users
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    UPDATE public.users
    SET
      email_verified = true,
      updated_at = NOW()
    WHERE auth_user_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_verified ON auth.users;

-- Create trigger to sync email verification
CREATE TRIGGER on_auth_user_verified
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_email_verified();

-- =====================================================
-- PART 4: Update RLS policies to use auth.uid()
-- =====================================================

-- Update users table policies
DROP POLICY IF EXISTS "Users can view their own data" ON users;
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT
  USING (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "Users can update their own data" ON users;
CREATE POLICY "Users can update their own data" ON users
  FOR UPDATE
  USING (auth.uid() = auth_user_id);

-- Update usage_logs policies
DROP POLICY IF EXISTS "Users can view their own usage logs" ON usage_logs;
CREATE POLICY "Users can view their own usage logs" ON usage_logs
  FOR SELECT
  USING (
    auth.uid() = (SELECT auth_user_id FROM users WHERE id = user_id)
  );

-- Update user_documents policies
DROP POLICY IF EXISTS "Users can view their own documents" ON user_documents;
CREATE POLICY "Users can view their own documents" ON user_documents
  FOR SELECT
  USING (
    auth.uid() = (SELECT auth_user_id FROM users WHERE id = user_id)
  );

-- Update credit_transactions policies
DROP POLICY IF EXISTS "Users can view their own transactions" ON credit_transactions;
CREATE POLICY "Users can view their own transactions" ON credit_transactions
  FOR SELECT
  USING (
    auth.uid() = (SELECT auth_user_id FROM users WHERE id = user_id)
  );

-- Update subscription_history policies
DROP POLICY IF EXISTS "Users can view their own subscription history" ON subscription_history;
CREATE POLICY "Users can view their own subscription history" ON subscription_history
  FOR SELECT
  USING (
    auth.uid() = (SELECT auth_user_id FROM users WHERE id = user_id)
  );

-- =====================================================
-- PART 5: Helper functions for auth integration
-- =====================================================

-- Function to get user profile by auth_user_id
CREATE OR REPLACE FUNCTION public.get_user_profile(p_auth_user_id UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  name TEXT,
  role VARCHAR(20),
  credits INT,
  subscription_type VARCHAR(50),
  subscription_status VARCHAR(20),
  email_verified BOOLEAN,
  provider VARCHAR(50),
  is_active BOOLEAN
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.email,
    u.name,
    u.role,
    u.credits,
    u.subscription_type,
    u.subscription_status,
    u.email_verified,
    u.provider,
    u.is_active
  FROM public.users u
  WHERE u.auth_user_id = p_auth_user_id
    AND u.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Function to update last sign in timestamp
CREATE OR REPLACE FUNCTION public.update_last_sign_in(p_auth_user_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET
    last_sign_in_at = NOW(),
    updated_at = NOW()
  WHERE auth_user_id = p_auth_user_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON FUNCTION handle_new_user() IS
'Automatically creates user profile in public.users when new user signs up via Supabase Auth. Awards free trial credits.';

COMMENT ON FUNCTION handle_email_verified() IS
'Syncs email verification status from auth.users to public.users when user verifies their email.';

COMMENT ON FUNCTION get_user_profile(UUID) IS
'Retrieves user profile by auth_user_id for session enrichment. Used by API routes.';

COMMENT ON FUNCTION update_last_sign_in(UUID) IS
'Updates last sign in timestamp when user authenticates.';

COMMENT ON POLICY "Users can view their own data" ON users IS
'Users can view their own profile using auth.uid() from Supabase Auth session';

-- =====================================================
-- MIGRATION NOTES
-- =====================================================

-- NOTE: password column is kept temporarily for migration period
-- After all users have migrated to Supabase Auth (30 days), run:
-- ALTER TABLE users DROP COLUMN IF EXISTS password;

-- NOTE: For existing users to migrate:
-- 1. They will need to use "Forgot Password" to reset via Supabase Auth
-- 2. This links their auth_user_id when they sign in with new password
-- 3. OR: Create migration script to import users into auth.users

-- NOTE: Admin user setup:
-- 1. Manually create admin@rexeli.com in Supabase Dashboard
-- 2. Go to Authentication > Users > Add User
-- 3. Set email: admin@rexeli.com
-- 4. Set password (strong password)
-- 5. Confirm email: Yes
-- 6. Set user_metadata: {"name": "RExeli Administrator"}
-- 7. Set app_metadata: {"role": "admin", "provider": "email"}
-- 8. Get the user's UUID from auth.users
-- 9. Run: UPDATE users SET auth_user_id = '[uuid]', role = 'admin' WHERE email = 'admin@rexeli.com';

-- =====================================================
-- ROLLBACK SCRIPT (for reference)
-- =====================================================

-- To rollback this migration, run:
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- DROP TRIGGER IF EXISTS on_auth_user_verified ON auth.users;
-- DROP FUNCTION IF EXISTS public.handle_new_user();
-- DROP FUNCTION IF EXISTS public.handle_email_verified();
-- DROP FUNCTION IF EXISTS public.get_user_profile(UUID);
-- DROP FUNCTION IF EXISTS public.update_last_sign_in(UUID);
-- ALTER TABLE users DROP COLUMN IF EXISTS auth_user_id;
-- ALTER TABLE users DROP COLUMN IF EXISTS email_verified;
-- ALTER TABLE users DROP COLUMN IF EXISTS provider;
-- ALTER TABLE users DROP COLUMN IF EXISTS last_sign_in_at;
-- -- Restore original RLS policies (see migrations 008-010 for original policies)

-- =====================================================
-- Migration Complete
-- =====================================================
