'use client';

/**
 * Deactivate User Button Component
 * Client component for admin to soft delete (deactivate) user account
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface DeactivateUserButtonProps {
  userId: string;
  isActive: boolean;
  userName: string;
}

export function DeactivateUserButton({ userId, isActive, userName }: DeactivateUserButtonProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleToggleStatus = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_active: !isActive,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user status');
      }

      // Refresh the page to show updated data
      router.refresh();
      setShowConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user status. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isActive) {
    return (
      <>
        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Deactivate Account
          </button>
        ) : (
          <div className="space-y-3">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800 font-medium mb-2">
                Are you sure you want to deactivate this account?
              </p>
              <p className="text-xs text-red-700">
                User "{userName}" will no longer be able to process documents. This action can be
                reversed.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleToggleStatus}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Deactivating...' : 'Yes, Deactivate'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </>
    );
  } else {
    return (
      <div className="space-y-3">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-800">
            This account is currently deactivated. Click below to reactivate it.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <button
          onClick={handleToggleStatus}
          disabled={isLoading}
          className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Reactivating...' : 'Reactivate Account'}
        </button>
      </div>
    );
  }
}
