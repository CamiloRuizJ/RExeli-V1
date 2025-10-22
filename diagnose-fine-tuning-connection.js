/**
 * OpenAI Fine-Tuning Connection Diagnostic Script
 *
 * This script diagnoses connection and authentication issues with OpenAI's fine-tuning API.
 * It tests API key decryption, validates permissions, and checks job accessibility.
 *
 * Usage: node diagnose-fine-tuning-connection.js
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

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, colors.bright + colors.cyan);
  console.log('='.repeat(80) + '\n');
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

// Mask API key for safe logging
function maskApiKey(key) {
  if (!key || key.length < 8) return '[INVALID]';
  return `${key.substring(0, 7)}...${key.substring(key.length - 4)}`;
}

// Load environment variables from .env.local
function loadEnvFile() {
  try {
    const envPath = path.join(__dirname, '.env.local');
    if (!fs.existsSync(envPath)) {
      logError('.env.local file not found');
      return {};
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
  } catch (error) {
    logError(`Failed to load .env.local: ${error.message}`);
    return {};
  }
}

// Decrypt API key using same method as auth.ts
function decryptApiKey(encryptedKey, encryptionKey) {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedKey, encryptionKey);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);

    if (!decrypted) {
      throw new Error('Decryption resulted in empty string');
    }

    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

// Main diagnostic function
async function runDiagnostics() {
  logSection('OpenAI Fine-Tuning Connection Diagnostics');
  log('Starting comprehensive diagnostic tests...', colors.bright);

  const results = {
    envLoaded: false,
    decryptionWorked: false,
    keyFormatValid: false,
    basicConnectionWorked: false,
    fineTuningPermissions: false,
    jobAccessible: false,
    errors: []
  };

  // Test 1: Load Environment Variables
  logSection('Test 1: Environment Variables');
  const env = loadEnvFile();

  if (env.ENCRYPTED_OPENAI_API_KEY) {
    logSuccess('ENCRYPTED_OPENAI_API_KEY found in .env.local');
    logInfo(`Encrypted key length: ${env.ENCRYPTED_OPENAI_API_KEY.length} characters`);
    results.envLoaded = true;
  } else {
    logError('ENCRYPTED_OPENAI_API_KEY not found in .env.local');
    results.errors.push('Missing ENCRYPTED_OPENAI_API_KEY in environment');
    return results;
  }

  if (env.ENCRYPTION_KEY) {
    logSuccess('ENCRYPTION_KEY found in .env.local');
    logInfo(`Encryption key: ${env.ENCRYPTION_KEY.substring(0, 20)}...`);
  } else {
    logError('ENCRYPTION_KEY not found in .env.local');
    results.errors.push('Missing ENCRYPTION_KEY in environment');
    return results;
  }

  // Test 2: Decrypt API Key
  logSection('Test 2: API Key Decryption');
  let apiKey;

  try {
    apiKey = decryptApiKey(env.ENCRYPTED_OPENAI_API_KEY, env.ENCRYPTION_KEY);
    logSuccess('API key decrypted successfully');
    logInfo(`Decrypted key format: ${maskApiKey(apiKey)}`);
    logInfo(`Decrypted key length: ${apiKey.length} characters`);
    results.decryptionWorked = true;

    // Validate key format
    if (apiKey.startsWith('sk-proj-') || apiKey.startsWith('sk-')) {
      logSuccess('API key format is valid (starts with sk-proj- or sk-)');
      results.keyFormatValid = true;
    } else {
      logWarning(`API key format is unusual (starts with: ${apiKey.substring(0, 7)})`);
      logWarning('Expected format: sk-proj-... or sk-...');
      results.errors.push('API key format does not match expected pattern');
    }
  } catch (error) {
    logError(`Failed to decrypt API key: ${error.message}`);
    results.errors.push(`Decryption error: ${error.message}`);
    return results;
  }

  // Test 3: Basic OpenAI API Connection
  logSection('Test 3: Basic OpenAI API Connection');
  let openai;

  try {
    openai = new OpenAI({ apiKey });
    logSuccess('OpenAI client initialized');

    // Try to list models as a basic connectivity test
    logInfo('Attempting to list available models...');
    const modelsResponse = await openai.models.list();
    const models = [];
    for await (const model of modelsResponse) {
      models.push(model.id);
    }

    logSuccess(`Successfully connected to OpenAI API`);
    logInfo(`Found ${models.length} available models`);

    // Check for fine-tuning capable models
    const fineTuneModels = models.filter(m =>
      m.includes('gpt-4') || m.includes('gpt-3.5')
    );
    if (fineTuneModels.length > 0) {
      logInfo(`Fine-tuning capable models found: ${fineTuneModels.slice(0, 3).join(', ')}...`);
    }

    results.basicConnectionWorked = true;
  } catch (error) {
    logError(`Failed to connect to OpenAI API: ${error.message}`);

    if (error.status === 401) {
      logError('Authentication failed (401 Unauthorized)');
      logError('This means the API key is invalid or has expired');
    } else if (error.status === 403) {
      logError('Access forbidden (403 Forbidden)');
      logError('The API key may not have the required permissions');
    } else if (error.message.includes('OAuth')) {
      logError('OAuth-related error detected');
      logWarning('This suggests you may be using an OAuth token instead of an API key');
    }

    results.errors.push(`API connection failed: ${error.message}`);
    return results;
  }

  // Test 4: Fine-Tuning API Permissions
  logSection('Test 4: Fine-Tuning API Permissions');

  try {
    logInfo('Attempting to list fine-tuning jobs...');
    const jobs = await openai.fineTuning.jobs.list({ limit: 5 });

    const jobsList = [];
    for await (const job of jobs) {
      jobsList.push(job);
    }

    logSuccess(`Successfully accessed fine-tuning API`);
    logInfo(`Found ${jobsList.length} recent fine-tuning job(s)`);

    if (jobsList.length > 0) {
      logInfo('\nRecent jobs:');
      jobsList.forEach(job => {
        logInfo(`  - Job ID: ${job.id}`);
        logInfo(`    Status: ${job.status}`);
        logInfo(`    Model: ${job.model}`);
        logInfo(`    Created: ${new Date(job.created_at * 1000).toLocaleString()}`);
      });
    }

    results.fineTuningPermissions = true;
  } catch (error) {
    logError(`Failed to access fine-tuning API: ${error.message}`);

    if (error.status === 403 || error.status === 401) {
      logError('Authentication or permission error');
      logWarning('Your API key may not have fine-tuning permissions enabled');
      logInfo('To enable fine-tuning:');
      logInfo('  1. Go to https://platform.openai.com/account/api-keys');
      logInfo('  2. Generate a new API key with fine-tuning permissions');
      logInfo('  3. Update your ENCRYPTED_OPENAI_API_KEY in .env.local');
    } else if (error.message.includes('OAuth')) {
      logError('OAuth error detected');
      logWarning('You may be using a user OAuth token instead of a project API key');
      logInfo('Fine-tuning requires a project API key (starts with sk-proj-)');
    }

    results.errors.push(`Fine-tuning API access failed: ${error.message}`);
    return results;
  }

  // Test 5: Retrieve Specific Job
  logSection('Test 5: Retrieve Specific Fine-Tuning Job');

  const targetJobId = 'ftjob-0VoxonQpNW0v3wBx6B8Ms0QB';
  logInfo(`Attempting to retrieve job: ${targetJobId}`);

  try {
    const job = await openai.fineTuning.jobs.retrieve(targetJobId);

    logSuccess(`Successfully retrieved job: ${targetJobId}`);
    logInfo('\nJob Details:');
    logInfo(`  Status: ${job.status}`);
    logInfo(`  Model: ${job.model}`);
    logInfo(`  Created: ${new Date(job.created_at * 1000).toLocaleString()}`);

    if (job.finished_at) {
      logInfo(`  Finished: ${new Date(job.finished_at * 1000).toLocaleString()}`);
    }

    if (job.fine_tuned_model) {
      logInfo(`  Fine-tuned model: ${job.fine_tuned_model}`);
    }

    if (job.error) {
      logWarning(`  Error: ${job.error.message}`);
    }

    if (job.trained_tokens) {
      logInfo(`  Trained tokens: ${job.trained_tokens}`);
    }

    // Check job status
    if (job.status === 'succeeded') {
      logSuccess('Job completed successfully!');
      logInfo(`Fine-tuned model available: ${job.fine_tuned_model}`);
    } else if (job.status === 'failed') {
      logError('Job failed');
      if (job.error) {
        logError(`Failure reason: ${job.error.message}`);
      }
    } else if (job.status === 'cancelled') {
      logWarning('Job was cancelled');
    } else if (job.status === 'running') {
      logInfo('Job is currently running');
    } else {
      logInfo(`Job is in ${job.status} state`);
    }

    results.jobAccessible = true;
  } catch (error) {
    logError(`Failed to retrieve job ${targetJobId}: ${error.message}`);

    if (error.status === 404) {
      logWarning('Job not found (404)');
      logInfo('This job ID may belong to a different OpenAI organization/project');
      logInfo('OR the job may have been deleted');
    } else if (error.status === 403 || error.status === 401) {
      logError('Access denied to this job');
      logWarning('The API key may not have access to this specific job');
    }

    results.errors.push(`Job retrieval failed: ${error.message}`);
  }

  // Test 6: Check API Key Type
  logSection('Test 6: API Key Type Analysis');

  if (apiKey.startsWith('sk-proj-')) {
    logSuccess('API key is a PROJECT key (sk-proj-...)');
    logInfo('Project keys are required for fine-tuning operations');
  } else if (apiKey.startsWith('sk-')) {
    logWarning('API key is a legacy SERVICE ACCOUNT key (sk-...)');
    logWarning('Consider migrating to a project API key for better access control');
  } else {
    logError('API key format is unrecognized');
    logError('This may be an OAuth token or invalid key');
  }

  return results;
}

// Print summary and recommendations
function printSummary(results) {
  logSection('Diagnostic Summary');

  const allPassed = results.envLoaded &&
                    results.decryptionWorked &&
                    results.keyFormatValid &&
                    results.basicConnectionWorked &&
                    results.fineTuningPermissions;

  if (allPassed) {
    logSuccess('All diagnostic tests passed!');

    if (!results.jobAccessible) {
      logWarning('Note: The specific job ftjob-0VoxonQpNW0v3wBx6B8Ms0QB could not be accessed');
      logInfo('This is likely because:');
      logInfo('  - The job belongs to a different OpenAI project/organization');
      logInfo('  - The job has been deleted');
      logInfo('  - You need to create a new fine-tuning job');
    } else {
      logSuccess('The specific job is accessible and can be monitored');
    }
  } else {
    logError('Some diagnostic tests failed');
    console.log('\nFailed tests:');

    if (!results.envLoaded) logError('  - Environment variables loading');
    if (!results.decryptionWorked) logError('  - API key decryption');
    if (!results.keyFormatValid) logError('  - API key format validation');
    if (!results.basicConnectionWorked) logError('  - Basic API connection');
    if (!results.fineTuningPermissions) logError('  - Fine-tuning API permissions');
  }

  if (results.errors.length > 0) {
    console.log('\nErrors encountered:');
    results.errors.forEach((error, index) => {
      logError(`  ${index + 1}. ${error}`);
    });
  }

  logSection('Recommendations');

  if (!results.basicConnectionWorked) {
    logInfo('1. Verify your API key is valid at: https://platform.openai.com/api-keys');
    logInfo('2. Generate a new API key if the current one has expired');
    logInfo('3. Encrypt the new key and update ENCRYPTED_OPENAI_API_KEY in .env.local');
  } else if (!results.fineTuningPermissions) {
    logInfo('1. Ensure your OpenAI account has fine-tuning enabled');
    logInfo('2. Create a new PROJECT API key with fine-tuning permissions');
    logInfo('3. Project API keys start with "sk-proj-" and have granular permissions');
    logInfo('4. Update your .env.local with the new encrypted key');
  } else if (!results.jobAccessible) {
    logInfo('1. The job ftjob-0VoxonQpNW0v3wBx6B8Ms0QB is from a different project');
    logInfo('2. Create a new fine-tuning job using your current API key');
    logInfo('3. The system has 10 verified training documents ready');
    logInfo('4. Use the training dashboard to trigger a new fine-tuning job');
  } else {
    logSuccess('Your OpenAI fine-tuning setup is working correctly!');
    logInfo('You can proceed with creating or monitoring fine-tuning jobs');
  }

  logSection('Next Steps');

  if (allPassed && !results.jobAccessible) {
    logInfo('To create a new fine-tuning job:');
    logInfo('  1. Run: node test-fine-tuning-api.js');
    logInfo('  2. Or use the training dashboard UI');
    logInfo('  3. Monitor progress using the fine-tuning status page');
  } else if (!allPassed) {
    logInfo('To fix the issues:');
    logInfo('  1. Follow the recommendations above');
    logInfo('  2. Re-run this diagnostic script to verify the fixes');
    logInfo('  3. Contact support if issues persist');
  }
}

// Run diagnostics
(async () => {
  try {
    const results = await runDiagnostics();
    printSummary(results);

    // Exit with appropriate code
    const success = results.basicConnectionWorked && results.fineTuningPermissions;
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('\n');
    logError('Unexpected error during diagnostics:');
    console.error(error);
    process.exit(1);
  }
})();
