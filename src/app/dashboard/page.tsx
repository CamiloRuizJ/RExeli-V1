'use client';

/**
 * User Dashboard
 * Shows user's credits, usage statistics, and document history
 * Client component with auto-refresh capability
 */

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FileText, Upload, Clock, CheckCircle, CreditCard, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';
import { useMultipleRealtimeSubscriptions } from '@/hooks/useRealtimeSubscription';

interface UserData {
  credits: number;
  subscription_type: string;
  subscription_status: string;
  monthly_usage: number;
  lifetime_usage: number;
  billing_cycle_end: string | null;
}

interface UserStats {
  totalDocuments: number;
  monthlyDocuments: number;
  successfulProcessing: number;
  totalPagesProcessed: number;
  successRate: number;
}

interface Document {
  id: string;
  created_at: string;
  file_name: string;
  document_type: string;
  page_count: number;
  credits_used: number;
  processing_status: string;
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [userData, setUserData] = useState<UserData | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [recentDocuments, setRecentDocuments] = useState<Document[]>([]);
  const [userName, setUserName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setIsRefreshing(true);
    }

    try {
      const response = await fetch('/api/user/dashboard');

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const data = await response.json();
      setUserData(data.userData);
      setUserStats(data.stats);
      setRecentDocuments(data.recentDocuments);
      setUserName(data.userName);
      setError(null);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Unable to load dashboard data. Please try refreshing.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial load and auth check
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin?callbackUrl=/dashboard');
      return;
    }

