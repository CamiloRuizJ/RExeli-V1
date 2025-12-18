/**
 * User Usage Analytics API
 * Returns usage logs, credit transactions, and statistics
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
    const [usageLogsResult, transactionsResult, allLogsResult] = await Promise.all([
      // Recent usage logs (last 50)
      supabase
        .from('usage_logs')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(50),

      // Credit transactions (last 30)
      supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(30),

      // All logs for stats calculation
      supabase
        .from('usage_logs')
        .select('processing_status, page_count, credits_used, timestamp')
        .eq('user_id', userId)
    ]);

    if (usageLogsResult.error) {
      console.error('Error fetching usage logs:', usageLogsResult.error);
      return NextResponse.json({ error: 'Failed to fetch usage data' }, { status: 500 });
    }

    // Calculate stats
    const logs = allLogsResult.data || [];
    const totalProcessed = logs.length;
    const successfulProcessing = logs.filter(log => log.processing_status === 'success').length;
    const failedProcessing = logs.filter(log => log.processing_status === 'failed').length;
    const totalPages = logs.reduce((sum, log) => sum + (log.page_count || 0), 0);
    const totalCreditsUsed = logs.reduce((sum, log) => sum + (log.credits_used || 0), 0);
    const successRate = totalProcessed > 0 ? Math.round((successfulProcessing / totalProcessed) * 100) : 0;
    const avgPagesPerDoc = totalProcessed > 0 ? Math.round(totalPages / totalProcessed) : 0;

    const stats = {
      totalProcessed,
      successfulProcessing,
      failedProcessing,
      totalPages,
      totalCreditsUsed,
      successRate,
      avgPagesPerDoc,
    };

    return NextResponse.json({
      usageLogs: usageLogsResult.data || [],
      creditTransactions: transactionsResult.data || [],
      stats
    });

  } catch (error) {
    console.error('Usage API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
