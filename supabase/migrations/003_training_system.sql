-- =====================================================
-- AI Training Data Collection System
-- OpenAI Fine-Tuning Best Practices Implementation
-- =====================================================

-- Main training documents table
CREATE TABLE IF NOT EXISTS training_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- File information
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  document_type TEXT NOT NULL,

  -- Processing status
  upload_date TIMESTAMP DEFAULT NOW(),
  processing_status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  processed_date TIMESTAMP,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Extraction data
  raw_extraction JSONB, -- Original AI extraction
  verified_extraction JSONB, -- Human-corrected version
  extraction_confidence DECIMAL,

  -- Verification workflow
  verification_status TEXT DEFAULT 'unverified', -- unverified, in_review, verified, rejected
  is_verified BOOLEAN DEFAULT false,
  verified_by TEXT,
  verified_date TIMESTAMP,
  verification_notes TEXT,
  requires_recheck BOOLEAN DEFAULT false,

  -- Training metadata
  dataset_split TEXT DEFAULT 'train', -- train, validation, test
  training_version INTEGER DEFAULT 1,
  include_in_training BOOLEAN DEFAULT true,
  quality_score DECIMAL, -- 0-1 score based on verification

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT,

  -- Constraints
  CONSTRAINT valid_doc_type CHECK (document_type IN (
    'rent_roll', 'operating_budget', 'broker_sales_comparables',
    'broker_lease_comparables', 'broker_listing', 'offering_memo',
    'lease_agreement', 'financial_statements'
  )),
  CONSTRAINT valid_processing_status CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  CONSTRAINT valid_verification_status CHECK (verification_status IN ('unverified', 'in_review', 'verified', 'rejected')),
  CONSTRAINT valid_dataset_split CHECK (dataset_split IN ('train', 'validation', 'test')),
  CONSTRAINT valid_quality_score CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 1))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_training_docs_type ON training_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_training_docs_processing_status ON training_documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_training_docs_verification_status ON training_documents(verification_status);
CREATE INDEX IF NOT EXISTS idx_training_docs_verified ON training_documents(is_verified);
CREATE INDEX IF NOT EXISTS idx_training_docs_split ON training_documents(dataset_split);
CREATE INDEX IF NOT EXISTS idx_training_docs_created ON training_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_training_docs_include_training ON training_documents(include_in_training) WHERE include_in_training = true;

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_training_docs_type_status ON training_documents(document_type, processing_status);
CREATE INDEX IF NOT EXISTS idx_training_docs_type_verified ON training_documents(document_type, is_verified);
CREATE INDEX IF NOT EXISTS idx_training_docs_type_split ON training_documents(document_type, dataset_split);

-- Training metrics per document type
CREATE TABLE IF NOT EXISTS training_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_type TEXT NOT NULL UNIQUE,

  -- Document counts
  total_documents INTEGER DEFAULT 0,
  pending_documents INTEGER DEFAULT 0,
  processing_documents INTEGER DEFAULT 0,
  completed_documents INTEGER DEFAULT 0,
  failed_documents INTEGER DEFAULT 0,

  -- Verification counts
  unverified_documents INTEGER DEFAULT 0,
  verified_documents INTEGER DEFAULT 0,
  rejected_documents INTEGER DEFAULT 0,

  -- Dataset split counts
  train_set_size INTEGER DEFAULT 0,
  validation_set_size INTEGER DEFAULT 0,
  test_set_size INTEGER DEFAULT 0,

  -- Quality metrics
  average_confidence DECIMAL,
  average_quality_score DECIMAL,
  ready_for_training BOOLEAN DEFAULT false,
  minimum_examples_met BOOLEAN DEFAULT false,

  -- Training history
  last_export_date TIMESTAMP,
  last_training_date TIMESTAMP,
  training_runs INTEGER DEFAULT 0,

  last_updated TIMESTAMP DEFAULT NOW(),

  CONSTRAINT valid_metrics_doc_type CHECK (document_type IN (
    'rent_roll', 'operating_budget', 'broker_sales_comparables',
    'broker_lease_comparables', 'broker_listing', 'offering_memo',
    'lease_agreement', 'financial_statements'
  ))
);

