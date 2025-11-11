/**
 * Admin User Detail Page
 * View and manage individual user account
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { AddCreditsForm } from './AddCreditsForm';
import { AssignPlanForm } from './AssignPlanForm';
import { DeactivateUserButton } from './DeactivateUserButton';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface UserDetail {
  id: string;
  email: string;
  name: string;
  credits: number;
  subscription_type: string;
  subscription_status: string;
  monthly_usage: number;
  lifetime_usage: number;
  billing_cycle_start: string | null;
  billing_cycle_end: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

async function getUserById(userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user:', error);
    return null;
  }

  return data as UserDetail;
}

async function getCreditTransactions(userId: string) {
  const { data, error } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }

  return data;
}

async function getUsageLogs(userId: string) {
  const { data, error } = await supabase
    .from('usage_logs')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error fetching usage logs:', error);
    return [];
  }

  return data;
}

async function getUserDocuments(userId: string) {
  const { data, error } = await supabase
    .from('user_documents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error fetching documents:', error);
    return [];
  }

  return data;
}

async function getSubscriptionHistory(userId: string) {
  const { data, error } = await supabase
    .from('subscription_history')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false });

  if (error) {
    console.error('Error fetching subscription history:', error);
    return [];
  }

  return data;
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();

  // Require authentication
  if (!session) {
    redirect('/auth/signin?callbackUrl=/admin/users/' + params.id);
  }

  // Require admin role
  if (session.user.role !== 'admin') {
    redirect('/dashboard');
  }

  const user = await getUserById(params.id);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-red-900 mb-2">User Not Found</h2>
          <p className="text-red-700 mb-4">
            The user you're looking for doesn't exist or has been deleted.
          </p>
          <Link
            href="/admin/users"
            className="inline-block px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            ← Back to Users
          </Link>
        </div>
      </div>
    );
  }

  const [transactions, usageLogs, documents, subscriptionHistory] = await Promise.all([
    getCreditTransactions(params.id),
    getUsageLogs(params.id),
    getUserDocuments(params.id),
    getSubscriptionHistory(params.id),
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{user.name || 'Unknown User'}</h1>
            <p className="text-gray-600 mt-1">{user.email}</p>
          </div>
          <Link
            href="/admin/users"
            className="px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ← Back to Users
          </Link>
        </div>

        {/* Status Banner */}
        {!user.is_active && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-red-600 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-red-800 font-medium">
                This account has been deactivated and cannot process documents.
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - User Info and Actions */}
        <div className="lg:col-span-1 space-y-6">
          {/* User Overview Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Overview</h2>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-500 uppercase">Current Credits</div>
                <div className="text-2xl font-bold text-blue-600">
                  {user.credits.toLocaleString()}
                </div>
              </div>
              <div className="pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-500 uppercase">Subscription</div>
                <div className="text-sm font-medium text-gray-900">
                  {user.subscription_type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </div>
                <div
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${
                    user.subscription_status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : user.subscription_status === 'cancelled'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {user.subscription_status}
                </div>
              </div>
              <div className="pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-500 uppercase">Monthly Usage</div>
                <div className="text-sm font-medium text-gray-900">
                  {user.monthly_usage.toLocaleString()} pages
                </div>
              </div>
              <div className="pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-500 uppercase">Lifetime Usage</div>
                <div className="text-sm font-medium text-gray-900">
                  {user.lifetime_usage.toLocaleString()} pages
                </div>
              </div>
              {user.billing_cycle_end && (
                <div className="pt-3 border-t border-gray-200">
                  <div className="text-xs text-gray-500 uppercase">Billing Cycle Ends</div>
                  <div className="text-sm font-medium text-gray-900">
                    {new Date(user.billing_cycle_end).toLocaleDateString()}
                  </div>
                </div>
              )}
              <div className="pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-500 uppercase">Account Status</div>
                <div
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${
                    user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}
                >
                  {user.is_active ? 'Active' : 'Inactive'}
                </div>
              </div>
              <div className="pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-500 uppercase">Member Since</div>
                <div className="text-sm font-medium text-gray-900">
                  {new Date(user.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>

          {/* Add Credits Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Credits</h2>
            <AddCreditsForm userId={user.id} adminId={session.user.id} />
          </div>

          {/* Assign Plan Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Assign Plan</h2>
            <AssignPlanForm userId={user.id} adminId={session.user.id} currentPlan={user.subscription_type} />
          </div>

          {/* Deactivate Account */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Actions</h2>
            <DeactivateUserButton userId={user.id} isActive={user.is_active} userName={user.name || user.email} />
          </div>
        </div>

        {/* Right Column - Activity Tables */}
        <div className="lg:col-span-2 space-y-6">
          {/* Credit Transactions */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Credit Transactions</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                        No credit transactions yet.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((txn: any) => (
                      <tr key={txn.id}>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {new Date(txn.timestamp).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm">
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
                        <td className="px-6 py-4 text-sm font-medium">
                          <span className={txn.amount > 0 ? 'text-green-600' : 'text-red-600'}>
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

          {/* Usage Logs */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Recent Usage</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Document
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Pages
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {usageLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                        No usage history yet.
                      </td>
                    </tr>
                  ) : (
                    usageLogs.map((log: any) => (
                      <tr key={log.id}>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {new Date(log.timestamp).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="font-medium">{log.document_type?.replace(/_/g, ' ')}</div>
                          <div className="text-xs text-gray-500">{log.file_name}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{log.page_count}</td>
                        <td className="px-6 py-4 text-sm">
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
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* User Documents */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Processed Documents</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      File Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Pages
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Credits
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {documents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        No processed documents yet.
                      </td>
                    </tr>
                  ) : (
                    documents.map((doc: any) => (
                      <tr key={doc.id}>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{doc.file_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {doc.document_type?.replace(/_/g, ' ')}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{doc.page_count}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{doc.credits_used}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Subscription History */}
          {subscriptionHistory.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Subscription History</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Plan
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Started
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Ended
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {subscriptionHistory.map((sub: any) => (
                      <tr key={sub.id}>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {sub.plan_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {new Date(sub.started_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {sub.ended_at ? new Date(sub.ended_at).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              sub.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : sub.status === 'cancelled'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {sub.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
