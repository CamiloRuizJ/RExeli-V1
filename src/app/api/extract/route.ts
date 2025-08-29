import { NextRequest, NextResponse } from 'next/server';
import { extractDocumentData } from '@/lib/openai';
import type { ApiResponse, ExtractionResponse, DocumentType } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    // Validate environment variables
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'dummy-key-for-build') {
      console.error('Extract API: OpenAI API key not configured');
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.'
      }, { status: 500 });
    }

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

    // Validate document type
    const validTypes: DocumentType[] = [
      'rent_roll',
      'offering_memo',
      'lease_agreement',
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
    console.log(`Starting data extraction for document type: ${documentType}`);
    const extractedData = await extractDocumentData(file, documentType);
    console.log('Data extraction completed:', extractedData);
    
    const processingTime = Date.now() - startTime;

    const response: ApiResponse<ExtractionResponse> = {
      success: true,
      data: {
        extractedData,
        processingTime
      },
      message: 'Data extraction completed successfully'
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Extraction API error:', error);
    
    // Provide more detailed error messages based on error type
    let errorMessage = 'Data extraction failed';
    let statusCode = 500;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      // Handle specific OpenAI errors
      if (error.message.includes('401') || error.message.includes('invalid_api_key')) {
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