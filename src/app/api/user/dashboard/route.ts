/**
 * User Dashboard API
 * Returns current user data, stats, and recent documents for dashboard display
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-helpers';
import { supabaseAdmin as supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch all data in parallel
    const [userResult, usageLogsResult, recentDocsResult] = await Promise.all([
      // User data (include group_id)
      supabase
        .from('users')
        .select('credits, subscription_type, subscription_status, monthly_usage, lifetime_usage, billing_cycle_end, group_id')
        .eq('id', userId)
        .single(),

      // Usage logs for stats
      supabase
        .from('usage_logs')
        .select('processing_status, page_count, timestamp')
        .eq('user_id', userId),

      // Recent documents
      supabase
        .from('user_documents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5)
    ]);

    if (userResult.error) {
      console.error('Error fetching user data:', userResult.error);
      return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 });
    }

    // Calculate stats from usage logs
    const usageLogs = usageLogsResult.data || [];
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const stats = {
      totalDocuments: usageLogs.length,
      monthlyDocuments: usageLogs.filter(log => new Date(log.timestamp) >= firstOfMonth).length,
      successfulProcessing: usageLogs.filter(log => log.processing_status === 'success').length,
      totalPagesProcessed: usageLogs
        .filter(log => log.processing_status === 'success')
        .reduce((sum, log) => sum + (log.page_count || 0), 0),
      successRate: usageLogs.length > 0
        ? Math.round((usageLogs.filter(log => log.processing_status === 'success').length / usageLogs.length) * 100)
        : 0,
    };

    // Fetch group info if user is in a group
    let groupInfo = null;
    if (userResult.data?.group_id) {
      const [groupResult, memberResult, memberCountResult] = await Promise.all([
        // Group details
        supabase
          .from('user_groups')
          .select('id, name, description, credits, subscription_type, subscription_status, owner_id, document_visibility')
          .eq('id', userResult.data.group_id)
          .single(),
        // User's role in group
        supabase
          .from('group_members')
          .select('role')
          .eq('group_id', userResult.data.group_id)
          .eq('user_id', userId)
          .single(),
        // Member count
        supabase
          .from('group_members')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', userResult.data.group_id)
          .eq('is_active', true)
      ]);

      if (groupResult.data) {
        groupInfo = {
          id: groupResult.data.id,
          name: groupResult.data.name,
          description: groupResult.data.description,
          credits: groupResult.data.credits,
          subscriptionType: groupResult.data.subscription_type,
          subscriptionStatus: groupResult.data.subscription_status,
          documentVisibility: groupResult.data.document_visibility,
          role: memberResult.data?.role || 'member',
          isOwner: groupResult.data.owner_id === userId,
          memberCount: memberCountResult.count || 0
        };
      }
    }

    return NextResponse.json({
      userData: userResult.data,
      stats,
      recentDocuments: recentDocsResult.data || [],
      userName: session.user.name || session.user.email,
      groupInfo
    });

  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
