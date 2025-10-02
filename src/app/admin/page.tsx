/**
 * Admin Dashboard
 * Protected page requiring authentication
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import Link from 'next/link';

export default async function AdminPage() {
  const session = await auth();

  // Require authentication
  if (!session) {
    redirect('/auth/signin?callbackUrl=/admin');
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome, {session.user.name || session.user.email}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Training System */}
        <Link href="/admin/training" className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Training System</h2>
          <p className="text-gray-600 text-sm mb-4">Upload and manage training documents for AI model improvement.</p>
          <span className="text-blue-600 font-medium">Go to Training →</span>
        </Link>

        {/* User Management */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 opacity-60">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">User Management</h2>
          <p className="text-gray-600 text-sm mb-4">Manage user accounts, roles, and permissions.</p>
          <span className="text-gray-400 text-sm">Coming soon</span>
        </div>

        {/* System Analytics */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 opacity-60">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">System Analytics</h2>
          <p className="text-gray-600 text-sm mb-4">View system performance and usage statistics.</p>
          <span className="text-gray-400 text-sm">Coming soon</span>
        </div>
      </div>
    </div>
  );
}
