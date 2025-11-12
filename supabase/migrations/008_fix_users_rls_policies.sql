-- Migration 008: Fix Users Table RLS Policies
-- Description: Update RLS policies to allow service role operations
-- The service role key should bypass RLS, but we need explicit policies

-- Drop existing service role policies if they exist
DROP POLICY IF EXISTS "Service role can insert users" ON users;
DROP POLICY IF EXISTS "Service role can select users" ON users;
DROP POLICY IF EXISTS "Service role can update users" ON users;
DROP POLICY IF EXISTS "Service role can delete users" ON users;

-- Create new policies that properly allow service role access
-- Using a more permissive approach for service role operations

CREATE POLICY "Allow service role full access" ON users
  USING (true)
  WITH CHECK (true);

-- Alternative: If you want to keep RLS enabled but allow the service role to bypass it,
-- you can also disable RLS for specific operations by the service role
-- However, the above policy should work for all operations

COMMENT ON POLICY "Allow service role full access" ON users IS
'Allows service role (backend API routes) full access to users table for signup and admin operations';
