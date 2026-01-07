'use client';

/**
 * Admin Create Group Page
 * Form to create a new user group with an owner
 */

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, User, AlertCircle, CheckCircle } from 'lucide-react';

interface UserOption {
  id: string;
  email: string;
  name: string;
  group_id: string | null;
  subscription_type: string;
}

function CreateGroupContent() {
  const { user, loading, userProfile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [subscriptionType, setSubscriptionType] = useState('professional_monthly');
  const [documentVisibility, setDocumentVisibility] = useState('shared');
  const [initialCredits, setInitialCredits] = useState('');

  const [ownerSearch, setOwnerSearch] = useState(searchParams.get('owner_email') || '');
  const [ownerOptions, setOwnerOptions] = useState<UserOption[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<UserOption | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Auth check
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin?callbackUrl=/admin/groups/new');
      return;
    }

    if (!loading && user && userProfile?.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [loading, user, userProfile, router]);

  // Search for users
  const searchUsers = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setOwnerOptions([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/admin/users?search=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Failed to search users');

      const data = await response.json();
      // Filter out users who are already in a group
      const availableUsers = data.users.filter((u: UserOption) => !u.group_id);
      setOwnerOptions(availableUsers.slice(0, 10));
    } catch (err) {
      console.error('Error searching users:', err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (ownerSearch && !selectedOwner) {
        searchUsers(ownerSearch);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [ownerSearch, selectedOwner, searchUsers]);

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate
    if (!name.trim()) {
      setError('Group name is required');
      return;
    }

    if (!selectedOwner) {
      setError('Please select a group owner');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          owner_id: selectedOwner.id,
          subscription_type: subscriptionType,
          document_visibility: documentVisibility,
          initial_credits: initialCredits ? parseInt(initialCredits) : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create group');
      }

      setSuccess(`Group "${data.group.name}" created successfully!`);

      // Redirect to group detail page after short delay
      setTimeout(() => {
        router.push(`/admin/groups/${data.group.id}`);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle owner selection
  const selectOwner = (owner: UserOption) => {
    setSelectedOwner(owner);
    setOwnerSearch(owner.email);
    setOwnerOptions([]);
  };

  // Clear owner selection
  const clearOwner = () => {
    setSelectedOwner(null);
    setOwnerSearch('');
    setOwnerOptions([]);
  };

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Create User Group</h1>
            <p className="text-gray-600 mt-2">
              Create a new group with a shared credit pool
            </p>
          </div>
          <Link
            href="/admin/groups"
            className="px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ← Back to Groups
          </Link>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6">
        {/* Error/Success Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Group Name */}
        <div className="mb-6">
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Group Name *
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Acme Corp Team"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        {/* Description */}
        <div className="mb-6">
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description for the group..."
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Owner Selection */}
        <div className="mb-6">
          <label htmlFor="owner" className="block text-sm font-medium text-gray-700 mb-2">
            Group Owner *
          </label>
          <div className="relative">
            {selectedOwner ? (
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <User className="w-5 h-5 text-blue-600" />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{selectedOwner.name || 'Unknown'}</div>
                  <div className="text-sm text-gray-600">{selectedOwner.email}</div>
                </div>
                <button
                  type="button"
                  onClick={clearOwner}
                  className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    id="owner"
                    value={ownerSearch}
                    onChange={(e) => setOwnerSearch(e.target.value)}
                    placeholder="Search by email or name..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>

                {/* Search Results */}
                {ownerOptions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                    {ownerOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => selectOwner(option)}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-gray-900">{option.name || 'Unknown'}</div>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            option.subscription_type === 'free'
                              ? 'bg-gray-100 text-gray-600'
                              : option.subscription_type?.includes('enterprise')
                              ? 'bg-purple-100 text-purple-700'
                              : option.subscription_type?.includes('business')
                              ? 'bg-blue-100 text-blue-700'
                              : option.subscription_type?.includes('professional')
                              ? 'bg-green-100 text-green-700'
                              : 'bg-orange-100 text-orange-700'
                          }`}>
                            {option.subscription_type?.replace('_', ' ') || 'free'}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">{option.email}</div>
                      </button>
                    ))}
                  </div>
                )}

                {ownerSearch.length >= 2 && !isSearching && ownerOptions.length === 0 && (
                  <p className="mt-2 text-sm text-gray-500">
                    No available users found. Users who are already in a group cannot be selected.
                  </p>
                )}
              </>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            The owner will be automatically added as the first member of the group.
          </p>
        </div>

        {/* Subscription Type */}
        <div className="mb-6">
          <label htmlFor="subscription_type" className="block text-sm font-medium text-gray-700 mb-2">
            Subscription Plan *
          </label>
          <select
            id="subscription_type"
            value={subscriptionType}
            onChange={(e) => setSubscriptionType(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="professional_monthly">Professional Monthly (1,500 credits, 3 users)</option>
            <option value="professional_annual">Professional Annual (1,500 credits, 3 users)</option>
            <option value="business_monthly">Business Monthly (7,500 credits, 10 users)</option>
            <option value="business_annual">Business Annual (7,500 credits, 10 users)</option>
            <option value="enterprise_monthly">Enterprise Monthly (50,000 credits, unlimited users)</option>
            <option value="enterprise_annual">Enterprise Annual (50,000 credits, unlimited users)</option>
          </select>
        </div>

        {/* Document Visibility */}
        <div className="mb-6">
          <label htmlFor="document_visibility" className="block text-sm font-medium text-gray-700 mb-2">
            Document Visibility
          </label>
          <select
            id="document_visibility"
            value={documentVisibility}
            onChange={(e) => setDocumentVisibility(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="shared">Shared - All members can see group documents</option>
            <option value="private">Private - Members can only see their own documents</option>
          </select>
          <p className="mt-2 text-xs text-gray-500">
            This controls whether group members can view documents created by other members.
          </p>
        </div>

        {/* Initial Credits Override */}
        <div className="mb-6">
          <label htmlFor="initial_credits" className="block text-sm font-medium text-gray-700 mb-2">
            Initial Credits (Optional Override)
          </label>
          <input
            type="number"
            id="initial_credits"
            value={initialCredits}
            onChange={(e) => setInitialCredits(e.target.value)}
            placeholder="Leave empty to use plan default"
            min="0"
            max="100000"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-2 text-xs text-gray-500">
            Override the default credit allocation from the plan. Leave empty to use the plan default.
          </p>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
          <Link
            href="/admin/groups"
            className="px-6 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || !selectedOwner}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </form>
    </div>
  );
}

// Loading fallback
function CreateGroupLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    </div>
  );
}

export default function CreateGroupPage() {
  return (
    <Suspense fallback={<CreateGroupLoading />}>
      <CreateGroupContent />
    </Suspense>
  );
}
