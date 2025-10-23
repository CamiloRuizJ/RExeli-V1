/**
 * Fine-Tuning Pipeline Utilities
 * Manages OpenAI fine-tuning jobs, model versioning, and auto-triggering
 */

import OpenAI from 'openai';
import { decryptApiKey } from './auth';
import { supabase } from './training-utils';
import { exportTrainingData } from './openai-export';
import type {
  DocumentType,
  FineTuningJob,
  ModelVersion,
  TrainingTrigger,
  TriggerCheckResult,
  FineTuningStatus
} from './types';

// Get OpenAI client with decrypted API key
function getOpenAIClient(): OpenAI {
  const encryptedKey = process.env.ENCRYPTED_OPENAI_API_KEY;
  if (!encryptedKey) {
    throw new Error('ENCRYPTED_OPENAI_API_KEY environment variable is required');
  }

  try {
    const apiKey = decryptApiKey(encryptedKey);

    // Validate API key format
    if (!apiKey || (!apiKey.startsWith('sk-proj-') && !apiKey.startsWith('sk-'))) {
      console.error('Invalid API key format after decryption');
      throw new Error('Decrypted API key has invalid format. Expected sk-proj-* or sk-*');
    }

    return new OpenAI({
      apiKey,
      maxRetries: 3, // Retry failed requests up to 3 times
      timeout: 600000, // 600 second timeout (10 minutes)
    });
  } catch (error) {
    console.error('Failed to initialize OpenAI client:', error);
    throw new Error(`OpenAI client initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if fine-tuning should be triggered for a document type
 * Called after each document verification
 */
export async function checkFineTuningTrigger(
  documentType: DocumentType
): Promise<TriggerCheckResult> {
  console.log(`Checking fine-tuning trigger for: ${documentType}`);

  try {
    // Get trigger configuration
    const { data: trigger, error: triggerError } = await supabase
      .from('training_triggers')
      .select('*')
      .eq('document_type', documentType)
      .single();

    if (triggerError || !trigger) {
      console.error('Failed to fetch trigger configuration:', triggerError);
      return {
        should_trigger: false,
        document_type: documentType,
        current_count: 0,
        trigger_threshold: 10,
        reason: 'Trigger configuration not found'
      };
    }

    // Check if auto-trigger is enabled
    if (!trigger.auto_trigger_enabled) {
      return {
        should_trigger: false,
        document_type: documentType,
        current_count: 0,
        trigger_threshold: trigger.trigger_interval,
        reason: 'Auto-trigger is disabled for this document type'
      };
    }

    // Get current verified document count
    const { data: metrics, error: metricsError } = await supabase
      .from('training_metrics')
      .select('verified_documents')
      .eq('document_type', documentType)
      .single();

    if (metricsError || !metrics) {
      console.error('Failed to fetch training metrics:', metricsError);
      return {
        should_trigger: false,
        document_type: documentType,
        current_count: 0,
        trigger_threshold: trigger.trigger_interval,
        reason: 'Could not retrieve document count'
      };
    }

    const currentCount = metrics.verified_documents;
    const nextTriggerAt = trigger.next_trigger_at;

    // Check if we've reached the trigger threshold
    if (currentCount >= nextTriggerAt && currentCount >= trigger.min_documents_required) {
      // Check if count is a multiple of trigger_interval from last trigger
      const countSinceLastTrigger = currentCount - trigger.last_trigger_count;
      const isMultiple = countSinceLastTrigger >= trigger.trigger_interval;

      if (isMultiple) {
        return {
          should_trigger: true,
          document_type: documentType,
          current_count: currentCount,
          trigger_threshold: nextTriggerAt,
          reason: `Reached ${currentCount} verified documents (trigger every ${trigger.trigger_interval})`
        };
      }
    }

    return {
      should_trigger: false,
      document_type: documentType,
      current_count: currentCount,
      trigger_threshold: nextTriggerAt,
      reason: `Current count: ${currentCount}, next trigger at: ${nextTriggerAt}`
    };

  } catch (error) {
    console.error('Error checking fine-tuning trigger:', error);
    return {
      should_trigger: false,
      document_type: documentType,
      current_count: 0,
      trigger_threshold: 10,
      reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Update trigger after fine-tuning job is created
 */
async function updateTriggerAfterStart(
  documentType: DocumentType,
  currentCount: number,
  jobId: string
): Promise<void> {
  const { data: trigger } = await supabase
    .from('training_triggers')
    .select('trigger_interval')
    .eq('document_type', documentType)
    .single();

  if (trigger) {
    await supabase
      .from('training_triggers')
      .update({
        last_trigger_count: currentCount,
        next_trigger_at: currentCount + trigger.trigger_interval,
        last_triggered_at: new Date().toISOString(),
        last_job_id: jobId,
        total_triggers: supabase.rpc('increment', { x: 1 })
      })
      .eq('document_type', documentType);
  }
}

/**
 * Upload training file to OpenAI
 */
async function uploadFileToOpenAI(
  fileUrl: string,
  purpose: 'fine-tune' | 'fine-tune-results' = 'fine-tune'
): Promise<string> {
  console.log(`Uploading file to OpenAI: ${fileUrl}`);

  const openai = getOpenAIClient();

  // Download file from Supabase storage
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }

  const blob = await response.blob();
  const file = new File([blob], 'training.jsonl', { type: 'application/jsonl' });

  // Upload to OpenAI
  const uploadedFile = await openai.files.create({
    file: file,
    purpose: 'fine-tune' as any // OpenAI SDK types may be outdated
  });

  console.log(`File uploaded to OpenAI: ${uploadedFile.id}`);
  return uploadedFile.id;
}

/**
 * Start a fine-tuning job
 */
export async function startFineTuningJob(params: {
  document_type: DocumentType;
  triggered_by?: string;
  hyperparameters?: {
    n_epochs?: number;
    batch_size?: number;
    learning_rate_multiplier?: number;
  };
  notes?: string;
}): Promise<FineTuningJob> {
  console.log(`Starting fine-tuning job for: ${params.document_type}`);

  try {
    const openai = getOpenAIClient();

    // Step 1: Export training data to JSONL
    console.log('Step 1: Exporting training data...');
    const exportResult = await exportTrainingData(params.document_type);

    if (!exportResult.train_file_path) {
      throw new Error('No training data available for export');
    }

    // Step 2: Upload training file to OpenAI
    console.log('Step 2: Uploading training file to OpenAI...');
    const trainingFileId = await uploadFileToOpenAI(exportResult.train_file_path, 'fine-tune');

    // Upload validation file if available
    let validationFileId: string | undefined;
    if (exportResult.validation_file_path) {
      console.log('Step 2b: Uploading validation file to OpenAI...');
      validationFileId = await uploadFileToOpenAI(exportResult.validation_file_path, 'fine-tune');
    }

    // Step 3: Create fine-tuning job in database (pending status)
    console.log('Step 3: Creating fine-tuning job record...');
    const { data: jobRecord, error: jobError } = await supabase
      .from('fine_tuning_jobs')
      .insert({
        document_type: params.document_type,
        openai_file_id: trainingFileId,
        openai_validation_file_id: validationFileId,
        status: 'uploading',
        base_model: 'gpt-4o-2024-08-06',
        hyperparameters: params.hyperparameters || { n_epochs: 3 },
        training_examples_count: exportResult.train_examples,
        validation_examples_count: exportResult.validation_examples,
        training_file_url: exportResult.train_file_path,
        validation_file_url: exportResult.validation_file_path,
        triggered_by: params.triggered_by || 'manual',
        created_by: params.triggered_by,
        notes: params.notes
      })
      .select()
      .single();

    if (jobError || !jobRecord) {
      throw new Error(`Failed to create job record: ${jobError?.message}`);
    }

    // Step 4: Create OpenAI fine-tuning job
    console.log('Step 4: Creating OpenAI fine-tuning job...');
    const fineTuningParams: any = {
      training_file: trainingFileId,
      model: 'gpt-4o-2024-08-06',
      hyperparameters: params.hyperparameters || { n_epochs: 3 }
    };

    if (validationFileId) {
      fineTuningParams.validation_file = validationFileId;
    }

    let openaiJob;
    try {
      openaiJob = await openai.fineTuning.jobs.create(fineTuningParams);
      console.log(`OpenAI job created: ${openaiJob.id}`);
    } catch (apiError: any) {
      // Handle API errors during job creation
      console.error('Failed to create OpenAI fine-tuning job:', apiError);

      if (apiError.status === 401 || apiError.status === 403) {
        throw new Error(`Authentication error: ${apiError.message}. Verify your API key has fine-tuning permissions.`);
      } else if (apiError.message && apiError.message.includes('OAuth')) {
        throw new Error(`OAuth token error: Fine-tuning requires a project API key (sk-proj-*), not an OAuth token.`);
      } else if (apiError.message && apiError.message.includes('file')) {
        throw new Error(`File error: ${apiError.message}. The training file may be invalid or not accessible.`);
      } else if (apiError.message && apiError.message.includes('billing')) {
        throw new Error(`Billing error: ${apiError.message}. Check your OpenAI account billing status.`);
      }

      throw new Error(`Failed to create fine-tuning job: ${apiError.message || 'Unknown error'}`);
    }

    // Step 5: Update job record with OpenAI job ID
    const { data: updatedJob, error: updateError } = await supabase
      .from('fine_tuning_jobs')
      .update({
        openai_job_id: openaiJob.id,
        status: 'running',
        started_at: new Date().toISOString()
      })
      .eq('id', jobRecord.id)
      .select()
      .single();

    if (updateError || !updatedJob) {
      throw new Error(`Failed to update job record: ${updateError?.message}`);
    }

    // Step 6: Update trigger tracking
    const { data: metrics } = await supabase
      .from('training_metrics')
      .select('verified_documents')
      .eq('document_type', params.document_type)
      .single();

    if (metrics) {
      await updateTriggerAfterStart(
        params.document_type,
        metrics.verified_documents,
        jobRecord.id
      );
    }

    console.log(`Fine-tuning job started successfully: ${updatedJob.id}`);
    return updatedJob as FineTuningJob;

  } catch (error) {
    console.error('Error starting fine-tuning job:', error);
    throw error;
  }
}

/**
 * Get fine-tuning job status from OpenAI and update database
 */
export async function updateFineTuningJobStatus(jobId: string): Promise<FineTuningJob> {
  console.log(`Updating fine-tuning job status: ${jobId}`);

  try {
    // Get job from database
    const { data: job, error: jobError } = await supabase
      .from('fine_tuning_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (!job.openai_job_id) {
      throw new Error(`Job has no OpenAI job ID: ${jobId}`);
    }

    // Query OpenAI for job status with retry logic
    const openai = getOpenAIClient();
    let openaiJob;

    try {
      openaiJob = await openai.fineTuning.jobs.retrieve(job.openai_job_id);
    } catch (apiError: any) {
      // Handle common API errors
      if (apiError.status === 404) {
        throw new Error(`OpenAI job ${job.openai_job_id} not found. It may have been deleted or belongs to a different project.`);
      } else if (apiError.status === 401 || apiError.status === 403) {
        throw new Error(`Authentication error: ${apiError.message}. Check that your API key has fine-tuning permissions.`);
      } else if (apiError.message && apiError.message.includes('OAuth')) {
        throw new Error(`OAuth token error: You may be using an OAuth token instead of a project API key. Fine-tuning requires a project API key (sk-proj-*).`);
      }
      // Re-throw other errors
      throw apiError;
    }

    console.log(`OpenAI job status: ${openaiJob.status}`);

    // Map OpenAI status to our status
    let status: FineTuningStatus = 'running';
    let completedAt: string | undefined;
    let failedAt: string | undefined;
    let errorMessage: string | undefined;

    switch (openaiJob.status) {
      case 'succeeded':
        status = 'succeeded';
        completedAt = new Date().toISOString();
        break;
      case 'failed':
        status = 'failed';
        failedAt = new Date().toISOString();
        const rawError = openaiJob.error?.message || 'Fine-tuning failed';

        // Enhanced error message for moderation failures
        if (rawError.includes('moderation') || rawError.includes('eval')) {
          errorMessage = `OpenAI Moderation Failure: ${rawError}. Note: This is an OpenAI infrastructure issue during safety evaluation, not a data quality issue. The model training may have completed successfully. Consider retrying or contacting OpenAI support.`;
          console.warn('Moderation evaluation failure detected - this is an OpenAI-side issue');
        } else {
          errorMessage = rawError;
        }
        break;
      case 'cancelled':
        status = 'cancelled';
        failedAt = new Date().toISOString();
        errorMessage = 'Job was cancelled';
        break;
      case 'running':
      case 'validating_files':
        status = 'running';
        break;
    }

    // Update database with new status
    const updateData: any = {
      status,
      fine_tuned_model_id: openaiJob.fine_tuned_model || undefined,
      trained_tokens: openaiJob.trained_tokens || undefined,
      error_message: errorMessage,
      completed_at: completedAt,
      failed_at: failedAt,
      metrics: openaiJob as any
    };

    const { data: updatedJob, error: updateError } = await supabase
      .from('fine_tuning_jobs')
      .update(updateData)
      .eq('id', jobId)
      .select()
      .single();

    if (updateError || !updatedJob) {
      throw new Error(`Failed to update job: ${updateError?.message}`);
    }

    return updatedJob as FineTuningJob;

  } catch (error) {
    console.error('Error updating fine-tuning job status:', error);
    throw error;
  }
}

/**
 * Deploy a fine-tuned model (create model version and set as active)
 */
export async function deployFineTunedModel(params: {
  job_id: string;
  deployment_status?: 'testing' | 'active';
  traffic_percentage?: number;
  notes?: string;
}): Promise<ModelVersion> {
  console.log(`Deploying fine-tuned model from job: ${params.job_id}`);

  try {
    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('fine_tuning_jobs')
      .select('*')
      .eq('id', params.job_id)
      .single();

    if (jobError || !job) {
      throw new Error(`Job not found: ${params.job_id}`);
    }

    if (job.status !== 'succeeded') {
      throw new Error(`Job is not completed successfully. Status: ${job.status}`);
    }

    if (!job.fine_tuned_model_id) {
      throw new Error('Job has no fine-tuned model ID');
    }

    // Create model version
    const { data: modelVersion, error: modelError } = await supabase
      .from('model_versions')
      .insert({
        document_type: job.document_type,
        model_id: job.fine_tuned_model_id,
        model_type: 'fine_tuned',
        fine_tuning_job_id: job.id,
        deployment_status: params.deployment_status || 'active',
        deployed_at: new Date().toISOString(),
        traffic_percentage: params.traffic_percentage || 100,
        notes: params.notes
      })
      .select()
      .single();

    if (modelError || !modelVersion) {
      throw new Error(`Failed to create model version: ${modelError?.message}`);
    }

    console.log(`Model deployed successfully: ${modelVersion.id}`);
    return modelVersion as ModelVersion;

  } catch (error) {
    console.error('Error deploying fine-tuned model:', error);
    throw error;
  }
}

/**
 * Get active model for a document type
 */
export async function getActiveModel(documentType: DocumentType): Promise<ModelVersion | null> {
  const { data: model, error } = await supabase
    .from('model_versions')
    .select('*')
    .eq('document_type', documentType)
    .eq('deployment_status', 'active')
    .single();

  if (error) {
    console.error('Error fetching active model:', error);
    return null;
  }

  return model as ModelVersion;
}

/**
 * Monitor all active fine-tuning jobs
 * Returns jobs that need status updates
 */
export async function monitorActiveJobs(): Promise<{
  updated_jobs: FineTuningJob[];
  completed: number;
  failed: number;
  still_running: number;
}> {
  console.log('Monitoring active fine-tuning jobs...');

  try {
    // Get all running or pending jobs
    const { data: jobs, error } = await supabase
      .from('fine_tuning_jobs')
      .select('*')
      .in('status', ['pending', 'uploading', 'running'])
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch active jobs: ${error.message}`);
    }

    if (!jobs || jobs.length === 0) {
      console.log('No active jobs to monitor');
      return { updated_jobs: [], completed: 0, failed: 0, still_running: 0 };
    }

    console.log(`Monitoring ${jobs.length} active jobs...`);

    const updatedJobs: FineTuningJob[] = [];
    let completed = 0;
    let failed = 0;
    let stillRunning = 0;

    // Update status for each job
    for (const job of jobs) {
      try {
        const updatedJob = await updateFineTuningJobStatus(job.id);
        updatedJobs.push(updatedJob);

        if (updatedJob.status === 'succeeded') {
          completed++;
          // Auto-deploy if configured
          if (process.env.AUTO_DEPLOY_MODELS === 'true') {
            console.log(`Auto-deploying model for job: ${updatedJob.id}`);
            await deployFineTunedModel({
              job_id: updatedJob.id,
              deployment_status: 'active',
              notes: 'Auto-deployed after successful training'
            });
          }
        } else if (updatedJob.status === 'failed' || updatedJob.status === 'cancelled') {
          failed++;
        } else {
          stillRunning++;
        }
      } catch (error) {
        console.error(`Error updating job ${job.id}:`, error);
      }
    }

    console.log(`Monitoring complete: ${completed} completed, ${failed} failed, ${stillRunning} still running`);

    return {
      updated_jobs: updatedJobs,
      completed,
      failed,
      still_running: stillRunning
    };

  } catch (error) {
    console.error('Error monitoring jobs:', error);
    throw error;
  }
}

