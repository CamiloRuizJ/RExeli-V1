/**
 * Feedback Analysis & Learning System
 * Analyzes verification notes and edit patterns to improve AI training
 */

import { supabase } from './training-utils';
import type { DocumentType, ExtractedData } from './types';

/**
 * Structured feedback categories
 */
export type FeedbackCategory =
  | 'date_format_error'
  | 'missing_data'
  | 'field_misidentification'
  | 'calculation_error'
  | 'unit_conversion_error'
  | 'currency_format_error'
  | 'table_parsing_error'
  | 'ocr_error'
  | 'logic_error'
  | 'other';

export interface ErrorPattern {
  field_path: string;
  error_type: FeedbackCategory;
  frequency: number;
  example_corrections: string[];
  affected_documents: string[];
}

export interface DocumentTypeLearnings {
  document_type: DocumentType;
  total_verifications: number;
  common_errors: ErrorPattern[];
  aggregated_notes: string[];
  improvement_suggestions: string[];
}

/**
 * Analyze differences between raw and verified extractions
 */
export function analyzeExtractionDifferences(
  rawExtraction: ExtractedData,
  verifiedExtraction: ExtractedData
): { differences: any[]; errorPatterns: ErrorPattern[] } {
  const differences: any[] = [];
  const errorPatterns: ErrorPattern[] = [];

  function compareObjects(raw: any, verified: any, path: string = '') {
    if (typeof raw !== 'object' || typeof verified !== 'object') {
      if (raw !== verified) {
        differences.push({
          path,
          raw_value: raw,
          verified_value: verified,
          type: typeof verified
        });
      }
      return;
    }

    // Compare all keys from verified extraction (the correct one)
    const allKeys = new Set([...Object.keys(raw || {}), ...Object.keys(verified || {})]);

    for (const key of allKeys) {
      const newPath = path ? `${path}.${key}` : key;
      const rawValue = raw?.[key];
      const verifiedValue = verified?.[key];

      if (rawValue === undefined && verifiedValue !== undefined) {
        // Field was missing in raw extraction
        differences.push({
          path: newPath,
          raw_value: null,
          verified_value: verifiedValue,
          type: 'missing_field'
        });
      } else if (typeof rawValue === 'object' && typeof verifiedValue === 'object') {
        compareObjects(rawValue, verifiedValue, newPath);
      } else if (rawValue !== verifiedValue) {
        differences.push({
          path: newPath,
          raw_value: rawValue,
          verified_value: verifiedValue,
          type: 'value_correction'
        });
      }
    }
  }

  compareObjects(rawExtraction, verifiedExtraction);

  // Categorize error patterns
  const patternMap = new Map<string, ErrorPattern>();

  for (const diff of differences) {
    const errorType = categorizeError(diff);
    const key = `${diff.path}_${errorType}`;

    if (patternMap.has(key)) {
      const pattern = patternMap.get(key)!;
      pattern.frequency++;
      pattern.example_corrections.push(`${diff.raw_value} → ${diff.verified_value}`);
    } else {
      patternMap.set(key, {
        field_path: diff.path,
        error_type: errorType,
        frequency: 1,
        example_corrections: [`${diff.raw_value} → ${diff.verified_value}`],
        affected_documents: []
      });
    }
  }

  return {
    differences,
    errorPatterns: Array.from(patternMap.values())
  };
}

/**
 * Categorize the type of error based on field and values
 */
function categorizeError(diff: any): FeedbackCategory {
  const { path, raw_value, verified_value } = diff;
  const pathLower = path.toLowerCase();

  // Date format errors
  if (pathLower.includes('date') || pathLower.includes('expiration') || pathLower.includes('lease_start')) {
    return 'date_format_error';
  }

  // Missing data
  if (raw_value === null || raw_value === undefined || raw_value === '') {
    return 'missing_data';
  }

  // Currency/amount errors
  if (pathLower.includes('rent') || pathLower.includes('price') || pathLower.includes('amount') || pathLower.includes('cost')) {
    return 'currency_format_error';
  }

  // Calculation errors
  if (pathLower.includes('total') || pathLower.includes('sum') || pathLower.includes('average')) {
    return 'calculation_error';
  }

  // Unit conversion errors
  if (pathLower.includes('square') || pathLower.includes('sqft') || pathLower.includes('sf') || pathLower.includes('footage')) {
    return 'unit_conversion_error';
  }

  // Table parsing errors
  if (pathLower.includes('tenant') || pathLower.includes('unit') || pathLower.includes('suite')) {
    return 'table_parsing_error';
  }

  // Field misidentification
  if (typeof raw_value === typeof verified_value && String(raw_value).length > 10) {
    return 'field_misidentification';
  }

  return 'other';
}

