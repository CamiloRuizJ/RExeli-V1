import { NextRequest, NextResponse } from 'next/server';
import { extractDocumentData, fileToBase64 } from '@/lib/openai';
import type { ApiResponse, ExtractionResponse, DocumentType } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    // Validate environment variables
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'dummy-key-for-build') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'OpenAI API key not configured'
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

    // Convert file to base64 for OpenAI Vision API
    let imageBase64: string;
    const startTime = Date.now();
    
    try {
      imageBase64 = await fileToBase64(file);
    } catch (error) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Failed to process file for extraction'
      }, { status: 400 });
    }

    // Extract structured data using OpenAI Vision
    const extractedData = await extractDocumentData(imageBase64, documentType);
    
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
    
    const errorMessage = error instanceof Error ? error.message : 'Data extraction failed';
    
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