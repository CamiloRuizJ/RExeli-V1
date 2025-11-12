-- =====================================================
-- Migration 001: Create Users Table
-- Description: Creates the base users table for authentication
-- This table is extended by migration 007 with credit and subscription fields
-- =====================================================

-- Create users table with core authentication fields
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user' NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- Add constraints (using DO block to handle IF NOT EXISTS for constraints)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_role'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT check_role CHECK (role IN ('user', 'admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_email_format'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT check_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policy for service role (allows API routes with service role key to manage users)
CREATE POLICY "Service role can insert users" ON users
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can select users" ON users
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can update users" ON users
  FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "Service role can delete users" ON users
  FOR DELETE
  TO service_role
  USING (true);

-- Create policies for authenticated users (when using auth.uid())
-- Note: These will be used if you implement Supabase Auth in the future
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own data" ON users
  FOR UPDATE
  USING (auth.uid() = id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE users IS 'Core users table for authentication and user management. Extended by migration 007 with credit and subscription fields.';
COMMENT ON COLUMN users.id IS 'Unique user identifier (UUID)';
COMMENT ON COLUMN users.email IS 'User email address (unique, used for login)';
COMMENT ON COLUMN users.password IS 'Bcrypt hashed password';
COMMENT ON COLUMN users.name IS 'User full name or display name';
COMMENT ON COLUMN users.role IS 'User role: user or admin';
COMMENT ON COLUMN users.is_active IS 'Whether the user account is active';
COMMENT ON COLUMN users.created_at IS 'Timestamp when user was created';
COMMENT ON COLUMN users.updated_at IS 'Timestamp when user was last updated';
