/**
 * DEBUG ENDPOINT - Remove in production
 * GET /api/debug/auth
 * Returns current auth state for debugging
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user from Supabase Auth
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({
        authenticated: false,
        error: authError?.message || 'No user found',
        cookies: request.cookies.getAll().map(c => c.name),
      });
    }

    // Try to fetch profile from public.users
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('id, auth_user_id, email, name, role, is_active')
      .eq('auth_user_id', authUser.id)
      .single();

    return NextResponse.json({
      authenticated: true,
      authUser: {
        id: authUser.id,
        email: authUser.email,
      },
      profile: profile || null,
      profileError: profileError?.message || null,
      hasAdminRole: profile?.role === 'admin',
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Debug endpoint error',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
