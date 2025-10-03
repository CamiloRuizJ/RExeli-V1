/**
 * POST /api/training/fine-tune/start
 * Start a fine-tuning job for a document type
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, StartFineTuningRequest, StartFineTuningResponse } from '@/lib/types';
import { startFineTuningJob } from '@/lib/fine-tuning';

export async function POST(request: NextRequest) {
  try {
    console.log('Starting fine-tuning job...');

    const body: StartFineTuningRequest = await request.json();
    const { document_type, hyperparameters, triggered_by, notes } = body;

    // Validate required fields
    if (!document_type) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'document_type is required'
      }, { status: 400 });
    }

    // Validate document type
    const validTypes = [
      'rent_roll',
      'operating_budget',
      'broker_sales_comparables',
      'broker_lease_comparables',
      'broker_listing',
      'offering_memo',
      'lease_agreement',
      'financial_statements'
    ];

    if (!validTypes.includes(document_type)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: `Invalid document_type. Must be one of: ${validTypes.join(', ')}`
      }, { status: 400 });
    }

    // Start fine-tuning job
    console.log(`Starting fine-tuning for document type: ${document_type}`);

    const job = await startFineTuningJob({
      document_type,
      hyperparameters,
      triggered_by: triggered_by || 'manual',
      notes
    });

    const response: ApiResponse<StartFineTuningResponse> = {
      success: true,
      data: {
        success: true,
        job,
        message: `Fine-tuning job started successfully. Job ID: ${job.id}`
      },
      message: 'Fine-tuning job created and submitted to OpenAI'
    };

    console.log(`Fine-tuning job started: ${job.id}, OpenAI job: ${job.openai_job_id}`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('Fine-tuning start error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to start fine-tuning';

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
