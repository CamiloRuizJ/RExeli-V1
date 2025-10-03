import { NextRequest, NextResponse } from 'next/server';
import { uploadFileToSupabase } from '@/lib/supabase';
import type { ApiResponse, UploadResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const skipSizeLimit = formData.get('skipSizeLimit') === 'true'; // For admin training uploads
    const bucket = (formData.get('bucket') as string) || 'documents'; // Default to 'documents' bucket

    if (!file) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'No file provided'
      }, { status: 400 });
    }

    // Validate file type (PDF documents)
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png'
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Invalid file type. Please upload PDF, JPEG, or PNG files only.'
      }, { status: 400 });
    }

    // Validate file size (25MB limit for regular uploads, no limit for admin training uploads)
    if (!skipSizeLimit) {
      const maxSize = 25 * 1024 * 1024; // 25MB in bytes
      if (file.size > maxSize) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'File size too large. Maximum size is 25MB.'
        }, { status: 400 });
      }
    }

    // Upload to Supabase
    console.log(`Upload API: Starting upload for ${file.name} (${file.size} bytes) to bucket '${bucket}'`);
    const uploadResult = await uploadFileToSupabase(file, bucket);
    console.log('Upload API: Upload completed successfully:', uploadResult);

    const response: ApiResponse<UploadResponse> = {
      success: true,
      data: uploadResult,
      message: 'File uploaded successfully'
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Upload API error:', error);
    
    // Provide more detailed error messages based on error type
    let errorMessage = 'Upload failed';
    let statusCode = 500;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      // Handle specific Supabase errors
      if (error.message.includes('signature verification failed')) {
        errorMessage = 'Supabase authentication failed. Please check your API keys.';
        statusCode = 401;
      } else if (error.message.includes('Invalid API key')) {
        errorMessage = 'Invalid Supabase API key. Please check your configuration.';
        statusCode = 401;
      } else if (error.message.includes('Upload failed')) {
        statusCode = 400;
      }
    }
    
    return NextResponse.json<ApiResponse>({
      success: false,
      error: errorMessage
    }, { status: statusCode });
  }
}

// Handle OPTIONS request for CORS
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