import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { ApiResponse } from '@/lib/types';

interface UploadUrlRequest {
  filename: string;
  contentType: string;
  fileSize: number;
}

interface UploadUrlResponse {
  uploadUrl: string;
  filePath: string;
  publicUrl: string;
}

export async function POST(request: NextRequest) {
  try {
    const { filename, contentType, fileSize }: UploadUrlRequest = await request.json();

    // Validate input
    if (!filename || !contentType || !fileSize) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Missing required fields: filename, contentType, and fileSize'
      }, { status: 400 });
    }

    // Validate file type (PDF documents)
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png'
    ];

    if (!allowedTypes.includes(contentType)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Invalid file type. Please upload PDF, JPEG, or PNG files only.'
      }, { status: 400 });
    }

    // Validate file size (25MB limit)
    const maxSize = 25 * 1024 * 1024; // 25MB in bytes
    if (fileSize > maxSize) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'File size too large. Maximum size is 25MB.'
      }, { status: 400 });
    }

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const cleanFileName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${timestamp}_${cleanFileName}`;

    console.log(`Upload URL API: Generating signed URL for ${filePath} (${fileSize} bytes)`);

    // Create signed upload URL - expires in 1 hour
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUploadUrl(filePath, {
        expiresIn: 3600, // 1 hour
      });

    if (error) {
      console.error('Supabase signed URL error:', error);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: `Failed to create upload URL: ${error.message}`
      }, { status: 500 });
    }

    // Get the future public URL
    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);

    const response: ApiResponse<UploadUrlResponse> = {
      success: true,
      data: {
        uploadUrl: data.signedUrl,
        filePath: filePath,
        publicUrl: urlData.publicUrl
      },
      message: 'Upload URL generated successfully'
    };

    console.log('Upload URL API: Generated successfully:', response.data);
    return NextResponse.json(response);

  } catch (error) {
    console.error('Upload URL API error:', error);

    let errorMessage = 'Failed to generate upload URL';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

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