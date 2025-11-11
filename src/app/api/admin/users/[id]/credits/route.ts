/**
 * Admin API: Add Credits to User
 * POST /api/admin/users/[id]/credits
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { addCreditsToUser } from '@/lib/subscriptionManager';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Check admin authentication
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const body = await request.json();
    const { amount, adminId, description } = body;

    // Validate input
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid credit amount. Must be a positive number.' },
        { status: 400 }
      );
    }

    if (amount > 100000) {
      return NextResponse.json(
        { success: false, error: 'Credit amount too large. Maximum is 100,000 credits per transaction.' },
        { status: 400 }
      );
    }

    // Add credits using subscription manager
    const result = await addCreditsToUser(
      id,
      amount,
      'admin_add',
      adminId || session.user.id,
      description || `${amount} credits manually added by admin`
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 500 }
      );
    }

    console.log(`[ADMIN ACTION] Admin ${session.user.email} added ${amount} credits to user ${id}`);

    return NextResponse.json({
      success: true,
      message: result.message,
      newBalance: result.newBalance,
    });
  } catch (error) {
    console.error('Error adding credits:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add credits. Please try again.' },
      { status: 500 }
    );
  }
}
