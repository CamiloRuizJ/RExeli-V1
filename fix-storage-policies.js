const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lddwbkefiucimrkfskzt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZHdia2VmaXVjaW1ya2Zza3p0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg4OTQ1MiwiZXhwIjoyMDcxNDY1NDUyfQ.Y8Apibmhx8ZE_JwX7kUuCL8L7TmvMJIgscNDwbUHSdA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixStoragePolicies() {
  console.log('Fixing storage policies for training-exports bucket...\n');

  const sql = `
    -- Drop existing policies
    DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated reads" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
    DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;
    DROP POLICY IF EXISTS "Allow all uploads" ON storage.objects;
    DROP POLICY IF EXISTS "Allow all reads" ON storage.objects;
    DROP POLICY IF EXISTS "Allow all updates" ON storage.objects;
    DROP POLICY IF EXISTS "Allow all deletes" ON storage.objects;

    -- Allow ANYONE (anon + authenticated) to upload to training-exports
    CREATE POLICY "Allow all uploads"
    ON storage.objects FOR INSERT
    TO anon, authenticated
    WITH CHECK (bucket_id = 'training-exports');

    -- Allow ANYONE to read files
    CREATE POLICY "Allow all reads"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'training-exports');

    -- Allow ANYONE to update files
    CREATE POLICY "Allow all updates"
    ON storage.objects FOR UPDATE
    TO anon, authenticated
    USING (bucket_id = 'training-exports');

    -- Allow ANYONE to delete files
    CREATE POLICY "Allow all deletes"
    ON storage.objects FOR DELETE
    TO anon, authenticated
    USING (bucket_id = 'training-exports');
  `;

  try {
    // Execute SQL - note: this requires a custom SQL function or direct query
    // Since Supabase JS client doesn't support raw SQL execution directly,
    // we'll need to use the management API

    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql })
    });

    if (!response.ok) {
      console.error('Failed to execute SQL. Please run the SQL manually in Supabase SQL Editor.');
      console.log('\nSQL to run:\n');
      console.log(sql);
      process.exit(1);
    }

    console.log('✅ Storage policies fixed successfully!');

  } catch (error) {
    console.error('Error:', error.message);
    console.log('\nPlease run this SQL manually in your Supabase SQL Editor:\n');
    console.log(sql);
    process.exit(1);
  }
}

fixStoragePolicies();
