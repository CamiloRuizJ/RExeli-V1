/**
 * User Documents History Page
 * Shows all processed documents with ability to re-download
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { FileText, Download, ArrowLeft } from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getUserDocuments(userId: string, documentType?: string) {
  let query = supabase
    .from('user_documents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (documentType && documentType !== 'all') {
    query = query.eq('document_type', documentType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching documents:', error);
    return [];
  }

  return data || [];
}

async function getDocumentStats(userId: string) {
  const { data, error } = await supabase
    .from('user_documents')
    .select('page_count, credits_used, processing_status')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching document stats:', error);
    return {
      totalDocuments: 0,
      totalPages: 0,
      totalCreditsUsed: 0,
      completedDocuments: 0,
    };
  }

  return {
    totalDocuments: data.length,
    totalPages: data.reduce((sum, doc) => sum + (doc.page_count || 0), 0),
    totalCreditsUsed: data.reduce((sum, doc) => sum + (doc.credits_used || 0), 0),
    completedDocuments: data.filter(doc => doc.processing_status === 'completed').length,
  };
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const session = await auth();

  // Require authentication
  if (!session) {
    redirect('/auth/signin?callbackUrl=/dashboard/documents');
  }

  const userId = session.user.id;
  const [documents, stats] = await Promise.all([
    getUserDocuments(userId, searchParams.type),
    getDocumentStats(userId),
  ]);

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

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">My Documents</h1>
        <p className="text-gray-600 mt-2">
          View and download all your processed documents
        </p>
      </div>

      {/* Statistics */}
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

      {/* Filter */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <form className="flex items-center gap-4">
          <label htmlFor="type" className="text-sm font-medium text-gray-700">
            Filter by type:
          </label>
          <select
            id="type"
            name="type"
            defaultValue={searchParams.type || 'all'}
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
            {searchParams.type && searchParams.type !== 'all'
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
                {documents.map((doc: any) => (
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
