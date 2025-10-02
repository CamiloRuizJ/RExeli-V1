/**
 * Admin Dashboard - Training System Integration
 * Protected page requiring admin authentication
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import TrainingDashboard from '@/components/training/TrainingDashboard';

export default async function AdminPage() {
  const session = await auth();

  // Require authentication
  if (!session) {
    redirect('/auth/signin?callbackUrl=/admin');
  }

  // Require admin role
  if (session.user.role !== 'admin') {
    redirect('/');
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Training Data Collection & Management</p>
      </div>

      <TrainingDashboard />
    </div>
  );
}
