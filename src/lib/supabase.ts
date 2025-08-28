import { createClient } from '@supabase/supabase-js';
import type { UploadResponse } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Upload a file to Supabase Storage
 */
export async function uploadFileToSupabase(
  file: File,
  bucket: string = 'documents'
): Promise<UploadResponse> {
  try {
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}_${cleanFileName}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

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