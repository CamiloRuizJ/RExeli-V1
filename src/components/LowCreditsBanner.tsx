'use client';

/**
 * Low Credits Banner Component
 * Shows when user is running low on credits (< 50)
 */

import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

interface LowCreditsBannerProps {
  remainingCredits: number;
  threshold?: number;
  className?: string;
}

export function LowCreditsBanner({
  remainingCredits,
  threshold = 50,
  className = ''
}: LowCreditsBannerProps) {
  // Only show if credits are below threshold but not zero
  if (remainingCredits === 0 || remainingCredits >= threshold) {
    return null;
  }

  // Calculate severity level for styling
  const isCritical = remainingCredits < 10;
  const bgColor = isCritical ? 'bg-orange-50' : 'bg-yellow-50';
  const borderColor = isCritical ? 'border-orange-200' : 'border-yellow-200';
  const iconColor = isCritical ? 'text-orange-600' : 'text-yellow-600';
  const headingColor = isCritical ? 'text-orange-900' : 'text-yellow-900';
  const textColor = isCritical ? 'text-orange-800' : 'text-yellow-800';
  const buttonBg = isCritical ? 'bg-orange-600 hover:bg-orange-700' : 'bg-yellow-600 hover:bg-yellow-700';

  return (
    <div className={`${bgColor} border ${borderColor} rounded-lg p-4 ${className}`}>
      <div className="flex items-start">
        <AlertCircle className={`w-5 h-5 ${iconColor} mr-3 mt-0.5 flex-shrink-0`} />
        <div className="flex-1">
          <h3 className={`${headingColor} font-semibold mb-1`}>
            {isCritical ? 'Critical: Very Low Credits' : 'Low Credits'}
          </h3>
          <p className={`${textColor} text-sm mb-3`}>
            You have only <strong>{remainingCredits} credits</strong> remaining.
            {isCritical
              ? ' Your account is at risk of running out. Upgrade now to avoid interruptions.'
              : ' Consider upgrading your plan to avoid running out.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/pricing"
              className={`inline-block px-4 py-2 ${buttonBg} text-white rounded-lg text-sm font-medium transition-colors`}
            >
              Upgrade Plan
            </Link>
            <Link
              href="/dashboard"
              className={`inline-block px-4 py-2 bg-white ${textColor} border ${borderColor} rounded-lg hover:${bgColor} text-sm font-medium transition-colors`}
            >
              View Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
