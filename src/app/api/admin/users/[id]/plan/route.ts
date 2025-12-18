/**
 * Admin API: Assign Subscription Plan to User
 * POST /api/admin/users/[id]/plan
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-helpers';
import { assignSubscriptionPlan } from '@/lib/subscriptionManager';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Check admin authentication
    const session = await getSession();
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const body = await request.json();
    const { planType, adminId } = body;

    // Validate input
    if (!planType || typeof planType !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Plan type is required.' },
        { status: 400 }
      );
    }

    // Validate plan type
    const validPlans = [
      'free',
      'entrepreneur_monthly',
      'professional_monthly',
      'business_monthly',
      'entrepreneur_annual',
      'professional_annual',
      'business_annual',
      'one_time_entrepreneur',
      'one_time_professional',
      'one_time_business',
    ];

    if (!validPlans.includes(planType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid plan type.' },
        { status: 400 }
      );
    }

    // Assign plan using subscription manager
    const result = await assignSubscriptionPlan(
      id,
      planType,
      adminId || session.user.id
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 500 }
      );
    }

    console.log(`[ADMIN ACTION] Admin ${session.user.email} assigned ${planType} plan to user ${id}`);

    return NextResponse.json({
      success: true,
      message: result.message,
      credits: result.credits,
    });
  } catch (error) {
    console.error('Error assigning plan:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to assign plan. Please try again.' },
      { status: 500 }
    );
  }
}
