import { NextRequest, NextResponse } from 'next/server';
import { classifyDocument } from '@/lib/openai';
import type { ApiResponse, ClassificationResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    // Validate environment variables
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'dummy-key-for-build') {
      console.error('Classification API: OpenAI API key not configured');
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.'
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

    // Classify document using OpenAI Vision (handles PDF conversion automatically)
    console.log(`Processing file: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);
    console.log('Starting document classification...');
    const classification = await classifyDocument(file);
    console.log('Classification completed:', classification);

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
    
    // Provide more detailed error messages based on error type
    let errorMessage = 'Classification failed';
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