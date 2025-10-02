/**
 * GET /api/training/metrics
 * Get training metrics for all document types
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, TrainingMetricsResponse } from '@/lib/types';
import { getTrainingMetrics, generateMetricsSummary } from '@/lib/training-utils';

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching training metrics');

    // Get metrics for all document types
    const metrics = await getTrainingMetrics();

    // Generate summary statistics
    const summary = generateMetricsSummary(metrics);

    const response: ApiResponse<TrainingMetricsResponse> = {
      success: true,
      data: {
        success: true,
        metrics,
        summary
      },
      message: `Training metrics for ${metrics.length} document types`
    };

    console.log(`Metrics retrieved: ${metrics.length} types`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('Training metrics error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch metrics';

    return NextResponse.json<ApiResponse>({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
