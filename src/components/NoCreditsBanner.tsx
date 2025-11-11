'use client';

/**
 * No Credits Banner Component
 * Shows when user has 0 credits remaining
 */

import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

interface NoCreditsBannerProps {
  remainingCredits?: number;
  className?: string;
}

export function NoCreditsBanner({ remainingCredits = 0, className = '' }: NoCreditsBannerProps) {
  // Only show if credits are exactly 0
  if (remainingCredits > 0) {
    return null;
  }

  return (
    <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start">
        <AlertCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-red-900 font-semibold mb-1">No Credits Remaining</h3>
          <p className="text-red-800 text-sm mb-3">
            You've used all your credits. Purchase more credits or upgrade your plan to continue processing documents.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/pricing"
              className="inline-block px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition-colors"
            >
              View Pricing Plans
            </Link>
            <Link
              href="/dashboard/usage"
              className="inline-block px-4 py-2 bg-white text-red-600 border border-red-300 rounded-lg hover:bg-red-50 text-sm font-medium transition-colors"
            >
              View Usage History
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
