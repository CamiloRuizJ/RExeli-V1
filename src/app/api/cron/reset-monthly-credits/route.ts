/**
 * Cron Job: Reset Monthly Credits
 * POST /api/cron/reset-monthly-credits
 *
 * Resets credits for users whose billing cycle has ended
 * Should be triggered daily by Vercel Cron
 *
 * Vercel Cron Configuration (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/reset-monthly-credits",
 *     "schedule": "0 0 * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { resetMonthlyCredits } from '@/lib/subscriptionManager';

export async function POST(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    // In production, you should verify the Authorization header from Vercel Cron
    const authHeader = request.headers.get('authorization');

    // For Vercel Cron, check if this is from Vercel's internal system
    // In development, allow without auth check
    if (process.env.NODE_ENV === 'production') {
      const cronSecret = process.env.CRON_SECRET;
      if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        console.error('[CRON] Unauthorized reset-monthly-credits attempt');
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    console.log('[CRON] Starting monthly credit reset job...');
    const startTime = Date.now();

    // Reset credits for users whose billing cycle has ended
    const result = await resetMonthlyCredits();

    const duration = Date.now() - startTime;

    if (!result.success) {
      console.error('[CRON] Monthly credit reset failed:', result.message);
      return NextResponse.json({
        success: false,
        error: result.message,
        duration,
      }, { status: 500 });
    }

    console.log(`[CRON] Monthly credit reset completed: ${result.usersReset} users reset in ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: result.message,
      usersReset: result.usersReset,
      duration,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[CRON] Error in reset-monthly-credits:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error during credit reset',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// Allow GET for manual testing in development
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'GET method only available in development' },
      { status: 405 }
    );
  }

  console.log('[CRON] Manual trigger of reset-monthly-credits (development)');
  return POST(request);
}
