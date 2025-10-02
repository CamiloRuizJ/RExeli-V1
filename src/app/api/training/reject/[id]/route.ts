/**
 * PATCH /api/training/reject/[id]
 * Reject training document (exclude from training)
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, RejectDocumentRequest, RejectDocumentResponse } from '@/lib/types';
import {
  supabase,
  createVerificationEdit,
  getTrainingDocument
} from '@/lib/training-utils';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`Rejecting training document: ${id}`);

    const body: RejectDocumentRequest = await request.json();
    const { rejection_reason, verified_by } = body;

    // Validate required fields
    if (!rejection_reason) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Rejection reason is required'
      }, { status: 400 });
    }

    // Get current document
    const { document: currentDocument } = await getTrainingDocument(id);

    // Update document status to rejected
    const { data: updatedDocument, error } = await supabase
      .from('training_documents')
      .update({
        verification_status: 'rejected',
        is_verified: false,
        include_in_training: false,
        verified_by: verified_by || 'system',
        verified_date: new Date().toISOString(),
        verification_notes: rejection_reason
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to reject document: ${error.message}`);
    }

    // Create verification edit record
    await createVerificationEdit({
      training_document_id: id,
      editor_id: verified_by || 'system',
      before_data: currentDocument.raw_extraction,
      after_data: undefined,
      changes_made: `Document rejected: ${rejection_reason}`,
      verification_action: 'reject'
    });

    const response: ApiResponse<RejectDocumentResponse> = {
      success: true,
      data: {
        success: true,
        document: updatedDocument,
        message: 'Document rejected successfully'
      },
      message: 'Document excluded from training'
    };

    console.log(`Document rejected successfully: ${id}`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('Document rejection error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Rejection failed';

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
      'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
