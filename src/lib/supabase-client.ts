/**
 * Client-side Supabase utility for direct browser uploads
 * Bypasses Vercel serverless functions to avoid 4.5MB body size limits
 *
 * Flow: Browser → Supabase Storage (direct, no Vercel middleware)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { ApiResponse } from './types';

// Singleton client instance
let supabaseClient: SupabaseClient | null = null;
let configPromise: Promise<{ url: string; anonKey: string }> | null = null;

/**
 * Fetch Supabase configuration from the server
 * Configuration is cached for the session
 */
async function getSupabaseConfig(): Promise<{ url: string; anonKey: string }> {
  // Return cached promise if already fetching
  if (configPromise) {
    return configPromise;
  }

  // Fetch configuration from server
  configPromise = (async () => {
    try {
      const response = await fetch('/api/config/supabase');

      if (!response.ok) {
        throw new Error('Failed to fetch Supabase configuration');
      }

      const result: ApiResponse<{ url: string; anonKey: string }> = await response.json();

      if (!result.success || !result.data) {
        throw new Error('Invalid Supabase configuration response');
      }

      return result.data;
    } catch (error) {
      // Clear cache on error so retry is possible
      configPromise = null;
      throw error;
    }
  })();

  return configPromise;
}

/**
 * Get or create Supabase client instance
 * Client is initialized lazily on first use
 */
async function getSupabaseClient(): Promise<SupabaseClient> {
  if (supabaseClient) {
    return supabaseClient;
  }

  const { url, anonKey } = await getSupabaseConfig();

  supabaseClient = createClient(url, anonKey, {
    auth: {
      persistSession: false // No auth needed for public uploads
    }
  });

  return supabaseClient;
}

/**
 * Upload a file directly from browser to Supabase Storage
 * Bypasses Vercel serverless functions completely
 *
 * @param file - File object from browser input
 * @param bucket - Supabase storage bucket name (default: 'documents')
 * @returns Object containing file path and public URL
 *
 * @example
 * const result = await uploadFileDirectly(file, 'documents');
 * console.log('Uploaded to:', result.url);
 */
export async function uploadFileDirectly(
  file: File,
  bucket: string = 'documents'
): Promise<{ path: string; url: string; filename: string }> {
  try {
    console.log(`[Supabase Client] Starting direct upload to bucket '${bucket}' for file: ${file.name} (${file.size} bytes)`);

    const client = await getSupabaseClient();

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}_${cleanFileName}`;

    console.log(`[Supabase Client] Generated filename: ${fileName}`);

    // Upload directly to Supabase Storage
    const { data, error } = await client.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('[Supabase Client] Upload error:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }

    console.log('[Supabase Client] File uploaded successfully:', data);

    // Get public URL
    const { data: urlData } = client.storage
      .from(bucket)
      .getPublicUrl(data.path);

    console.log('[Supabase Client] Generated public URL:', urlData.publicUrl);

    return {
      path: data.path,
      url: urlData.publicUrl,
      filename: fileName
    };

  } catch (error) {
    console.error('[Supabase Client] Upload error:', error);
    throw error;
  }
}

/**
 * Delete a file from Supabase Storage
 * Used for cleanup if subsequent operations fail
 *
 * @param path - File path in storage (from upload response)
 * @param bucket - Supabase storage bucket name
 */
export async function deleteFileDirectly(
  path: string,
  bucket: string = 'documents'
): Promise<void> {
  try {
    const client = await getSupabaseClient();

    const { error } = await client.storage
      .from(bucket)
      .remove([path]);

    if (error) {
      console.error('[Supabase Client] Delete error:', error);
      throw new Error(`Delete failed: ${error.message}`);
    }

    console.log('[Supabase Client] File deleted successfully:', path);
  } catch (error) {
    console.error('[Supabase Client] Delete error:', error);
    throw error;
  }
}