-- Training runs history
CREATE TABLE IF NOT EXISTS training_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_type TEXT NOT NULL,

  -- Run metadata
  run_date TIMESTAMP DEFAULT NOW(),
  total_examples INTEGER,
  train_examples INTEGER,
  validation_examples INTEGER,

  -- OpenAI fine-tuning info
  openai_job_id TEXT,
  fine_tuned_model_id TEXT,
  training_status TEXT DEFAULT 'pending', -- pending, running, completed, failed

  -- Export info
  export_file_path TEXT,
  export_file_size INTEGER,

  -- Performance metrics (filled after training)
  training_accuracy DECIMAL,
  validation_accuracy DECIMAL,
  training_loss DECIMAL,
  validation_loss DECIMAL,

  -- Audit
  created_by TEXT,
  notes TEXT,

  CONSTRAINT valid_run_doc_type CHECK (document_type IN (
    'rent_roll', 'operating_budget', 'broker_sales_comparables',
    'broker_lease_comparables', 'broker_listing', 'offering_memo',
    'lease_agreement', 'financial_statements'
  )),
  CONSTRAINT valid_training_status CHECK (training_status IN ('pending', 'running', 'completed', 'failed'))
);

-- Index for training runs
CREATE INDEX IF NOT EXISTS idx_training_runs_type ON training_runs(document_type);
CREATE INDEX IF NOT EXISTS idx_training_runs_date ON training_runs(run_date DESC);
CREATE INDEX IF NOT EXISTS idx_training_runs_status ON training_runs(training_status);

-- Verification edit history
CREATE TABLE IF NOT EXISTS verification_edits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  training_document_id UUID REFERENCES training_documents(id) ON DELETE CASCADE,

  editor_id TEXT NOT NULL,
  edit_date TIMESTAMP DEFAULT NOW(),

  before_data JSONB,
  after_data JSONB,
  changes_made TEXT,

  verification_action TEXT, -- verify, reject, edit, recheck

  CONSTRAINT valid_verification_action CHECK (verification_action IN ('verify', 'reject', 'edit', 'recheck'))
);

-- Index for edit history
CREATE INDEX IF NOT EXISTS idx_verification_edits_doc ON verification_edits(training_document_id);
CREATE INDEX IF NOT EXISTS idx_verification_edits_date ON verification_edits(edit_date DESC);
CREATE INDEX IF NOT EXISTS idx_verification_edits_editor ON verification_edits(editor_id);

-- =====================================================
-- TRIGGERS AND FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for training_documents
DROP TRIGGER IF EXISTS update_training_documents_updated_at ON training_documents;
CREATE TRIGGER update_training_documents_updated_at
    BEFORE UPDATE ON training_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to update training metrics
CREATE OR REPLACE FUNCTION update_training_metrics()
RETURNS TRIGGER AS $$
DECLARE
    doc_type TEXT;
BEGIN
    -- Determine which document type to update
    IF TG_OP = 'DELETE' THEN
        doc_type := OLD.document_type;
    ELSE
        doc_type := NEW.document_type;
    END IF;

    -- Upsert metrics for this document type
    INSERT INTO training_metrics (document_type)
    VALUES (doc_type)
    ON CONFLICT (document_type) DO NOTHING;

    -- Update all counts
    UPDATE training_metrics
    SET
        total_documents = (
            SELECT COUNT(*)
            FROM training_documents
            WHERE document_type = doc_type
        ),
        pending_documents = (
            SELECT COUNT(*)
            FROM training_documents
            WHERE document_type = doc_type AND processing_status = 'pending'
        ),
        processing_documents = (
            SELECT COUNT(*)
            FROM training_documents
            WHERE document_type = doc_type AND processing_status = 'processing'
        ),
        completed_documents = (
            SELECT COUNT(*)
            FROM training_documents
            WHERE document_type = doc_type AND processing_status = 'completed'
        ),
        failed_documents = (
            SELECT COUNT(*)
            FROM training_documents
            WHERE document_type = doc_type AND processing_status = 'failed'
        ),
        unverified_documents = (
            SELECT COUNT(*)
            FROM training_documents
            WHERE document_type = doc_type AND verification_status = 'unverified'
        ),
        verified_documents = (
            SELECT COUNT(*)
            FROM training_documents
            WHERE document_type = doc_type AND verification_status = 'verified'
        ),
        rejected_documents = (
            SELECT COUNT(*)
            FROM training_documents
            WHERE document_type = doc_type AND verification_status = 'rejected'
        ),
        train_set_size = (
            SELECT COUNT(*)
            FROM training_documents
            WHERE document_type = doc_type AND dataset_split = 'train' AND include_in_training = true
        ),
        validation_set_size = (
            SELECT COUNT(*)
            FROM training_documents
            WHERE document_type = doc_type AND dataset_split = 'validation' AND include_in_training = true
        ),
        test_set_size = (
            SELECT COUNT(*)
            FROM training_documents
            WHERE document_type = doc_type AND dataset_split = 'test' AND include_in_training = true
        ),
        average_confidence = (
            SELECT AVG(extraction_confidence)
            FROM training_documents
            WHERE document_type = doc_type AND extraction_confidence IS NOT NULL
        ),
        average_quality_score = (
            SELECT AVG(quality_score)
            FROM training_documents
            WHERE document_type = doc_type AND quality_score IS NOT NULL
        ),
        minimum_examples_met = (
            SELECT COUNT(*) >= 50
            FROM training_documents
            WHERE document_type = doc_type AND is_verified = true AND include_in_training = true
        ),
        ready_for_training = (
            SELECT COUNT(*) >= 50
            FROM training_documents
            WHERE document_type = doc_type AND is_verified = true AND include_in_training = true
        ),
        last_updated = NOW()
    WHERE training_metrics.document_type = doc_type;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update metrics on training_documents changes
