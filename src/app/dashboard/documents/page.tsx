'use client';

/**
 * User Documents History Page
 * Shows all processed documents with ability to re-download
 * Client component with auto-refresh capability
 */

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FileText, Download, ArrowLeft, RefreshCw } from 'lucide-react';

interface Document {
  id: string;
  created_at: string;
  file_name: string;
  document_type: string;
  page_count: number;
  credits_used: number;
  processing_status: string;
}

interface DocumentStats {
  totalDocuments: number;
  totalPages: number;
  totalCreditsUsed: number;
  completedDocuments: number;
}

const documentTypes = [
  { value: 'all', label: 'All Documents' },
  { value: 'rent_roll', label: 'Rent Roll' },
  { value: 'operating_budget', label: 'Operating Budget' },
  { value: 'broker_sales_comparables', label: 'Sales Comparables' },
  { value: 'broker_lease_comparables', label: 'Lease Comparables' },
  { value: 'broker_listing', label: 'Broker Listing' },
  { value: 'offering_memo', label: 'Offering Memo' },
  { value: 'lease_agreement', label: 'Lease Agreement' },
  { value: 'financial_statements', label: 'Financial Statements' },
];

function DocumentsContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [stats, setStats] = useState<DocumentStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedType, setSelectedType] = useState(searchParams.get('type') || 'all');
  const [error, setError] = useState<string | null>(null);

  // Fetch documents data
  const fetchDocuments = useCallback(async (showRefreshing = false, type?: string) => {
    if (showRefreshing) {
      setIsRefreshing(true);
    }

    try {
      const typeParam = type || selectedType;
      const url = typeParam && typeParam !== 'all'
        ? `/api/user/documents?type=${typeParam}`
        : '/api/user/documents';

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }

      const data = await response.json();
      setDocuments(data.documents);
      setStats(data.stats);
      setError(null);
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError('Unable to load documents. Please try refreshing.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedType]);

  // Initial load and auth check
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin?callbackUrl=/dashboard/documents');
      return;
    }

    if (!loading && user) {
      fetchDocuments();
    }
  }, [loading, user, router, fetchDocuments]);

  // Auto-refresh every 10 seconds for faster updates
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      fetchDocuments(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [status, fetchDocuments]);

  // Handle filter change
  const handleFilterChange = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const type = formData.get('type') as string;
    setSelectedType(type);
    fetchDocuments(true, type);

    // Update URL without reload
    const params = new URLSearchParams();
    if (type && type !== 'all') {
      params.set('type', type);
    }
    router.push(`/dashboard/documents${params.toString() ? `?${params.toString()}` : ''}`);
  };

  // Manual refresh handler
  const handleRefresh = () => {
    fetchDocuments(true);
  };

  // Loading state
  if (loading || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading documents...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-blue-600 hover:text-blue-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-800">{error}</p>
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
            href="/dashboard"
            className="inline-flex items-center text-blue-600 hover:text-blue-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
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
        <h1 className="text-3xl font-bold text-gray-900">My Documents</h1>
        <p className="text-gray-600 mt-2">
          View and download all your processed documents
        </p>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-gray-600 text-sm mb-1">Total Documents</div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalDocuments}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-gray-600 text-sm mb-1">Completed</div>
            <div className="text-2xl font-bold text-green-600">{stats.completedDocuments}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-gray-600 text-sm mb-1">Total Pages</div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalPages.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-gray-600 text-sm mb-1">Credits Used</div>
            <div className="text-2xl font-bold text-blue-600">{stats.totalCreditsUsed.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <form onSubmit={handleFilterChange} className="flex items-center gap-4">
          <label htmlFor="type" className="text-sm font-medium text-gray-700">
            Filter by type:
          </label>
          <select
            id="type"
            name="type"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {documentTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Filter
          </button>
        </form>
      </div>

      {/* Documents Table */}
      {documents.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">No documents found</p>
          <p className="text-gray-500 text-sm mb-4">
            {selectedType && selectedType !== 'all'
              ? 'Try selecting a different document type'
              : 'Upload your first document to get started'}
          </p>
          <Link
            href="/tool"
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span>Process Document</span>
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    File Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Document Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pages
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
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(doc.created_at).toLocaleDateString()}
                      <div className="text-xs text-gray-500">
                        {new Date(doc.created_at).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 font-medium max-w-xs truncate">
                        {doc.file_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        ID: {doc.id.slice(0, 8)}...
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {doc.document_type
                        ?.replace(/_/g, ' ')
                        .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{doc.page_count}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{doc.credits_used}</td>
                    <td className="px-6 py-4">
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
                    <td className="px-6 py-4">
                      {doc.processing_status === 'completed' && (
                        <a
                          href={`/api/user/documents/${doc.id}/download`}
                          className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download className="w-4 h-4" />
                          <span>Download</span>
                        </a>
                      )}
                      {doc.processing_status === 'failed' && (
                        <span className="text-xs text-gray-500">Failed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Results Count */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing {documents.length} document{documents.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Loading fallback for Suspense
function DocumentsLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading documents...</p>
        </div>
      </div>
    </div>
  );
}

// Default export wraps content in Suspense for useSearchParams
export default function DocumentsPage() {
  return (
    <Suspense fallback={<DocumentsLoading />}>
      <DocumentsContent />
    </Suspense>
  );
}
