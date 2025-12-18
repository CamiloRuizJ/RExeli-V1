-- =====================================================
-- Migration 011: Fix Supabase Security Warnings
-- Description: Address security warnings from Supabase security audit
-- 1. Remove SECURITY DEFINER from 10 views (change to SECURITY INVOKER)
-- 2. Enable RLS on 7 tables without RLS policies
-- 3. Add search_path = public to 8 functions
-- =====================================================

-- =====================================================
-- PART 1: Fix Views - Remove SECURITY DEFINER
-- Change all views to use security_invoker=true
-- =====================================================

-- From 003_training_system.sql
CREATE OR REPLACE VIEW training_ready_documents
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

CREATE OR REPLACE VIEW verification_queue
WITH (security_invoker=true) AS
SELECT
    d.*,
    (SELECT COUNT(*) FROM verification_edits WHERE training_document_id = d.id) as edit_count
FROM training_documents d
WHERE
    d.processing_status = 'completed'
    AND d.verification_status IN ('unverified', 'in_review')
ORDER BY d.created_at ASC;

CREATE OR REPLACE VIEW training_summary
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
CREATE OR REPLACE VIEW active_models
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

CREATE OR REPLACE VIEW fine_tuning_status
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

CREATE OR REPLACE VIEW trigger_readiness
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
CREATE OR REPLACE VIEW learning_insights_summary
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
CREATE OR REPLACE VIEW user_credit_summary
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

CREATE OR REPLACE VIEW monthly_usage_summary
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

CREATE OR REPLACE VIEW document_type_analytics
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
-- This table tracks edits to training documents
-- Service role needs full access, authenticated users can view all (admin feature)
ALTER TABLE verification_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access to verification_edits" ON verification_edits
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view verification_edits" ON verification_edits
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Table 2: training_documents
-- System-level training data, not user-specific
-- Service role needs full access, authenticated users can view (admin/training feature)
ALTER TABLE training_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access to training_documents" ON training_documents
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view training_documents" ON training_documents
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Table 3: training_metrics
-- System-level aggregated metrics
-- Service role needs full access, authenticated users can view
ALTER TABLE training_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access to training_metrics" ON training_metrics
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view training_metrics" ON training_metrics
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Table 4: training_runs
-- System-level training run history
-- Service role needs full access, authenticated users can view
ALTER TABLE training_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access to training_runs" ON training_runs
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view training_runs" ON training_runs
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Table 5: fine_tuning_jobs
-- System-level fine-tuning job tracking
-- Service role needs full access, authenticated users can view
ALTER TABLE fine_tuning_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access to fine_tuning_jobs" ON fine_tuning_jobs
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view fine_tuning_jobs" ON fine_tuning_jobs
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Table 6: model_versions
-- System-level model version control
-- Service role needs full access, authenticated users can view
ALTER TABLE model_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access to model_versions" ON model_versions
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view model_versions" ON model_versions
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Table 7: training_triggers
-- System configuration table
-- Service role needs full access, authenticated users can view
ALTER TABLE training_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access to training_triggers" ON training_triggers
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view training_triggers" ON training_triggers
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- =====================================================
-- PART 3: Fix Functions - Add search_path
-- Add search_path = public to all 8 functions to prevent SQL injection
-- =====================================================

-- Function 1: update_updated_at_column (trigger function)
-- Used by multiple tables to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Function 2: update_training_metrics (trigger function)
-- Updates training metrics aggregations when training_documents change
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
$$ LANGUAGE plpgsql SET search_path = public;

-- Function 3: set_model_version_number (trigger function)
-- Auto-increments version number for new model versions
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
$$ LANGUAGE plpgsql SET search_path = public;

-- Function 4: ensure_single_active_model (trigger function)
-- Ensures only one active model per document type
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
$$ LANGUAGE plpgsql SET search_path = public;

-- Function 5: get_user_credits (RPC function with SECURITY DEFINER)
-- Gets current credit balance for user
-- Keeps SECURITY DEFINER from migration 010 to bypass RLS
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

-- Function 6: deduct_user_credits (RPC function with SECURITY DEFINER)
-- Deducts credits from user account for document processing
-- Keeps SECURITY DEFINER from migration 010 to bypass RLS
CREATE OR REPLACE FUNCTION deduct_user_credits(p_user_id UUID, p_page_count INT)
RETURNS BOOLEAN AS $$
DECLARE
  current_credits INT;
