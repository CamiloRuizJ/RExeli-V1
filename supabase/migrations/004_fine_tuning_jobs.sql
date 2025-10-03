-- =====================================================
-- Automatic Fine-Tuning Pipeline
-- OpenAI Fine-Tuning Job Management & Model Versioning
-- =====================================================

-- Fine-tuning jobs tracking
CREATE TABLE IF NOT EXISTS fine_tuning_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Document type being fine-tuned
  document_type TEXT NOT NULL,

  -- OpenAI fine-tuning job information
  openai_job_id TEXT UNIQUE, -- OpenAI's job ID
  openai_file_id TEXT, -- Training file ID uploaded to OpenAI
  openai_validation_file_id TEXT, -- Validation file ID (optional)

  -- Job status
  status TEXT DEFAULT 'pending', -- pending, uploading, running, succeeded, failed, cancelled
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  failed_at TIMESTAMP,

  -- Training configuration
  base_model TEXT DEFAULT 'gpt-4o-mini-2024-07-18',
  hyperparameters JSONB, -- n_epochs, batch_size, learning_rate_multiplier

  -- Training data information
  training_examples_count INTEGER,
  validation_examples_count INTEGER,
  training_file_url TEXT, -- URL to training JSONL in storage
  validation_file_url TEXT, -- URL to validation JSONL in storage

  -- Results
  fine_tuned_model_id TEXT, -- The resulting model ID (e.g., ft:gpt-4o-mini-2024-07-18:...)
  trained_tokens INTEGER, -- Total tokens used in training

  -- Performance metrics (from OpenAI)
  training_loss DECIMAL,
  training_accuracy DECIMAL,
  validation_loss DECIMAL,
  validation_accuracy DECIMAL,
  metrics JSONB, -- Full metrics from OpenAI

  -- Error handling
  error_message TEXT,
  error_code TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Trigger information
  triggered_by TEXT DEFAULT 'auto', -- auto, manual, scheduled
  triggered_at_count INTEGER, -- Document count when triggered

  -- Audit
  created_by TEXT,
  notes TEXT,

  -- Constraints
  CONSTRAINT valid_doc_type CHECK (document_type IN (
    'rent_roll', 'operating_budget', 'broker_sales_comparables',
    'broker_lease_comparables', 'broker_listing', 'offering_memo',
    'lease_agreement', 'financial_statements'
  )),
  CONSTRAINT valid_status CHECK (status IN (
    'pending', 'uploading', 'running', 'succeeded', 'failed', 'cancelled'
  ))
);

-- Indexes for fine_tuning_jobs
CREATE INDEX IF NOT EXISTS idx_fine_tuning_jobs_doc_type ON fine_tuning_jobs(document_type);
CREATE INDEX IF NOT EXISTS idx_fine_tuning_jobs_status ON fine_tuning_jobs(status);
CREATE INDEX IF NOT EXISTS idx_fine_tuning_jobs_openai_id ON fine_tuning_jobs(openai_job_id);
CREATE INDEX IF NOT EXISTS idx_fine_tuning_jobs_created ON fine_tuning_jobs(created_at DESC);

-- Model versions tracking
CREATE TABLE IF NOT EXISTS model_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Model identification
  document_type TEXT NOT NULL,
  model_id TEXT NOT NULL, -- OpenAI model ID (base or fine-tuned)
  version_number INTEGER NOT NULL, -- Auto-incrementing version per doc type

  -- Model type
  model_type TEXT DEFAULT 'fine_tuned', -- base, fine_tuned
  fine_tuning_job_id UUID REFERENCES fine_tuning_jobs(id) ON DELETE SET NULL,

  -- Deployment status
  deployment_status TEXT DEFAULT 'inactive', -- inactive, testing, active, archived
  deployed_at TIMESTAMP,
  archived_at TIMESTAMP,

  -- Performance tracking
  total_requests INTEGER DEFAULT 0,
  successful_extractions INTEGER DEFAULT 0,
  failed_extractions INTEGER DEFAULT 0,
  average_confidence DECIMAL,
  user_satisfaction_score DECIMAL, -- Based on verification edits needed

  -- A/B testing support
  traffic_percentage INTEGER DEFAULT 0, -- 0-100, for gradual rollout

  -- Performance metrics
  performance_metrics JSONB, -- Custom metrics, benchmarks, etc.

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT,
  notes TEXT,

  -- Constraints
  CONSTRAINT valid_model_doc_type CHECK (document_type IN (
    'rent_roll', 'operating_budget', 'broker_sales_comparables',
    'broker_lease_comparables', 'broker_listing', 'offering_memo',
    'lease_agreement', 'financial_statements'
  )),
  CONSTRAINT valid_model_type CHECK (model_type IN ('base', 'fine_tuned')),
  CONSTRAINT valid_deployment_status CHECK (deployment_status IN ('inactive', 'testing', 'active', 'archived')),
  CONSTRAINT valid_traffic_percentage CHECK (traffic_percentage >= 0 AND traffic_percentage <= 100),
  CONSTRAINT unique_doc_type_version UNIQUE (document_type, version_number)
);

