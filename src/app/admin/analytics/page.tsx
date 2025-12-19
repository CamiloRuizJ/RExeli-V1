'use client';

/**
 * Admin Analytics Page
 * Platform-wide usage statistics and revenue analytics
 * Client component with auto-refresh capability
 */

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Users, FileText, CreditCard, TrendingUp, DollarSign, RefreshCw } from 'lucide-react';
import { useMultipleRealtimeSubscriptions } from '@/hooks/useRealtimeSubscription';

interface PlatformStats {
  users: {
    total: number;
    active: number;
    newThisMonth: number;
    activeSubscriptions: number;
    freeUsers: number;
  };
  subscriptions: Record<string, number>;
  usage: {
    totalDocuments: number;
    successful: number;
    totalPages: number;
    totalCreditsUsed: number;
    monthlyDocs: number;
    monthlyPages: number;
    successRate: number;
  };
  credits: {
    totalIssued: number;
    totalUsed: number;
    currentInSystem: number;
  };
}

export default function AdminAnalyticsPage() {
  const { user, loading, userProfile } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch analytics data
  const fetchAnalytics = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setIsRefreshing(true);
    }

    try {
      const response = await fetch('/api/admin/analytics');

      if (!response.ok) {
        if (response.status === 403) {
          router.push('/dashboard');
          return;
        }
        throw new Error('Failed to fetch analytics');
      }

      const data = await response.json();
      setStats(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Unable to load analytics data. Please try refreshing.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [router]);

  // Initial load and auth check
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin?callbackUrl=/admin/analytics');
      return;
    }

    if (!loading && user) {
      if (userProfile?.role !== 'admin') {
        router.push('/dashboard');
        return;
      }
      fetchAnalytics();
    }
  }, [loading, user, userProfile, router, fetchAnalytics]);

  // Real-time subscriptions for platform-wide updates
  // Admin monitors ALL users, documents, and transactions
  useMultipleRealtimeSubscriptions(
    userProfile?.role === 'admin'
      ? [
          // Listen to all new users
          {
            table: 'users',
            event: 'INSERT',
            onInsert: (payload) => {
              console.log('[Admin Analytics] New user registered:', payload.new);
              // Refresh analytics to update user count
              fetchAnalytics(false);
            },
          },
          // Listen to all document processing
          {
            table: 'user_documents',
            event: 'INSERT',
            onInsert: (payload) => {
              console.log('[Admin Analytics] New document processed:', payload.new);
              // Refresh analytics to update document stats
              fetchAnalytics(false);
            },
          },
          // Listen to all credit transactions
          {
            table: 'credit_transactions',
            event: 'INSERT',
            onInsert: (payload) => {
              console.log('[Admin Analytics] New transaction:', payload.new);
              // Refresh analytics to update credit metrics
              fetchAnalytics(false);
            },
          },
          // Listen to user updates (subscription changes, etc)
          {
            table: 'users',
            event: 'UPDATE',
            onUpdate: (payload) => {
              console.log('[Admin Analytics] User updated:', payload.new);
              // Refresh analytics to update subscription breakdown
              fetchAnalytics(false);
            },
          },
        ]
      : []
  );

  // Fallback polling every 60 seconds (reduced from 30s since we have realtime now)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      fetchAnalytics(false);
    }, 60000);

    return () => clearInterval(interval);
  }, [user, fetchAnalytics]);

  // Manual refresh handler
  const handleRefresh = () => {
    fetchAnalytics(true);
  };

  // Loading state
  if (loading || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !stats) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-4">
          <Link
            href="/admin"
            className="inline-flex items-center text-blue-600 hover:text-blue-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Admin Dashboard
          </Link>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-800">{error || 'Unable to load analytics data. Please try refreshing the page.'}</p>
          <button
            onClick={handleRefresh}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <Link
            href="/admin"
            className="inline-flex items-center text-blue-600 hover:text-blue-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Admin Dashboard
          </Link>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
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
            {Object.entries(stats.subscriptions).length === 0 ? (
              <p className="text-gray-500 text-center py-4">No active subscriptions</p>
            ) : (
              Object.entries(stats.subscriptions).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-gray-900 font-medium">
                    {type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </span>
                  <span className="text-gray-600 font-semibold">{count} users</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
