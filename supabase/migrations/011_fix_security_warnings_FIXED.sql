-- =====================================================
-- Migration 011: Fix Supabase Security Warnings (FIXED)
-- Description: Address security warnings from Supabase security audit
-- 1. Remove SECURITY DEFINER from 10 views (change to SECURITY INVOKER)
-- 2. Enable RLS on 7 tables without RLS policies
-- 3. Add search_path = public to 8 functions
-- =====================================================

-- =====================================================
-- PART 1: Fix Views - Remove SECURITY DEFINER
-- Change all views to use security_invoker=true
-- NOTE: We drop and recreate to avoid column name conflicts
-- =====================================================

-- Drop all views first (in correct dependency order)
DROP VIEW IF EXISTS trigger_readiness CASCADE;
DROP VIEW IF EXISTS fine_tuning_status CASCADE;
DROP VIEW IF EXISTS active_models CASCADE;
DROP VIEW IF EXISTS learning_insights_summary CASCADE;
DROP VIEW IF EXISTS document_type_analytics CASCADE;
DROP VIEW IF EXISTS monthly_usage_summary CASCADE;
DROP VIEW IF EXISTS user_credit_summary CASCADE;
DROP VIEW IF EXISTS training_summary CASCADE;
DROP VIEW IF EXISTS verification_queue CASCADE;
DROP VIEW IF EXISTS training_ready_documents CASCADE;

-- Recreate views with security_invoker=true

-- From 003_training_system.sql
CREATE VIEW training_ready_documents
WITH (security_invoker=true) AS
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

CREATE VIEW verification_queue
WITH (security_invoker=true) AS
SELECT
    d.*,
    (SELECT COUNT(*) FROM verification_edits WHERE training_document_id = d.id) as edit_count
FROM training_documents d
WHERE
    d.processing_status = 'completed'
    AND d.verification_status IN ('unverified', 'in_review')
ORDER BY d.created_at ASC;

CREATE VIEW training_summary
WITH (security_invoker=true) AS
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

-- From 004_fine_tuning_jobs.sql
CREATE VIEW active_models
WITH (security_invoker=true) AS
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

CREATE VIEW fine_tuning_status
WITH (security_invoker=true) AS
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

CREATE VIEW trigger_readiness
WITH (security_invoker=true) AS
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

-- From 005_learning_insights.sql
CREATE VIEW learning_insights_summary
WITH (security_invoker=true) AS
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

-- From 007_user_management_system.sql
CREATE VIEW user_credit_summary
WITH (security_invoker=true) AS
SELECT
  u.id,
  u.email,
  u.name,
  u.credits,
  u.subscription_type,
  u.subscription_status,
  u.monthly_usage,
  u.lifetime_usage,
  u.billing_cycle_start,
  u.billing_cycle_end,
  u.is_active,
  u.created_at,
  COALESCE(SUM(CASE WHEN ul.processing_status = 'success' THEN 1 ELSE 0 END), 0) as total_successful_documents,
  COALESCE(SUM(CASE WHEN ul.processing_status = 'failed' THEN 1 ELSE 0 END), 0) as total_failed_documents,
  COALESCE(AVG(ul.page_count), 0) as avg_pages_per_document
FROM users u
LEFT JOIN usage_logs ul ON u.id = ul.user_id
GROUP BY u.id, u.email, u.name, u.credits, u.subscription_type, u.subscription_status,
         u.monthly_usage, u.lifetime_usage, u.billing_cycle_start, u.billing_cycle_end,
         u.is_active, u.created_at;

CREATE VIEW monthly_usage_summary
WITH (security_invoker=true) AS
SELECT
  user_id,
  DATE_TRUNC('month', timestamp) as month,
  COUNT(*) as documents_processed,
  SUM(page_count) as pages_processed,
  SUM(credits_used) as credits_consumed,
  AVG(page_count) as avg_pages_per_doc,
  COUNT(CASE WHEN processing_status = 'success' THEN 1 END) as successful_count,
  COUNT(CASE WHEN processing_status = 'failed' THEN 1 END) as failed_count
FROM usage_logs
GROUP BY user_id, DATE_TRUNC('month', timestamp);

