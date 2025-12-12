/**
 * GET /api/config/supabase
 * Provides Supabase configuration for client-side uploads
 * Returns decrypted URL and anon key safe for browser use
 */

import { NextRequest, NextResponse } from 'next/server';
import { decryptApiKey, auth } from '@/lib/auth';
import type { ApiResponse } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Require authentication to prevent credential exposure
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const encryptedUrl = process.env.ENCRYPTED_SUPABASE_URL;
    const encryptedKey = process.env.ENCRYPTED_SUPABASE_ANON_KEY;

    if (!encryptedUrl || !encryptedKey) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Supabase configuration not available'
      }, { status: 500 });
    }

    // Decrypt the configuration
    const supabaseUrl = decryptApiKey(encryptedUrl);
    const supabaseAnonKey = decryptApiKey(encryptedKey);

    const response: ApiResponse<{ url: string; anonKey: string }> = {
      success: true,
      data: {
        url: supabaseUrl,
        anonKey: supabaseAnonKey
      }
    };

    return NextResponse.json(response, {
      headers: {
        // Cache for 1 hour since config rarely changes
        'Cache-Control': 'private, max-age=3600'
      }
    });

  } catch (error) {
    console.error('Supabase config error:', error);

    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Failed to retrieve Supabase configuration'
    }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
