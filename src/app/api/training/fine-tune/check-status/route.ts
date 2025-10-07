/**
 * Check Fine-Tuning Status Endpoint
 * Returns complete status of fine-tuning jobs, triggers, and verified documents
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/training-utils';
import type { DocumentType } from '@/lib/types';

interface StatusReport {
  document_type: DocumentType;
  verified_count: number;
  trigger_interval: number;
  last_trigger_count: number;
  next_trigger_at: number;
  ready_to_trigger: boolean;
  recent_jobs: Array<{
    id: string;
    status: string;
    created_at: string;
    fine_tuned_model_id?: string;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentType = searchParams.get('document_type') as DocumentType | null;

    // Get all training metrics
    const metricsQuery = supabase
      .from('training_metrics')
      .select('document_type, verified_documents');

    if (documentType) {
      metricsQuery.eq('document_type', documentType);
    }

    const { data: metrics, error: metricsError } = await metricsQuery;

    if (metricsError) {
      throw new Error(`Failed to fetch metrics: ${metricsError.message}`);
    }

    // Get all training triggers
    const triggersQuery = supabase
      .from('training_triggers')
      .select('*');

    if (documentType) {
      triggersQuery.eq('document_type', documentType);
    }

    const { data: triggers, error: triggersError } = await triggersQuery;

    if (triggersError) {
      throw new Error(`Failed to fetch triggers: ${triggersError.message}`);
    }

    // Get recent fine-tuning jobs
    const jobsQuery = supabase
      .from('fine_tuning_jobs')
      .select('id, document_type, status, created_at, fine_tuned_model_id')
      .order('created_at', { ascending: false })
      .limit(10);

    if (documentType) {
      jobsQuery.eq('document_type', documentType);
    }

    const { data: jobs, error: jobsError } = await jobsQuery;

    if (jobsError) {
      throw new Error(`Failed to fetch jobs: ${jobsError.message}`);
    }

    // Build status report
    const statusReports: StatusReport[] = [];

    for (const metric of metrics || []) {
      const trigger = triggers?.find(t => t.document_type === metric.document_type);
      const docJobs = jobs?.filter(j => j.document_type === metric.document_type) || [];

      const readyToTrigger = trigger
        ? metric.verified_documents >= trigger.next_trigger_at && trigger.auto_trigger_enabled
        : false;

      statusReports.push({
        document_type: metric.document_type,
        verified_count: metric.verified_documents,
        trigger_interval: trigger?.trigger_interval || 10,
        last_trigger_count: trigger?.last_trigger_count || 0,
        next_trigger_at: trigger?.next_trigger_at || 10,
        ready_to_trigger: readyToTrigger,
        recent_jobs: docJobs.map(j => ({
          id: j.id,
          status: j.status,
          created_at: j.created_at,
          fine_tuned_model_id: j.fine_tuned_model_id
        }))
      });
    }

    // Sort by verified count descending
    statusReports.sort((a, b) => b.verified_count - a.verified_count);

    return NextResponse.json({
      success: true,
      data: {
        reports: statusReports,
        summary: {
          total_verified: statusReports.reduce((sum, r) => sum + r.verified_count, 0),
          ready_to_trigger: statusReports.filter(r => r.ready_to_trigger).length,
          total_jobs: jobs?.length || 0,
          running_jobs: jobs?.filter(j => j.status === 'running').length || 0,
          succeeded_jobs: jobs?.filter(j => j.status === 'succeeded').length || 0,
          failed_jobs: jobs?.filter(j => j.status === 'failed').length || 0
        }
      }
    });

  } catch (error) {
    console.error('Error checking fine-tuning status:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
