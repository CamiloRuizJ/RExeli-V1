/**
 * GET /api/user/profile
 * Returns the current user's profile including role
 * Uses server-side auth to bypass RLS issues
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase';
import type { ApiResponse } from '@/lib/types';

export interface UserProfileResponse {
  id: string;
  auth_user_id: string;
  email: string;
  name: string;
  role: string;
  credits: number;
  subscription_type: string;
  subscription_status: string;
  is_active: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Fetch full profile using admin client (bypasses RLS)
    const { data: profile, error } = await supabaseAdmin
      .from('users')
      .select('id, auth_user_id, email, name, role, credits, subscription_type, subscription_status, is_active')
      .eq('id', session.user.id)
      .eq('is_active', true)
      .single();

    if (error || !profile) {
      console.error('Error fetching user profile:', error);
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse<UserProfileResponse>>({
      success: true,
      data: profile
    });

  } catch (error) {
    console.error('Profile API error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}
