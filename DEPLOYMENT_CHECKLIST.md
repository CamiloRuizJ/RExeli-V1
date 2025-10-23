# Fine-Tuning Deployment Checklist

## Status: ✅ Code Committed and Pushed

**Commit**: `2fdae0b` - fix: Resolve fine-tuning OAuth errors and add comprehensive diagnostics

---

## Step-by-Step Deployment Guide

### ☑️ Step 1: Code Deployment (COMPLETED)
- ✅ All fixes committed to git
- ✅ Pushed to remote repository
- ⏳ Vercel will auto-deploy (usually takes 2-5 minutes)

**Monitor Deployment**:
- Check Vercel dashboard: https://vercel.com/camiloruizjs-projects/rexeli-v1
- Or run: `npx vercel list`

---

### ☐ Step 2: Run Database Migration

Once deployment is complete, run this SQL in **Supabase SQL Editor**:

1. **Open Supabase Dashboard**:
   - Go to: https://supabase.com/dashboard
   - Select your RExeli project
   - Click "SQL Editor" in left sidebar

2. **Run Migration**:
   ```sql
   -- Copy contents of fix-model-migration.sql
   -- Or paste this directly:

   -- 1. Update the default model for fine_tuning_jobs table
   ALTER TABLE fine_tuning_jobs
     ALTER COLUMN base_model SET DEFAULT 'gpt-4o-2024-08-06';

   -- 2. Update any existing base model entries in model_versions
   UPDATE model_versions
   SET model_id = 'gpt-4o-2024-08-06'
   WHERE model_id = 'gpt-4o-mini-2024-07-18'
     AND model_type = 'base';

   -- 3. Add comment
   COMMENT ON COLUMN fine_tuning_jobs.base_model IS
     'Base model for fine-tuning. Using gpt-4o-2024-08-06 because it supports vision/images, required for document extraction with base64 images. gpt-4o-mini does NOT support images.';

   -- 4. Verify
   SELECT 'Current default model:' as info,
          column_default
   FROM information_schema.columns
   WHERE table_name = 'fine_tuning_jobs'
     AND column_name = 'base_model';
   ```

3. **Verify Results**:
   - Should see: `'gpt-4o-2024-08-06'::text`
   - If successful: "Success. No rows returned" (normal for ALTER TABLE)

---

### ☐ Step 3: Verify Deployment

Run diagnostic script to ensure everything works:

```bash
# Full system diagnostics
node diagnose-fine-tuning-connection.js
```

**Expected Output**:
```
✅ Environment variables loaded
✅ API Key decrypted successfully
✅ API connection successful
✅ Fine-tuning permissions active
✅ OpenAI client initialized
```

---

### ☐ Step 4: Start Fine-Tuning Job

**Option A: Using the Script** (Recommended)
```bash
node start-fine-tuning-job.js broker_sales_comparables
```

**Option B: Via API Call**
```bash
curl -X POST https://rexeli-v1.vercel.app/api/training/fine-tune/start \
  -H "Content-Type: application/json" \
  -d '{
    "document_type": "broker_sales_comparables",
    "hyperparameters": {"n_epochs": 3},
    "notes": "Production fine-tuning with gpt-4o-2024-08-06"
  }'
```

**Option C: Via Training Dashboard**
1. Go to: https://rexeli-v1.vercel.app/admin/training
2. Navigate to Fine-Tuning section
3. Click "Start Fine-Tuning Job"
4. Select "Broker Sales Comparables"
5. Click "Start"

---

### ☐ Step 5: Monitor Job Progress

Once job is created, monitor with:

```bash
# Get the job ID from Step 4 output, then:
node test-fine-tuning-api.js status <job-id>

# Or list all jobs:
node test-fine-tuning-api.js list
```

**Expected Timeline**:
- File Upload: 1-2 minutes
- Validation: 2-5 minutes
- Training: 10-30 minutes (depends on dataset size)
- **Total**: ~15-40 minutes

---

### ☐ Step 6: Deploy Fine-Tuned Model (After Training Completes)

Once job status shows `succeeded`:

```bash
# Via API
curl -X POST https://rexeli-v1.vercel.app/api/training/fine-tune/deploy/<job-id> \
  -H "Content-Type: application/json" \
  -d '{
    "deployment_status": "active",
    "traffic_percentage": 100,
    "notes": "Production deployment of broker_sales_comparables v1"
  }'
```

---