    if (!loading && user) {
      fetchDashboardData();
    }
  }, [loading, user, router, fetchDashboardData]);

  // Real-time subscriptions for instant updates
  useMultipleRealtimeSubscriptions(
    user?.id
      ? [
          // Listen to user table changes for credit updates
          {
            table: 'users',
            event: 'UPDATE',
            filter: `id=eq.${user.id}`,
            onUpdate: (payload) => {
              console.log('[Dashboard] User data updated:', payload.new);
              setUserData((prev) => ({
                ...prev!,
                credits: payload.new.credits,
                monthly_usage: payload.new.monthly_usage,
                lifetime_usage: payload.new.lifetime_usage,
                subscription_status: payload.new.subscription_status,
              }));
            },
          },
          // Listen to new documents
          {
            table: 'user_documents',
            event: 'INSERT',
            filter: `user_id=eq.${user.id}`,
            onInsert: (payload) => {
              console.log('[Dashboard] New document:', payload.new);
              setRecentDocuments((prev) => [payload.new, ...prev].slice(0, 5));
              // Refresh stats when new document added
              fetchDashboardData(false);
            },
          },
          // Listen to document updates
          {
            table: 'user_documents',
            event: 'UPDATE',
            filter: `user_id=eq.${user.id}`,
            onUpdate: (payload) => {
              console.log('[Dashboard] Document updated:', payload.new);
              setRecentDocuments((prev) =>
                prev.map((doc) => (doc.id === payload.new.id ? payload.new : doc))
              );
            },
          },
        ]
      : []
  );

  // Fallback polling every 30 seconds (reduced from 10s since we have realtime now)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      fetchDashboardData(false);
    }, 30000);

    return () => clearInterval(interval);
  }, [user, fetchDashboardData]);

  // Manual refresh handler
  const handleRefresh = () => {
    fetchDashboardData(true);
  };

  // Loading state
  if (loading || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !userData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-800">{error || 'Unable to load user data. Please try refreshing the page.'}</p>
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

  const isLowCredits = userData.credits < 50;
  const hasNoCredits = userData.credits === 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome back, {userName}</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Credit Alert Banners */}
      {hasNoCredits && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-red-900 font-semibold mb-1">No Credits Remaining</h3>
              <p className="text-red-800 text-sm mb-3">
                You&apos;ve used all your credits. Purchase more credits or upgrade your plan to continue processing documents.
              </p>
              <Link
                href="/pricing"
                className="inline-block px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition-colors"
              >
                View Pricing Plans
              </Link>
            </div>
          </div>
        </div>
      )}

      {isLowCredits && !hasNoCredits && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-yellow-900 font-semibold mb-1">Low Credits</h3>
              <p className="text-yellow-800 text-sm mb-3">
                You&apos;re running low on credits. Consider upgrading your plan to avoid interruptions.
              </p>
              <Link
                href="/pricing"
                className="inline-block px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm font-medium transition-colors"
              >
                Upgrade Plan
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Credit & Subscription Overview */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Credits Card */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-blue-100 text-sm">Available Credits</span>
              <CreditCard className="w-5 h-5 text-blue-200" />
            </div>
            <p className="text-4xl font-bold mb-1">{userData.credits.toLocaleString()}</p>
            <p className="text-blue-100 text-sm">
              1 credit = 1 page
            </p>
          </div>

          {/* Subscription Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">Subscription Plan</span>
              <FileText className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900 mb-1">
              {userData.subscription_type
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (l: string) => l.toUpperCase())}
            </p>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  userData.subscription_status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : userData.subscription_status === 'cancelled'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {userData.subscription_status}
              </span>
            </div>
            {userData.billing_cycle_end && (
              <p className="text-xs text-gray-500 mt-2">
                Renews {new Date(userData.billing_cycle_end).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Monthly Usage Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">This Month</span>
              <TrendingUp className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900 mb-1">
              {userData.monthly_usage.toLocaleString()}
            </p>
            <p className="text-sm text-gray-600">pages processed</p>
            <p className="text-xs text-gray-500 mt-2">
              Lifetime: {userData.lifetime_usage.toLocaleString()} pages
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            href="/tool"
            className={`${
              hasNoCredits ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-br from-blue-600 to-indigo-600 hover:shadow-lg'
            } text-white rounded-lg p-6 transition-shadow`}
          >
            <div className="flex items-center space-x-3 mb-2">
              <Upload className="w-6 h-6" />
              <h3 className="text-xl font-semibold">Process Document</h3>
            </div>
            <p className="text-blue-100 text-sm">
              {hasNoCredits ? 'No credits available' : 'Upload and extract data from a new document'}
            </p>
          </Link>

          <Link href="/dashboard/documents" className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center space-x-3 mb-2">
              <FileText className="w-6 h-6 text-gray-600" />
              <h3 className="text-xl font-semibold text-gray-900">My Documents</h3>
            </div>
            <p className="text-gray-600 text-sm">View and download your processed documents</p>
          </Link>

          <Link href="/dashboard/usage" className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center space-x-3 mb-2">
              <Clock className="w-6 h-6 text-gray-600" />
              <h3 className="text-xl font-semibold text-gray-900">Usage Analytics</h3>
            </div>
            <p className="text-gray-600 text-sm">View detailed usage history and statistics</p>
          </Link>
        </div>
      </div>

      {/* Statistics */}
      {userStats && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm">Total Documents</span>
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{userStats.totalDocuments}</p>
              <p className="text-xs text-gray-500 mt-1">All time</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm">This Month</span>
                <Upload className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{userStats.monthlyDocuments}</p>
              <p className="text-xs text-gray-500 mt-1">documents</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm">Successful</span>
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{userStats.successfulProcessing}</p>
              <p className="text-xs text-gray-500 mt-1">processed</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm">Success Rate</span>
                <CheckCircle className="w-5 h-5 text-indigo-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {userStats.totalDocuments > 0 ? `${userStats.successRate}%` : '-'}
              </p>
              <p className="text-xs text-gray-500 mt-1">accuracy</p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Documents */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Recent Documents</h2>
          {recentDocuments.length > 0 && (
            <Link href="/dashboard/documents" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
              View All →
            </Link>
          )}
        </div>

        {recentDocuments.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No documents yet</p>
            <p className="text-gray-500 text-sm mb-4">Upload your first document to get started</p>
            <Link
              href="/tool"
              className={`inline-flex items-center space-x-2 px-4 py-2 ${
                hasNoCredits ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              } text-white rounded-lg transition-colors`}
            >
              <Upload className="w-4 h-4" />
              <span>Process Document</span>
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    File Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Pages
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Credits Used
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {doc.file_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {doc.document_type?.replace(/_/g, ' ')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{doc.page_count}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{doc.credits_used}</td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          doc.processing_status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : doc.processing_status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {doc.processing_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
