/**
 * POST /api/training/process-batch
 * Process multiple training documents through extraction pipeline
 */

import { NextRequest, NextResponse } from 'next/server';
import type {
  ApiResponse,
  ProcessBatchRequest,
  ProcessBatchResponse,
  DocumentType
} from '@/lib/types';
import { supabase, updateTrainingDocumentExtraction, calculateConfidenceScore } from '@/lib/training-utils';
import { extractDocumentData } from '@/lib/openai';

export async function POST(request: NextRequest) {
  try {
    console.log('[BATCH] ===== Batch processing request received =====');

    // Log request headers for debugging
    console.log('[BATCH] Request headers:', {
      contentType: request.headers.get('content-type'),
      contentLength: request.headers.get('content-length')
    });

    // Step 1: Get raw body text to log what was actually received
    let rawBody: string;
    let body: ProcessBatchRequest;

    try {
      // Clone the request so we can read it twice
      const clonedRequest = request.clone();
      rawBody = await clonedRequest.text();
      console.log('[BATCH] Raw request body:', rawBody);
      console.log('[BATCH] Raw body length:', rawBody.length);

      // Step 2: Parse the JSON
      body = JSON.parse(rawBody);
      console.log('[BATCH] Parsed body:', JSON.stringify(body, null, 2));

    } catch (parseError) {
      console.error('[BATCH] JSON parsing failed:', parseError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: `Invalid JSON in request body: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`
      }, { status: 400 });
    }

    // Step 3: Extract documentIds
    const { documentIds } = body;
    console.log('[BATCH] Extracted documentIds:', documentIds);
    console.log('[BATCH] documentIds type:', typeof documentIds);
    console.log('[BATCH] documentIds is array?', Array.isArray(documentIds));

    // Step 4: Validation checks with detailed logging
    if (!documentIds) {
      console.error('[BATCH] VALIDATION FAILED: documentIds is undefined or null');
      return NextResponse.json<ApiResponse>({
        success: false,
        error: `Document IDs array is required. Received: ${JSON.stringify(body)}`
      }, { status: 400 });
    }

    if (!Array.isArray(documentIds)) {
      console.error('[BATCH] VALIDATION FAILED: documentIds is not an array. Type:', typeof documentIds, 'Value:', documentIds);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: `Document IDs must be an array. Received type: ${typeof documentIds}, value: ${JSON.stringify(documentIds)}`
      }, { status: 400 });
    }

    if (documentIds.length === 0) {
      console.error('[BATCH] VALIDATION FAILED: documentIds array is empty');
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Document IDs array cannot be empty'
      }, { status: 400 });
    }

    console.log(`[BATCH] Validation passed. Processing ${documentIds.length} documents:`, documentIds);

    const results: Array<{ documentId: string; success: boolean; error?: string }> = [];
    let processed = 0;
    let failed = 0;

    // Process each document
    for (const documentId of documentIds) {
      try {
        console.log(`Processing document: ${documentId}`);

        // Get document from database
        const { data: document, error: fetchError } = await supabase
          .from('training_documents')
          .select('*')
          .eq('id', documentId)
          .single();

        if (fetchError || !document) {
          throw new Error(`Document not found: ${documentId}`);
        }

        // Update status to processing
        await supabase
          .from('training_documents')
          .update({ processing_status: 'processing' })
          .eq('id', documentId);

        // Download file from Supabase Storage
        const fileResponse = await fetch(document.file_url);
        if (!fileResponse.ok) {
          throw new Error(`Failed to download file: ${fileResponse.statusText}`);
        }

        const fileBlob = await fileResponse.blob();
        const file = new File([fileBlob], document.file_name, { type: document.file_type || 'application/pdf' });

        // Extract data using OpenAI
        console.log(`Extracting data for document type: ${document.document_type}`);
        const extractedData = await extractDocumentData(file, document.document_type as DocumentType);

        // Calculate confidence score
        const confidence = calculateConfidenceScore(extractedData);

        // Update document with extraction results
        await updateTrainingDocumentExtraction(documentId, {
          raw_extraction: extractedData,
          extraction_confidence: confidence,
          processing_status: 'completed',
          processed_date: new Date().toISOString()
        });

        processed++;
        results.push({
          documentId,
          success: true
        });

        console.log(`Successfully processed document: ${documentId}`);

      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : 'Processing failed';
        console.error(`Failed to process ${documentId}:`, errorMessage);

        // Update document with error
        try {
          await updateTrainingDocumentExtraction(documentId, {
            processing_status: 'failed',
            error_message: errorMessage,
            raw_extraction: {} as any // Empty extraction on failure
          });
        } catch (updateError) {
          console.error('Failed to update error status:', updateError);
        }

        results.push({
          documentId,
          success: false,
          error: errorMessage
        });
      }
    }

    const response: ApiResponse<ProcessBatchResponse> = {
      success: processed > 0,
      data: {
        success: processed > 0,
        processed,
        failed,
        results
      },
      message: `Processed ${processed} of ${documentIds.length} documents successfully`
    };

    console.log(`Batch processing completed: ${processed} success, ${failed} failed`);

    return NextResponse.json(response, {
      status: processed > 0 ? 200 : 400
    });

  } catch (error) {
    console.error('[BATCH] ===== Batch processing error =====');
    console.error('[BATCH] Error type:', error?.constructor?.name);
    console.error('[BATCH] Error message:', error instanceof Error ? error.message : String(error));
    console.error('[BATCH] Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    const errorMessage = error instanceof Error ? error.message : 'Batch processing failed';

    return NextResponse.json<ApiResponse>({
      success: false,
      error: `Batch processing error: ${errorMessage}`
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