-- Indexes for model_versions
CREATE INDEX IF NOT EXISTS idx_model_versions_doc_type ON model_versions(document_type);
CREATE INDEX IF NOT EXISTS idx_model_versions_status ON model_versions(deployment_status);
CREATE INDEX IF NOT EXISTS idx_model_versions_active ON model_versions(document_type, deployment_status) WHERE deployment_status = 'active';
CREATE INDEX IF NOT EXISTS idx_model_versions_created ON model_versions(created_at DESC);

-- Training triggers tracking (for auto-trigger every 10 documents)
CREATE TABLE IF NOT EXISTS training_triggers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Document type
  document_type TEXT NOT NULL UNIQUE,

  -- Trigger configuration
  trigger_interval INTEGER DEFAULT 10, -- Trigger every N verified documents
  last_trigger_count INTEGER DEFAULT 0, -- Count when last triggered
  next_trigger_at INTEGER DEFAULT 10, -- Next trigger count

  -- Auto-trigger settings
  auto_trigger_enabled BOOLEAN DEFAULT true,
  min_documents_required INTEGER DEFAULT 10, -- Minimum documents before first trigger

  -- Last trigger information
  last_triggered_at TIMESTAMP,
  last_job_id UUID REFERENCES fine_tuning_jobs(id) ON DELETE SET NULL,
  total_triggers INTEGER DEFAULT 0,

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_trigger_doc_type CHECK (document_type IN (
    'rent_roll', 'operating_budget', 'broker_sales_comparables',
    'broker_lease_comparables', 'broker_listing', 'offering_memo',
    'lease_agreement', 'financial_statements'
  ))
);

-- Indexes for training_triggers
CREATE INDEX IF NOT EXISTS idx_training_triggers_doc_type ON training_triggers(document_type);
CREATE INDEX IF NOT EXISTS idx_training_triggers_enabled ON training_triggers(auto_trigger_enabled) WHERE auto_trigger_enabled = true;

-- =====================================================
-- TRIGGERS AND FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp for model_versions
DROP TRIGGER IF EXISTS update_model_versions_updated_at ON model_versions;
CREATE TRIGGER update_model_versions_updated_at
    BEFORE UPDATE ON model_versions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to update updated_at timestamp for training_triggers
DROP TRIGGER IF EXISTS update_training_triggers_updated_at ON training_triggers;
CREATE TRIGGER update_training_triggers_updated_at
    BEFORE UPDATE ON training_triggers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-increment version number for new models
CREATE OR REPLACE FUNCTION set_model_version_number()
RETURNS TRIGGER AS $$
BEGIN
    -- If version_number is not set, auto-increment
    IF NEW.version_number IS NULL THEN
        SELECT COALESCE(MAX(version_number), 0) + 1
        INTO NEW.version_number
        FROM model_versions
        WHERE document_type = NEW.document_type;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_model_version_number_trigger ON model_versions;
CREATE TRIGGER set_model_version_number_trigger
    BEFORE INSERT ON model_versions
    FOR EACH ROW
    EXECUTE FUNCTION set_model_version_number();

-- Function to ensure only one active model per document type
CREATE OR REPLACE FUNCTION ensure_single_active_model()
RETURNS TRIGGER AS $$
BEGIN
    -- If setting this model to active, deactivate all others for this doc type
    IF NEW.deployment_status = 'active' THEN
        UPDATE model_versions
        SET deployment_status = 'inactive',
            updated_at = NOW()
        WHERE document_type = NEW.document_type
          AND id != NEW.id
          AND deployment_status = 'active';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_single_active_model_trigger ON model_versions;
CREATE TRIGGER ensure_single_active_model_trigger
    BEFORE INSERT OR UPDATE OF deployment_status ON model_versions
    FOR EACH ROW
    WHEN (NEW.deployment_status = 'active')
    EXECUTE FUNCTION ensure_single_active_model();

-- =====================================================
-- SEED DATA
-- =====================================================

-- Initialize training triggers for all document types
INSERT INTO training_triggers (document_type, trigger_interval, next_trigger_at) VALUES
    ('rent_roll', 10, 10),
    ('operating_budget', 10, 10),
    ('broker_sales_comparables', 10, 10),
    ('broker_lease_comparables', 10, 10),
    ('broker_listing', 10, 10),
    ('offering_memo', 10, 10),
    ('lease_agreement', 10, 10),
    ('financial_statements', 10, 10)
ON CONFLICT (document_type) DO NOTHING;