/**
 * Cancel a fine-tuning job
 */
export async function cancelFineTuningJob(jobId: string): Promise<FineTuningJob> {
  console.log(`Cancelling fine-tuning job: ${jobId}`);

  try {
    // Get job
    const { data: job, error: jobError } = await supabase
      .from('fine_tuning_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (!job.openai_job_id) {
      throw new Error(`Job has no OpenAI job ID: ${jobId}`);
    }

    // Cancel OpenAI job
    const openai = getOpenAIClient();
    await openai.fineTuning.jobs.cancel(job.openai_job_id);

    // Update database
    const { data: updatedJob, error: updateError } = await supabase
      .from('fine_tuning_jobs')
      .update({
        status: 'cancelled',
        failed_at: new Date().toISOString(),
        error_message: 'Job cancelled by user'
      })
      .eq('id', jobId)
      .select()
      .single();

    if (updateError || !updatedJob) {
      throw new Error(`Failed to update job: ${updateError?.message}`);
    }

    console.log(`Job cancelled: ${jobId}`);
    return updatedJob as FineTuningJob;

  } catch (error) {
    console.error('Error cancelling job:', error);
    throw error;
  }
}

/**
 * Get all fine-tuning jobs for a document type
 */
export async function getFineTuningJobs(documentType?: DocumentType): Promise<FineTuningJob[]> {
  let query = supabase
    .from('fine_tuning_jobs')
    .select('*')
    .order('created_at', { ascending: false });

  if (documentType) {
    query = query.eq('document_type', documentType);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch jobs: ${error.message}`);
  }

  return (data as FineTuningJob[]) || [];
}

/**
 * Get all model versions for a document type
 */
export async function getModelVersions(documentType?: DocumentType): Promise<ModelVersion[]> {
  let query = supabase
    .from('model_versions')
    .select('*')
    .order('version_number', { ascending: false });

  if (documentType) {
    query = query.eq('document_type', documentType);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch model versions: ${error.message}`);
  }

  return (data as ModelVersion[]) || [];
}
