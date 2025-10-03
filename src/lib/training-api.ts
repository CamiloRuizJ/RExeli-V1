/**
 * API Client for Training Data Management
 * Provides typed functions for interacting with training endpoints
 */

import type {
  TrainingDocument,
  TrainingDocumentsQuery,
  TrainingDocumentsResponse,
  VerifyDocumentRequest,
  VerifyDocumentResponse,
  RejectDocumentRequest,
  RejectDocumentResponse,
  TrainingMetricsResponse,
  ExportTrainingDataRequest,
  ExportTrainingDataResponse,
  DocumentType,
  ExtractedData,
  ApiResponse,
  BatchUploadResponse,
  ProcessBatchResponse,
} from './types';

/**
 * Upload multiple documents for training
 * Uses individual file upload pattern to avoid serverless function body size limits
 */
export async function uploadBatchDocuments(
  files: File[],
  documentType: DocumentType
): Promise<BatchUploadResponse> {
  const documentIds: string[] = [];
  const errors: Array<{ filename: string; error: string }> = [];
  let uploaded = 0;
  let failed = 0;

  // Validate file types upfront
  const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];

  // Process files one at a time
  for (const file of files) {
    try {
      console.log(`Processing file: ${file.name} (${file.size} bytes)`);

      // Validate file type
      if (!validTypes.includes(file.type)) {
        throw new Error(`Invalid file type: ${file.type}. Only PDF, PNG, and JPEG are supported.`);
      }

      // Step 1: Upload file to Supabase via /api/upload
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('skipSizeLimit', 'true'); // No size limit for admin training uploads
      uploadFormData.append('bucket', 'training-documents'); // Use training-documents bucket

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      if (!uploadResponse.ok) {
        const uploadError = await uploadResponse.json();
        throw new Error(uploadError.error || 'File upload failed');
      }

      const uploadResult: ApiResponse<{ fileId: string; url: string; filename: string; size: number }> = await uploadResponse.json();

      if (!uploadResult.success || !uploadResult.data) {
        throw new Error('Upload response missing data');
      }

      // Step 2: Create training document record via /api/training/create-record
      const createRecordResponse = await fetch('/api/training/create-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_path: uploadResult.data.fileId,
          file_name: file.name,
          file_url: uploadResult.data.url,
          file_size: file.size,
          file_type: file.type,
          document_type: documentType,
        }),
      });

      if (!createRecordResponse.ok) {
        const recordError = await createRecordResponse.json();
        throw new Error(recordError.error || 'Failed to create training record');
      }

      const recordResult: ApiResponse<{ document: { id: string } }> = await createRecordResponse.json();

      if (!recordResult.success || !recordResult.data?.document?.id) {
        throw new Error('Create record response missing document ID');
      }

      documentIds.push(recordResult.data.document.id);
      uploaded++;
      console.log(`Successfully uploaded: ${file.name} (ID: ${recordResult.data.document.id})`);

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

  return {
    success: uploaded > 0,
    uploaded,
    failed,
    documentIds,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Process uploaded documents (extract data)
 */
export async function processBatchDocuments(
  documentIds: string[]
): Promise<ProcessBatchResponse> {
  const response = await fetch('/api/training/process-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentIds }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Processing failed');
  }

  return response.json();
}

/**
 * Fetch training documents with filters and pagination
 */
export async function fetchTrainingDocuments(
  query?: TrainingDocumentsQuery
): Promise<TrainingDocumentsResponse> {
  const params = new URLSearchParams();

  if (query?.document_type) params.append('document_type', query.document_type);
  if (query?.processing_status) params.append('processing_status', query.processing_status);
  if (query?.verification_status) params.append('verification_status', query.verification_status);
  if (query?.dataset_split) params.append('dataset_split', query.dataset_split);
  if (query?.is_verified !== undefined) params.append('is_verified', String(query.is_verified));
  if (query?.include_in_training !== undefined) params.append('include_in_training', String(query.include_in_training));
  if (query?.limit) params.append('limit', String(query.limit));
  if (query?.offset) params.append('offset', String(query.offset));

  const response = await fetch(`/api/training/documents?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch documents');
  }

  const result: ApiResponse<TrainingDocumentsResponse> = await response.json();
  return result.data!;
}

/**
 * Get a single training document by ID
 */
export async function getTrainingDocument(id: string): Promise<TrainingDocument> {
  const response = await fetch(`/api/training/document/${id}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch document');
  }

  const result: ApiResponse<{ document: TrainingDocument }> = await response.json();
  return result.data!.document;
}

/**
 * Verify a document with corrected extraction data
 */
export async function verifyDocument(
  id: string,
  verifiedExtraction: ExtractedData,
  qualityScore: number,
  notes?: string,
  verifiedBy?: string
): Promise<VerifyDocumentResponse> {
  const requestBody: VerifyDocumentRequest = {
    verified_extraction: verifiedExtraction,
    quality_score: qualityScore,
    verification_notes: notes,
    verified_by: verifiedBy,
  };

  const response = await fetch(`/api/training/verify/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Verification failed');
  }

  const result: ApiResponse<VerifyDocumentResponse> = await response.json();
  return result.data!;
}

/**
 * Reject a document
 */
export async function rejectDocument(
  id: string,
  reason: string,
  verifiedBy?: string
): Promise<RejectDocumentResponse> {
  const requestBody: RejectDocumentRequest = {
    rejection_reason: reason,
    verified_by: verifiedBy,
  };

  const response = await fetch(`/api/training/reject/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Rejection failed');
  }

  const result: ApiResponse<RejectDocumentResponse> = await response.json();
  return result.data!;
}

/**
 * Save partial edits to a document (without verifying)
 */
export async function saveDocumentEdits(
  id: string,
  editedExtraction: ExtractedData,
  notes?: string
): Promise<TrainingDocument> {
  // Update the raw extraction with edits but keep verification status as in_review
  const response = await fetch(`/api/training/document/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      raw_extraction: editedExtraction,
      verification_status: 'in_review',
      verification_notes: notes,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Save failed');
  }

  const result: ApiResponse<{ document: TrainingDocument }> = await response.json();
  return result.data!.document;
}

/**
 * Get training metrics across all document types
 */
export async function fetchTrainingMetrics(): Promise<TrainingMetricsResponse> {
  const response = await fetch('/api/training/metrics');

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch metrics');
  }

  const result: ApiResponse<TrainingMetricsResponse> = await response.json();
  return result.data!;
}

/**
 * Export training data for OpenAI fine-tuning
 */
export async function exportTrainingData(
  documentType: DocumentType
): Promise<ExportTrainingDataResponse> {
  const requestBody: ExportTrainingDataRequest = {
    document_type: documentType,
  };

  const response = await fetch('/api/training/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Export failed');
  }

  const result: ApiResponse<ExportTrainingDataResponse> = await response.json();
  return result.data!;
}

/**
 * Delete a training document
 */
export async function deleteDocument(id: string): Promise<void> {
  const response = await fetch(`/api/training/document/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Delete failed');
  }
}

/**
 * Auto-split documents into train/validation sets
 */
export async function autoSplitDatasets(
  documentType?: DocumentType,
  trainPercentage: number = 80
): Promise<void> {
  const response = await fetch('/api/training/auto-split', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document_type: documentType,
      train_percentage: trainPercentage,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Auto-split failed');
  }
}
