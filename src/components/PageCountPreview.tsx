'use client';

/**
 * Page Count Preview Component
 * Shows page count and credit cost before document processing
 */

import { useState, useEffect } from 'react';
import { FileText, CreditCard, AlertTriangle, CheckCircle } from 'lucide-react';

interface PageCountPreviewProps {
  file: File | null;
  userCredits: number;
  onPageCountCalculated?: (pageCount: number) => void;
  className?: string;
}

export function PageCountPreview({
  file,
  userCredits,
  onPageCountCalculated,
  className = ''
}: PageCountPreviewProps) {
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPageCount(null);
      setError(null);
      return;
    }

    calculatePageCount();
  }, [file]);

  const calculatePageCount = async () => {
    if (!file) return;

    setIsCalculating(true);
    setError(null);

    try {
      // For images, always 1 page
      if (file.type.startsWith('image/')) {
        const count = 1;
        setPageCount(count);
        onPageCountCalculated?.(count);
        return;
      }

      // For PDFs, we need to count pages
      // Note: This is a client-side estimation. The server will do the actual count.
      if (file.type === 'application/pdf') {
        // We'll use a simple heuristic: PDF file size to estimate pages
        // Average PDF page is ~100KB, but this is just an estimate
        // The actual count will be done server-side
        const estimatedPages = Math.max(1, Math.ceil(file.size / 102400)); // ~100KB per page
        setPageCount(estimatedPages);
        onPageCountCalculated?.(estimatedPages);
      } else {
        setError('Unsupported file type');
      }
    } catch (err) {
      console.error('Error calculating page count:', err);
      setError('Unable to calculate page count');
    } finally {
      setIsCalculating(false);
    }
  };

  if (!file) {
    return null;
  }

  if (isCalculating) {
    return (
      <div className={`bg-blue-50 border border-blue-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
          <p className="text-blue-800 text-sm">Analyzing document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-start">
          <AlertTriangle className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-red-800 text-sm font-medium">Error</p>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (pageCount === null) {
    return null;
  }

  const creditsNeeded = pageCount;
  const hasEnoughCredits = userCredits >= creditsNeeded;
  const creditsShortage = Math.max(0, creditsNeeded - userCredits);

  return (
    <div
      className={`border rounded-lg p-4 ${
        hasEnoughCredits
          ? 'bg-green-50 border-green-200'
          : 'bg-red-50 border-red-200'
      } ${className}`}
    >
      <div className="space-y-3">
        {/* Page Count */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <FileText className={`w-5 h-5 mr-2 ${hasEnoughCredits ? 'text-green-600' : 'text-red-600'}`} />
            <span className={`text-sm font-medium ${hasEnoughCredits ? 'text-green-900' : 'text-red-900'}`}>
              Document Pages
            </span>
          </div>
          <span className={`text-lg font-bold ${hasEnoughCredits ? 'text-green-900' : 'text-red-900'}`}>
            {pageCount} {pageCount === 1 ? 'page' : 'pages'}
          </span>
        </div>

        {/* Credit Cost */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <CreditCard className={`w-5 h-5 mr-2 ${hasEnoughCredits ? 'text-green-600' : 'text-red-600'}`} />
            <span className={`text-sm font-medium ${hasEnoughCredits ? 'text-green-900' : 'text-red-900'}`}>
              Credits Needed
            </span>
          </div>
          <span className={`text-lg font-bold ${hasEnoughCredits ? 'text-green-900' : 'text-red-900'}`}>
            {creditsNeeded} {creditsNeeded === 1 ? 'credit' : 'credits'}
          </span>
        </div>

        {/* Divider */}
        <div className={`border-t ${hasEnoughCredits ? 'border-green-200' : 'border-red-200'}`}></div>

        {/* Status Message */}
        {hasEnoughCredits ? (
          <div className="flex items-start">
            <CheckCircle className="w-5 h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-green-900 text-sm font-medium">
                You have enough credits
              </p>
              <p className="text-green-700 text-xs">
                After processing: {userCredits - creditsNeeded} credits remaining
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-red-900 text-sm font-medium">
                Insufficient credits
              </p>
              <p className="text-red-700 text-xs">
                You need {creditsShortage} more {creditsShortage === 1 ? 'credit' : 'credits'} to process this document.
                You currently have {userCredits} {userCredits === 1 ? 'credit' : 'credits'}.
              </p>
            </div>
          </div>
        )}

        {/* Note about estimation for PDFs */}
        {file.type === 'application/pdf' && (
          <p className="text-xs text-gray-600 italic">
            Note: This is an estimated page count. The actual count will be calculated when you upload.
          </p>
        )}
      </div>
    </div>
  );
}
