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
import { extractDocumentData } from '@/lib/anthropic';
import { ProcessBatchRequestSchema, safeValidateInput, formatValidationError, hasPrototypePollution } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    console.log('[BATCH] ===== Batch processing request received =====');

    // Log request headers for debugging
    console.log('[BATCH] Request headers:', {
      contentType: request.headers.get('content-type'),
      contentLength: request.headers.get('content-length')
    });

    // Step 1: Parse and validate with Zod schema (SECURITY: prevents injection attacks)
    let validatedRequest;

    try {
      const clonedRequest = request.clone();
      const rawBody = await clonedRequest.text();
      console.log('[BATCH] Raw request body:', rawBody.substring(0, 200) + '...');

      // Parse JSON
      const rawData = JSON.parse(rawBody);

      // Security check: detect prototype pollution attempts
      if (hasPrototypePollution(rawData)) {
        console.error('[BATCH] SECURITY: Prototype pollution attempt detected');
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Invalid request: malicious input detected'
        }, { status: 400 });
      }

      // Validate with Zod schema
      const validation = safeValidateInput(ProcessBatchRequestSchema, rawData);

      if (!validation.success) {
        console.error('[BATCH] Validation error:', validation.error);
        return NextResponse.json<ApiResponse>({
          success: false,
          error: formatValidationError(validation.error)
        }, { status: 400 });
      }

      validatedRequest = validation.data;
      console.log('[BATCH] Validated request:', {
        documentCount: validatedRequest.documentIds.length,
        batchSize: validatedRequest.batchSize,
        priority: validatedRequest.priority
      });

    } catch (parseError) {
      console.error('[BATCH] JSON parsing failed:', parseError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: `Invalid JSON in request body: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`
      }, { status: 400 });
    }

    const { documentIds } = validatedRequest;
    console.log(`[BATCH] Processing ${documentIds.length} documents:`, documentIds);

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

        // Convert PDF to images if needed (server-side multi-page support)
        let fileToProcess: File = file;

        if (file.type === 'application/pdf') {
          console.log(`Converting PDF to images for training document: ${documentId}`);

          // Import server-side PDF converter
          const { convertPdfToAllPngsServer } = await import('@/lib/pdf-utils-server');

          // Convert all pages to images
          const allPages = await convertPdfToAllPngsServer(file);

          console.log(`Converted ${allPages.length} pages for training document`);

          // Create multi-page JSON file format (same as client-side tool page)
          const multiPageData = {
            type: 'multi-page',
            pages: allPages.map(page => ({
              imageBase64: page.imageBase64,
              mimeType: page.mimeType,
              pageNumber: page.pageNumber
            }))
          };

          // Create JSON file with multi-page data
          const jsonBlob = new Blob([JSON.stringify(multiPageData)], { type: 'application/json' });
          fileToProcess = new File([jsonBlob], `${document.file_name}_multipage.json`, { type: 'application/json' });

          console.log(`Created multi-page JSON file for training extraction`);
        }

        // Extract data using OpenAI
        console.log(`Extracting data for document type: ${document.document_type}`);
        const extractedData = await extractDocumentData(fileToProcess, document.document_type as DocumentType);

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
