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
    console.log('Batch processing request received');

    const body: ProcessBatchRequest = await request.json();
    const { documentIds } = body;

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Document IDs array is required'
      }, { status: 400 });
    }

    console.log(`Processing ${documentIds.length} documents`);

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
    console.error('Batch processing error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Batch processing failed';

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
