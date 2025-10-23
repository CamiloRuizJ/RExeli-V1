// Direct SQL execution using Supabase service role
const https = require('https');

const supabaseUrl = 'https://lddwbkefiucimrkfskzt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZHdia2VmaXVjaW1ya2Zza3p0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg4OTQ1MiwiZXhwIjoyMDcxNDY1NDUyfQ.Y8Apibmhx8ZE_JwX7kUuCL8L7TmvMJIgscNDwbUHSdA';

// SQL to execute
const sql = `
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow all uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow all reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow all updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow all deletes" ON storage.objects;

CREATE POLICY "Allow all uploads" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'training-exports');
CREATE POLICY "Allow all reads" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'training-exports');
CREATE POLICY "Allow all updates" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'training-exports');
CREATE POLICY "Allow all deletes" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'training-exports');
`;

console.log('='.repeat(60));
console.log('SUPABASE STORAGE POLICIES FIX');
console.log('='.repeat(60));
console.log('\nPlease copy and paste this SQL into your Supabase SQL Editor:\n');
console.log(sql);
console.log('\n' + '='.repeat(60));
console.log('\nAfter running the SQL, the fine-tuning will work!');
console.log('='.repeat(60));
