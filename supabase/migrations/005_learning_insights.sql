-- =====================================================
-- Learning Insights Enhancement
-- Store aggregated learnings from verification feedback
-- =====================================================

-- Add learning_insights column to training_metrics
ALTER TABLE training_metrics
ADD COLUMN IF NOT EXISTS learning_insights JSONB;

-- Create index for learning insights queries
CREATE INDEX IF NOT EXISTS idx_training_metrics_learning_insights
ON training_metrics USING GIN (learning_insights);

-- Add feedback categories to training_documents
ALTER TABLE training_documents
ADD COLUMN IF NOT EXISTS feedback_categories TEXT[];

-- Create index for feedback categories
CREATE INDEX IF NOT EXISTS idx_training_docs_feedback_categories
ON training_documents USING GIN (feedback_categories);

-- View for learning insights summary
CREATE OR REPLACE VIEW learning_insights_summary AS
SELECT
    document_type,
    verified_documents,
    learning_insights,
    (learning_insights->>'last_updated')::timestamp as insights_last_updated,
    jsonb_array_length(COALESCE(learning_insights->'common_errors', '[]'::jsonb)) as common_errors_count,
    jsonb_array_length(COALESCE(learning_insights->'improvement_suggestions', '[]'::jsonb)) as suggestions_count
FROM training_metrics
WHERE learning_insights IS NOT NULL
ORDER BY verified_documents DESC;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON COLUMN training_metrics.learning_insights IS 'Aggregated learnings from verification feedback including common errors and improvement suggestions';
COMMENT ON COLUMN training_documents.feedback_categories IS 'Structured categories of feedback for error pattern analysis';

-- =====================================================
-- ROLLBACK SCRIPT (for reference)
-- =====================================================

-- To rollback this migration, run:
-- DROP VIEW IF EXISTS learning_insights_summary;
-- DROP INDEX IF EXISTS idx_training_docs_feedback_categories;
-- DROP INDEX IF EXISTS idx_training_metrics_learning_insights;
-- ALTER TABLE training_documents DROP COLUMN IF EXISTS feedback_categories;
-- ALTER TABLE training_metrics DROP COLUMN IF EXISTS learning_insights;
