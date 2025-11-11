/**
 * User Usage Analytics Page
 * Shows detailed usage history and analytics
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { supabaseAdmin as supabase } from '@/lib/supabase';
import Link from 'next/link';
import { ArrowLeft, FileText, TrendingUp, Clock, CheckCircle, XCircle } from 'lucide-react';

async function getUsageLogs(userId: string) {
  const { data, error } = await supabase
    .from('usage_logs')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching usage logs:', error);
    return [];
  }

  return data || [];
}

async function getCreditTransactions(userId: string) {
  const { data, error } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(30);

  if (error) {
    console.error('Error fetching credit transactions:', error);
    return [];
  }

  return data || [];
}

async function getUsageStats(userId: string) {
  const { data: logs } = await supabase
    .from('usage_logs')
    .select('processing_status, page_count, credits_used, timestamp')
    .eq('user_id', userId);

  if (!logs) {
    return {
      totalProcessed: 0,
      successfulProcessing: 0,
      failedProcessing: 0,
      totalPages: 0,
      totalCreditsUsed: 0,
      successRate: 0,
      avgPagesPerDoc: 0,
    };
  }

  const totalProcessed = logs.length;
  const successfulProcessing = logs.filter(log => log.processing_status === 'success').length;
  const failedProcessing = logs.filter(log => log.processing_status === 'failed').length;
  const totalPages = logs.reduce((sum, log) => sum + (log.page_count || 0), 0);
  const totalCreditsUsed = logs.reduce((sum, log) => sum + (log.credits_used || 0), 0);
  const successRate = totalProcessed > 0 ? Math.round((successfulProcessing / totalProcessed) * 100) : 0;
  const avgPagesPerDoc = totalProcessed > 0 ? Math.round(totalPages / totalProcessed) : 0;

  return {
    totalProcessed,
    successfulProcessing,
    failedProcessing,
    totalPages,
    totalCreditsUsed,
    successRate,
    avgPagesPerDoc,
  };
}

export default async function UsageAnalyticsPage() {
  const session = await auth();

  // Require authentication
  if (!session) {
    redirect('/auth/signin?callbackUrl=/dashboard/usage');
  }

  const userId = session.user.id;
  const [usageLogs, creditTransactions, stats] = await Promise.all([
    getUsageLogs(userId),
    getCreditTransactions(userId),
    getUsageStats(userId),
  ]);

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
        <h1 className="text-3xl font-bold text-gray-900">Usage Analytics</h1>
        <p className="text-gray-600 mt-2">
          Detailed history of your document processing and credit usage
        </p>
      </div>

      {/* Statistics Overview */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Overview Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">Total Processed</span>
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.totalProcessed}</p>
            <p className="text-xs text-gray-500 mt-1">documents</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">Success Rate</span>
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-600">{stats.successRate}%</p>
            <p className="text-xs text-gray-500 mt-1">
              {stats.successfulProcessing} of {stats.totalProcessed}
            </p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">Total Pages</span>
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.totalPages.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">
              Avg: {stats.avgPagesPerDoc} per doc
            </p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">Credits Used</span>
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-3xl font-bold text-orange-600">{stats.totalCreditsUsed.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">all time</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Processing Activity */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Processing Activity</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-gray-900">Successful</span>
              </div>
              <span className="text-lg font-bold text-green-600">{stats.successfulProcessing}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <XCircle className="w-5 h-5 text-red-600" />
                <span className="text-sm font-medium text-gray-900">Failed</span>
              </div>
              <span className="text-lg font-bold text-red-600">{stats.failedProcessing}</span>
            </div>
          </div>
        </div>

        {/* Credit Usage */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Credit Usage</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Credits Used</span>
              <span className="text-lg font-bold text-gray-900">
                {stats.totalCreditsUsed.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Pages Processed</span>
              <span className="text-lg font-bold text-gray-900">
                {stats.totalPages.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-gray-200">
              <span className="text-sm text-gray-600">Average per Document</span>
              <span className="text-lg font-bold text-blue-600">
                {stats.avgPagesPerDoc} pages
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Processing History */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Processing History</h2>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Document
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
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {usageLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      No processing history yet
                    </td>
                  </tr>
                ) : (
                  usageLogs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {new Date(log.timestamp).toLocaleDateString()}
                        <div className="text-xs text-gray-500">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {log.document_type?.replace(/_/g, ' ')}
                        </div>
                        <div className="text-xs text-gray-500 max-w-xs truncate">
                          {log.file_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{log.page_count}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{log.credits_used}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            log.processing_status === 'success'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {log.processing_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {log.processing_time_ms
                          ? `${(log.processing_time_ms / 1000).toFixed(1)}s`
                          : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Credit Transactions */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Credit Transaction History</h2>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {creditTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      No credit transactions yet
                    </td>
                  </tr>
                ) : (
                  creditTransactions.map((txn: any) => (
                    <tr key={txn.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {new Date(txn.timestamp).toLocaleDateString()}
                        <div className="text-xs text-gray-500">
                          {new Date(txn.timestamp).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            txn.amount > 0
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {txn.transaction_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-sm font-semibold ${
                            txn.amount > 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {txn.amount > 0 ? '+' : ''}
                          {txn.amount.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{txn.description}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
