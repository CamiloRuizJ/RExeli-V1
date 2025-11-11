/**
 * Admin Analytics Page
 * Platform-wide usage statistics and revenue analytics
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { ArrowLeft, Users, FileText, CreditCard, TrendingUp, DollarSign } from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getPlatformStats() {
  // Get user statistics
  const { data: users } = await supabase
    .from('users')
    .select('id, credits, subscription_type, subscription_status, created_at, is_active');

  // Get usage logs
  const { data: usageLogs } = await supabase
    .from('usage_logs')
    .select('id, page_count, credits_used, processing_status, timestamp');

  // Get credit transactions
  const { data: transactions } = await supabase
    .from('credit_transactions')
    .select('id, amount, transaction_type, timestamp');

  if (!users || !usageLogs || !transactions) {
    return null;
  }

  // Calculate current month start
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // User metrics
  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.is_active).length;
  const newUsersThisMonth = users.filter(u => new Date(u.created_at) >= monthStart).length;

  // Subscription metrics
  const activeSubscriptions = users.filter(u => u.subscription_status === 'active' && u.subscription_type !== 'free').length;
  const freeUsers = users.filter(u => u.subscription_type === 'free').length;

  // Revenue estimation (placeholder - actual revenue tracking would need payment integration)
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

  // Monthly usage
  const monthlyDocs = usageLogs.filter(log => new Date(log.timestamp) >= monthStart).length;
  const monthlyPages = usageLogs
    .filter(log => new Date(log.timestamp) >= monthStart)
    .reduce((sum, log) => sum + (log.page_count || 0), 0);

  // Success rate
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

  return {
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
  };
}

export default async function AdminAnalyticsPage() {
  const session = await auth();

  // Require authentication
  if (!session) {
    redirect('/auth/signin?callbackUrl=/admin/analytics');
  }

  // Require admin role
  if (session.user.role !== 'admin') {
    redirect('/dashboard');
  }

  const stats = await getPlatformStats();

  if (!stats) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-800">Unable to load analytics data. Please try refreshing the page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin"
          className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Admin Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Platform Analytics</h1>
        <p className="text-gray-600 mt-2">
          Overview of platform usage, user growth, and system metrics
        </p>
      </div>

      {/* User Metrics */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">User Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">Total Users</span>
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.users.total}</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">Active Users</span>
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-600">{stats.users.active}</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">New This Month</span>
              <TrendingUp className="w-5 h-5 text-indigo-600" />
            </div>
            <p className="text-3xl font-bold text-indigo-600">{stats.users.newThisMonth}</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">Paid Subscriptions</span>
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-3xl font-bold text-emerald-600">{stats.users.activeSubscriptions}</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">Free Users</span>
              <Users className="w-5 h-5 text-gray-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.users.freeUsers}</p>
          </div>
        </div>
      </div>

      {/* Usage Metrics */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Usage Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">Total Documents</span>
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.usage.totalDocuments.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">All time</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">Success Rate</span>
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-600">{stats.usage.successRate}%</p>
            <p className="text-xs text-gray-500 mt-1">{stats.usage.successful} successful</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">This Month</span>
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <p className="text-3xl font-bold text-indigo-600">{stats.usage.monthlyDocs.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">{stats.usage.monthlyPages.toLocaleString()} pages</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">Total Pages</span>
              <FileText className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-3xl font-bold text-orange-600">{stats.usage.totalPages.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">All time</p>
          </div>
        </div>
      </div>

      {/* Credit Metrics */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Credit Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">Total Credits Issued</span>
              <CreditCard className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-blue-600">{stats.credits.totalIssued.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">Purchases & free trials</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">Credits Used</span>
              <CreditCard className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-3xl font-bold text-red-600">{stats.credits.totalUsed.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">Document processing</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">Current in System</span>
              <CreditCard className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-600">{stats.credits.currentInSystem.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">User balances</p>
          </div>
        </div>
      </div>

      {/* Subscription Breakdown */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Active Subscription Breakdown</h2>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="space-y-4">
            {Object.entries(stats.subscriptions).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="text-gray-900 font-medium">
                  {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
                <span className="text-gray-600 font-semibold">{count} users</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
