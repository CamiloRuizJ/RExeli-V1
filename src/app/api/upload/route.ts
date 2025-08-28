import { NextRequest, NextResponse } from 'next/server';
import { uploadFileToSupabase } from '@/lib/supabase';
import type { ApiResponse, UploadResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    // Validate environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Supabase configuration missing'
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

    // Validate file size (25MB limit)
    const maxSize = 25 * 1024 * 1024; // 25MB in bytes
    if (file.size > maxSize) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'File size too large. Maximum size is 25MB.'
      }, { status: 400 });
    }

    // Upload to Supabase
    const uploadResult = await uploadFileToSupabase(file);

    const response: ApiResponse<UploadResponse> = {
      success: true,
      data: uploadResult,
      message: 'File uploaded successfully'
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Upload API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Upload failed';
    
    return NextResponse.json<ApiResponse>({
      success: false,
      error: errorMessage
    }, { status: 500 });
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