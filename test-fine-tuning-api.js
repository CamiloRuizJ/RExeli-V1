/**
 * OpenAI Fine-Tuning API Test Script
 *
 * This script can be used to test the fine-tuning API functionality:
 * - List existing jobs
 * - Check job status
 * - Create a new fine-tuning job (optional)
 *
 * Usage:
 *   node test-fine-tuning-api.js list              # List all jobs
 *   node test-fine-tuning-api.js status <job-id>   # Check job status
 *   node test-fine-tuning-api.js verify            # Verify API connection
 */

const OpenAI = require('openai');
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

// Load environment variables from .env.local
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

// Decrypt API key
function decryptApiKey(encryptedKey, encryptionKey) {
  const bytes = CryptoJS.AES.decrypt(encryptedKey, encryptionKey);
  return bytes.toString(CryptoJS.enc.Utf8);
}

// Initialize OpenAI client
function getOpenAIClient() {
  const env = loadEnvFile();
  const apiKey = decryptApiKey(env.ENCRYPTED_OPENAI_API_KEY, env.ENCRYPTION_KEY);
  return new OpenAI({ apiKey });
}

// Format date
function formatDate(timestamp) {
  return new Date(timestamp * 1000).toLocaleString();
}

// Get status emoji
function getStatusEmoji(status) {
  const statusMap = {
    'succeeded': '✓',
    'failed': '✗',
    'cancelled': '⊗',
    'running': '⟳',
    'validating_files': '⟳',
    'queued': '⋯',
  };
  return statusMap[status] || '?';
}

// List all fine-tuning jobs
async function listJobs(openai, limit = 20) {
  console.log('\n' + '='.repeat(80));
  log('Fine-Tuning Jobs', colors.bright + colors.cyan);
  console.log('='.repeat(80) + '\n');

  try {
    const jobs = await openai.fineTuning.jobs.list({ limit });
    const jobsList = [];

    for await (const job of jobs) {
      jobsList.push(job);
    }

    if (jobsList.length === 0) {
      logInfo('No fine-tuning jobs found');
      return;
    }

    console.log(`Found ${jobsList.length} job(s):\n`);

    jobsList.forEach((job, index) => {
      const statusEmoji = getStatusEmoji(job.status);
      const statusColor = job.status === 'succeeded' ? colors.green :
                          job.status === 'failed' ? colors.red :
                          job.status === 'cancelled' ? colors.yellow :
                          colors.blue;

      console.log(`${index + 1}. ${job.id}`);
      log(`   Status: ${statusEmoji} ${job.status}`, statusColor);
      console.log(`   Model: ${job.model}`);
      console.log(`   Created: ${formatDate(job.created_at)}`);

      if (job.finished_at) {
        console.log(`   Finished: ${formatDate(job.finished_at)}`);
      }

      if (job.fine_tuned_model) {
        logSuccess(`   Fine-tuned model: ${job.fine_tuned_model}`);
      }

      if (job.error) {
        logError(`   Error: ${job.error.message}`);
      }

      if (job.trained_tokens) {
        logInfo(`   Trained tokens: ${job.trained_tokens.toLocaleString()}`);
      }

      console.log('');
    });

    // Summary
    const succeeded = jobsList.filter(j => j.status === 'succeeded').length;
    const failed = jobsList.filter(j => j.status === 'failed').length;
    const running = jobsList.filter(j => j.status === 'running' || j.status === 'validating_files').length;
    const cancelled = jobsList.filter(j => j.status === 'cancelled').length;

    console.log('Summary:');
    if (succeeded > 0) logSuccess(`  ${succeeded} succeeded`);
    if (failed > 0) logError(`  ${failed} failed`);
    if (running > 0) logInfo(`  ${running} running`);
    if (cancelled > 0) logWarning(`  ${cancelled} cancelled`);

  } catch (error) {
    logError(`Failed to list jobs: ${error.message}`);
    throw error;
  }
}

