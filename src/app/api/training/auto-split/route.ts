/**
 * POST /api/training/auto-split
 * Automatically assign train/validation split (80/20)
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, AutoSplitRequest, AutoSplitResponse, DocumentType } from '@/lib/types';
import { autoAssignDatasetSplit, isValidDocumentType } from '@/lib/training-utils';

export async function POST(request: NextRequest) {
  try {
    console.log('Auto-split request received');

    const body: AutoSplitRequest = await request.json();
    const { document_type, train_percentage } = body;

    // Validate document type if provided
    if (document_type && !isValidDocumentType(document_type)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Invalid document type'
      }, { status: 400 });
    }

    // Validate train percentage
    const trainPct = train_percentage || 80;
    if (trainPct < 50 || trainPct > 95) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Train percentage must be between 50 and 95'
      }, { status: 400 });
    }

    console.log(`Auto-splitting with ${trainPct}% train for ${document_type || 'all types'}`);

    // Perform auto-split
    const splits = await autoAssignDatasetSplit(
      document_type as DocumentType | undefined,
      trainPct
    );

    const response: ApiResponse<AutoSplitResponse> = {
      success: true,
      data: {
        success: true,
        splits,
        message: `Dataset split assigned: ${trainPct}% train, ${100 - trainPct}% validation`
      },
      message: `Successfully split ${splits.length} document types`
    };

    console.log(`Auto-split completed for ${splits.length} document types`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('Auto-split error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Auto-split failed';

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
