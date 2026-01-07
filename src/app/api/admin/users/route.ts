/**
 * Admin Users API
 * Returns all users with stats for admin dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-helpers';
import { supabaseAdmin as supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Require admin role
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');

    // Build query for users
    let query = supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply search filter
    if (search) {
      query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`);
    }

    // Apply status filter
    if (status && status !== 'all') {
      if (status === 'active') {
        query = query.eq('is_active', true);
      } else if (status === 'inactive') {
        query = query.eq('is_active', false);
      } else {
        query = query.eq('subscription_status', status);
      }
    }

    const { data: users, error: usersError } = await query;

    if (usersError) {
      console.error('Error fetching users:', {
        code: usersError.code,
        message: usersError.message,
        details: usersError.details,
        hint: usersError.hint
      });

      // Check if it's an RLS policy error
      if (usersError.code === '42501') {
        return NextResponse.json({ error: 'Permission denied. SUPABASE_SERVICE_ROLE_KEY may not be configured.' }, { status: 500 });
      }

      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    console.log(`[Admin Users API] Fetched ${users?.length || 0} users for search: "${search || 'all'}"`);
    if (users && users.length > 0) {
      console.log('[Admin Users API] Sample user subscription types:', users.slice(0, 5).map(u => u.subscription_type));
    }

    // Get stats
    const { data: allUsers } = await supabase
      .from('users')
      .select('id, subscription_status, credits, is_active');

    const stats = {
      totalUsers: allUsers?.length || 0,
      activeUsers: allUsers?.filter(u => u.is_active).length || 0,
      totalCreditsIssued: allUsers?.reduce((sum, u) => sum + (u.credits || 0), 0) || 0,
      activeSubscriptions: allUsers?.filter(u => u.subscription_status === 'active').length || 0,
    };

    return NextResponse.json({
      users: users || [],
      stats
    });

  } catch (error) {
    console.error('Admin users API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
