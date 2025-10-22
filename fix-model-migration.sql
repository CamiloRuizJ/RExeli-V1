-- Fix Fine-Tuning Model Configuration
-- Changes default from gpt-4o-mini to gpt-4o for vision support
-- Run this in Supabase SQL Editor

-- 1. Update the default model for fine_tuning_jobs table
ALTER TABLE fine_tuning_jobs
  ALTER COLUMN base_model SET DEFAULT 'gpt-4o-2024-08-06';

-- 2. Update any existing base model entries in model_versions that use gpt-4o-mini
UPDATE model_versions
SET model_id = 'gpt-4o-2024-08-06'
WHERE model_id = 'gpt-4o-mini-2024-07-18'
  AND model_type = 'base';

-- 3. Add a comment explaining why we use gpt-4o
COMMENT ON COLUMN fine_tuning_jobs.base_model IS
  'Base model for fine-tuning. Using gpt-4o-2024-08-06 because it supports vision/images, required for document extraction with base64 images. gpt-4o-mini does NOT support images.';

-- Verification queries
SELECT 'Current default model:' as info,
       column_default
FROM information_schema.columns
WHERE table_name = 'fine_tuning_jobs'
  AND column_name = 'base_model';

SELECT 'Active base models:' as info,
       document_type,
       model_id,
       model_type,
       deployment_status
FROM model_versions
WHERE model_type = 'base'
  AND deployment_status = 'active';
