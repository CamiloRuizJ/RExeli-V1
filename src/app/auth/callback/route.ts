/**
 * OAuth Callback Route
 * Handles the callback from OAuth providers (Google, Azure)
 * Exchanges the auth code for a session
 */

import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/tool'
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error, errorDescription)
    return NextResponse.redirect(
      new URL(
        `/auth/error?error=${encodeURIComponent(errorDescription || error)}`,
        request.url
      )
    )
  }

  // Exchange code for session
  if (code) {
    const supabase = await createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
      code
    )

    if (exchangeError) {
      console.error('Error exchanging code for session:', exchangeError)
      return NextResponse.redirect(
        new URL(
          `/auth/error?error=${encodeURIComponent(exchangeError.message)}`,
          request.url
        )
      )
    }
  }

  // Redirect to the specified next URL or default to /tool
  return NextResponse.redirect(new URL(next, request.url))
}
