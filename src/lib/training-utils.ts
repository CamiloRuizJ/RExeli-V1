/**
 * Training System Utility Functions
 * Helper functions for AI training data collection and management
 */

import { supabase } from './supabase';
import type {
  TrainingDocument,
  TrainingMetrics,
  DocumentType,
  ExtractedData,
  ProcessingStatus,
  VerificationStatus,
  DatasetSplit
} from './types';

// Re-export supabase for backward compatibility
export { supabase };

/**
 * Upload file to Supabase Storage
 * Path: training-documents/{document_type}/{uuid}_{filename}
 */
export async function uploadTrainingFile(
  file: File,
  documentType: DocumentType,
  documentId: string
): Promise<{ path: string; url: string }> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${documentId}_${file.name}`;
  const filePath = `${documentType}/${fileName}`;

  console.log(`Uploading training file: ${filePath}`);

  const { data, error } = await supabase.storage
    .from('training-documents')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error('Training file upload error:', error);
    throw new Error(`Failed to upload training file: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('training-documents')
    .getPublicUrl(filePath);

  console.log(`Training file uploaded successfully: ${urlData.publicUrl}`);

  return {
    path: filePath,
    url: urlData.publicUrl
  };
}

/**
 * Create training document record in database
 */
export async function createTrainingDocument(data: {
  file_path: string;
  file_name: string;
  file_url: string;
  file_size: number;
  file_type: string;
  document_type: DocumentType;
  created_by?: string;
}): Promise<TrainingDocument> {
  console.log(`Creating training document record: ${data.file_name}`);

  const { data: document, error } = await supabase
    .from('training_documents')
    .insert(data)
    .select()
    .single();

  if (error) {
    console.error('Failed to create training document:', error);
    throw new Error(`Failed to create training document: ${error.message}`);
  }

  console.log(`Training document created: ${document.id}`);
  return document as TrainingDocument;
}

/**
 * Update training document with extraction data
 */
export async function updateTrainingDocumentExtraction(
  documentId: string,
  data: {
    raw_extraction: ExtractedData;
    extraction_confidence?: number;
    processing_status: ProcessingStatus;
    processed_date?: string;
    error_message?: string;
  }
): Promise<TrainingDocument> {
  console.log(`Updating extraction for document: ${documentId}`);

  const { data: document, error } = await supabase
    .from('training_documents')
    .update(data)
    .eq('id', documentId)
    .select()
    .single();

  if (error) {
    console.error('Failed to update training document:', error);
    throw new Error(`Failed to update training document: ${error.message}`);
  }

  return document as TrainingDocument;
}

/**
 * Update training document verification status
 */
export async function updateTrainingDocumentVerification(
  documentId: string,
  data: {
    verified_extraction: ExtractedData;
    verification_status: VerificationStatus;
    is_verified: boolean;
    verified_by?: string;
    verified_date: string;
    verification_notes?: string;
    quality_score?: number;
  }
): Promise<TrainingDocument> {
  console.log(`Updating verification for document: ${documentId}`);

  const { data: document, error } = await supabase
    .from('training_documents')
    .update(data)
    .eq('id', documentId)
    .select()
    .single();

  if (error) {
    console.error('Failed to update verification:', error);
    throw new Error(`Failed to update verification: ${error.message}`);
  }

  return document as TrainingDocument;
}

/**
 * Create verification edit record
 */
export async function createVerificationEdit(data: {
  training_document_id: string;
  editor_id: string;
  before_data?: ExtractedData;
  after_data?: ExtractedData;
  changes_made?: string;
  verification_action: 'verify' | 'reject' | 'edit' | 'recheck';
}): Promise<void> {
  console.log(`Creating verification edit for document: ${data.training_document_id}`);

  const { error } = await supabase
    .from('verification_edits')
    .insert(data);

  if (error) {
    console.error('Failed to create verification edit:', error);
    throw new Error(`Failed to create verification edit: ${error.message}`);
  }
}

/**
 * Get training document by ID with edit history
 */
