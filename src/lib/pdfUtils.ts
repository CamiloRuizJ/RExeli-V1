/**
 * PDF Utilities - Page Counting and Validation
 *
 * CRITICAL: This module handles page counting for the credit system
 * Credit Model: 1 credit = 1 page
 * Accuracy is essential as it determines credit deductions
 */

import pdf from 'pdf-parse';

/**
 * Get accurate page count from a PDF file
 * @param fileBuffer - Buffer containing the PDF file data
 * @returns Number of pages in the PDF
 * @throws Error if the file is not a valid PDF
 */
export async function getPageCount(fileBuffer: Buffer): Promise<number> {
  try {
    const data = await pdf(fileBuffer);

    // Validate that we got a valid page count
    if (!data.numpages || data.numpages < 1) {
      throw new Error('Invalid page count returned from PDF');
    }

    return data.numpages;
  } catch (error) {
    console.error('Error counting PDF pages:', error);
    throw new Error('Unable to read PDF file. Please ensure the file is not corrupted.');
  }
}

/**
 * Get page count from file - handles both PDFs and images
 * Images always count as 1 page
 * @param file - File object (can be PDF or image)
 * @returns Number of pages
 */
export async function getPageCountFromFile(file: File): Promise<number> {
  const fileType = file.type;

  // Images always count as 1 page
  if (fileType.startsWith('image/')) {
    return 1;
  }

  // For PDFs, read and count pages
  if (fileType === 'application/pdf') {
    const buffer = await file.arrayBuffer();
    return getPageCount(Buffer.from(buffer));
  }

  throw new Error('Unsupported file type. Please upload a PDF or image file.');
}

/**
 * Validate PDF file structure
 * @param fileBuffer - Buffer containing the PDF file data
 * @returns True if valid, throws error if invalid
 */
export async function validatePDF(fileBuffer: Buffer): Promise<boolean> {
  try {
    await pdf(fileBuffer);
    return true;
  } catch (error) {
    throw new Error('Invalid PDF file. The file may be corrupted or password-protected.');
  }
}

/**
 * Get PDF metadata including page count, text content length, etc.
 * @param fileBuffer - Buffer containing the PDF file data
 * @returns PDF metadata
 */
export async function getPDFMetadata(fileBuffer: Buffer) {
  try {
    const data = await pdf(fileBuffer);

    return {
      pages: data.numpages,
      info: data.info,
      metadata: data.metadata,
      version: data.version,
      textLength: data.text ? data.text.length : 0,
    };
  } catch (error) {
    console.error('Error reading PDF metadata:', error);
    throw new Error('Unable to read PDF metadata');
  }
}

/**
 * Calculate credits required for a file
 * @param file - File object
 * @returns Object with pageCount and creditsRequired (1:1 ratio)
 */
export async function calculateCreditsRequired(file: File): Promise<{
  pageCount: number;
  creditsRequired: number;
  fileType: string;
}> {
  const pageCount = await getPageCountFromFile(file);

  return {
    pageCount,
    creditsRequired: pageCount, // 1 credit per page
    fileType: file.type,
  };
}

/**
 * Validate file before processing
 * Checks file type, size, and validity
 * @param file - File object
 * @param maxSizeMB - Maximum file size in MB (default 50MB)
 * @returns Validation result
 */
export async function validateFileForProcessing(
  file: File,
  maxSizeMB: number = 50
): Promise<{
  isValid: boolean;
  error?: string;
  pageCount?: number;
}> {
  try {
    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return {
        isValid: false,
        error: `File is too large. Maximum size is ${maxSizeMB}MB.`,
      };
    }

    // Check file type
    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      return {
        isValid: false,
        error: 'Invalid file type. Please upload a PDF, JPG, or PNG file.',
      };
    }

    // Get and validate page count
    const pageCount = await getPageCountFromFile(file);

    if (pageCount < 1) {
      return {
        isValid: false,
        error: 'Invalid document. No pages found.',
      };
    }

    // Optional: Add maximum page limit if needed
    const maxPages = 100; // Adjust as needed
    if (pageCount > maxPages) {
      return {
        isValid: false,
        error: `Document has too many pages (${pageCount}). Maximum is ${maxPages} pages.`,
      };
    }

    return {
      isValid: true,
      pageCount,
    };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Unable to validate file',
    };
  }
}

/**
 * Format page count for display
 * @param pageCount - Number of pages
 * @returns Formatted string for user display
 */
export function formatPageCount(pageCount: number): string {
  return `${pageCount} ${pageCount === 1 ? 'page' : 'pages'}`;
}

/**
 * Format credits display
 * @param credits - Number of credits
 * @returns Formatted string for user display
 */
export function formatCredits(credits: number): string {
  return `${credits} ${credits === 1 ? 'credit' : 'credits'}`;
}

/**
 * Get credit usage message for user
 * @param pageCount - Number of pages in document
 * @param userCredits - User's current credit balance
 * @returns User-friendly message about credit usage
 */
export function getCreditUsageMessage(pageCount: number, userCredits: number): string {
  const creditsNeeded = pageCount;

  if (userCredits >= creditsNeeded) {
    return `This document has ${formatPageCount(pageCount)} and will use ${formatCredits(creditsNeeded)}. You have ${formatCredits(userCredits)} remaining.`;
  } else {
    const shortage = creditsNeeded - userCredits;
    return `Insufficient credits. This document needs ${formatCredits(creditsNeeded)} but you only have ${formatCredits(userCredits)}. You need ${formatCredits(shortage)} more.`;
  }
}
