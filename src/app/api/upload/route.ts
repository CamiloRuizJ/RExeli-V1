import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, UploadResponse } from '@/lib/types';

// Route segment config - optimize for metadata processing
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds timeout for metadata operations

/**
 * Upload API Route - Accepts metadata from direct Supabase uploads
 *
 * This route NO LONGER accepts file uploads directly. Files are uploaded
 * directly from the browser to Supabase Storage, and this route only
 * receives metadata for database record creation.
 *
 * This approach bypasses Vercel's 4.5MB request body limit.
 */
export async function POST(request: NextRequest) {
  try {
    // Parse JSON metadata (no longer using FormData)
    const metadata = await request.json();
    const { supabaseUrl, filename, size, mimeType, path } = metadata;

    // Validate required metadata fields
    if (!supabaseUrl) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Missing required field: supabaseUrl'
      }, { status: 400 });
    }

    if (!filename) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Missing required field: filename'
      }, { status: 400 });
    }

    if (!size) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Missing required field: size'
      }, { status: 400 });
    }

    // Validate file type from mimeType
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png'
    ];

    if (mimeType && !allowedTypes.includes(mimeType)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Invalid file type. Please upload PDF, JPEG, or PNG files only.'
      }, { status: 400 });
    }

    // Validate file size (25MB limit)
    const maxSize = 25 * 1024 * 1024; // 25MB in bytes
    if (size > maxSize) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'File size too large. Maximum size is 25MB.'
      }, { status: 400 });
    }

    // Validate Supabase URL format
    if (!supabaseUrl.includes('supabase.co/storage/v1/object/public/')) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Invalid Supabase URL format'
      }, { status: 400 });
    }

    console.log(`[Upload API] Received metadata for: ${filename} (${(size / 1024 / 1024).toFixed(2)}MB)`);
    console.log(`[Upload API] Supabase URL: ${supabaseUrl}`);

    // Create response with upload metadata
    // File is already uploaded to Supabase at this point
    const uploadResult: UploadResponse = {
      fileId: path || filename,
      url: supabaseUrl,
      filename: filename,
      size: size
    };

    const response: ApiResponse<UploadResponse> = {
      success: true,
      data: uploadResult,
      message: 'File metadata recorded successfully'
    };

    console.log('[Upload API] Metadata processing completed successfully');
    return NextResponse.json(response);

  } catch (error) {
    console.error('[Upload API] Metadata processing error:', error);

    // Provide more detailed error messages based on error type
    let errorMessage = 'Metadata processing failed';
    let statusCode = 500;

    if (error instanceof Error) {
      errorMessage = error.message;

      // Handle JSON parsing errors
      if (error.message.includes('JSON')) {
        errorMessage = 'Invalid request format. Expected JSON metadata.';
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
