import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Define which routes require authentication
const protectedRoutes = [
  '/api/upload',
  '/api/classify',
  '/api/extract',
  '/api/export',
  '/tool'
]

// Define public routes that don't require authentication
const publicRoutes = [
  '/',
  '/auth/signin',
  '/auth/error',
  '/api/auth'
]

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes without any processing
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Check authentication for protected routes
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    try {
      const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })

      if (!token) {
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

      // For authenticated API routes, add user info to headers and forward request
      if (pathname.startsWith('/api/')) {
        const response = NextResponse.next()
        // Safely extract token fields with fallbacks
        const userId = token.sub || token.id || ''
        const userEmail = token.email || ''
        const userRole = token.role || 'user'

        response.headers.set('x-user-id', String(userId))
        response.headers.set('x-user-email', String(userEmail))
        response.headers.set('x-user-role', String(userRole))

        console.log('[Middleware] Forwarding authenticated API request:', {
          path: pathname,
          method: request.method,
          userId,
          userEmail,
          userRole
        })

        return response
      }

      // For authenticated page routes, just continue
      return NextResponse.next()
    } catch (error) {
      console.error('Middleware error:', error)
      // On error, allow the request to proceed to avoid blocking legitimate requests
      // The route handler will re-validate authentication
      return NextResponse.next()
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * 1. /api/auth/* (NextAuth.js routes)
     * 2. /_next/* (Next.js internals)
     * 3. /favicon.ico, /robots.txt (static files)
     * 4. Static assets (images, css, js)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|robots.txt).*)',
  ],
}