DROP TRIGGER IF EXISTS update_metrics_on_training_doc_change ON training_documents;
CREATE TRIGGER update_metrics_on_training_doc_change
    AFTER INSERT OR UPDATE OR DELETE ON training_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_training_metrics();

-- =====================================================
-- SEED DATA
-- =====================================================

-- Initialize metrics for all document types
INSERT INTO training_metrics (document_type) VALUES
    ('rent_roll'),
    ('operating_budget'),
    ('broker_sales_comparables'),
    ('broker_lease_comparables'),
    ('broker_listing'),
    ('offering_memo'),
    ('lease_agreement'),
    ('financial_statements')
ON CONFLICT (document_type) DO NOTHING;

-- =====================================================
-- STORAGE BUCKET SETUP (if using Supabase Storage)
-- =====================================================

-- Note: Storage bucket creation is typically done via Supabase Dashboard or CLI
-- This is a reference for the bucket structure needed:
--
-- Bucket: training-documents
-- Path structure: {document_type}/{uuid}_{filename}
-- Public: false (requires authentication)
-- File size limit: 50MB
-- Allowed MIME types: application/pdf, image/png, image/jpeg

-- =====================================================
-- HELPER VIEWS
-- =====================================================

-- View for training-ready documents
CREATE OR REPLACE VIEW training_ready_documents AS
SELECT
    d.*,
    m.ready_for_training as type_ready_for_training,
    m.verified_documents as total_verified_in_type
FROM training_documents d
JOIN training_metrics m ON d.document_type = m.document_type
WHERE
    d.is_verified = true
    AND d.include_in_training = true
    AND d.processing_status = 'completed';

-- View for verification queue
CREATE OR REPLACE VIEW verification_queue AS
SELECT
    d.*,
    (SELECT COUNT(*) FROM verification_edits WHERE training_document_id = d.id) as edit_count
FROM training_documents d
WHERE
    d.processing_status = 'completed'
    AND d.verification_status IN ('unverified', 'in_review')
ORDER BY d.created_at ASC;

-- View for training metrics summary
CREATE OR REPLACE VIEW training_summary AS
SELECT
    document_type,
    total_documents,
    verified_documents,
    train_set_size,
    validation_set_size,
    ROUND(average_confidence * 100, 2) as avg_confidence_pct,
    ROUND(average_quality_score * 100, 2) as avg_quality_pct,
    ready_for_training,
    minimum_examples_met,
    last_export_date,
    training_runs
FROM training_metrics
ORDER BY document_type;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE training_documents IS 'Main table storing all training documents with extraction data and verification status';
COMMENT ON TABLE training_metrics IS 'Aggregated metrics per document type for training readiness monitoring';
COMMENT ON TABLE training_runs IS 'History of training runs and OpenAI fine-tuning jobs';
COMMENT ON TABLE verification_edits IS 'Audit trail of all verification and editing actions';

COMMENT ON COLUMN training_documents.raw_extraction IS 'Original AI extraction before human verification';
COMMENT ON COLUMN training_documents.verified_extraction IS 'Human-corrected extraction used for training';
COMMENT ON COLUMN training_documents.dataset_split IS 'Assigned split: train (80%), validation (20%), or test';
COMMENT ON COLUMN training_documents.quality_score IS 'Human-assigned quality score (0-1) based on extraction accuracy';

-- =====================================================
-- ROLLBACK SCRIPT (for reference)
-- =====================================================

-- To rollback this migration, run:
-- DROP VIEW IF EXISTS training_summary;
-- DROP VIEW IF EXISTS verification_queue;
-- DROP VIEW IF EXISTS training_ready_documents;
-- DROP TRIGGER IF EXISTS update_metrics_on_training_doc_change ON training_documents;
-- DROP TRIGGER IF EXISTS update_training_documents_updated_at ON training_documents;
-- DROP FUNCTION IF EXISTS update_training_metrics();
-- DROP FUNCTION IF EXISTS update_updated_at_column();
-- DROP TABLE IF EXISTS verification_edits;
-- DROP TABLE IF EXISTS training_runs;
-- DROP TABLE IF EXISTS training_metrics;
-- DROP TABLE IF EXISTS training_documents;
