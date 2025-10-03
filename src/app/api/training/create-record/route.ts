/**
 * POST /api/training/create-record
 * Create a training document database record (without file upload)
 * Used in conjunction with /api/upload for individual file uploads
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, DocumentType, TrainingDocument } from '@/lib/types';
import { createTrainingDocument, isValidDocumentType } from '@/lib/training-utils';

export async function POST(request: NextRequest) {
  try {
    console.log('Create training record request received');

    const body = await request.json();
    const {
      file_path,
      file_name,
      file_url,
      file_size,
      file_type,
      document_type,
      created_by
    } = body;

    // Validation
    if (!file_path || !file_name || !file_url) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Missing required fields: file_path, file_name, file_url'
      }, { status: 400 });
    }

    if (!document_type || !isValidDocumentType(document_type)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Valid document type is required'
      }, { status: 400 });
    }

    if (typeof file_size !== 'number' || file_size <= 0) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Valid file size is required'
      }, { status: 400 });
    }

    console.log(`Creating training document record: ${file_name}`);

    // Create database record
    const document = await createTrainingDocument({
      file_path,
      file_name,
      file_url,
      file_size,
      file_type: file_type || 'application/pdf',
      document_type: document_type as DocumentType,
      created_by: created_by || undefined
    });

    console.log(`Training document record created: ${document.id}`);

    const response: ApiResponse<{ document: TrainingDocument }> = {
      success: true,
      data: { document },
      message: 'Training document record created successfully'
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Create training record error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to create training record';

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
