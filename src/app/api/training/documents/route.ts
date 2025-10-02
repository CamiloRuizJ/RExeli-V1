/**
 * GET /api/training/documents
 * Query training documents with filters and pagination
 */

import { NextRequest, NextResponse } from 'next/server';
import type {
  ApiResponse,
  TrainingDocumentsQuery,
  TrainingDocumentsResponse,
  DocumentType,
  ProcessingStatus,
  VerificationStatus,
  DatasetSplit
} from '@/lib/types';
import { queryTrainingDocuments, isValidDocumentType } from '@/lib/training-utils';

export async function GET(request: NextRequest) {
  try {
    console.log('Training documents query received');

    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const query: TrainingDocumentsQuery = {};

    const documentType = searchParams.get('document_type');
    if (documentType) {
      if (!isValidDocumentType(documentType)) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Invalid document type'
        }, { status: 400 });
      }
      query.document_type = documentType as DocumentType;
    }

    const processingStatus = searchParams.get('processing_status');
    if (processingStatus) {
      query.processing_status = processingStatus as ProcessingStatus;
    }

    const verificationStatus = searchParams.get('verification_status');
    if (verificationStatus) {
      query.verification_status = verificationStatus as VerificationStatus;
    }

    const datasetSplit = searchParams.get('dataset_split');
    if (datasetSplit) {
      query.dataset_split = datasetSplit as DatasetSplit;
    }

    const isVerified = searchParams.get('is_verified');
    if (isVerified !== null) {
      query.is_verified = isVerified === 'true';
    }

    const includeInTraining = searchParams.get('include_in_training');
    if (includeInTraining !== null) {
      query.include_in_training = includeInTraining === 'true';
    }

    const limit = searchParams.get('limit');
    if (limit) {
      query.limit = parseInt(limit, 10);
    }

    const offset = searchParams.get('offset');
    if (offset) {
      query.offset = parseInt(offset, 10);
    }

    console.log('Query parameters:', query);

    // Query documents
    const { documents, total } = await queryTrainingDocuments(query);

    const response: ApiResponse<TrainingDocumentsResponse> = {
      success: true,
      data: {
        success: true,
        documents,
        total,
        limit: query.limit || 50,
        offset: query.offset || 0
      },
      message: `Found ${documents.length} documents (${total} total)`
    };

    console.log(`Query returned ${documents.length} documents`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('Training documents query error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Query failed';

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
