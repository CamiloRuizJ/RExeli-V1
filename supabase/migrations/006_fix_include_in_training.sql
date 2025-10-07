-- Fix include_in_training for existing verified documents
-- This ensures all verified documents are included in training

UPDATE training_documents
SET include_in_training = true
WHERE is_verified = true
AND (include_in_training IS NULL OR include_in_training = false);

-- Verify the update
SELECT
    document_type,
    COUNT(*) as total_verified,
    SUM(CASE WHEN include_in_training = true THEN 1 ELSE 0 END) as included_in_training
FROM training_documents
WHERE is_verified = true
GROUP BY document_type;
