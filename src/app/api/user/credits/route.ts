/**
 * User API: Credit Information
 * GET /api/user/credits - Get user's credit balance and subscription info
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-helpers';
import { getUserCreditInfo } from '@/middleware/creditCheck';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Get credit information
    const creditInfo = await getUserCreditInfo(userId);

    if (!creditInfo) {
      return NextResponse.json(
        { success: false, error: 'Unable to fetch credit information' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: creditInfo,
    });
  } catch (error) {
    console.error('Error fetching credit info:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch credit information' },
      { status: 500 }
    );
  }
}
