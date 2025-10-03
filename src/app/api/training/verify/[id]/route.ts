/**
 * PATCH /api/training/verify/[id]
 * Verify and update training document with corrected extraction
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, VerifyDocumentRequest, VerifyDocumentResponse } from '@/lib/types';
import {
  updateTrainingDocumentVerification,
  createVerificationEdit,
  getTrainingDocument,
  validateExtractionData,
  generateChangesSummary
} from '@/lib/training-utils';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`Verifying training document: ${id}`);

    const body: VerifyDocumentRequest = await request.json();
    const { verified_extraction, verification_notes, quality_score, verified_by } = body;

    // Validate required fields
    if (!verified_extraction) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Verified extraction data is required'
      }, { status: 400 });
    }

    if (quality_score === undefined || quality_score < 0 || quality_score > 1) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Quality score must be between 0 and 1'
      }, { status: 400 });
    }

    // Validate extraction data structure
    const validation = validateExtractionData(verified_extraction);
    if (!validation.valid) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: `Invalid extraction data: ${validation.errors.join(', ')}`
      }, { status: 400 });
    }

    // Get current document
    const { document: currentDocument } = await getTrainingDocument(id);

    // Update document with verified data
    const updatedDocument = await updateTrainingDocumentVerification(id, {
      verified_extraction,
      verification_status: 'verified',
      is_verified: true,
      verified_by: verified_by || 'system',
      verified_date: new Date().toISOString(),
      verification_notes,
      quality_score
    });

    // Create verification edit record
    const changesSummary = currentDocument.raw_extraction
      ? generateChangesSummary(currentDocument.raw_extraction, verified_extraction)
      : 'Initial verification';

    await createVerificationEdit({
      training_document_id: id,
      editor_id: verified_by || 'system',
      before_data: currentDocument.raw_extraction,
      after_data: verified_extraction,
      changes_made: changesSummary,
      verification_action: 'verify'
    });

    // Check if fine-tuning should be triggered
    let fineTuningTriggered = false;
    let fineTuningMessage = '';

    try {
      // Import fine-tuning utilities
      const { checkFineTuningTrigger, startFineTuningJob } = await import('@/lib/fine-tuning');

      // Check if we should trigger fine-tuning
      const triggerCheck = await checkFineTuningTrigger(updatedDocument.document_type);

      if (triggerCheck.should_trigger) {
        console.log(`Auto-triggering fine-tuning: ${triggerCheck.reason}`);

        // Start fine-tuning job
        const job = await startFineTuningJob({
          document_type: updatedDocument.document_type,
          triggered_by: 'auto',
          notes: `Auto-triggered at ${triggerCheck.current_count} verified documents`
        });

        fineTuningTriggered = true;
        fineTuningMessage = `Fine-tuning job started automatically (Job ID: ${job.id})`;

        console.log(`Fine-tuning auto-triggered: ${job.id}`);
      } else {
        console.log(`Fine-tuning not triggered: ${triggerCheck.reason}`);
      }
    } catch (fineTuningError) {
      console.error('Fine-tuning trigger error:', fineTuningError);
      // Don't fail verification if fine-tuning fails
      fineTuningMessage = 'Note: Auto fine-tuning check failed but verification succeeded';
    }

    const response: ApiResponse<VerifyDocumentResponse> = {
      success: true,
      data: {
        success: true,
        document: updatedDocument,
        message: fineTuningTriggered
          ? `Document verified successfully. ${fineTuningMessage}`
          : 'Document verified successfully'
      },
      message: 'Document verified and ready for training'
    };

    console.log(`Document verified successfully: ${id}`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('Document verification error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Verification failed';

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
