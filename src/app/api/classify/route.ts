import { NextRequest, NextResponse } from 'next/server';
import { classifyDocument, fileToBase64 } from '@/lib/openai';
import type { ApiResponse, ClassificationResponse } from '@/lib/types';

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

    if (!file) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'No file provided'
      }, { status: 400 });
    }

    // Convert file to base64 for OpenAI Vision API
    let imageBase64: string;
    
    try {
      imageBase64 = await fileToBase64(file);
    } catch (error) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Failed to process file for classification'
      }, { status: 400 });
    }

    // Classify document using OpenAI Vision
    const classification = await classifyDocument(imageBase64);

    const response: ApiResponse<ClassificationResponse> = {
      success: true,
      data: {
        classification,
        extractionPrompt: `Document classified as ${classification.type} with ${(classification.confidence * 100).toFixed(1)}% confidence`
      },
      message: 'Document classified successfully'
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Classification API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Classification failed';
    
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