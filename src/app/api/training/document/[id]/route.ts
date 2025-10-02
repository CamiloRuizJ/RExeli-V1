/**
 * GET /api/training/document/[id]
 * Get single training document with edit history
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/types';
import { getTrainingDocument } from '@/lib/training-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`Fetching training document: ${id}`);

    const { document, editHistory } = await getTrainingDocument(id);

    const response: ApiResponse = {
      success: true,
      data: {
        document,
        editHistory,
        editCount: editHistory.length
      },
      message: 'Document retrieved successfully'
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Document fetch error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch document';

    return NextResponse.json<ApiResponse>({
      success: false,
      error: errorMessage
    }, { status: error instanceof Error && error.message.includes('not found') ? 404 : 500 });
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
