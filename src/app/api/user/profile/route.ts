/**
 * GET /api/user/profile
 * Returns the current user's profile including role
 * Uses server-side auth to bypass RLS issues
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
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
  group_id?: string;
  group_name?: string;
}

export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user directly from Supabase Auth
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      console.log('Profile API: No authenticated user found');
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log('Profile API: Fetching profile for auth_user_id:', authUser.id);

    // Fetch full profile using admin client (bypasses RLS)
    // Use auth_user_id to find the user in public.users table
    const { data: profile, error } = await supabaseAdmin
      .from('users')
      .select('id, auth_user_id, email, name, role, credits, subscription_type, subscription_status, is_active, group_id')
      .eq('auth_user_id', authUser.id)
      .eq('is_active', true)
      .single();

    if (error || !profile) {
      console.error('Error fetching user profile for auth_user_id:', authUser.id, error);
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      );
    }

    console.log('Profile API: Found profile with role:', profile.role);

    // Fetch group name if user is in a group
    let groupName: string | undefined;
    if (profile.group_id) {
      const { data: group } = await supabaseAdmin
        .from('user_groups')
        .select('name')
        .eq('id', profile.group_id)
        .single();

      groupName = group?.name;
    }

    return NextResponse.json<ApiResponse<UserProfileResponse>>({
      success: true,
      data: {
        ...profile,
        group_name: groupName
      }
    });

  } catch (error) {
    console.error('Profile API error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}
