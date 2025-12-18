/**
 * Auth Helper Functions for Supabase Auth
 * Replaces NextAuth's auth() function with Supabase-based session management
 * Enriches session with custom user data from public.users table
 */

import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import type { User as SupabaseUser } from '@supabase/supabase-js'

/**
 * User session interface matching NextAuth structure for compatibility
 * This maintains the same session shape as before for easier migration
 */
export interface UserSession {
  user: {
    id: string // public.users.id (UUID)
    email: string
    name: string
    role: string
    credits: number
    subscriptionType: string
    subscriptionStatus: string
    emailVerified: boolean
    provider: string
  }
}

/**
 * User profile from public.users table
 */
export interface UserProfile {
  id: string
  auth_user_id: string
  email: string
  name: string
  role: string
  credits: number
  subscription_type: string
  subscription_status: string
  email_verified: boolean
  provider: string
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * Get current session with enriched user data
 * Use this to replace NextAuth's auth() in API routes and Server Components
 *
 * @returns UserSession with user data or null if not authenticated
 *
 * @example
 * const session = await getSession()
 * if (!session) {
 *   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 * }
 * const userId = session.user.id
 */
export async function getSession(): Promise<UserSession | null> {
  try {
    const supabase = await createClient()

    // Get the authenticated user from Supabase Auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return null
    }

    // Get user profile from public.users using the auth_user_id
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select(
        'id, name, role, credits, subscription_type, subscription_status, email_verified, provider, is_active'
      )
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .single()

    if (profileError || !profile) {
      console.error('Profile not found for auth user:', user.id, profileError)
      return null
    }

    // Update last sign in timestamp (async, don't await)
    updateLastSignIn(user.id).catch((err) =>
      console.error('Failed to update last sign in:', err)
    )

    // Return session in NextAuth-compatible format
    return {
      user: {
        id: profile.id, // Use public.users.id (UUID)
        email: user.email!,
        name: profile.name,
        role: profile.role,
        credits: profile.credits,
        subscriptionType: profile.subscription_type,
        subscriptionStatus: profile.subscription_status,
        emailVerified: profile.email_verified,
        provider: profile.provider,
      },
    }
  } catch (error) {
    console.error('Error getting session:', error)
    return null
  }
}

/**
 * Get user profile by public.users.id
 *
 * @param userId - The public.users.id (UUID)
 * @returns User profile or null
 */
export async function getUserById(userId: string): Promise<UserProfile | null> {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .eq('is_active', true)
      .single()

    if (error || !profile) {
      console.error('User not found:', userId, error)
      return null
    }

    return profile
  } catch (error) {
    console.error('Error getting user by ID:', error)
    return null
  }
}

/**
 * Get user profile by auth_user_id (Supabase Auth UUID)
 *
 * @param authUserId - The auth.users.id (UUID)
 * @returns User profile or null
 */
export async function getUserByAuthId(
  authUserId: string
): Promise<UserProfile | null> {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('auth_user_id', authUserId)
      .eq('is_active', true)
      .single()

    if (error || !profile) {
      console.error('User not found by auth ID:', authUserId, error)
      return null
    }

    return profile
  } catch (error) {
    console.error('Error getting user by auth ID:', error)
    return null
  }
}

/**
 * Check if current user is admin
 *
 * @returns true if user is admin, false otherwise
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const session = await getSession()
    return session?.user?.role === 'admin'
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}

/**
 * Require authentication - throws error if not authenticated
 * Use this in API routes that require authentication
 *
 * @returns UserSession
 * @throws Error if not authenticated
 *
 * @example
 * const session = await requireAuth()
 * const userId = session.user.id
 */
export async function requireAuth(): Promise<UserSession> {
  const session = await getSession()
  if (!session) {
    throw new Error('Authentication required')
  }
  return session
}

/**
 * Require admin role - throws error if not admin
 * Use this in API routes that require admin access
 *
 * @returns UserSession
 * @throws Error if not authenticated or not admin
 *
 * @example
 * const session = await requireAdmin()
 * // User is authenticated and is admin
 */
export async function requireAdmin(): Promise<UserSession> {
  const session = await requireAuth()
  if (session.user.role !== 'admin') {
    throw new Error('Admin access required')
  }
  return session
}

/**
 * Update last sign in timestamp for user
 * Called automatically by getSession()
 *
 * @param authUserId - The auth.users.id (UUID)
 */
async function updateLastSignIn(authUserId: string): Promise<void> {
  try {
    await supabaseAdmin
      .from('users')
      .update({
        last_sign_in_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('auth_user_id', authUserId)
  } catch (error) {
    console.error('Error updating last sign in:', error)
    // Don't throw - this is not critical
  }
}

/**
 * Sign out the current user
 * Use this in API routes or Server Actions to sign out
 *
 * @example
 * await signOut()
 */
export async function signOut(): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
  } catch (error) {
    console.error('Error signing out:', error)
    throw error
  }
}