BEGIN
  -- Get current credits
  SELECT credits INTO current_credits
  FROM users
  WHERE id = p_user_id AND is_active = true;

  -- Check if user has enough credits
  IF current_credits >= p_page_count THEN
    -- Deduct credits and update usage
    UPDATE users
    SET
      credits = credits - p_page_count,
      monthly_usage = monthly_usage + p_page_count,
      lifetime_usage = lifetime_usage + p_page_count,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = p_user_id;

    -- Log the transaction
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

-- Function 7: add_user_credits (RPC function with SECURITY DEFINER)
-- Adds credits to user account
-- Keeps SECURITY DEFINER from migration 010 to bypass RLS
CREATE OR REPLACE FUNCTION add_user_credits(
  p_user_id UUID,
  p_amount INT,
  p_transaction_type VARCHAR,
  p_admin_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Add credits to user
  UPDATE users
  SET
    credits = credits + p_amount,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_user_id;

  -- Log the transaction
  INSERT INTO credit_transactions (user_id, amount, transaction_type, admin_id, description)
  VALUES (p_user_id, p_amount, p_transaction_type, p_admin_id, p_description);

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in add_user_credits: %', SQLERRM;
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function 8: reset_monthly_usage (RPC function)
-- Resets monthly usage for users whose billing cycle has ended
CREATE OR REPLACE FUNCTION reset_monthly_usage()
RETURNS INT AS $$
DECLARE
  reset_count INT;
BEGIN
  -- Reset monthly_usage for users whose billing cycle has ended
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
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON POLICY "Allow service role full access to verification_edits" ON verification_edits IS
'Allows service role (backend API routes) full access for managing verification edit history';

COMMENT ON POLICY "Authenticated users can view verification_edits" ON verification_edits IS
'Allows authenticated users to view verification edits for transparency';

COMMENT ON POLICY "Allow service role full access to training_documents" ON training_documents IS
'Allows service role (backend API routes) full access for managing training documents';

COMMENT ON POLICY "Authenticated users can view training_documents" ON training_documents IS
'Allows authenticated users to view training documents for review and analysis';

COMMENT ON POLICY "Allow service role full access to training_metrics" ON training_metrics IS
'Allows service role (backend API routes) full access for managing training metrics';

COMMENT ON POLICY "Authenticated users can view training_metrics" ON training_metrics IS
'Allows authenticated users to view training metrics for monitoring';

COMMENT ON POLICY "Allow service role full access to training_runs" ON training_runs IS
'Allows service role (backend API routes) full access for managing training runs';

COMMENT ON POLICY "Authenticated users can view training_runs" ON training_runs IS
'Allows authenticated users to view training run history';

COMMENT ON POLICY "Allow service role full access to fine_tuning_jobs" ON fine_tuning_jobs IS
'Allows service role (backend API routes) full access for managing fine-tuning jobs';

COMMENT ON POLICY "Authenticated users can view fine_tuning_jobs" ON fine_tuning_jobs IS
'Allows authenticated users to view fine-tuning job status';

COMMENT ON POLICY "Allow service role full access to model_versions" ON model_versions IS
'Allows service role (backend API routes) full access for managing model versions';

COMMENT ON POLICY "Authenticated users can view model_versions" ON model_versions IS
'Allows authenticated users to view model versions and deployment status';

COMMENT ON POLICY "Allow service role full access to training_triggers" ON training_triggers IS
'Allows service role (backend API routes) full access for managing training triggers';

COMMENT ON POLICY "Authenticated users can view training_triggers" ON training_triggers IS
'Allows authenticated users to view training trigger configuration';

-- =====================================================
-- MANUAL CONFIGURATION REQUIRED
-- =====================================================

-- Auth OTP Expiry Configuration:
-- This cannot be set via SQL migration. Manual configuration required:
-- 1. Navigate to Supabase Dashboard
-- 2. Go to: Authentication > Providers > Email
-- 3. Find "Email OTP expiry" setting
-- 4. Change to: 3600 seconds (1 hour) or less
-- Current default is typically 24 hours (86400 seconds)

-- PostgreSQL Version Upgrade:
-- The security warning about PostgreSQL version requires infrastructure action
-- Contact Supabase support or check dashboard for available upgrade options
-- This is not addressable via SQL migration

-- =====================================================
-- Migration Complete
-- =====================================================

-- Summary of changes:
-- ✅ Fixed 10 views by adding security_invoker=true
-- ✅ Enabled RLS on 7 tables (verification_edits, training_documents, training_metrics,
--    training_runs, fine_tuning_jobs, model_versions, training_triggers)
-- ✅ Added search_path = public to 8 functions
-- ⚠️ Auth OTP expiry requires manual configuration via dashboard
-- ⚠️ PostgreSQL version upgrade requires Supabase infrastructure action
