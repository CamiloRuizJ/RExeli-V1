/**
 * DEBUG ENDPOINT - Check Supabase Configuration
 * This endpoint helps diagnose connection issues
 * DELETE THIS FILE after debugging
 */

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,

      // Check which variables exist (without exposing values)
      encryptedSupabaseUrl: {
        exists: !!process.env.ENCRYPTED_SUPABASE_URL,
        length: process.env.ENCRYPTED_SUPABASE_URL?.length || 0,
      },
      encryptedSupabaseAnonKey: {
        exists: !!process.env.ENCRYPTED_SUPABASE_ANON_KEY,
        length: process.env.ENCRYPTED_SUPABASE_ANON_KEY?.length || 0,
      },
      supabaseServiceRoleKey: {
        exists: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
        startsWithEyJ: process.env.SUPABASE_SERVICE_ROLE_KEY?.startsWith('eyJ') || false,
      },
      encryptionKey: {
        exists: !!process.env.ENCRYPTION_KEY,
        length: process.env.ENCRYPTION_KEY?.length || 0,
      },
      nextPublicSupabaseUrl: {
        exists: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        value: process.env.NEXT_PUBLIC_SUPABASE_URL || 'not set',
      },
    };

    return NextResponse.json({
      success: true,
      diagnostics,
      message: 'Environment variable diagnostics',
    });

  } catch (error) {
    console.error('Diagnostics error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
