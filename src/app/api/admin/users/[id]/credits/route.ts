/**
 * Admin API: Add Credits to User
 * POST /api/admin/users/[id]/credits
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-helpers';
import { addCreditsToUser } from '@/lib/subscriptionManager';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    console.log('[Admin Credits API] Request received');

    // Check admin authentication
    const session = await getSession();
    console.log('[Admin Credits API] Session:', session?.user?.email, 'Role:', session?.user?.role);

    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    console.log('[Admin Credits API] Target user ID:', id);

    const body = await request.json();
    console.log('[Admin Credits API] Request body:', body);

    const { amount, adminId, description } = body;

    // Validate input
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      console.log('[Admin Credits API] Invalid amount:', amount, typeof amount);
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

    // Determine admin ID - only use if it's a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const effectiveAdminId = adminId || session.user.id;
    const validAdminId = uuidRegex.test(effectiveAdminId) ? effectiveAdminId : undefined;

    console.log('[Admin Credits API] Calling addCreditsToUser with:', {
      userId: id,
      amount,
      adminId: validAdminId,
      originalAdminId: effectiveAdminId,
    });

    // Add credits using subscription manager
    const result = await addCreditsToUser(
      id,
      amount,
      'admin_add',
      validAdminId,
      description || `${amount} credits manually added by admin (by ${session.user.email})`
    );

    console.log('[Admin Credits API] Result:', result);

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
    console.error('[Admin Credits API] Exception:', error);
    return NextResponse.json(
      { success: false, error: `Failed to add credits: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
