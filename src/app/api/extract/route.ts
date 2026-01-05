import { NextRequest, NextResponse } from 'next/server';
import { extractDocumentData } from '@/lib/anthropic';
import { transformExtractedData } from '@/lib/data-transformers';
import { getSession } from '@/lib/auth-helpers';
import type { ApiResponse, ExtractionResponse, DocumentType, ExtractedData } from '@/lib/types';
import { getPageCount } from '@/lib/pdfUtils';
import { validateCreditTransaction, deductCredits, logUsage, saveUserDocument } from '@/middleware/creditCheck';

// Route segment config - optimize for long-running Claude API calls
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for large PDF processing

export async function POST(request: NextRequest) {
  console.log('[Extract API] POST request received');
  console.log('[Extract API] Request method:', request.method);
  console.log('[Extract API] Request headers:', Object.fromEntries(request.headers.entries()));

  try {
    // Get user session - REQUIRED for credit system
    const session = await getSession();

    console.log('[Extract API] Session check:', session ? 'Authenticated' : 'Not authenticated');
    console.log('[Extract API] User ID:', session?.user?.id || 'None');
    console.log('[Extract API] User role:', session?.user?.role || 'None');

    // Require authentication
    if (!session?.user?.id) {
      console.log('[Extract API] Authentication failed - no user ID');
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Authentication required. Please sign in to process documents.'
      }, { status: 401 });
    }

    const userId = session.user.id;
    console.log('[Extract API] Processing for user:', userId, session.user.email);

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const supabaseUrl = formData.get('supabaseUrl') as string | null;
    const documentType = formData.get('documentType') as DocumentType;
    const userInstructions = formData.get('userInstructions') as string | null;

    // Accept either a file directly or a Supabase URL to fetch from
    if (!file && !supabaseUrl) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'No file or Supabase URL provided'
      }, { status: 400 });
    }

    if (!documentType) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Document type is required'
      }, { status: 400 });
    }

    // Validate document type - now supports all 8 document types for manual selection
    const validTypes: DocumentType[] = [
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
      'financial_statement'
    ];

    if (!validTypes.includes(documentType)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Invalid document type'
      }, { status: 400 });
    }

    // If Supabase URL is provided, fetch the file from there
    let fileToProcess: File;
    if (supabaseUrl) {
      console.log(`Fetching file from Supabase URL: ${supabaseUrl}`);
      try {
        const response = await fetch(supabaseUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch file from Supabase: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
        // Extract filename from URL or use default
        const urlParts = supabaseUrl.split('/');
        const filename = urlParts[urlParts.length - 1].split('?')[0] || 'document.pdf';
        fileToProcess = new File([blob], filename, { type: 'application/pdf' });
        console.log(`Successfully fetched file from Supabase: ${filename}, size: ${fileToProcess.size} bytes`);
      } catch (fetchError) {
        console.error('Error fetching file from Supabase:', fetchError);
        return NextResponse.json<ApiResponse>({
          success: false,
          error: `Failed to fetch file from Supabase: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`
        }, { status: 500 });
      }
    } else {
      fileToProcess = file as File;
    }

    // ============================================
    // CREDIT SYSTEM: Count pages and validate credits
    // ============================================
    let pageCount = 1; // Default for images

    // Count pages for PDFs
    if (fileToProcess.type === 'application/pdf') {
      try {
        const arrayBuffer = await fileToProcess.arrayBuffer();
        pageCount = await getPageCount(Buffer.from(arrayBuffer));
        console.log(`[CREDIT CHECK] Document has ${pageCount} pages`);
      } catch (pageError) {
        console.error('Error counting pages:', pageError);
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Unable to read document pages. Please ensure the file is not corrupted.'
        }, { status: 400 });
      }
    }

    // Validate user has sufficient credits
    const creditValidation = await validateCreditTransaction(userId, pageCount);

    if (!creditValidation.isValid) {
      console.log(`[CREDIT DENIED] User ${session.user.email} - ${creditValidation.message}`);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: creditValidation.message
      }, { status: 402 }); // Payment Required
    }

    console.log(`[CREDIT APPROVED] ${creditValidation.message}`);

    // Extract structured data using Claude Sonnet 4.5 (handles PDF conversion automatically)
    const startTime = Date.now();
    console.log(`Processing file for extraction: ${fileToProcess.name}, size: ${fileToProcess.size} bytes, type: ${fileToProcess.type}`);

    // Check if this is a multi-page document
    if (fileToProcess.type === 'application/json' && fileToProcess.name.includes('multipage')) {
      try {
        const fileText = await fileToProcess.text();
        const multiPageData = JSON.parse(fileText);
        if (multiPageData.type === 'multi-page' && Array.isArray(multiPageData.pages)) {
          console.log(`Multi-page document detected: ${multiPageData.pages.length} pages for ${documentType}`);
        }
      } catch (parseError) {
        console.warn('Could not parse multi-page data for logging:', parseError);
      }
    }

    console.log(`Starting data extraction for manually selected document type: ${documentType}`);
    if (userInstructions) {
      console.log(`[Extract API] User provided custom instructions: ${userInstructions.substring(0, 100)}...`);
    }

    // Create user metadata for extraction
    const userMetadata = {
      pdfFileName: fileToProcess.name,
      rexeliUserName: session?.user?.name || 'Unknown User',
      rexeliUserEmail: session?.user?.email || 'unknown@rexeli.com',
      extractionTimestamp: new Date().toISOString(),
      documentId: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    console.log('[Extract API] User metadata:', userMetadata);

    let extractedData;
    let partialSuccess = false;
    let warnings: string[] = [];

    try {
      extractedData = await extractDocumentData(fileToProcess, documentType, userMetadata, userInstructions || undefined);
      console.log('Raw data extraction completed:', extractedData);

      // Transform the extracted data to match display component expectations
      extractedData = transformExtractedData(extractedData);
      console.log('Data transformation completed successfully');
    } catch (extractionError) {
      console.error('Extraction error, attempting partial recovery:', extractionError);

      // Try to provide partial results if extraction fails
      if (extractionError instanceof Error && extractionError.message.includes('Invalid JSON')) {
        partialSuccess = true;
        warnings.push('Some data may be incomplete due to parsing errors');
        // Return a minimal structure for the selected document type with type assertion
        extractedData = {
          documentType,
          metadata: {
            // Document metadata (failed extraction)
            extractedDate: new Date().toISOString().split('T')[0],
            propertyName: 'Unable to extract',
            propertyAddress: 'Unable to extract',
            // User metadata (from system)
            ...userMetadata
          },
          data: {} as any // Empty data object with type assertion - client should handle gracefully
        } as ExtractedData;
      } else {
        throw extractionError; // Re-throw if not a parsing error
      }
    }

    const processingTime = Date.now() - startTime;

    // ============================================
    // CREDIT SYSTEM: Deduct credits and log usage (only on success)
    // ============================================
    const deductionResult = await deductCredits(userId, pageCount);

    if (!deductionResult.success) {
      console.error('[CREDIT DEDUCTION FAILED]', deductionResult.error);
      // Still return the extracted data but warn about credit issue
      warnings.push('Credit deduction failed. Please contact support.');
    }

    // Log usage - CHECK RETURN VALUE
    const usageLogged = await logUsage(userId, {
      documentType,
      fileName: fileToProcess.name,
      filePath: supabaseUrl || fileToProcess.name,
      pageCount,
      processingStatus: 'success',
      processingTimeMs: processingTime,
    });

    if (!usageLogged) {
      console.error('[USAGE LOG FAILED] Failed to log usage for user:', session.user.email, 'document:', fileToProcess.name);
      warnings.push('Usage logging failed. Please contact support if this persists.');
    } else {
      console.log('[USAGE LOG SUCCESS] Logged usage for user:', session.user.email);
    }

    // Save document to user history - CHECK RETURN VALUE
    const documentId = await saveUserDocument(userId, {
      filePath: supabaseUrl || fileToProcess.name,
      fileName: fileToProcess.name,
      documentType,
      extractedData: extractedData,
      pageCount,
      processingStatus: 'completed',
    });

    if (!documentId) {
      console.error('[DOCUMENT SAVE FAILED] Failed to save document for user:', session.user.email, 'document:', fileToProcess.name);
      warnings.push('Document history save failed. Please contact support if this persists.');
    } else {
      console.log('[DOCUMENT SAVE SUCCESS] Saved document:', documentId, 'for user:', session.user.email);
    }

    console.log(`[CREDIT DEDUCTED] User ${session.user.email} - ${pageCount} credits used. Remaining: ${deductionResult.remainingCredits}`);

    const response: ApiResponse<ExtractionResponse> = {
      success: true,
      data: {
        extractedData,
        processingTime,
        creditsUsed: pageCount,
        remainingCredits: deductionResult.remainingCredits,
      } as any,
      message: partialSuccess
        ? `Data extraction completed with partial results for ${documentType.replace('_', ' ')}`
        : `Successfully processed! ${pageCount} ${pageCount === 1 ? 'credit' : 'credits'} used. ${deductionResult.remainingCredits} ${deductionResult.remainingCredits === 1 ? 'credit' : 'credits'} remaining.`,
      ...(warnings.length > 0 && { warnings })
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    });

  } catch (error) {
    console.error('Extraction API error:', error);

    // ============================================
    // CREDIT SYSTEM: Log failed processing (NO credit deduction)
    // ============================================
    const session = await getSession();
    if (session?.user?.id) {
      try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const documentType = formData.get('documentType') as string;

        // Try to get page count for logging (best effort)
        let pageCount = 1;
        if (file && file.type === 'application/pdf') {
          try {
            const arrayBuffer = await file.arrayBuffer();
            pageCount = await getPageCount(Buffer.from(arrayBuffer));
          } catch {}
        }

        // Log failed processing (no credit deduction)
        await logUsage(session.user.id, {
          documentType: documentType || 'unknown',
          fileName: file?.name || 'unknown',
          filePath: file?.name || 'unknown',
          pageCount,
          processingStatus: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });
      } catch (logError) {
        console.error('Error logging failed processing:', logError);
      }
    }

    // Provide more detailed error messages based on error type
    let errorMessage = 'Data extraction failed';
    let statusCode = 500;

    if (error instanceof Error) {
      errorMessage = error.message;

      // Handle timeout errors specifically
      if (error.message.includes('timeout') || error.message.includes('aborted') || error.message.includes('ETIMEDOUT')) {
        errorMessage = 'Extraction timeout: Document processing took too long. ' +
                       'This usually happens with large multi-page documents (10+ pages). ' +
                       'Please try with a smaller document or split your PDF into sections.';
        statusCode = 504;
      }
      // Handle specific Claude/Anthropic errors
      else if (error.message.includes('401') || error.message.includes('invalid_api_key') || error.message.includes('authentication')) {
        errorMessage = 'Invalid Anthropic API key. Please check your API key configuration.';
        statusCode = 401;
      } else if (error.message.includes('429') || error.message.includes('rate_limit')) {
        errorMessage = 'Anthropic API rate limit exceeded. Please try again later.';
        statusCode = 429;
      } else if (error.message.includes('insufficient_quota') || error.message.includes('credit_balance')) {
        errorMessage = 'Anthropic API quota exceeded. Please check your billing details.';
        statusCode = 402;
      } else if (error.message.includes('No extraction prompt available')) {
        errorMessage = `Unsupported document type for extraction: ${error.message.split(': ')[1] || 'unknown'}`;
        statusCode = 400;
      }
    }

    return NextResponse.json<ApiResponse>({
      success: false,
      error: errorMessage
    }, { status: statusCode });
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400', // 24 hours
    },
  });
}

// Add GET handler to prevent 405 errors and provide helpful message
export async function GET(request: NextRequest) {
  console.log('[Extract API] WARNING: GET request received (should be POST)');
  console.log('[Extract API] Request URL:', request.url);
  console.log('[Extract API] Request headers:', Object.fromEntries(request.headers.entries()));

  return NextResponse.json({
    success: false,
    error: 'GET method not supported. Please use POST to submit documents for extraction.',
    hint: 'This endpoint requires POST method with multipart/form-data containing documentType and either file or supabaseUrl.'
  }, { status: 405 });
}