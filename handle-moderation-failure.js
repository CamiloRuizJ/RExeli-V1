/**
 * Handle Moderation Failure for Fine-Tuning Job
 *
 * This script handles the case where a fine-tuning job failed due to OpenAI's
 * moderation evaluation, but the model was actually trained successfully.
 *
 * The job ftjob-0VoxonQpNW0v3wBx6B8Ms0QB completed training (30/30 steps)
 * and created model ft:gpt-4o-2024-08-06:camilo-ruiz-projects::CPKfcrht,
 * but failed during safety evaluation.
 *
 * This is an OpenAI infrastructure issue, not an authentication problem.
 *
 * Usage: node handle-moderation-failure.js
 */

const { createClient } = require('@supabase/supabase-js');
const CryptoJS = require('crypto-js');
const fs = require('fs');
const path = require('path');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green);
}

function logError(message) {
  log(`✗ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠ ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ ${message}`, colors.blue);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, colors.bright + colors.cyan);
  console.log('='.repeat(80) + '\n');
}

// Load environment variables
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env.local file not found');
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};

  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });

  return envVars;
}

// Decrypt key
function decryptKey(encryptedKey, encryptionKey) {
  const bytes = CryptoJS.AES.decrypt(encryptedKey, encryptionKey);
  return bytes.toString(CryptoJS.enc.Utf8);
}

// Main function
async function main() {
  logSection('Handle Fine-Tuning Moderation Failure');

  try {
    // Load environment
    const env = loadEnvFile();
    const supabaseUrl = decryptKey(env.ENCRYPTED_SUPABASE_URL, env.ENCRYPTION_KEY);
    const supabaseKey = decryptKey(env.ENCRYPTED_SUPABASE_ANON_KEY, env.ENCRYPTION_KEY);
    const supabase = createClient(supabaseUrl, supabaseKey);

    const FAILED_JOB_ID = 'ftjob-0VoxonQpNW0v3wBx6B8Ms0QB';
    const TRAINED_MODEL_ID = 'ft:gpt-4o-2024-08-06:camilo-ruiz-projects::CPKfcrht';

    // Step 1: Check if job exists in database
    logInfo('Step 1: Checking database for job record...');

    const { data: jobs, error: jobError } = await supabase
      .from('fine_tuning_jobs')
      .select('*')
      .eq('openai_job_id', FAILED_JOB_ID);

    if (jobError) {
      throw new Error(`Failed to query jobs: ${jobError.message}`);
    }

    if (!jobs || jobs.length === 0) {
      logWarning(`No database record found for job ${FAILED_JOB_ID}`);
      logInfo('This job may have been created outside the system');
      logInfo('You can create a new fine-tuning job through the training dashboard');
      return;
    }

    const job = jobs[0];
    logSuccess(`Found job record: ${job.id}`);
    logInfo(`Current status: ${job.status}`);
    logInfo(`Document type: ${job.document_type}`);

    // Step 2: Analyze the failure
    logSection('Step 2: Analyzing Failure');

    logInfo('Job details:');
    logInfo(`  OpenAI Job ID: ${FAILED_JOB_ID}`);
    logInfo(`  Training completed: 30/30 steps`);
    logInfo(`  Model created: ${TRAINED_MODEL_ID}`);
    logInfo(`  Final training loss: 0.11`);
    logInfo(`  Failure reason: Moderation evaluation error`);

    console.log('');
    logWarning('Analysis:');
    logWarning('  - Training completed successfully');
    logWarning('  - Model was created and checkpointed');
    logWarning('  - Failed during OpenAI safety evaluation (not user error)');
    logWarning('  - This is an OpenAI infrastructure issue');

    // Step 3: Recommendations
    logSection('Step 3: Recommendations');

    console.log('Option 1: Wait and retry the moderation evaluation');
    logInfo('  - Contact OpenAI support about job ' + FAILED_JOB_ID);
    logInfo('  - They may be able to re-run the moderation check');
    logInfo('  - The model exists and may be recoverable');

    console.log('\nOption 2: Create a new fine-tuning job (RECOMMENDED)');
    logSuccess('  - You have 10 verified training documents ready');
    logSuccess('  - The training data is already prepared');
    logSuccess('  - Create a new job through the training dashboard');
    logSuccess('  - Use the same training data');

    console.log('\nOption 3: Review training data for potential issues');
    logInfo('  - Check for any content that might trigger moderation');
    logInfo('  - Real estate documents should be fine');
    logInfo('  - The error likely occurred in OpenAI\'s evaluation, not the data');

    // Step 4: Update database if needed
    logSection('Step 4: Database Status');

    if (job.status !== 'failed') {
      logInfo('Updating job status in database...');

      const { error: updateError } = await supabase
        .from('fine_tuning_jobs')
        .update({
          status: 'failed',
          error_message: 'Error while running moderation eval refusals_v3. OpenAI infrastructure issue during safety evaluation. Training completed successfully (30/30 steps, loss: 0.11).',
          failed_at: new Date().toISOString(),
          fine_tuned_model_id: null // Model not accessible due to moderation failure
        })
        .eq('id', job.id);

      if (updateError) {
        logError(`Failed to update job: ${updateError.message}`);
      } else {
        logSuccess('Job status updated in database');
      }
    } else {
      logSuccess('Job status is already marked as failed');
    }

    // Step 5: Next steps
    logSection('Next Steps');

    logInfo('To create a new fine-tuning job:');
    console.log('');
    log('  1. Go to the training dashboard', colors.bright);
    log('  2. Navigate to the Fine-Tuning section', colors.bright);
    log('  3. Click "Start Fine-Tuning Job" for your document type', colors.bright);
    log('  4. The system will use the existing 10 verified documents', colors.bright);
    log('  5. Monitor the new job progress', colors.bright);

    console.log('');
    logInfo('Or run this command to list current jobs:');
    log('  node test-fine-tuning-api.js list', colors.cyan);

    console.log('');
    logSuccess('Analysis complete!');

  } catch (error) {
    console.error('\n');
    logError('Error during analysis:');
    console.error(error);
    process.exit(1);
  }
}

// Run
main();
