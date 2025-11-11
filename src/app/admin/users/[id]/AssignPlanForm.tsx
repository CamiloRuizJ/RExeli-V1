'use client';

/**
 * Assign Plan Form Component
 * Client component for admin to assign subscription plan to user
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AssignPlanFormProps {
  userId: string;
  adminId: string;
  currentPlan: string;
}

export function AssignPlanForm({ userId, adminId, currentPlan }: AssignPlanFormProps) {
  const router = useRouter();
  const [planType, setPlanType] = useState(currentPlan);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const plans = [
    { value: 'free', label: 'Free', credits: 0 },
    { value: 'entrepreneur_monthly', label: 'Entrepreneur Monthly', credits: 250 },
    { value: 'professional_monthly', label: 'Professional Monthly', credits: 1500 },
    { value: 'business_monthly', label: 'Business Monthly', credits: 7500 },
    { value: 'entrepreneur_annual', label: 'Entrepreneur Annual', credits: 250 },
    { value: 'professional_annual', label: 'Professional Annual', credits: 1500 },
    { value: 'business_annual', label: 'Business Annual', credits: 7500 },
    { value: 'one_time_entrepreneur', label: 'One-Time Entrepreneur', credits: 250 },
    { value: 'one_time_professional', label: 'One-Time Professional', credits: 1250 },
    { value: 'one_time_business', label: 'One-Time Business', credits: 6250 },
  ];

  const selectedPlan = plans.find((p) => p.value === planType);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/admin/users/${userId}/plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planType,
          adminId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to assign plan');
      }

      setSuccess(`Successfully assigned ${selectedPlan?.label} plan with ${data.credits} credits.`);

      // Refresh the page to show updated data
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign plan. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="planType" className="block text-sm font-medium text-gray-700 mb-1">
          Select Plan
        </label>
        <select
          id="planType"
          value={planType}
          onChange={(e) => setPlanType(e.target.value)}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
        >
          {plans.map((plan) => (
            <option key={plan.value} value={plan.value}>
              {plan.label} ({plan.credits.toLocaleString()} credits)
            </option>
          ))}
        </select>
      </div>

      {selectedPlan && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            This will set the user's subscription to <strong>{selectedPlan.label}</strong> and give
            them <strong>{selectedPlan.credits.toLocaleString()} credits</strong>.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || planType === currentPlan}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? 'Assigning Plan...' : 'Assign Plan'}
      </button>

      {planType === currentPlan && (
        <p className="text-xs text-gray-500 text-center">
          This is the user's current plan. Select a different plan to make changes.
        </p>
      )}
    </form>
  );
}
