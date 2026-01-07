'use client';

/**
 * Admin Group Detail Page
 * View and manage a specific user group
 */

import { useEffect, useState, useCallback, use } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RefreshCw, Users, Plus, Trash2, AlertCircle, CheckCircle, CreditCard, Settings } from 'lucide-react';

interface GroupMember {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  invited_by?: string;
  is_active: boolean;
  user_email?: string;
  user_name?: string;
}

interface GroupDetail {
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
  members: GroupMember[];
  member_count: number;
}

interface CreditTransaction {
  id: string;
  group_id: string;
  user_id?: string;
  amount: number;
  transaction_type: string;
  description?: string;
  admin_id?: string;
  timestamp: string;
  user_email?: string;
  admin_email?: string;
}

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading, userProfile } = useAuth();
  const router = useRouter();

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Add Credits Form
  const [showAddCredits, setShowAddCredits] = useState(false);
  const [creditsAmount, setCreditsAmount] = useState('');
  const [creditsDescription, setCreditsDescription] = useState('');
  const [isAddingCredits, setIsAddingCredits] = useState(false);

  // Add Member Form
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberOptions, setMemberOptions] = useState<any[]>([]);
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);

  // Fetch group data
  const fetchGroup = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setIsRefreshing(true);
    }

    try {
      const response = await fetch(`/api/admin/groups/${id}`);

      if (!response.ok) {
        if (response.status === 403) {
          router.push('/dashboard');
          return;
        }
        if (response.status === 404) {
          setError('Group not found');
          return;
        }
        throw new Error('Failed to fetch group');
      }

      const data = await response.json();
      setGroup(data.group);
      setTransactions(data.transactions || []);
    } catch (err) {
      console.error('Error fetching group:', err);
      setError(err instanceof Error ? err.message : 'Failed to load group');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [id, router]);

  // Initial load and auth check
  useEffect(() => {
    if (!loading && !user) {
      router.push(`/auth/signin?callbackUrl=/admin/groups/${id}`);
      return;
    }

    if (!loading && user) {
      if (userProfile?.role !== 'admin') {
        router.push('/dashboard');
        return;
      }
      fetchGroup();
    }
  }, [loading, user, userProfile, router, id, fetchGroup]);

  // Search members
  const searchMembers = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setMemberOptions([]);
      return;
    }

    setIsSearchingMembers(true);
    try {
      const response = await fetch(`/api/admin/users?search=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Failed to search users');

      const data = await response.json();
      // Filter out users who are already in a group
      const availableUsers = data.users.filter((u: any) => !u.group_id);
      setMemberOptions(availableUsers.slice(0, 5));
    } catch (err) {
      console.error('Error searching users:', err);
    } finally {
      setIsSearchingMembers(false);
    }
  }, []);

  // Debounced member search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (memberSearch) {
        searchMembers(memberSearch);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [memberSearch, searchMembers]);

  // Add credits to group
  const handleAddCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const amount = parseInt(creditsAmount);
    if (!amount || amount <= 0) {
      setError('Please enter a valid credit amount');
      return;
    }

    setIsAddingCredits(true);
    try {
      const response = await fetch(`/api/admin/groups/${id}/credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          description: creditsDescription || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to add credits');

      setSuccess(`Added ${amount} credits. New balance: ${data.newBalance}`);
      setShowAddCredits(false);
      setCreditsAmount('');
      setCreditsDescription('');
      fetchGroup(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add credits');
    } finally {
      setIsAddingCredits(false);
    }
  };

  // Add member to group
  const handleAddMember = async (userId: string) => {
    setError(null);
    setSuccess(null);
    setIsAddingMember(true);

    try {
      const response = await fetch(`/api/admin/groups/${id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to add member');

      setSuccess(data.message);
      setShowAddMember(false);
      setMemberSearch('');
      setMemberOptions([]);
      fetchGroup(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setIsAddingMember(false);
    }
  };

  // Remove member from group
  const handleRemoveMember = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to remove ${userEmail} from this group?`)) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/groups/${id}/members?user_id=${userId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to remove member');

      setSuccess(data.message);
      fetchGroup(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  // Loading state
  if (loading || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading group...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Group Not Found</h2>
          <p className="text-gray-600 mb-4">{error || 'The requested group could not be found.'}</p>
          <Link href="/admin/groups" className="text-blue-600 hover:underline">
            ← Back to Groups
          </Link>
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
            <h1 className="text-3xl font-bold text-gray-900">{group.name}</h1>
            {group.description && (
              <p className="text-gray-600 mt-2">{group.description}</p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => fetchGroup(true)}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <Link
              href="/admin/groups"
              className="px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              ← Back to Groups
            </Link>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Group Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Group Stats */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Group Details
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-blue-600 text-sm font-medium">Credits</div>
                <div className="text-2xl font-bold text-blue-900">{group.credits.toLocaleString()}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-green-600 text-sm font-medium">Members</div>
                <div className="text-2xl font-bold text-green-900">{group.member_count} / {group.max_members}</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-purple-600 text-sm font-medium">Monthly Usage</div>
                <div className="text-2xl font-bold text-purple-900">{group.monthly_usage.toLocaleString()}</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4">
                <div className="text-orange-600 text-sm font-medium">Lifetime Usage</div>
                <div className="text-2xl font-bold text-orange-900">{group.lifetime_usage.toLocaleString()}</div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Plan:</span>{' '}
                <span className="font-medium">{group.subscription_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
              </div>
              <div>
                <span className="text-gray-500">Status:</span>{' '}
                <span className={`font-medium ${group.subscription_status === 'active' ? 'text-green-600' : 'text-yellow-600'}`}>
                  {group.subscription_status}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Document Visibility:</span>{' '}
                <span className="font-medium">{group.document_visibility}</span>
              </div>
              <div>
                <span className="text-gray-500">Billing Cycle End:</span>{' '}
                <span className="font-medium">
                  {group.billing_cycle_end ? new Date(group.billing_cycle_end).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Owner:</span>{' '}
                <span className="font-medium">{group.owner_email}</span>
              </div>
              <div>
                <span className="text-gray-500">Created:</span>{' '}
                <span className="font-medium">{new Date(group.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Members List */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Members ({group.member_count})
              </h2>
              {group.member_count < group.max_members && (
                <button
                  onClick={() => setShowAddMember(!showAddMember)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Member
                </button>
              )}
            </div>

            {/* Add Member Form */}
            {showAddMember && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="relative">
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search users by email or name..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {isSearchingMembers && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                {memberOptions.length > 0 && (
                  <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
                    {memberOptions.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => handleAddMember(option.id)}
                        disabled={isAddingMember}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 border-b border-gray-100 last:border-b-0 disabled:opacity-50"
                      >
                        <div className="font-medium text-gray-900">{option.name || 'Unknown'}</div>
                        <div className="text-sm text-gray-600">{option.email}</div>
                      </button>
                    ))}
                  </div>
                )}
                {memberSearch.length >= 2 && !isSearchingMembers && memberOptions.length === 0 && (
                  <p className="mt-2 text-sm text-gray-500">No available users found.</p>
                )}
              </div>
            )}

            {/* Members Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {group.members.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{member.user_name || 'Unknown'}</div>
                        <div className="text-sm text-gray-500">{member.user_email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          member.role === 'owner' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {member.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(member.joined_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        {member.role !== 'owner' && (
                          <button
                            onClick={() => handleRemoveMember(member.user_id, member.user_email || '')}
                            className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1"
                          >
                            <Trash2 className="w-4 h-4" />
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column - Credits & Actions */}
        <div className="space-y-6">
          {/* Add Credits */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Add Credits
            </h2>
            <form onSubmit={handleAddCredits} className="space-y-4">
              <div>
                <label htmlFor="credits" className="block text-sm font-medium text-gray-700 mb-1">
                  Amount
                </label>
                <input
                  type="number"
                  id="credits"
                  value={creditsAmount}
                  onChange={(e) => setCreditsAmount(e.target.value)}
                  placeholder="Enter amount"
                  min="1"
                  max="100000"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <input
                  type="text"
                  id="description"
                  value={creditsDescription}
                  onChange={(e) => setCreditsDescription(e.target.value)}
                  placeholder="Reason for adding credits"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={isAddingCredits || !creditsAmount}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {isAddingCredits ? 'Adding...' : 'Add Credits'}
              </button>
            </form>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h2>
            {transactions.length === 0 ? (
              <p className="text-gray-500 text-sm">No transactions yet.</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {transactions.slice(0, 10).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {tx.transaction_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(tx.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div className={`font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
