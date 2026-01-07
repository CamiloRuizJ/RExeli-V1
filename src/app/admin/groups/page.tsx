'use client';

/**
 * Admin Groups Management Page
 * Shows all user groups with credits, subscription, and member information
 */

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { RefreshCw, Users, Plus } from 'lucide-react';

interface GroupSummary {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  owner_email?: string;
  owner_name?: string;
  credits: number;
  monthly_usage: number;
  lifetime_usage: number;
  subscription_type: string;
  subscription_status: string;
  billing_cycle_start?: string;
  billing_cycle_end?: string;
  document_visibility: string;
  max_members: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  member_count: number;
}

interface GroupStats {
  totalGroups: number;
  activeGroups: number;
  totalCreditsInGroups: number;
  totalMembers: number;
  professionalGroups: number;
  businessGroups: number;
}

function AdminGroupsContent() {
  const { user, loading, userProfile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [stats, setStats] = useState<GroupStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [subscriptionFilter, setSubscriptionFilter] = useState(searchParams.get('subscription_type') || 'all');

  // Fetch groups data
  const fetchGroups = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setIsRefreshing(true);
    }

    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (subscriptionFilter && subscriptionFilter !== 'all') params.set('subscription_type', subscriptionFilter);

      const response = await fetch(`/api/admin/groups?${params.toString()}`);

      if (!response.ok) {
        if (response.status === 403) {
          router.push('/dashboard');
          return;
        }
        throw new Error('Failed to fetch groups');
      }

      const data = await response.json();
      setGroups(data.groups);
      setStats(data.stats);
    } catch (err) {
      console.error('Error fetching groups:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchQuery, statusFilter, subscriptionFilter, router]);

  // Initial load and auth check
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin?callbackUrl=/admin/groups');
      return;
    }

    if (!loading && user) {
      if (userProfile?.role !== 'admin') {
        router.push('/dashboard');
        return;
      }
      fetchGroups();
    }
  }, [loading, user, userProfile, router, fetchGroups]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      fetchGroups(false);
    }, 30000);

    return () => clearInterval(interval);
  }, [user, fetchGroups]);

  // Handle search form submit
  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fetchGroups(true);

    // Update URL
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
    if (subscriptionFilter && subscriptionFilter !== 'all') params.set('subscription_type', subscriptionFilter);
    router.push(`/admin/groups${params.toString() ? `?${params.toString()}` : ''}`);
  };

  // Manual refresh handler
  const handleRefresh = () => {
    fetchGroups(true);
  };

  // Loading state
  if (loading || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading groups...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Groups</h1>
            <p className="text-gray-600 mt-2">
              Manage user groups with shared credit pools
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <Link
              href="/admin/groups/new"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Group
            </Link>
            <Link
              href="/admin"
              className="px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="text-blue-600 text-sm font-medium mb-1">Total Groups</div>
              <div className="text-2xl font-bold text-blue-900">{stats.totalGroups}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="text-green-600 text-sm font-medium mb-1">Active Groups</div>
              <div className="text-2xl font-bold text-green-900">{stats.activeGroups}</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <div className="text-purple-600 text-sm font-medium mb-1">Total Members</div>
              <div className="text-2xl font-bold text-purple-900">{stats.totalMembers}</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
              <div className="text-orange-600 text-sm font-medium mb-1">Credits in Groups</div>
              <div className="text-2xl font-bold text-orange-900">
                {stats.totalCreditsInGroups.toLocaleString()}
              </div>
            </div>
            <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
              <div className="text-indigo-600 text-sm font-medium mb-1">Professional</div>
              <div className="text-2xl font-bold text-indigo-900">{stats.professionalGroups}</div>
            </div>
            <div className="bg-pink-50 rounded-lg p-4 border border-pink-200">
              <div className="text-pink-600 text-sm font-medium mb-1">Business</div>
              <div className="text-2xl font-bold text-pink-900">{stats.businessGroups}</div>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label htmlFor="search" className="sr-only">
                Search groups
              </label>
              <input
                type="text"
                id="search"
                name="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by group name or owner email..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="status" className="sr-only">
                Filter by status
              </label>
              <select
                id="status"
                name="status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="cancelled">Cancelled</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div>
              <label htmlFor="subscription_type" className="sr-only">
                Filter by plan
              </label>
              <select
                id="subscription_type"
                name="subscription_type"
                value={subscriptionFilter}
                onChange={(e) => setSubscriptionFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Plans</option>
                <option value="professional_monthly">Professional Monthly</option>
                <option value="professional_annual">Professional Annual</option>
                <option value="business_monthly">Business Monthly</option>
                <option value="business_annual">Business Annual</option>
              </select>
            </div>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Groups Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Group
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Members
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Credits
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {groups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No groups found. Try adjusting your search or filters, or{' '}
                    <Link href="/admin/groups/new" className="text-blue-600 hover:underline">
                      create a new group
                    </Link>
                    .
                  </td>
                </tr>
              ) : (
                groups.map((group) => (
                  <tr key={group.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900">{group.name}</div>
                        {group.description && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {group.description}
                          </div>
                        )}
                        <div className="text-xs text-gray-400 mt-1">
                          Created {new Date(group.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {group.owner_name || 'Unknown'}
                        </div>
                        <div className="text-sm text-gray-500">{group.owner_email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {group.subscription_type
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </div>
                        {group.billing_cycle_end && (
                          <div className="text-xs text-gray-500 mt-1">
                            Renews {new Date(group.billing_cycle_end).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">
                          {group.member_count} / {group.max_members}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {group.credits.toLocaleString()} credits
                        </div>
                        <div className="text-xs text-gray-500">
                          Used: {group.monthly_usage.toLocaleString()} / month
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            group.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {group.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            group.subscription_status === 'active'
                              ? 'bg-blue-100 text-blue-800'
                              : group.subscription_status === 'cancelled'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {group.subscription_status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/groups/${group.id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                      >
                        View Details →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Results Count */}
      {groups.length > 0 && (
        <div className="mt-4 text-sm text-gray-600 text-center">
          Showing {groups.length} group{groups.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

// Loading fallback for Suspense
function AdminGroupsLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading groups...</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminGroupsPage() {
  return (
    <Suspense fallback={<AdminGroupsLoading />}>
      <AdminGroupsContent />
    </Suspense>
  );
}
