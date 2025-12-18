/**
 * Browser-side Supabase Client for Authentication
 * Uses public anon key for client-side auth operations
 * Separate from storage client to keep concerns separated
 */

import { createBrowserClient } from '@supabase/ssr'

/**
 * Creates a Supabase client for browser-side authentication
 * This client is used for:
 * - Sign in/sign up operations
 * - OAuth flows
 * - Password reset
 * - Email verification
 * - Session management
 *
 * @returns Supabase client configured for browser auth
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