-- Initialize base models for all document types
INSERT INTO model_versions (document_type, model_id, version_number, model_type, deployment_status, created_by, notes) VALUES
    ('rent_roll', 'gpt-4o-mini-2024-07-18', 0, 'base', 'active', 'system', 'Initial base model'),
    ('operating_budget', 'gpt-4o-mini-2024-07-18', 0, 'base', 'active', 'system', 'Initial base model'),
    ('broker_sales_comparables', 'gpt-4o-mini-2024-07-18', 0, 'base', 'active', 'system', 'Initial base model'),
    ('broker_lease_comparables', 'gpt-4o-mini-2024-07-18', 0, 'base', 'active', 'system', 'Initial base model'),
    ('broker_listing', 'gpt-4o-mini-2024-07-18', 0, 'base', 'active', 'system', 'Initial base model'),
    ('offering_memo', 'gpt-4o-mini-2024-07-18', 0, 'base', 'active', 'system', 'Initial base model'),
    ('lease_agreement', 'gpt-4o-mini-2024-07-18', 0, 'base', 'active', 'system', 'Initial base model'),
    ('financial_statements', 'gpt-4o-mini-2024-07-18', 0, 'base', 'active', 'system', 'Initial base model')
ON CONFLICT (document_type, version_number) DO NOTHING;

-- =====================================================
-- HELPER VIEWS
-- =====================================================

-- View for active models per document type
CREATE OR REPLACE VIEW active_models AS
SELECT
    document_type,
    model_id,
    version_number,
    model_type,
    deployment_status,
    deployed_at,
    total_requests,
    successful_extractions,
    average_confidence,
    performance_metrics
FROM model_versions
WHERE deployment_status = 'active'
ORDER BY document_type;

-- View for fine-tuning job status
CREATE OR REPLACE VIEW fine_tuning_status AS
SELECT
    ftj.id,
    ftj.document_type,
    ftj.openai_job_id,
    ftj.status,
    ftj.created_at,
    ftj.completed_at,
    ftj.training_examples_count,
    ftj.validation_examples_count,
    ftj.fine_tuned_model_id,
    ftj.error_message,
    mv.version_number as model_version,
    mv.deployment_status as model_deployment_status
FROM fine_tuning_jobs ftj
LEFT JOIN model_versions mv ON ftj.id = mv.fine_tuning_job_id
ORDER BY ftj.created_at DESC;

-- View for trigger readiness
CREATE OR REPLACE VIEW trigger_readiness AS
SELECT
    tt.document_type,
    tt.auto_trigger_enabled,
    tt.trigger_interval,
    tt.last_trigger_count,
    tt.next_trigger_at,
    tm.verified_documents as current_verified_count,
    (tm.verified_documents >= tt.next_trigger_at AND tt.auto_trigger_enabled) as ready_to_trigger,
    tt.last_triggered_at,
    tt.total_triggers
FROM training_triggers tt
JOIN training_metrics tm ON tt.document_type = tm.document_type
ORDER BY ready_to_trigger DESC, tm.verified_documents DESC;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE fine_tuning_jobs IS 'Tracks OpenAI fine-tuning jobs and their status';
COMMENT ON TABLE model_versions IS 'Version control for models with deployment tracking';
COMMENT ON TABLE training_triggers IS 'Auto-trigger configuration for fine-tuning every N verified documents';

COMMENT ON COLUMN fine_tuning_jobs.openai_job_id IS 'OpenAI fine-tuning job ID from API';
COMMENT ON COLUMN fine_tuning_jobs.fine_tuned_model_id IS 'Resulting fine-tuned model ID (e.g., ft:gpt-4o-mini-2024-07-18:org:suffix:id)';
COMMENT ON COLUMN model_versions.traffic_percentage IS 'Percentage of traffic to route to this model (for A/B testing)';
COMMENT ON COLUMN training_triggers.trigger_interval IS 'Trigger fine-tuning every N verified documents';

-- =====================================================
-- ROLLBACK SCRIPT (for reference)
-- =====================================================

-- To rollback this migration, run:
-- DROP VIEW IF EXISTS trigger_readiness;
-- DROP VIEW IF EXISTS fine_tuning_status;
-- DROP VIEW IF EXISTS active_models;
-- DROP TRIGGER IF EXISTS ensure_single_active_model_trigger ON model_versions;
-- DROP TRIGGER IF EXISTS set_model_version_number_trigger ON model_versions;
-- DROP TRIGGER IF EXISTS update_training_triggers_updated_at ON training_triggers;
-- DROP TRIGGER IF EXISTS update_model_versions_updated_at ON model_versions;
-- DROP FUNCTION IF EXISTS ensure_single_active_model();
-- DROP FUNCTION IF EXISTS set_model_version_number();
-- DROP TABLE IF EXISTS training_triggers;
-- DROP TABLE IF EXISTS model_versions;
-- DROP TABLE IF EXISTS fine_tuning_jobs;