/**
 * Parse verification notes to extract structured feedback
 */
export function parseVerificationNotes(notes: string): {
  categories: FeedbackCategory[];
  key_learnings: string[];
  instructions: string[];
} {
  const categories: FeedbackCategory[] = [];
  const key_learnings: string[] = [];
  const instructions: string[] = [];

  if (!notes || notes.trim() === '') {
    return { categories, key_learnings, instructions };
  }

  const notesLower = notes.toLowerCase();

  // Extract categories based on keywords
  if (notesLower.includes('date') || notesLower.includes('expiration')) {
    categories.push('date_format_error');
  }
  if (notesLower.includes('missing') || notesLower.includes('blank') || notesLower.includes('empty')) {
    categories.push('missing_data');
  }
  if (notesLower.includes('wrong field') || notesLower.includes('misidentified')) {
    categories.push('field_misidentification');
  }
  if (notesLower.includes('calculation') || notesLower.includes('total') || notesLower.includes('sum')) {
    categories.push('calculation_error');
  }
  if (notesLower.includes('currency') || notesLower.includes('dollar') || notesLower.includes('$')) {
    categories.push('currency_format_error');
  }
  if (notesLower.includes('table') || notesLower.includes('row') || notesLower.includes('column')) {
    categories.push('table_parsing_error');
  }

  // Extract actionable instructions (sentences with "should", "must", "need to")
  const sentences = notes.split(/[.!?]+/).filter(s => s.trim());
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed.match(/\b(should|must|need to|always|never|remember)\b/i)) {
      instructions.push(trimmed);
    } else if (trimmed.length > 20) {
      key_learnings.push(trimmed);
    }
  }

  return { categories, key_learnings, instructions };
}

/**
 * Aggregate learnings across all verified documents for a document type
 */
export async function aggregateDocumentTypeLearnings(
  documentType: DocumentType
): Promise<DocumentTypeLearnings> {
  console.log(`Aggregating learnings for: ${documentType}`);

  // Get all verified documents with notes and edit history
  const { data: documents, error } = await supabase
    .from('training_documents')
    .select('id, verification_notes, raw_extraction, verified_extraction')
    .eq('document_type', documentType)
    .eq('is_verified', true)
    .not('verification_notes', 'is', null);

  if (error) {
    console.error('Failed to fetch documents for learning aggregation:', error);
    return {
      document_type: documentType,
      total_verifications: 0,
      common_errors: [],
      aggregated_notes: [],
      improvement_suggestions: []
    };
  }

  const errorPatternMap = new Map<string, ErrorPattern>();
  const allNotes: string[] = [];
  const allInstructions: string[] = [];

  // Analyze each document
  for (const doc of documents || []) {
    if (doc.verification_notes) {
      allNotes.push(doc.verification_notes);

      const { instructions } = parseVerificationNotes(doc.verification_notes);
      allInstructions.push(...instructions);
    }

    // Analyze extraction differences
    if (doc.raw_extraction && doc.verified_extraction) {
      const { errorPatterns } = analyzeExtractionDifferences(
        doc.raw_extraction,
        doc.verified_extraction
      );

      // Merge error patterns
      for (const pattern of errorPatterns) {
        const key = `${pattern.field_path}_${pattern.error_type}`;

        if (errorPatternMap.has(key)) {
          const existing = errorPatternMap.get(key)!;
          existing.frequency += pattern.frequency;
          existing.example_corrections.push(...pattern.example_corrections);
          existing.affected_documents.push(doc.id);
        } else {
          pattern.affected_documents = [doc.id];
          errorPatternMap.set(key, pattern);
        }
      }
    }
  }

  // Sort error patterns by frequency
  const commonErrors = Array.from(errorPatternMap.values())
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 20); // Top 20 most common errors

  // Generate improvement suggestions based on patterns
  const improvement_suggestions = generateImprovementSuggestions(commonErrors, allInstructions);

  return {
    document_type: documentType,
    total_verifications: documents?.length || 0,
    common_errors: commonErrors,
    aggregated_notes: allNotes,
    improvement_suggestions
  };
}

