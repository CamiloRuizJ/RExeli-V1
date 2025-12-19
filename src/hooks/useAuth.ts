/**
 * Client-side Auth Hook for Supabase Auth
 * Replaces NextAuth's useSession() hook
 * Provides real-time auth state management
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase-auth-client'
import type { Session, User } from '@supabase/supabase-js'

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
  is_active: boolean
}

/**
 * Auth state hook - replaces useSession() from next-auth/react
 *
 * @returns Auth state with user, session, userProfile, and loading status
 *
 * @example
 * const { user, session, userProfile, loading } = useAuth()
 *
 * if (loading) return <div>Loading...</div>
 * if (!user) router.push('/auth/signin')
 * if (userProfile?.role === 'admin') // show admin content
 * return <div>Welcome, {user.email}</div>
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  // Fetch user profile from public.users table
  const fetchUserProfile = useCallback(async (authUserId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, auth_user_id, email, name, role, credits, subscription_type, subscription_status, is_active')
        .eq('auth_user_id', authUserId)
        .eq('is_active', true)
        .single()

      if (!error && data) {
        setUserProfile(data)
      } else if (error) {
        console.error('Error fetching user profile:', error)
        setUserProfile(null)
      }
    } catch (err) {
      console.error('Error in fetchUserProfile:', err)
      setUserProfile(null)
    }
  }, [supabase])

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUserProfile(session.user.id)
      }
      setLoading(false)
    })

    // Listen for auth changes (sign in, sign out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUserProfile(session.user.id)
      } else {
        setUserProfile(null)
      }
      setLoading(false)
    })

    // Cleanup subscription on unmount
    return () => subscription.unsubscribe()
  }, [fetchUserProfile, supabase.auth])

  return { session, user, userProfile, loading }
}

/**
 * Sign in with email and password
 *
 * @param email - User email
 * @param password - User password
 * @returns { data, error } from Supabase
 *
 * @example
 * const { data, error } = await signInWithPassword('user@example.com', 'password123')
 * if (error) {
 *   toast.error(error.message)
 * } else {
 *   router.push('/dashboard')
 * }
 */
export async function signInWithPassword(email: string, password: string) {
  const supabase = createClient()
  return await supabase.auth.signInWithPassword({ email, password })
}

/**
 * Sign up with email and password
 *
 * @param email - User email
 * @param password - User password
 * @param metadata - Additional user metadata (name, etc.)
 * @returns { data, error } from Supabase
 *
 * @example
 * const { data, error } = await signUpWithPassword(
 *   'user@example.com',
 *   'password123',
 *   { name: 'John Doe' }
 * )
 */
export async function signUpWithPassword(
  email: string,
  password: string,
  metadata?: { name?: string; [key: string]: any }
) {
  const supabase = createClient()
  return await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
      emailRedirectTo: `${window.location.origin}/auth/callback?next=/tool`,
    },
  })
}

/**
 * Sign in with OAuth provider (Google, Azure)
 *
 * @param provider - OAuth provider ('google' | 'azure')
 * @returns { data, error } from Supabase
 *
 * @example
 * await signInWithOAuth('google')
 */
export async function signInWithOAuth(provider: 'google' | 'azure') {
  const supabase = createClient()
  return await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback?next=/tool`,
    },
  })
}

/**
 * Sign out the current user
 *
 * @example
 * await signOut()
 * router.push('/')
 */
export async function signOut() {
  const supabase = createClient()
  return await supabase.auth.signOut()
}

/**
 * Request password reset email
 *
 * @param email - User email
 * @returns { data, error } from Supabase
 *
 * @example
 * const { error } = await resetPassword('user@example.com')
 * if (!error) {
 *   toast.success('Password reset email sent')
 * }
 */
export async function resetPassword(email: string) {
  const supabase = createClient()
  return await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  })
}

/**
 * Update user password (after reset)
 *
 * @param newPassword - New password
 * @returns { data, error } from Supabase
 *
 * @example
 * const { error } = await updatePassword('newPassword123')
 * if (!error) {
 *   toast.success('Password updated successfully')
 *   router.push('/auth/signin')
 * }
 */
export async function updatePassword(newPassword: string) {
  const supabase = createClient()
  return await supabase.auth.updateUser({
    password: newPassword,
  })
}

/**
 * Resend email verification
 *
 * @param email - User email
 * @returns { data, error } from Supabase
 *
 * @example
 * const { error } = await resendVerificationEmail('user@example.com')
 */
export async function resendVerificationEmail(email: string) {
  const supabase = createClient()
  return await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback?next=/tool`,
    },
  })
}
