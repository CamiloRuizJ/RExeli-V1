/**
 * User Dashboard
 * Shows user's document history and extractions
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import Link from 'next/link';
import { FileText, Upload, Clock, CheckCircle } from 'lucide-react';

export default async function DashboardPage() {
  const session = await auth();

  // Require authentication
  if (!session) {
    redirect('/auth/signin?callbackUrl=/dashboard');
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome back, {session.user.name || session.user.email}</p>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/tool" className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-lg p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center space-x-3 mb-2">
              <Upload className="w-6 h-6" />
              <h3 className="text-xl font-semibold">Process Document</h3>
            </div>
            <p className="text-blue-100 text-sm">Upload and extract data from a new document</p>
          </Link>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-2">
              <FileText className="w-6 h-6 text-gray-600" />
              <h3 className="text-xl font-semibold text-gray-900">My Documents</h3>
            </div>
            <p className="text-gray-600 text-sm mb-3">View all your processed documents</p>
            <span className="text-gray-400 text-xs">Coming soon</span>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-2">
              <Clock className="w-6 h-6 text-gray-600" />
              <h3 className="text-xl font-semibold text-gray-900">Recent Activity</h3>
            </div>
            <p className="text-gray-600 text-sm mb-3">View your extraction history</p>
            <span className="text-gray-400 text-xs">Coming soon</span>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">Total Documents</span>
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">0</p>
            <p className="text-xs text-gray-500 mt-1">Coming soon</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">This Month</span>
              <Upload className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">0</p>
            <p className="text-xs text-gray-500 mt-1">Coming soon</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">Processed</span>
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">0</p>
            <p className="text-xs text-gray-500 mt-1">Coming soon</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">Success Rate</span>
              <CheckCircle className="w-5 h-5 text-indigo-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">-</p>
            <p className="text-xs text-gray-500 mt-1">Coming soon</p>
          </div>
        </div>
      </div>

      {/* Recent Documents */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Documents</h2>
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">No documents yet</p>
          <p className="text-gray-500 text-sm mb-4">Upload your first document to get started</p>
          <Link href="/tool" className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Upload className="w-4 h-4" />
            <span>Process Document</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