CREATE VIEW document_type_analytics
WITH (security_invoker=true) AS
SELECT
  user_id,
  document_type,
  COUNT(*) as document_count,
  SUM(page_count) as total_pages,
  AVG(page_count) as avg_pages,
  SUM(credits_used) as total_credits_used
FROM usage_logs
WHERE processing_status = 'success'
GROUP BY user_id, document_type;

-- =====================================================
-- PART 2: Enable RLS on Tables
-- Add RLS policies to 7 tables that currently lack them
-- =====================================================

-- Table 1: verification_edits
ALTER TABLE verification_edits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role full access to verification_edits" ON verification_edits;
CREATE POLICY "Allow service role full access to verification_edits" ON verification_edits
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can view verification_edits" ON verification_edits;
CREATE POLICY "Authenticated users can view verification_edits" ON verification_edits
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Table 2: training_documents
ALTER TABLE training_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role full access to training_documents" ON training_documents;
CREATE POLICY "Allow service role full access to training_documents" ON training_documents
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can view training_documents" ON training_documents;
CREATE POLICY "Authenticated users can view training_documents" ON training_documents
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Table 3: training_metrics
ALTER TABLE training_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role full access to training_metrics" ON training_metrics;
CREATE POLICY "Allow service role full access to training_metrics" ON training_metrics
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can view training_metrics" ON training_metrics;
CREATE POLICY "Authenticated users can view training_metrics" ON training_metrics
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Table 4: training_runs
ALTER TABLE training_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role full access to training_runs" ON training_runs;
CREATE POLICY "Allow service role full access to training_runs" ON training_runs
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can view training_runs" ON training_runs;
CREATE POLICY "Authenticated users can view training_runs" ON training_runs
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Table 5: fine_tuning_jobs
ALTER TABLE fine_tuning_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role full access to fine_tuning_jobs" ON fine_tuning_jobs;
CREATE POLICY "Allow service role full access to fine_tuning_jobs" ON fine_tuning_jobs
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can view fine_tuning_jobs" ON fine_tuning_jobs;
CREATE POLICY "Authenticated users can view fine_tuning_jobs" ON fine_tuning_jobs
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Table 6: model_versions
ALTER TABLE model_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role full access to model_versions" ON model_versions;
CREATE POLICY "Allow service role full access to model_versions" ON model_versions
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can view model_versions" ON model_versions;
CREATE POLICY "Authenticated users can view model_versions" ON model_versions
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Table 7: training_triggers
ALTER TABLE training_triggers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role full access to training_triggers" ON training_triggers;
CREATE POLICY "Allow service role full access to training_triggers" ON training_triggers
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can view training_triggers" ON training_triggers;
CREATE POLICY "Authenticated users can view training_triggers" ON training_triggers
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- =====================================================
-- PART 3: Fix Functions - Add search_path
-- Add search_path = public to all 8 functions to prevent SQL injection
-- =====================================================

-- Function 1: update_updated_at_column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Function 2: update_training_metrics
CREATE OR REPLACE FUNCTION update_training_metrics()
RETURNS TRIGGER AS $$
DECLARE
    doc_type TEXT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        doc_type := OLD.document_type;
    ELSE
        doc_type := NEW.document_type;
    END IF;

    INSERT INTO training_metrics (document_type)
    VALUES (doc_type)
    ON CONFLICT (document_type) DO NOTHING;

    UPDATE training_metrics
    SET
        total_documents = (SELECT COUNT(*) FROM training_documents WHERE document_type = doc_type),
        pending_documents = (SELECT COUNT(*) FROM training_documents WHERE document_type = doc_type AND processing_status = 'pending'),
        processing_documents = (SELECT COUNT(*) FROM training_documents WHERE document_type = doc_type AND processing_status = 'processing'),
        completed_documents = (SELECT COUNT(*) FROM training_documents WHERE document_type = doc_type AND processing_status = 'completed'),
        failed_documents = (SELECT COUNT(*) FROM training_documents WHERE document_type = doc_type AND processing_status = 'failed'),
        unverified_documents = (SELECT COUNT(*) FROM training_documents WHERE document_type = doc_type AND verification_status = 'unverified'),
        verified_documents = (SELECT COUNT(*) FROM training_documents WHERE document_type = doc_type AND verification_status = 'verified'),
        rejected_documents = (SELECT COUNT(*) FROM training_documents WHERE document_type = doc_type AND verification_status = 'rejected'),
        train_set_size = (SELECT COUNT(*) FROM training_documents WHERE document_type = doc_type AND dataset_split = 'train' AND include_in_training = true),
        validation_set_size = (SELECT COUNT(*) FROM training_documents WHERE document_type = doc_type AND dataset_split = 'validation' AND include_in_training = true),
        test_set_size = (SELECT COUNT(*) FROM training_documents WHERE document_type = doc_type AND dataset_split = 'test' AND include_in_training = true),
        average_confidence = (SELECT AVG(extraction_confidence) FROM training_documents WHERE document_type = doc_type AND extraction_confidence IS NOT NULL),
        average_quality_score = (SELECT AVG(quality_score) FROM training_documents WHERE document_type = doc_type AND quality_score IS NOT NULL),
        minimum_examples_met = (SELECT COUNT(*) >= 50 FROM training_documents WHERE document_type = doc_type AND is_verified = true AND include_in_training = true),
        ready_for_training = (SELECT COUNT(*) >= 50 FROM training_documents WHERE document_type = doc_type AND is_verified = true AND include_in_training = true),
        last_updated = NOW()
    WHERE training_metrics.document_type = doc_type;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Function 3: set_model_version_number
