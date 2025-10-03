/**
 * POST /api/training/fine-tune/deploy/[jobId]
 * Deploy a completed fine-tuned model
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, DeployModelRequest, DeployModelResponse } from '@/lib/types';
import { deployFineTunedModel } from '@/lib/fine-tuning';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    console.log(`Deploying fine-tuned model from job: ${jobId}`);

    if (!jobId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Job ID is required'
      }, { status: 400 });
    }

    const body: DeployModelRequest = await request.json().catch(() => ({}));
    const { deployment_status, traffic_percentage, notes } = body;

    // Validate deployment_status if provided
    if (deployment_status && !['testing', 'active', 'inactive', 'archived'].includes(deployment_status)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Invalid deployment_status. Must be: testing, active, inactive, or archived'
      }, { status: 400 });
    }

    // Validate traffic_percentage if provided
    if (traffic_percentage !== undefined && (traffic_percentage < 0 || traffic_percentage > 100)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'traffic_percentage must be between 0 and 100'
      }, { status: 400 });
    }

    // Deploy the model
    const modelVersion = await deployFineTunedModel({
      job_id: jobId,
      deployment_status: (deployment_status || 'active') as 'testing' | 'active',
      traffic_percentage: traffic_percentage || 100,
      notes
    });

    const response: ApiResponse<DeployModelResponse> = {
      success: true,
      data: {
        success: true,
        model_version: modelVersion,
        message: `Model deployed successfully. Version: ${modelVersion.version_number}, Status: ${modelVersion.deployment_status}`
      },
      message: 'Fine-tuned model deployed and ready for use'
    };

    console.log(`Model deployed: ${modelVersion.model_id}, Version: ${modelVersion.version_number}`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('Model deployment error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to deploy model';

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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
