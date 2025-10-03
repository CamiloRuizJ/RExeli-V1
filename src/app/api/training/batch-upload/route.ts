/**
 * POST /api/training/batch-upload
 * Upload multiple training documents at once
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, BatchUploadResponse, DocumentType } from '@/lib/types';
import {
  uploadTrainingFile,
  createTrainingDocument,
  isValidDocumentType
} from '@/lib/training-utils';

// Route segment config for larger payloads and longer execution
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    console.log('Batch upload request received');

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const documentType = formData.get('documentType') as string;
    const createdBy = formData.get('createdBy') as string | null;

    // Validation
    if (!files || files.length === 0) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'No files provided'
      }, { status: 400 });
    }

    if (!documentType || !isValidDocumentType(documentType)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Valid document type is required'
      }, { status: 400 });
    }

    console.log(`Processing ${files.length} files for document type: ${documentType}`);

    const documentIds: string[] = [];
    const errors: Array<{ filename: string; error: string }> = [];
    let uploaded = 0;
    let failed = 0;

    // Process each file
    for (const file of files) {
      try {
        console.log(`Processing file: ${file.name} (${file.size} bytes)`);

        // Validate file type
        const validTypes = ['application/pdf', 'image/png', 'image/jpeg'];
        if (!validTypes.includes(file.type)) {
          throw new Error(`Invalid file type: ${file.type}. Only PDF, PNG, and JPEG are supported.`);
        }

        // Validate file size (50MB max)
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxSize) {
          throw new Error(`File size exceeds 50MB limit`);
        }

        // Generate document ID
        const documentId = crypto.randomUUID();

        // Upload file to Supabase Storage
        const { path, url } = await uploadTrainingFile(
          file,
          documentType as DocumentType,
          documentId
        );

        // Create database record
        const document = await createTrainingDocument({
          file_path: path,
          file_name: file.name,
          file_url: url,
          file_size: file.size,
          file_type: file.type,
          document_type: documentType as DocumentType,
          created_by: createdBy || undefined
        });

        documentIds.push(document.id);
        uploaded++;
        console.log(`Successfully uploaded: ${file.name} (ID: ${document.id})`);

      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to upload ${file.name}:`, errorMessage);
        errors.push({
          filename: file.name,
          error: errorMessage
        });
      }
    }

    const response: ApiResponse<BatchUploadResponse> = {
      success: uploaded > 0,
      data: {
        success: uploaded > 0,
        uploaded,
        failed,
        documentIds,
        errors: errors.length > 0 ? errors : undefined
      },
      message: uploaded > 0
        ? `Successfully uploaded ${uploaded} of ${files.length} files`
        : 'Failed to upload any files'
    };

    console.log(`Batch upload completed: ${uploaded} success, ${failed} failed`);

    return NextResponse.json(response, {
      status: uploaded > 0 ? 200 : 400
    });

  } catch (error) {
    console.error('Batch upload error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Batch upload failed';

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
