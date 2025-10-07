/**
 * POST /api/training/export
 * Export training data to OpenAI JSONL format
 */

import { NextRequest, NextResponse } from 'next/server';
import type {
  ApiResponse,
  ExportTrainingDataRequest,
  ExportTrainingDataResponse,
  DocumentType
} from '@/lib/types';
import { isValidDocumentType } from '@/lib/training-utils';
import { exportTrainingData, createTrainingRun, getTrainingDataStats } from '@/lib/openai-export';

export async function POST(request: NextRequest) {
  try {
    console.log('Training data export request received');

    const body: ExportTrainingDataRequest = await request.json();
    const { document_type, dataset_split } = body;

    // Validate document type
    if (!document_type || !isValidDocumentType(document_type)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Valid document type is required'
      }, { status: 400 });
    }

    console.log(`Exporting training data for: ${document_type}`);

    // Get training data statistics
    const stats = await getTrainingDataStats(document_type);

    // Check if minimum examples are met (OpenAI minimum is 10, temporarily lowered to 5)
    if (stats.total_verified < 5) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: `Insufficient training data. Have ${stats.total_verified} verified documents, need at least 5 for OpenAI fine-tuning.`
      }, { status: 400 });
    }

    console.log(`Training data stats:`, stats);

    // Export to JSONL format
    const exportResult = await exportTrainingData(document_type);

    // Create training run record
    await createTrainingRun({
      document_type,
      total_examples: stats.total_verified,
      train_examples: exportResult.train_examples,
      validation_examples: exportResult.validation_examples,
      export_file_path: exportResult.train_file_path || exportResult.validation_file_path,
      created_by: 'system',
      notes: `Exported ${stats.total_verified} verified documents (train: ${exportResult.train_examples}, validation: ${exportResult.validation_examples})`
    });

    const response: ApiResponse<ExportTrainingDataResponse> = {
      success: true,
      data: {
        success: true,
        train_file_url: exportResult.train_file_path,
        validation_file_url: exportResult.validation_file_path,
        train_examples: exportResult.train_examples,
        validation_examples: exportResult.validation_examples,
        message: `Successfully exported ${stats.total_verified} training examples`
      },
      message: `Training data exported successfully for ${document_type}`
    };

    console.log(`Export completed: ${exportResult.train_examples} train, ${exportResult.validation_examples} validation`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('Training data export error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Export failed';

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
