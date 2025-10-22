import { NextRequest, NextResponse } from 'next/server';
import { extractDocumentData } from '@/lib/openai';
import { transformExtractedData } from '@/lib/data-transformers';
import type { ApiResponse, ExtractionResponse, DocumentType, ExtractedData } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const documentType = formData.get('documentType') as DocumentType;

    if (!file) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'No file provided'
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

    // Extract structured data using OpenAI Vision (handles PDF conversion automatically)
    const startTime = Date.now();
    console.log(`Processing file for extraction: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);

    // Check if this is a multi-page document
    if (file.type === 'application/json' && file.name.includes('multipage')) {
      try {
        const fileText = await file.text();
        const multiPageData = JSON.parse(fileText);
        if (multiPageData.type === 'multi-page' && Array.isArray(multiPageData.pages)) {
          console.log(`Multi-page document detected: ${multiPageData.pages.length} pages for ${documentType}`);
        }
      } catch (parseError) {
        console.warn('Could not parse multi-page data for logging:', parseError);
      }
    }

    console.log(`Starting data extraction for manually selected document type: ${documentType}`);

    let extractedData;
    let partialSuccess = false;
    let warnings: string[] = [];

    try {
      extractedData = await extractDocumentData(file, documentType);
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
            extractedDate: new Date().toISOString().split('T')[0],
            propertyName: 'Unable to extract',
            propertyAddress: 'Unable to extract'
          },
          data: {} as any // Empty data object with type assertion - client should handle gracefully
        } as ExtractedData;
      } else {
        throw extractionError; // Re-throw if not a parsing error
      }
    }

    const processingTime = Date.now() - startTime;

    const response: ApiResponse<ExtractionResponse> = {
      success: true,
      data: {
        extractedData,
        processingTime
      },
      message: partialSuccess
        ? `Data extraction completed with partial results for ${documentType.replace('_', ' ')}`
        : `Data extraction completed successfully for ${documentType.replace('_', ' ')}`,
      ...(warnings.length > 0 && { warnings })
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Extraction API error:', error);

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
      // Handle specific OpenAI errors
      else if (error.message.includes('401') || error.message.includes('invalid_api_key')) {
        errorMessage = 'Invalid OpenAI API key. Please check your API key configuration.';
        statusCode = 401;
      } else if (error.message.includes('429')) {
        errorMessage = 'OpenAI API rate limit exceeded. Please try again later.';
        statusCode = 429;
      } else if (error.message.includes('insufficient_quota')) {
        errorMessage = 'OpenAI API quota exceeded. Please check your billing details.';
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
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}