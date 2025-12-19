/**
 * Middleware for Supabase Auth
 * Protects routes and handles authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

// Define which routes require authentication
const protectedRoutes = [
  '/api/upload',
  '/api/classify',
  '/api/extract',
  '/api/export',
  '/api/user',
  '/api/admin',
  '/tool',
  '/dashboard',
  '/admin'
]

// Define public routes that don't require authentication
const publicRoutes = [
  '/',
  '/auth/signin',
  '/auth/signup',
  '/auth/callback',
  '/auth/verify-email',
  '/auth/reset-password',
  '/auth/error',
  '/api/auth',
  '/api/config/supabase' // Needed for client-side Supabase config
]

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Create response early to set cookies
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Validate Supabase environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('[Middleware] Missing Supabase environment variables')
    console.error('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING')
    console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'MISSING')

    // For protected routes, return error
    if (protectedRoutes.some(route => pathname.startsWith(route))) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, error: 'Authentication service unavailable' },
          { status: 503 }
        )
      }
      return NextResponse.redirect(new URL('/auth/error?error=Configuration', request.url))
    }

    // For public routes, allow through
    return response
  }

  // Create Supabase client with cookie handling
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Allow public routes without any processing
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return response
  }

  // Check authentication for protected routes
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    try {
      // Get the authenticated user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        // For API routes, return unauthorized
        if (pathname.startsWith('/api/')) {
          return NextResponse.json(
            { success: false, error: 'Authentication required' },
            { status: 401 }
          )
        }

        // For pages, redirect to signin
        const signInUrl = new URL('/auth/signin', request.url)
        signInUrl.searchParams.set('callbackUrl', pathname)
        return NextResponse.redirect(signInUrl)
      }

      // Check admin routes
      if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
        // Get user role from app_metadata or database
        const role = user.app_metadata?.role || user.user_metadata?.role || 'user'

        if (role !== 'admin') {
          // Not an admin - redirect or return 403
          if (pathname.startsWith('/api/')) {
            return NextResponse.json(
              { success: false, error: 'Admin access required' },
              { status: 403 }
            )
          }
          // Redirect to dashboard for non-admins trying to access admin pages
          return NextResponse.redirect(new URL('/dashboard', request.url))
        }
      }

      // For authenticated API routes, add user info to headers
      if (pathname.startsWith('/api/')) {
        response.headers.set('x-user-auth-id', user.id) // auth.users.id
        response.headers.set('x-user-email', user.email || '')

        // Note: We don't set x-user-id here because we need to look up public.users.id
        // API routes will use getSession() to get the full profile with public.users.id

        console.log('[Middleware] Forwarding authenticated API request:', {
          path: pathname,
          method: request.method,
          authUserId: user.id,
          userEmail: user.email,
        })

        return response
      }

      // For authenticated page routes, continue
      return response
    } catch (error) {
      console.error('Middleware error:', error)
      // On error, allow the request to proceed to avoid blocking legitimate requests
      // The route handler will re-validate authentication
      return response
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * 1. /_next/* (Next.js internals)
     * 2. /favicon.ico, /robots.txt (static files)
     * 3. Static assets (images, css, js, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)',
  ],
}
