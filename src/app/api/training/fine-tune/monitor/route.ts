/**
 * GET /api/training/fine-tune/monitor
 * Monitor all active fine-tuning jobs and auto-deploy completed ones
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, MonitorJobsResponse } from '@/lib/types';
import { monitorActiveJobs } from '@/lib/fine-tuning';

export async function GET(request: NextRequest) {
  try {
    console.log('Monitoring active fine-tuning jobs...');

    // Monitor all active jobs
    const result = await monitorActiveJobs();

    const response: ApiResponse<MonitorJobsResponse> = {
      success: true,
      data: {
        success: true,
        active_jobs: result.updated_jobs,
        completed_count: result.completed,
        failed_count: result.failed,
        deployed_count: result.completed, // Assuming auto-deploy is enabled
        message: `Monitoring complete: ${result.completed} completed, ${result.failed} failed, ${result.still_running} still running`
      },
      message: `Checked ${result.updated_jobs.length} active jobs`
    };

    console.log(`Monitor result: ${result.completed} completed, ${result.failed} failed, ${result.still_running} running`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('Job monitoring error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to monitor jobs';

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
