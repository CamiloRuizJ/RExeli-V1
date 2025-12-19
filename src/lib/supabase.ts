import { createClient } from '@supabase/supabase-js';
import type { UploadResponse } from './types';

// Get Supabase configuration from environment variables
function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // During build time, return dummy values to prevent build errors
    // This allows the build to succeed while actual values will be used at runtime
    console.warn('Supabase environment variables not found during build - using placeholders');
    return {
      url: 'https://placeholder.supabase.co',
      key: 'build-time-placeholder-key'
    };
  }

  return {
    url,
    key
  };
}

const { url: supabaseUrl, key: supabaseAnonKey } = getSupabaseConfig();

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Get service role configuration (for admin operations)
function getServiceRoleConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    // During build time, return dummy values to prevent build errors
    console.warn('Service role keys not found during build - using placeholders');
    return {
      url: 'https://placeholder.supabase.co',
      key: 'build-time-placeholder-service-key'
    };
  }

  return {
    url,
    key: serviceKey
  };
}

const { url: serviceUrl, key: serviceKey } = getServiceRoleConfig();

// Service role client for admin operations (bypasses RLS)
// Important: auth.persistSession must be false for server-side usage
// auth.autoRefreshToken must be false to prevent token refresh issues
export const supabaseAdmin = createClient(serviceUrl, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

// Log configuration for debugging (without exposing encrypted keys)
if (typeof window === 'undefined') {
  console.log('Supabase configured:', {
    url: supabaseUrl.substring(0, 30) + '...',
    keyPrefix: supabaseAnonKey.substring(0, 10) + '...',
    hasUrl: !!supabaseUrl && supabaseUrl !== 'https://dummy.supabase.co',
    hasKey: !!supabaseAnonKey && supabaseAnonKey !== 'dummy-key'
  });
}

/**
 * Upload a file to Supabase Storage
 */
export async function uploadFileToSupabase(
  file: File,
  bucket: string = 'documents'
): Promise<UploadResponse> {
  try {
    console.log(`Supabase: Starting upload to bucket '${bucket}' for file: ${file.name}`);
    
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}_${cleanFileName}`;
    
    console.log(`Supabase: Generated filename: ${fileName}`);

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: '0',
        upsert: false,
      });

    if (error) {
      console.error('Supabase upload error details:', {
        message: error.message,
        error: error
      });
      throw new Error(`Upload failed: ${error.message}`);
    }
    
    console.log('Supabase: File uploaded successfully:', data);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);
    
    console.log('Supabase: Generated public URL:', urlData.publicUrl);

    return {
      fileId: data.path,
      url: urlData.publicUrl,
      filename: fileName,
      size: file.size,
    };
  } catch (error) {
    console.error('Supabase upload error:', error);
    throw error;
  }
}

/**
 * Get a signed URL for downloading a file
 */
export async function getSignedUrl(
  path: string,
  bucket: string = 'documents',
  expiresIn: number = 3600
) {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) {
      throw new Error(`Failed to create signed URL: ${error.message}`);
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Signed URL error:', error);
    throw error;
  }
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteFile(path: string, bucket: string = 'documents') {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }

    return true;
  } catch (error) {
    console.error('Delete file error:', error);
    throw error;
  }
}

/**
 * List files in a bucket
 */
export async function listFiles(
  path: string = '',
  bucket: string = 'documents'
) {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(path);

    if (error) {
      throw new Error(`List files failed: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('List files error:', error);
    throw error;
  }
}

// Database operations would go here if we add tables for tracking documents
// For V1, we'll focus on file storage only