export async function getTrainingDocument(
  documentId: string
): Promise<{ document: TrainingDocument; editHistory: any[] }> {
  console.log(`Fetching training document: ${documentId}`);

  // Get document
  const { data: document, error: docError } = await supabase
    .from('training_documents')
    .select('*')
    .eq('id', documentId)
    .single();

  if (docError) {
    console.error('Failed to fetch training document:', docError);
    throw new Error(`Failed to fetch training document: ${docError.message}`);
  }

  // Get edit history
  const { data: editHistory, error: editError } = await supabase
    .from('verification_edits')
    .select('*')
    .eq('training_document_id', documentId)
    .order('edit_date', { ascending: false });

  if (editError) {
    console.error('Failed to fetch edit history:', editError);
    // Don't fail if edit history can't be fetched
  }

  return {
    document: document as TrainingDocument,
    editHistory: editHistory || []
  };
}

/**
 * Query training documents with filters
 */
export async function queryTrainingDocuments(params: {
  document_type?: DocumentType;
  processing_status?: ProcessingStatus;
  verification_status?: VerificationStatus;
  dataset_split?: DatasetSplit;
  is_verified?: boolean;
  include_in_training?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ documents: TrainingDocument[]; total: number }> {
  console.log('Querying training documents:', params);

  let query = supabase.from('training_documents').select('*', { count: 'exact' });

  // Apply filters
  if (params.document_type) {
    query = query.eq('document_type', params.document_type);
  }
  if (params.processing_status) {
    query = query.eq('processing_status', params.processing_status);
  }
  if (params.verification_status) {
    query = query.eq('verification_status', params.verification_status);
  }
  if (params.dataset_split) {
    query = query.eq('dataset_split', params.dataset_split);
  }
  if (params.is_verified !== undefined) {
    query = query.eq('is_verified', params.is_verified);
  }
  if (params.include_in_training !== undefined) {
    query = query.eq('include_in_training', params.include_in_training);
  }

  // Apply pagination
  const limit = params.limit || 50;
  const offset = params.offset || 0;
  query = query.range(offset, offset + limit - 1);

  // Order by created date
  query = query.order('created_at', { ascending: false });

  const { data, error, count } = await query;

  if (error) {
    console.error('Failed to query training documents:', error);
    throw new Error(`Failed to query training documents: ${error.message}`);
  }

  return {
    documents: (data as TrainingDocument[]) || [],
    total: count || 0
  };
}

/**
 * Get training metrics for all document types
 */
export async function getTrainingMetrics(): Promise<TrainingMetrics[]> {
  console.log('Fetching training metrics');

  const { data, error } = await supabase
    .from('training_metrics')
    .select('*')
    .order('document_type');

  if (error) {
    console.error('Failed to fetch training metrics:', error);
    throw new Error(`Failed to fetch training metrics: ${error.message}`);
  }

  return (data as TrainingMetrics[]) || [];
}

/**
 * Auto-assign train/validation split (80/20)
 */
export async function autoAssignDatasetSplit(
  documentType?: DocumentType,
  trainPercentage: number = 80
): Promise<{ document_type: DocumentType; train_count: number; validation_count: number }[]> {
  console.log(`Auto-assigning dataset split (${trainPercentage}% train)`);

  const results: { document_type: DocumentType; train_count: number; validation_count: number }[] = [];

  // Get document types to process
  const types: DocumentType[] = documentType
    ? [documentType]
    : [
        'rent_roll',
        'operating_budget',
        'broker_sales_comparables',
        'broker_lease_comparables',
        'broker_listing',
        'offering_memo',
        'lease_agreement',
        'financial_statements'
      ];

  for (const type of types) {
    // Get all verified documents for this type that don't have a split assigned yet
    const { data: documents, error } = await supabase
      .from('training_documents')
      .select('id')
      .eq('document_type', type)
      .eq('is_verified', true)
      .eq('include_in_training', true)
      .order('created_at', { ascending: true });

    if (error) {
      console.error(`Failed to fetch documents for ${type}:`, error);
      continue;
    }

    if (!documents || documents.length === 0) {
      console.log(`No verified documents found for ${type}`);
      continue;
    }

    // Calculate split index
    const totalDocs = documents.length;
    const trainCount = Math.floor(totalDocs * (trainPercentage / 100));
    const validationCount = totalDocs - trainCount;

    // Shuffle documents for random split
    const shuffled = [...documents].sort(() => Math.random() - 0.5);

    // Assign train split
    const trainIds = shuffled.slice(0, trainCount).map(d => d.id);
    if (trainIds.length > 0) {
      await supabase
        .from('training_documents')
        .update({ dataset_split: 'train' as DatasetSplit })
        .in('id', trainIds);
    }

    // Assign validation split
    const validationIds = shuffled.slice(trainCount).map(d => d.id);
    if (validationIds.length > 0) {
      await supabase
        .from('training_documents')
        .update({ dataset_split: 'validation' as DatasetSplit })
        .in('id', validationIds);
    }

    console.log(`Split assigned for ${type}: ${trainCount} train, ${validationCount} validation`);

    results.push({
      document_type: type,
      train_count: trainCount,
      validation_count: validationCount
    });
  }

  return results;
}

/**
 * Calculate extraction confidence score
 * Based on data completeness and quality indicators
 */
export function calculateConfidenceScore(extraction: ExtractedData): number {
  let score = 0.5; // Base score

  // Check metadata completeness
  if (extraction.metadata) {
    const metadataFields = Object.values(extraction.metadata).filter(v => v !== null && v !== undefined && v !== '');
    score += (metadataFields.length / 10) * 0.2; // Up to 0.2 for metadata
  }

  // Check data completeness
  if (extraction.data) {
    const dataFields = JSON.stringify(extraction.data).length;
    if (dataFields > 1000) score += 0.15;
    else if (dataFields > 500) score += 0.10;
    else if (dataFields > 100) score += 0.05;
  }

  // Cap at 0.95 (never 100% confident without human verification)
  return Math.min(score, 0.95);
}

/**
 * Validate document type
 */
export function isValidDocumentType(type: string): type is DocumentType {
  const validTypes: DocumentType[] = [
    'rent_roll',
    'operating_budget',
    'broker_sales_comparables',
    'broker_lease_comparables',
    'broker_listing',
    'offering_memo',
    'lease_agreement',
    'financial_statements'
  ];
  return validTypes.includes(type as DocumentType);
}

/**
 * Generate summary statistics from training metrics
 */
export function generateMetricsSummary(metrics: TrainingMetrics[]) {
  const total_documents = metrics.reduce((sum, m) => sum + m.total_documents, 0);
  const total_verified = metrics.reduce((sum, m) => sum + m.verified_documents, 0);
  const types_ready_for_training = metrics.filter(m => m.ready_for_training).length;

  return {
    total_documents,
    total_verified,
    types_ready_for_training,
    total_types: metrics.length,
    overall_progress: total_documents > 0 ? (total_verified / total_documents) * 100 : 0,
    readiness_percentage: (types_ready_for_training / metrics.length) * 100
  };
}

/**
 * Format quality score (0-1) to star rating (1-5)
 */
export function qualityScoreToStars(score: number): number {
  return Math.round(score * 5);
}

/**
 * Format star rating (1-5) to quality score (0-1)
 */
export function starsToQualityScore(stars: number): number {
  return stars / 5;
}

/**
 * Get file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Validate extraction data structure
 */
export function validateExtractionData(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data) {
    errors.push('Extraction data is null or undefined');
    return { valid: false, errors };
  }

  if (!data.documentType) {
    errors.push('Missing documentType field');
  }

  if (!data.metadata) {
    errors.push('Missing metadata object');
  }

  if (!data.data) {
    errors.push('Missing data object');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Compare two extraction objects to generate change summary
 */
export function generateChangesSummary(before: ExtractedData, after: ExtractedData): string {
  const changes: string[] = [];

  // Compare top-level fields
  if (before.documentType !== after.documentType) {
    changes.push(`Document type changed from ${before.documentType} to ${after.documentType}`);
  }

  // Compare metadata
  if (JSON.stringify(before.metadata) !== JSON.stringify(after.metadata)) {
    changes.push('Metadata modified');
  }

  // Compare data
  if (JSON.stringify(before.data) !== JSON.stringify(after.data)) {
    changes.push('Data content modified');
  }

  return changes.length > 0 ? changes.join(', ') : 'No significant changes detected';
}

/**
 * Calculate estimated training time based on document count
 * OpenAI fine-tuning typically takes ~10-30 minutes per 50 examples
 */
export function estimateTrainingTime(documentCount: number): string {
  const minutesPerExample = 0.5; // Conservative estimate
  const totalMinutes = documentCount * minutesPerExample;

  if (totalMinutes < 60) {
    return `~${Math.ceil(totalMinutes)} minutes`;
  } else {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.ceil(totalMinutes % 60);
    return `~${hours}h ${minutes}m`;
  }
}
