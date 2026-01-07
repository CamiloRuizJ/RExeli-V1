/**
 * Admin Dashboard
 * Protected page requiring authentication
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-helpers';
import Link from 'next/link';

export default async function AdminPage() {
  const session = await getSession();

  // Require authentication
  if (!session) {
    redirect('/auth/signin?callbackUrl=/admin');
  }

  // Require admin role
  if (session.user.role !== 'admin') {
    redirect('/dashboard');
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome, {session.user.name || session.user.email}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* User Management */}
        <Link href="/admin/users" className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">User Management</h2>
          <p className="text-gray-600 text-sm mb-4">Manage user accounts, credits, and subscriptions.</p>
          <span className="text-blue-600 font-medium">Manage Users →</span>
        </Link>

        {/* User Groups */}
        <Link href="/admin/groups" className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">User Groups</h2>
          <p className="text-gray-600 text-sm mb-4">Manage user groups with shared credit pools for multi-user packages.</p>
          <span className="text-blue-600 font-medium">Manage Groups →</span>
        </Link>

        {/* Payments & Billing */}
        <Link href="/admin/payments" className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Payments & Billing</h2>
          <p className="text-gray-600 text-sm mb-4">View payment history, revenue, and subscription stats.</p>
          <span className="text-blue-600 font-medium">View Payments →</span>
        </Link>

        {/* System Analytics */}
        <Link href="/admin/analytics" className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">System Analytics</h2>
          <p className="text-gray-600 text-sm mb-4">View platform usage statistics and user growth metrics.</p>
          <span className="text-blue-600 font-medium">View Analytics →</span>
        </Link>

        {/* Training System */}
        <Link href="/admin/training" className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Training System</h2>
          <p className="text-gray-600 text-sm mb-4">Upload and manage training documents for AI.</p>
          <span className="text-blue-600 font-medium">Manage Training →</span>
        </Link>
      </div>
    </div>
  );
}
