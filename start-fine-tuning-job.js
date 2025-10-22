#!/usr/bin/env node

/**
 * Start Fine-Tuning Job
 * Creates a new fine-tuning job using gpt-4o-2024-08-06 with vision support
 */

require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch');

const API_BASE = process.env.NEXTAUTH_URL || 'http://localhost:3002';

async function startFineTuning(documentType = 'broker_sales_comparables') {
  console.log('━'.repeat(80));
  console.log('🚀 Starting Fine-Tuning Job');
  console.log('━'.repeat(80));
  console.log();

  console.log('Configuration:');
  console.log(`  Document Type: ${documentType}`);
  console.log(`  Model: gpt-4o-2024-08-06 (with vision support)`);
  console.log(`  Epochs: 3`);
  console.log(`  API Base: ${API_BASE}`);
  console.log();

  try {
    console.log('📤 Sending request to API...');
    const response = await fetch(`${API_BASE}/api/training/fine-tune/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document_type: documentType,
        hyperparameters: {
          n_epochs: 3
        },
        triggered_by: 'manual-script',
        notes: 'Started via start-fine-tuning-job.js - Using gpt-4o-2024-08-06 with vision support'
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ API Error:', response.status, response.statusText);
      console.error('Error details:', JSON.stringify(result, null, 2));
      process.exit(1);
    }

    console.log('✅ Success!');
    console.log();

    if (result.success && result.data?.job) {
      const job = result.data.job;

      console.log('Job Details:');
      console.log('━'.repeat(80));
      console.log(`  Database ID: ${job.id}`);
      console.log(`  OpenAI Job ID: ${job.openai_job_id || 'Pending...'}`);
      console.log(`  Status: ${job.status}`);
      console.log(`  Model: ${job.base_model}`);
      console.log(`  Document Type: ${job.document_type}`);
      console.log(`  Training Examples: ${job.training_examples_count}`);
      console.log(`  Validation Examples: ${job.validation_examples_count || 0}`);
      console.log(`  Created: ${new Date(job.created_at).toLocaleString()}`);
      console.log('━'.repeat(80));
      console.log();

      if (job.openai_job_id) {
        console.log('📊 Monitor Progress:');
        console.log(`  node test-fine-tuning-api.js status ${job.openai_job_id}`);
        console.log();

        console.log('🔗 OpenAI Dashboard:');
        console.log(`  https://platform.openai.com/finetune/${job.openai_job_id}`);
        console.log();
      }

      console.log('⏳ Expected Timeline:');
      console.log('  • File Upload: 1-2 minutes');
      console.log('  • Validation: 2-5 minutes');
      console.log('  • Training: 10-30 minutes');
      console.log('  • Total: ~15-40 minutes');
      console.log();

      console.log('✅ Fine-tuning job started successfully!');
      console.log();

      // Auto-monitor if job ID is available
      if (job.openai_job_id) {
        console.log('Starting auto-monitor in 5 seconds...');
        console.log('(Press Ctrl+C to cancel)');

        await new Promise(resolve => setTimeout(resolve, 5000));

        // Import monitoring
        const { exec } = require('child_process');
        exec(`node test-fine-tuning-api.js status ${job.openai_job_id}`,
          (error, stdout) => {
            if (error) {
              console.error('Error monitoring job:', error.message);
              return;
            }
            console.log(stdout);
          }
        );
      }

    } else {
      console.log('Response:', JSON.stringify(result, null, 2));
    }

  } catch (error) {
    console.error('❌ Error starting fine-tuning job:', error.message);
    console.error();
    console.error('Troubleshooting:');
    console.error('  1. Ensure server is running: npm run dev');
    console.error('  2. Check .env.local has ENCRYPTED_OPENAI_API_KEY');
    console.error('  3. Verify database migrations are run');
    console.error('  4. Check you have verified training documents');
    console.error();
    console.error('Diagnostic command:');
    console.error('  node diagnose-fine-tuning-connection.js');
    process.exit(1);
  }
}

// Parse command line arguments
const documentType = process.argv[2] || 'broker_sales_comparables';

// Validate document type
const validTypes = [
  'rent_roll',
  'operating_budget',
  'broker_sales_comparables',
  'broker_lease_comparables',
  'broker_listing',
  'offering_memo',
  'lease_agreement',
  'financial_statements'
];

if (!validTypes.includes(documentType)) {
  console.error('❌ Invalid document type:', documentType);
  console.error();
  console.error('Valid types:');
  validTypes.forEach(type => console.error(`  - ${type}`));
  console.error();
  console.error('Usage:');
  console.error('  node start-fine-tuning-job.js [document_type]');
  console.error();
  console.error('Example:');
  console.error('  node start-fine-tuning-job.js broker_sales_comparables');
  process.exit(1);
}

// Run
startFineTuning(documentType);