// Get job status
async function getJobStatus(openai, jobId) {
  console.log('\n' + '='.repeat(80));
  log(`Job Status: ${jobId}`, colors.bright + colors.cyan);
  console.log('='.repeat(80) + '\n');

  try {
    const job = await openai.fineTuning.jobs.retrieve(jobId);

    const statusEmoji = getStatusEmoji(job.status);
    const statusColor = job.status === 'succeeded' ? colors.green :
                        job.status === 'failed' ? colors.red :
                        job.status === 'cancelled' ? colors.yellow :
                        colors.blue;

    console.log('Job Details:');
    console.log(`  ID: ${job.id}`);
    log(`  Status: ${statusEmoji} ${job.status}`, statusColor);
    console.log(`  Model: ${job.model}`);
    console.log(`  Created: ${formatDate(job.created_at)}`);

    if (job.finished_at) {
      console.log(`  Finished: ${formatDate(job.finished_at)}`);

      const duration = job.finished_at - job.created_at;
      const hours = Math.floor(duration / 3600);
      const minutes = Math.floor((duration % 3600) / 60);
      console.log(`  Duration: ${hours}h ${minutes}m`);
    }

    if (job.training_file) {
      console.log(`  Training file: ${job.training_file}`);
    }

    if (job.validation_file) {
      console.log(`  Validation file: ${job.validation_file}`);
    }

    if (job.trained_tokens) {
      logInfo(`  Trained tokens: ${job.trained_tokens.toLocaleString()}`);
    }

    if (job.fine_tuned_model) {
      logSuccess(`  Fine-tuned model: ${job.fine_tuned_model}`);
    }

    if (job.error) {
      console.log('');
      logError('Error Details:');
      logError(`  ${job.error.message}`);
      console.log('');

      // Check for common error types
      if (job.error.message.includes('moderation')) {
        logWarning('This is a moderation evaluation error from OpenAI');
        logInfo('Possible causes:');
        logInfo('  - Training data may contain content flagged by moderation');
        logInfo('  - This is an OpenAI-side error during safety checks');
        logInfo('  - The model training itself may have succeeded');
        console.log('');
        logInfo('Recommendations:');
        logInfo('  1. Review training data for potentially problematic content');
        logInfo('  2. Contact OpenAI support if the error persists');
        logInfo('  3. Try creating a new job with the same data');
      } else if (job.error.message.includes('file')) {
        logWarning('This is a file-related error');
        logInfo('  - Check that training file format is correct (JSONL)');
        logInfo('  - Verify file was uploaded successfully');
        logInfo('  - Ensure file meets OpenAI requirements');
      }
    }

    // Get recent events
    console.log('\nRecent Events:');
    try {
      const events = await openai.fineTuning.jobs.listEvents(jobId, { limit: 10 });
      const eventsList = [];

      for await (const event of events) {
        eventsList.push(event);
      }

      if (eventsList.length > 0) {
        eventsList.reverse().forEach(event => {
          const timestamp = formatDate(event.created_at);
          console.log(`  [${timestamp}] ${event.message}`);
        });
      } else {
        logInfo('  No events available');
      }
    } catch (error) {
      logWarning(`  Could not fetch events: ${error.message}`);
    }

  } catch (error) {
    logError(`Failed to get job status: ${error.message}`);

    if (error.status === 404) {
      logWarning('Job not found. It may have been deleted or belong to a different project.');
    }

    throw error;
  }
}

// Verify API connection
async function verifyConnection(openai) {
  console.log('\n' + '='.repeat(80));
  log('API Connection Verification', colors.bright + colors.cyan);
  console.log('='.repeat(80) + '\n');

  try {
    // Test basic connection
    logInfo('Testing basic API connection...');
    const modelsResponse = await openai.models.list();
    const models = [];
    for await (const model of modelsResponse) {
      models.push(model.id);
    }
    logSuccess(`Connected successfully (${models.length} models available)`);

    // Test fine-tuning permissions
    logInfo('Testing fine-tuning API permissions...');
    const jobs = await openai.fineTuning.jobs.list({ limit: 1 });
    const jobsList = [];
    for await (const job of jobs) {
      jobsList.push(job);
    }
    logSuccess('Fine-tuning API accessible');

    console.log('');
    logSuccess('All API tests passed!');
    logInfo('Your OpenAI fine-tuning setup is working correctly');

  } catch (error) {
    logError(`API verification failed: ${error.message}`);
    throw error;
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'list';

  try {
    const openai = getOpenAIClient();

    switch (command) {
      case 'list':
        await listJobs(openai, parseInt(args[1]) || 20);
        break;

      case 'status':
        if (!args[1]) {
          logError('Job ID required');
          console.log('Usage: node test-fine-tuning-api.js status <job-id>');
          process.exit(1);
        }
        await getJobStatus(openai, args[1]);
        break;

      case 'verify':
        await verifyConnection(openai);
        break;

      case 'help':
      default:
        console.log('\nOpenAI Fine-Tuning API Test Script\n');
        console.log('Usage:');
        console.log('  node test-fine-tuning-api.js list [limit]        List all jobs (default: 20)');
        console.log('  node test-fine-tuning-api.js status <job-id>     Get detailed job status');
        console.log('  node test-fine-tuning-api.js verify              Verify API connection');
        console.log('  node test-fine-tuning-api.js help                Show this help\n');
        console.log('Examples:');
        console.log('  node test-fine-tuning-api.js list');
        console.log('  node test-fine-tuning-api.js status ftjob-0VoxonQpNW0v3wBx6B8Ms0QB');
        console.log('  node test-fine-tuning-api.js verify\n');
        break;
    }

    console.log('');
    process.exit(0);

  } catch (error) {
    console.error('\nUnexpected error:');
    console.error(error);
    process.exit(1);
  }
}

// Run main function
main();