/**
 * Generate improvement suggestions based on error patterns
 */
function generateImprovementSuggestions(
  errorPatterns: ErrorPattern[],
  instructions: string[]
): string[] {
  const suggestions: string[] = [];

  // Group by error type
  const errorsByType = new Map<FeedbackCategory, ErrorPattern[]>();
  for (const pattern of errorPatterns) {
    if (!errorsByType.has(pattern.error_type)) {
      errorsByType.set(pattern.error_type, []);
    }
    errorsByType.get(pattern.error_type)!.push(pattern);
  }

  // Generate suggestions for each error type
  for (const [errorType, patterns] of errorsByType) {
    const totalFrequency = patterns.reduce((sum, p) => sum + p.frequency, 0);

    if (totalFrequency >= 3) { // Only suggest if error appears 3+ times
      switch (errorType) {
        case 'date_format_error':
          suggestions.push(`Pay special attention to date formats. Common issues: ${patterns.map(p => p.field_path).join(', ')}`);
          break;
        case 'missing_data':
          suggestions.push(`Always check for missing data in: ${patterns.map(p => p.field_path).join(', ')}`);
          break;
        case 'field_misidentification':
          suggestions.push(`Verify correct field identification for: ${patterns.map(p => p.field_path).join(', ')}`);
          break;
        case 'calculation_error':
          suggestions.push(`Double-check calculations for: ${patterns.map(p => p.field_path).join(', ')}`);
          break;
        case 'currency_format_error':
          suggestions.push(`Ensure proper currency formatting for: ${patterns.map(p => p.field_path).join(', ')}`);
          break;
        case 'table_parsing_error':
          suggestions.push(`Carefully parse table data for: ${patterns.map(p => p.field_path).join(', ')}`);
          break;
      }
    }
  }

  // Add unique user instructions
  const uniqueInstructions = Array.from(new Set(instructions)).slice(0, 10);
  suggestions.push(...uniqueInstructions);

  return suggestions;
}

/**
 * Build enhanced system prompt with learnings
 */
export async function buildEnhancedSystemPrompt(
  documentType: DocumentType,
  basePrompt: string
): Promise<string> {
  const learnings = await aggregateDocumentTypeLearnings(documentType);

  if (learnings.total_verifications === 0) {
    return basePrompt;
  }

  let enhancedPrompt = basePrompt;

  // Add learnings section
  if (learnings.improvement_suggestions.length > 0) {
    enhancedPrompt += '\n\n**IMPORTANT LEARNINGS FROM VERIFICATIONS:**\n';
    enhancedPrompt += 'Based on previous verifications, pay special attention to:\n';

    learnings.improvement_suggestions.forEach((suggestion, index) => {
      enhancedPrompt += `${index + 1}. ${suggestion}\n`;
    });
  }

  // Add common error warnings
  if (learnings.common_errors.length > 0) {
    enhancedPrompt += '\n**COMMON ERRORS TO AVOID:**\n';

    const topErrors = learnings.common_errors.slice(0, 5);
    topErrors.forEach((error) => {
      enhancedPrompt += `- ${error.field_path}: ${error.error_type.replace(/_/g, ' ')} (occurred ${error.frequency} times)\n`;
      if (error.example_corrections.length > 0) {
        enhancedPrompt += `  Example correction: ${error.example_corrections[0]}\n`;
      }
    });
  }

  return enhancedPrompt;
}

/**
 * Store learning insights for tracking
 */
export async function storeLearningInsights(
  documentType: DocumentType,
  learnings: DocumentTypeLearnings
): Promise<void> {
  const { data, error } = await supabase
    .from('training_metrics')
    .upsert({
      document_type: documentType,
      learning_insights: {
        total_verifications: learnings.total_verifications,
        common_errors: learnings.common_errors.slice(0, 10),
        improvement_suggestions: learnings.improvement_suggestions,
        last_updated: new Date().toISOString()
      }
    }, {
      onConflict: 'document_type'
    });

  if (error) {
    console.error('Failed to store learning insights:', error);
  }
}