CREATE OR REPLACE FUNCTION set_model_version_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.version_number IS NULL THEN
        SELECT COALESCE(MAX(version_number), 0) + 1
        INTO NEW.version_number
        FROM model_versions
        WHERE document_type = NEW.document_type;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Function 4: ensure_single_active_model
CREATE OR REPLACE FUNCTION ensure_single_active_model()
RETURNS TRIGGER AS $$
BEGIN
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
$$ LANGUAGE plpgsql SET search_path = public;

-- Function 5: get_user_credits (SECURITY DEFINER for RLS bypass)
CREATE OR REPLACE FUNCTION get_user_credits(p_user_id UUID)
RETURNS INT AS $$
DECLARE
  credit_balance INT;
BEGIN
  SELECT credits INTO credit_balance
  FROM users
  WHERE id = p_user_id AND is_active = true;
  RETURN COALESCE(credit_balance, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function 6: deduct_user_credits (SECURITY DEFINER for RLS bypass)
CREATE OR REPLACE FUNCTION deduct_user_credits(p_user_id UUID, p_page_count INT)
RETURNS BOOLEAN AS $$
DECLARE
  current_credits INT;
BEGIN
  SELECT credits INTO current_credits
  FROM users
  WHERE id = p_user_id AND is_active = true;

  IF current_credits >= p_page_count THEN
    UPDATE users
    SET
      credits = credits - p_page_count,
      monthly_usage = monthly_usage + p_page_count,
      lifetime_usage = lifetime_usage + p_page_count,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = p_user_id;

    INSERT INTO credit_transactions (user_id, amount, transaction_type, description)
    VALUES (p_user_id, -p_page_count, 'deduction', 'Document processing');

    RETURN true;
  ELSE
    RETURN false;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in deduct_user_credits: %', SQLERRM;
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function 7: add_user_credits (SECURITY DEFINER for RLS bypass)
CREATE OR REPLACE FUNCTION add_user_credits(
  p_user_id UUID,
  p_amount INT,
  p_transaction_type VARCHAR,
  p_admin_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE users
  SET
    credits = credits + p_amount,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_user_id;

  INSERT INTO credit_transactions (user_id, amount, transaction_type, admin_id, description)
  VALUES (p_user_id, p_amount, p_transaction_type, p_admin_id, p_description);

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in add_user_credits: %', SQLERRM;
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function 8: reset_monthly_usage
CREATE OR REPLACE FUNCTION reset_monthly_usage()
RETURNS INT AS $$
DECLARE
  reset_count INT;
BEGIN
  WITH updated AS (
    UPDATE users
    SET monthly_usage = 0
    WHERE billing_cycle_end <= CURRENT_DATE
      AND subscription_status = 'active'
      AND subscription_type != 'free'
    RETURNING id
  )
  SELECT COUNT(*) INTO reset_count FROM updated;
  RETURN reset_count;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =====================================================
-- Migration Complete
-- =====================================================
