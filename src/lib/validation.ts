/**
 * Zod validation schemas for API request validation
 * Prevents JSON deserialization attacks, prototype pollution, and malicious object injection
 */

import { z } from 'zod';

// ============================================
// Document Type Validation
// ============================================

export const DocumentTypeSchema = z.enum([
  'rent_roll',
  'operating_budget',
  'broker_sales_comparables',
  'broker_lease_comparables',
  'broker_listing',
  'offering_memo',
  'lease_agreement',
  'financial_statements',
  // Legacy types for backward compatibility
  'comparable_sales',
  'financial_statement',
  'unknown'
]);

// ============================================
// Export API Validation (/api/export)
// ============================================

// Base metadata schema
const ExtractedDataMetadataSchema = z.object({
  propertyName: z.string().optional(),
  propertyAddress: z.string().optional(),
  totalSquareFeet: z.number().optional(),
  totalUnits: z.number().optional(),
  extractedDate: z.string(),
  pdfFileName: z.string(),
  rexeliUserName: z.string(),
  rexeliUserEmail: z.string().email(),
  extractionTimestamp: z.string(),
  documentId: z.string()
});

// Relaxed data schema - allows any structure since document types vary
const ExtractedDataDataSchema = z.record(z.string(), z.any());

// Main extracted data schema
const ExtractedDataSchema = z.object({
  documentType: DocumentTypeSchema,
  metadata: ExtractedDataMetadataSchema,
  data: ExtractedDataDataSchema
});

// Export options schema
const ExportOptionsSchema = z.object({
  format: z.enum(['xlsx', 'csv']).optional(),
  includeMetadata: z.boolean().optional(),
  includeCharts: z.boolean().optional()
}).optional();

// Complete export request schema
export const ExportRequestSchema = z.object({
  extractedData: ExtractedDataSchema,
  options: ExportOptionsSchema
});

// Type inference for TypeScript
export type ExportRequestInput = z.infer<typeof ExportRequestSchema>;

// ============================================
// Extract API Validation (/api/extract)
// ============================================

// Multi-page document schema
export const MultiPageDocumentSchema = z.object({
  type: z.literal('multi-page'),
  pages: z.array(z.object({
    pageNumber: z.number().int().positive(),
    imageData: z.string(), // Base64 encoded image
    mimeType: z.string().regex(/^image\/(png|jpeg|jpg)$/),
    dimensions: z.object({
      width: z.number().int().positive(),
      height: z.number().int().positive()
    }).optional()
  })),
  documentType: DocumentTypeSchema,
  metadata: z.record(z.string(), z.any()).optional()
});

// Type inference
export type MultiPageDocumentInput = z.infer<typeof MultiPageDocumentSchema>;

// ============================================
// Training Process Batch Validation (/api/training/process-batch)
// ============================================

export const ProcessBatchRequestSchema = z.object({
  documentIds: z.array(
    z.string()
      .uuid('Document ID must be a valid UUID')
      .or(z.string().regex(/^[a-f0-9-]+$/i, 'Document ID must be a valid identifier'))
  )
    .min(1, 'Document IDs array cannot be empty')
    .max(100, 'Cannot process more than 100 documents at once'),
  batchSize: z.number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(10),
  priority: z.enum(['low', 'normal', 'high']).optional().default('normal'),
  options: z.object({
    skipVerified: z.boolean().optional(),
    overwriteExisting: z.boolean().optional(),
    confidenceThreshold: z.number().min(0).max(1).optional()
  }).optional()
});

// Type inference
export type ProcessBatchRequestInput = z.infer<typeof ProcessBatchRequestSchema>;

// ============================================
// Generic Validation Helper
// ============================================

/**
 * Safely parse and validate JSON input with Zod schema
 * @param schema Zod schema to validate against
 * @param input Raw input data (string or object)
 * @returns Validated data or throws ZodError
 */
export function validateInput<T>(schema: z.ZodSchema<T>, input: string | unknown): T {
  // If input is a string, parse it as JSON first
  const data = typeof input === 'string' ? JSON.parse(input) : input;

  // Validate with Zod schema
  return schema.parse(data);
}

/**
 * Safe parse that returns success/error result instead of throwing
 * @param schema Zod schema to validate against
 * @param input Raw input data
 * @returns SafeParseReturnType with success status and data/error
 */
export function safeValidateInput<T>(
  schema: z.ZodSchema<T>,
  input: string | unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  try {
    const data = typeof input === 'string' ? JSON.parse(input) : input;
    const result = schema.safeParse(data);

    if (result.success) {
      return { success: true, data: result.data };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    // JSON parse error - wrap in ZodError-like structure
    return {
      success: false,
      error: new z.ZodError([
        {
          code: 'custom',
          path: [],
          message: error instanceof Error ? error.message : 'Invalid JSON'
        }
      ])
    };
  }
}

/**
 * Format Zod validation errors into user-friendly messages
 * @param error ZodError from validation
 * @returns Formatted error message
 */
export function formatValidationError(error: z.ZodError): string {
  const issues = error.issues.map(issue => {
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    return `${path}${issue.message}`;
  });

  return `Validation failed: ${issues.join(', ')}`;
}

// ============================================
// Security Validation Utilities
// ============================================

/**
 * Check if object contains prototype pollution attempts
 * @param obj Object to check
 * @returns true if potentially malicious
 */
export function hasPrototypePollution(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null) return false;

  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];

  function checkObject(o: any): boolean {
    if (typeof o !== 'object' || o === null) return false;

    for (const key of Object.keys(o)) {
      if (dangerousKeys.includes(key)) return true;
      if (typeof o[key] === 'object' && checkObject(o[key])) return true;
    }

    return false;
  }

  return checkObject(obj);
}

/**
 * Sanitize object by removing potentially dangerous keys
 * @param obj Object to sanitize
 * @returns Sanitized object
 */
export function sanitizeObject<T extends object>(obj: T): T {
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];

  function sanitize(o: any): any {
    if (typeof o !== 'object' || o === null) return o;

    if (Array.isArray(o)) {
      return o.map(item => sanitize(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(o)) {
      if (!dangerousKeys.includes(key)) {
        sanitized[key] = typeof value === 'object' ? sanitize(value) : value;
      }
    }

    return sanitized;
  }

  return sanitize(obj);
}
