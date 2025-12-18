/**
 * Admin Analytics API
 * Returns platform-wide statistics
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

    // Require admin role
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all data in parallel
    const [usersResult, usageLogsResult, transactionsResult] = await Promise.all([
      supabase
        .from('users')
        .select('id, credits, subscription_type, subscription_status, created_at, is_active'),
      supabase
        .from('usage_logs')
        .select('id, page_count, credits_used, processing_status, timestamp'),
      supabase
        .from('credit_transactions')
        .select('id, amount, transaction_type, timestamp')
    ]);

    const users = usersResult.data || [];
    const usageLogs = usageLogsResult.data || [];
    const transactions = transactionsResult.data || [];

    // Calculate current month start
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // User metrics
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.is_active).length;
    const newUsersThisMonth = users.filter(u => new Date(u.created_at) >= monthStart).length;
    const activeSubscriptions = users.filter(u => u.subscription_status === 'active' && u.subscription_type !== 'free').length;
    const freeUsers = users.filter(u => u.subscription_type === 'free').length;

    // Subscription breakdown
    const subscriptionBreakdown = users.reduce((acc, user) => {
      if (user.subscription_status === 'active') {
        acc[user.subscription_type] = (acc[user.subscription_type] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Usage metrics
    const totalDocumentsProcessed = usageLogs.length;
    const successfulProcessing = usageLogs.filter(log => log.processing_status === 'success').length;
    const totalPagesProcessed = usageLogs.reduce((sum, log) => sum + (log.page_count || 0), 0);
    const totalCreditsUsed = usageLogs.reduce((sum, log) => sum + (log.credits_used || 0), 0);
    const monthlyDocs = usageLogs.filter(log => new Date(log.timestamp) >= monthStart).length;
    const monthlyPages = usageLogs
      .filter(log => new Date(log.timestamp) >= monthStart)
      .reduce((sum, log) => sum + (log.page_count || 0), 0);
    const successRate = totalDocumentsProcessed > 0
      ? Math.round((successfulProcessing / totalDocumentsProcessed) * 100)
      : 0;

    // Credit metrics
    const totalCreditsIssued = transactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    const totalCreditsDeducted = transactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const currentCreditsInSystem = users.reduce((sum, u) => sum + (u.credits || 0), 0);

    return NextResponse.json({
      users: {
        total: totalUsers,
        active: activeUsers,
        newThisMonth: newUsersThisMonth,
        activeSubscriptions,
        freeUsers,
      },
      subscriptions: subscriptionBreakdown,
      usage: {
        totalDocuments: totalDocumentsProcessed,
        successful: successfulProcessing,
        totalPages: totalPagesProcessed,
        totalCreditsUsed,
        monthlyDocs,
        monthlyPages,
        successRate,
      },
      credits: {
        totalIssued: totalCreditsIssued,
        totalUsed: totalCreditsDeducted,
        currentInSystem: currentCreditsInSystem,
      },
    });

  } catch (error) {
    console.error('Admin analytics API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
