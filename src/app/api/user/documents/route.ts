/**
 * User Documents API
 * Returns all documents for the current user with optional filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin as supabase } from '@/lib/supabase';

// Valid document types for filtering
const VALID_DOCUMENT_TYPES = [
  'all',
  'rent_roll',
  'operating_budget',
  'broker_sales_comparables',
  'broker_lease_comparables',
  'broker_listing',
  'offering_memo',
  'lease_agreement',
  'financial_statements',
];

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const documentType = searchParams.get('type');

    // Validate document type if provided
    if (documentType && !VALID_DOCUMENT_TYPES.includes(documentType)) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }

    // Build query for documents
    let documentsQuery = supabase
      .from('user_documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (documentType && documentType !== 'all') {
      documentsQuery = documentsQuery.eq('document_type', documentType);
    }

    // Fetch documents and stats in parallel
    const [documentsResult, statsResult] = await Promise.all([
      documentsQuery,
      supabase
        .from('user_documents')
        .select('page_count, credits_used, processing_status')
        .eq('user_id', userId)
    ]);

    if (documentsResult.error) {
      console.error('Error fetching documents:', documentsResult.error);
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
    }

    // Calculate stats
    const allDocs = statsResult.data || [];
    const stats = {
      totalDocuments: allDocs.length,
      totalPages: allDocs.reduce((sum, doc) => sum + (doc.page_count || 0), 0),
      totalCreditsUsed: allDocs.reduce((sum, doc) => sum + (doc.credits_used || 0), 0),
      completedDocuments: allDocs.filter(doc => doc.processing_status === 'completed').length,
    };

    return NextResponse.json({
      documents: documentsResult.data || [],
      stats
    });

  } catch (error) {
    console.error('Documents API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
