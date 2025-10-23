-- =====================================================
-- FIX STORAGE POLICIES FOR TRAINING-EXPORTS BUCKET
-- Run this in Supabase SQL Editor
-- =====================================================

-- Drop all existing policies for training-exports bucket
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow all uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow all reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow all updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow all deletes" ON storage.objects;

-- Create new policies allowing anon + authenticated access
CREATE POLICY "Allow all uploads"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'training-exports');

CREATE POLICY "Allow all reads"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'training-exports');

CREATE POLICY "Allow all updates"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'training-exports');

CREATE POLICY "Allow all deletes"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'training-exports');

-- Verify policies were created
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename = 'objects'
AND policyname LIKE '%Allow all%'
ORDER BY policyname;
