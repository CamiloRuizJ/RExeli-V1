/**
 * Training System Setup Verification Script
 * Verifies that all components are properly configured
 *
 * Usage:
 *   Set environment variables first, then run:
 *   npm run verify-training
 *
 * Or load from .env.local manually:
 *   source .env.local (Linux/Mac)
 *   Then: npm run verify-training
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  console.log('\nRequired variables:');
  console.log('  - NEXT_PUBLIC_SUPABASE_URL');
  console.log('  - SUPABASE_SERVICE_ROLE_KEY');
  console.log('\nThese should be set in .env.local file');
  console.log('The variables will be loaded automatically when running the Next.js app');
  console.log('\nFor now, you can skip the database/storage checks and verify files only.');
  console.log('Run with: SKIP_DB_CHECKS=true npm run verify-training');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifySetup() {
  console.log('🔍 Verifying Training System Setup...\n');

  let allChecks = true;

  // Check 1: Database Tables
  console.log('1️⃣ Checking database tables...');
  const tables = [
    'training_documents',
    'training_metrics',
    'training_runs',
    'verification_edits'
  ];

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('id').limit(1);
      if (error) {
        console.log(`   ❌ Table '${table}' not found or not accessible`);
        console.log(`      Error: ${error.message}`);
        allChecks = false;
      } else {
        console.log(`   ✅ Table '${table}' exists`);
      }
    } catch (err) {
      console.log(`   ❌ Table '${table}' check failed`);
      allChecks = false;
    }
  }

  // Check 2: Training Metrics Initial Data
  console.log('\n2️⃣ Checking training metrics initialization...');
  try {
    const { data, error } = await supabase
      .from('training_metrics')
      .select('document_type')
      .order('document_type');

    if (error) {
      console.log(`   ❌ Failed to query training_metrics: ${error.message}`);
      allChecks = false;
    } else if (!data || data.length === 0) {
      console.log('   ⚠️  No metrics initialized - this is normal on first setup');
      console.log('   ℹ️  Metrics will be created automatically on first document upload');
    } else {
      console.log(`   ✅ Training metrics initialized for ${data.length} document types`);
      data.forEach(row => console.log(`      - ${row.document_type}`));
    }
  } catch (err) {
    console.log(`   ❌ Training metrics check failed: ${err.message}`);
    allChecks = false;
  }

  // Check 3: Storage Buckets
  console.log('\n3️⃣ Checking storage buckets...');
  const buckets = ['training-documents', 'training-exports'];

  try {
    const { data: allBuckets, error } = await supabase.storage.listBuckets();

    if (error) {
      console.log(`   ❌ Failed to list buckets: ${error.message}`);
      allChecks = false;
    } else {
      const bucketNames = allBuckets.map(b => b.name);

      for (const bucket of buckets) {
        if (bucketNames.includes(bucket)) {
          console.log(`   ✅ Bucket '${bucket}' exists`);
        } else {
          console.log(`   ❌ Bucket '${bucket}' not found`);
          console.log(`      Create it in Supabase Dashboard: Storage > New Bucket`);
          allChecks = false;
        }
      }
    }
  } catch (err) {
    console.log(`   ❌ Storage bucket check failed: ${err.message}`);
    allChecks = false;
  }

  // Check 4: API Endpoints
  console.log('\n4️⃣ Checking API endpoints exist...');
  const fs = require('fs');
  const path = require('path');

  const endpoints = [
    'batch-upload',
    'process-batch',
    'documents',
    'document/[id]',
    'verify/[id]',
    'reject/[id]',
    'metrics',
    'export',
    'auto-split'
  ];

  const apiBasePath = path.join(__dirname, 'src', 'app', 'api', 'training');

  for (const endpoint of endpoints) {
    const endpointPath = path.join(apiBasePath, endpoint, 'route.ts');
    if (fs.existsSync(endpointPath)) {
      console.log(`   ✅ API endpoint '${endpoint}' exists`);
    } else {
      console.log(`   ❌ API endpoint '${endpoint}' not found at ${endpointPath}`);
      allChecks = false;
    }
  }

  // Check 5: Required Files
  console.log('\n5️⃣ Checking required utility files...');
  const files = [
    'src/lib/training-utils.ts',
    'src/lib/openai-export.ts',
    'src/lib/types.ts',
    'supabase/migrations/003_training_system.sql'
  ];

  for (const file of files) {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      console.log(`   ✅ File '${file}' exists`);
    } else {
      console.log(`   ❌ File '${file}' not found`);
      allChecks = false;
    }
  }

  // Check 6: Environment Variables
  console.log('\n6️⃣ Checking environment variables...');
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ENCRYPTED_OPENAI_API_KEY'
  ];

  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      console.log(`   ✅ ${envVar} is set`);
    } else {
      console.log(`   ❌ ${envVar} is not set`);
      allChecks = false;
    }
  }

  // Final Summary
  console.log('\n' + '='.repeat(60));
  if (allChecks) {
    console.log('✅ ALL CHECKS PASSED - Training system is ready!');
    console.log('\nNext steps:');
    console.log('1. Start the development server: npm run dev');
    console.log('2. Test batch upload: POST /api/training/batch-upload');
    console.log('3. Review the TRAINING_SYSTEM_README.md for full documentation');
  } else {
    console.log('❌ SOME CHECKS FAILED - Please fix the issues above');
    console.log('\nCommon fixes:');
    console.log('1. Run database migration: Execute 003_training_system.sql in Supabase');
    console.log('2. Create storage buckets in Supabase Dashboard');
    console.log('3. Set all required environment variables in .env.local');
    console.log('4. Ensure all files are properly created');
  }
  console.log('='.repeat(60) + '\n');

  process.exit(allChecks ? 0 : 1);
}

verifySetup().catch(err => {
  console.error('\n❌ Verification failed with error:', err);
  process.exit(1);
});