## Verification Commands

### Check Deployment Status
```bash
# List recent deployments
npx vercel list

# Check production URL
curl -I https://rexeli-v1.vercel.app/api/training/fine-tune/check-status
```

### Check Database Migration
```sql
-- In Supabase SQL Editor
SELECT column_default
FROM information_schema.columns
WHERE table_name = 'fine_tuning_jobs'
  AND column_name = 'base_model';
-- Should return: 'gpt-4o-2024-08-06'::text
```

### Check API Connection
```bash
node diagnose-fine-tuning-connection.js
```

### Monitor All Jobs
```bash
node test-fine-tuning-api.js list
```

---

## Troubleshooting

### Deployment Not Showing in Vercel
- Check: https://vercel.com/camiloruizjs-projects/rexeli-v1/deployments
- Look for commit: `2fdae0b`
- Status should be "Ready" (green checkmark)

### Database Migration Fails
**Error**: "relation 'fine_tuning_jobs' does not exist"
- **Solution**: Run migration `004_fine_tuning_jobs.sql` first
- Location: `supabase/migrations/004_fine_tuning_jobs.sql`

### API Key Issues
```bash
# Run diagnostics
node diagnose-fine-tuning-connection.js

# Check .env.local
cat .env.local | grep ENCRYPTED_OPENAI_API_KEY
```

### Job Creation Fails
**Check**:
1. Deployment is complete (Vercel)
2. Database migration ran successfully
3. Have verified training documents (at least 10)
4. API key is valid

---

## Success Criteria

After completing all steps, you should have:

- ✅ Code deployed to Vercel (production)
- ✅ Database updated with gpt-4o-2024-08-06 default
- ✅ New fine-tuning job created
- ✅ Job status: `running` (not `failed`)
- ✅ Using model: `gpt-4o-2024-08-06` (not gpt-4o-mini)
- ✅ Training data: 10 verified documents
- ✅ Expected completion: 15-40 minutes

---

## Cost Estimate

### Fine-Tuning Training Cost
- Model: gpt-4o-2024-08-06
- Documents: 10 with images
- Estimated tokens: ~500K tokens
- **Training Cost**: ~$12.50 (one-time)

### Inference Cost (After Deployment)
- Fine-tuned gpt-4o: $5/1M input tokens, $15/1M output tokens
- For 1,000 documents/month: ~$30/month

**vs. gpt-4o-mini**:
- Would be $2.40/month BUT doesn't support images ❌
- **Our training data requires images**, so gpt-4o is necessary

---

## Next Steps After Successful Deployment

1. **Monitor job completion** (~15-40 minutes)
2. **Deploy fine-tuned model** when status = `succeeded`
3. **Test extraction** with new fine-tuned model
4. **Compare accuracy** vs. base model
5. **Prepare for next batch** (if needed, 20+ documents recommended)

---

## Files Reference

- **Diagnostic**: [diagnose-fine-tuning-connection.js](diagnose-fine-tuning-connection.js)
- **Monitor**: [test-fine-tuning-api.js](test-fine-tuning-api.js)
- **Start Job**: [start-fine-tuning-job.js](start-fine-tuning-job.js)
- **Migration**: [fix-model-migration.sql](fix-model-migration.sql)
- **Documentation**:
  - [FINE_TUNING_DIAGNOSIS.md](FINE_TUNING_DIAGNOSIS.md)
  - [FIX_GPT4O_MINI_IMAGE_ERROR.md](FIX_GPT4O_MINI_IMAGE_ERROR.md)
  - [QUICK_START_FINE_TUNING.md](QUICK_START_FINE_TUNING.md)

---

## Status Tracking

### Current Status
- [x] Code committed
- [x] Code pushed to GitHub
- [ ] Vercel deployment complete
- [ ] Database migration run
- [ ] Fine-tuning job started
- [ ] Job status: running
- [ ] Job completed
- [ ] Model deployed

**Last Updated**: 2025-10-22

---

## Quick Commands Summary

```bash
# 1. Check deployment
npx vercel list

# 2. Run diagnostics
node diagnose-fine-tuning-connection.js

# 3. Start fine-tuning
node start-fine-tuning-job.js broker_sales_comparables

# 4. Monitor progress
node test-fine-tuning-api.js status <job-id>

# 5. List all jobs
node test-fine-tuning-api.js list
```

---

🎯 **Ready to proceed!** Follow the checklist above step by step.
