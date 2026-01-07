/**
 * User Documents API
 * Returns all documents for the current user with optional filtering
 *
 * For users in groups with shared visibility, also returns documents
 * created by other group members.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-helpers';
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
    const session = await getSession();

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

    // Check if user is in a group with shared visibility
    const { data: userData } = await supabase
      .from('users')
      .select('group_id')
      .eq('id', userId)
      .single();

    let groupInfo: { id: string; document_visibility: string } | null = null;

    if (userData?.group_id) {
      const { data: groupData } = await supabase
        .from('user_groups')
        .select('id, document_visibility, is_active')
        .eq('id', userData.group_id)
        .single();

      if (groupData?.is_active && groupData.document_visibility === 'shared') {
        groupInfo = groupData;
      }
    }

    let documents: any[] = [];
    let allDocsForStats: any[] = [];

    if (groupInfo) {
      // User is in a group with shared visibility - get all group documents
      let groupDocsQuery = supabase
        .from('user_documents')
        .select('*, users!inner(email, name)')
        .eq('group_id', groupInfo.id)
        .order('created_at', { ascending: false });

      if (documentType && documentType !== 'all') {
        groupDocsQuery = groupDocsQuery.eq('document_type', documentType);
      }

      const [groupDocsResult, statsResult] = await Promise.all([
        groupDocsQuery,
        supabase
          .from('user_documents')
          .select('page_count, credits_used, processing_status')
          .eq('group_id', groupInfo.id)
      ]);

      if (groupDocsResult.error) {
        console.error('Error fetching group documents:', groupDocsResult.error);
        return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
      }

      // Enrich documents with owner info
      documents = (groupDocsResult.data || []).map(doc => ({
        ...doc,
        owner_email: (doc as any).users?.email,
        owner_name: (doc as any).users?.name,
        is_own_document: doc.user_id === userId,
      }));

      allDocsForStats = statsResult.data || [];
    } else {
      // Individual user or group with private visibility - get only own documents
      let documentsQuery = supabase
        .from('user_documents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (documentType && documentType !== 'all') {
        documentsQuery = documentsQuery.eq('document_type', documentType);
      }

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

      documents = (documentsResult.data || []).map(doc => ({
        ...doc,
        is_own_document: true,
      }));

      allDocsForStats = statsResult.data || [];
    }

    // Calculate stats
    const stats = {
      totalDocuments: allDocsForStats.length,
      totalPages: allDocsForStats.reduce((sum, doc) => sum + (doc.page_count || 0), 0),
      totalCreditsUsed: allDocsForStats.reduce((sum, doc) => sum + (doc.credits_used || 0), 0),
      completedDocuments: allDocsForStats.filter(doc => doc.processing_status === 'completed').length,
      // Group info
      isGroupMember: !!groupInfo,
      groupSharedVisibility: groupInfo?.document_visibility === 'shared',
    };

    return NextResponse.json({
      documents,
      stats
    });

  } catch (error) {
    console.error('Documents API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
