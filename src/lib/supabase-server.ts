/**
 * Server-side Supabase Client for Next.js App Router
 * Uses @supabase/ssr for proper cookie handling in Server Components and Route Handlers
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Creates a Supabase client for Server Components and Route Handlers
 * This client automatically handles cookies for auth session management
 *
 * @returns Supabase client configured for server-side use
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // The `set` method can fail in Server Components
            // This is expected behavior when the component is being rendered
            // Cookies can only be modified in Server Actions or Route Handlers
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Same as above - expected behavior in Server Components
          }
        },
      },
    }
  )
}

/**
 * Creates a Supabase client for use in middleware
 * Middleware requires different cookie handling than Server Components
 *
 * Note: Import this separately in middleware.ts
 *
 * @param request - The Next.js request object
 * @param response - The Next.js response object
 * @returns Supabase client configured for middleware use
 */
export function createMiddlewareClient(request: any, response: any) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )
}
