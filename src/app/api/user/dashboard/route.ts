/**
 * User Dashboard API
 * Returns current user data, stats, and recent documents for dashboard display
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin as supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch all data in parallel
    const [userResult, usageLogsResult, recentDocsResult] = await Promise.all([
      // User data
      supabase
        .from('users')
        .select('credits, subscription_type, subscription_status, monthly_usage, lifetime_usage, billing_cycle_end')
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

    return NextResponse.json({
      userData: userResult.data,
      stats,
      recentDocuments: recentDocsResult.data || [],
      userName: session.user.name || session.user.email
    });

  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
