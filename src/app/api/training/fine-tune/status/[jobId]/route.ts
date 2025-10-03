/**
 * GET /api/training/fine-tune/status/[jobId]
 * Check fine-tuning job status and update from OpenAI
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, FineTuningStatusResponse } from '@/lib/types';
import { updateFineTuningJobStatus } from '@/lib/fine-tuning';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    console.log(`Checking fine-tuning job status: ${jobId}`);

    if (!jobId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Job ID is required'
      }, { status: 400 });
    }

    // Update job status from OpenAI and get latest data
    const job = await updateFineTuningJobStatus(jobId);

    // Calculate progress estimation
    let progress: any = undefined;
    if (job.status === 'running') {
      progress = {
        current_step: 'Training model',
        percentage: 50, // Approximate - OpenAI doesn't provide exact progress
        estimated_completion: 'Typically 10-30 minutes'
      };
    } else if (job.status === 'uploading') {
      progress = {
        current_step: 'Uploading training data',
        percentage: 25,
        estimated_completion: 'A few minutes'
      };
    } else if (job.status === 'succeeded') {
      progress = {
        current_step: 'Completed',
        percentage: 100,
        estimated_completion: 'Completed'
      };
    }

    const response: ApiResponse<FineTuningStatusResponse> = {
      success: true,
      data: {
        success: true,
        job,
        progress
      },
      message: `Job status: ${job.status}`
    };

    console.log(`Job ${jobId} status: ${job.status}`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('Fine-tuning status check error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to check job status';

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
