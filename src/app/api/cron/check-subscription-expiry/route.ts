/**
 * Cron Job: Check Subscription Expiry
 * POST /api/cron/check-subscription-expiry
 *
 * Marks expired subscriptions as expired and clears remaining credits
 * Should be triggered daily by Vercel Cron
 *
 * Vercel Cron Configuration (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/check-subscription-expiry",
 *     "schedule": "0 1 * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkSubscriptionExpiry } from '@/lib/subscriptionManager';

export async function POST(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization');

    // For Vercel Cron, check if this is from Vercel's internal system
    // In development, allow without auth check
    if (process.env.NODE_ENV === 'production') {
      const cronSecret = process.env.CRON_SECRET;
      if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        console.error('[CRON] Unauthorized check-subscription-expiry attempt');
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    console.log('[CRON] Starting subscription expiry check job...');
    const startTime = Date.now();

    // Check and mark expired subscriptions
    const result = await checkSubscriptionExpiry();

    const duration = Date.now() - startTime;

    if (!result.success) {
      console.error('[CRON] Subscription expiry check failed:', result.message);
      return NextResponse.json({
        success: false,
        error: result.message,
        duration,
      }, { status: 500 });
    }

    console.log(`[CRON] Subscription expiry check completed: ${result.subscriptionsExpired} subscriptions expired in ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: result.message,
      subscriptionsExpired: result.subscriptionsExpired,
      duration,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[CRON] Error in check-subscription-expiry:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error during expiry check',
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

  console.log('[CRON] Manual trigger of check-subscription-expiry (development)');
  return POST(request);
}
