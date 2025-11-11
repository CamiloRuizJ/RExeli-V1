/**
 * User API: Download Document
 * GET /api/user/documents/[id]/download
 * Allows users to download their processed documents as JSON
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const { id } = await context.params;

    // Get document and verify ownership
    const { data: document, error } = await supabase
      .from('user_documents')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !document) {
      return NextResponse.json(
        { success: false, error: 'Document not found or access denied' },
        { status: 404 }
      );
    }

    // Check if document was successfully processed
    if (document.processing_status !== 'completed') {
      return NextResponse.json(
        { success: false, error: 'Document processing not completed' },
        { status: 400 }
      );
    }

    // Increment download count
    await supabase
      .from('user_documents')
      .update({
        download_count: (document.download_count || 0) + 1,
      })
      .eq('id', id);

    // Prepare download data
    const downloadData = {
      documentId: document.id,
      fileName: document.file_name,
      documentType: document.document_type,
      processedAt: document.created_at,
      pageCount: document.page_count,
      extractedData: document.extracted_data,
    };

    // Create safe filename
    const timestamp = new Date().toISOString().split('T')[0];
    const safeFileName = document.file_name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const downloadFileName = `rexeli_${safeFileName}_${timestamp}.json`;

    // Return JSON file for download
    return new NextResponse(JSON.stringify(downloadData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${downloadFileName}"`,
      },
    });
  } catch (error) {
    console.error('Error downloading document:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to download document' },
      { status: 500 }
    );
  }
}
