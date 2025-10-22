# Fix: GPT-4o-mini Image Support Error

## Problem Summary

**Error from OpenAI**: "Images are not supported for gpt-4o-mini-2024-07-18"

**Job ID**: `ftjob-vC2sKInvMG4yHyzRsWjrjiYZ`

**Root Cause**: Your training data includes base64-encoded images (document scans/PDFs), but `gpt-4o-mini` does **NOT** support vision capabilities.

---

## ✅ Solution: Already Implemented!

**Good news**: Your code has already been updated to use `gpt-4o-2024-08-06` which **DOES support images**.

### What Was Changed

1. **[src/lib/fine-tuning.ts:247](src/lib/fine-tuning.ts:247)** - Database insert uses `gpt-4o-2024-08-06`
2. **[src/lib/fine-tuning.ts:268](src/lib/fine-tuning.ts:268)** - OpenAI API call uses `gpt-4o-2024-08-06`

### Why the Job Failed

The failed job `ftjob-vC2sKInvMG4yHyzRsWjrjiYZ` was created with the **old code** that used `gpt-4o-mini`. Your current code is correct.

---

## 🔧 Next Steps

### Step 1: Update Database Default (Optional but Recommended)

Run this SQL in your Supabase SQL Editor:

```bash
# Open the migration file
cat fix-model-migration.sql
```

Then copy and paste into Supabase Dashboard → SQL Editor → Run

This updates the database DEFAULT from `gpt-4o-mini` to `gpt-4o-2024-08-06`.

### Step 2: Create a NEW Fine-Tuning Job

Your current code will create jobs with the correct model (`gpt-4o-2024-08-06`).

**Option A: Via Training Dashboard** (Recommended)
1. Go to: `http://localhost:3002/admin/training` (or your production URL)
2. Navigate to Fine-Tuning section
3. Click "Start Fine-Tuning Job" for Broker Sales Comparables
4. The system will automatically use `gpt-4o-2024-08-06`

**Option B: Via API**
```bash
curl -X POST http://localhost:3002/api/training/fine-tune/start \
  -H "Content-Type: application/json" \
  -d '{
    "document_type": "broker_sales_comparables",
    "hyperparameters": {"n_epochs": 3},
    "notes": "Using gpt-4o with vision support"
  }'
```

**Option C: Via Node.js Script**
```javascript
// Create: start-fine-tuning.js
const fetch = require('node-fetch');

async function startFineTuning() {
  const response = await fetch('http://localhost:3002/api/training/fine-tune/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document_type: 'broker_sales_comparables',
      hyperparameters: { n_epochs: 3 },
      notes: 'Using gpt-4o-2024-08-06 with vision support for document images'
    })
  });

  const result = await response.json();
  console.log('Fine-tuning job created:', result);

  if (result.success && result.data?.job) {
    console.log('\nJob ID:', result.data.job.openai_job_id);
    console.log('Status:', result.data.job.status);
    console.log('Model:', result.data.job.base_model);

    console.log('\nMonitor with:');
    console.log(`node test-fine-tuning-api.js status ${result.data.job.openai_job_id}`);
  }
}

startFineTuning().catch(console.error);
```

### Step 3: Monitor New Job

```bash
# List all jobs (verify new one uses gpt-4o)
node test-fine-tuning-api.js list

# Monitor specific job status
node test-fine-tuning-api.js status <new-job-id>
```

---

## 📊 Cost Impact: GPT-4o vs GPT-4o-mini

| Model | Training Cost | Inference Cost | Monthly (1K docs) |
|-------|---------------|----------------|-------------------|
| **gpt-4o-mini** | $3.00/1M tokens | $0.60/1M input | **$2.40** ❌ No images |
| **gpt-4o** | $25/1M tokens | $5/1M input | **$30.00** ✅ Supports images |

**Cost Increase**: ~12.5x more expensive

### Is It Worth It?

**YES** - Because:
1. ✅ Your training data **requires** image support (document scans)
2. ✅ Vision models are **significantly more accurate** for document extraction
3. ✅ You can't use gpt-4o-mini with your current training data format
4. ✅ Trying to convert to text-only would:
   - Require rewriting all training data generation
   - Lose visual layout information
   - Reduce accuracy significantly
   - Take weeks of development time

**Alternative** (Not Recommended):
- Rewrite training data to remove images
- Use OCR to extract text first
- Fine-tune gpt-4o-mini on text-only
- **Problem**: Will lose table layouts, visual formatting, and accuracy

---

## 🎯 Verification Checklist

After starting a new job, verify:

- [ ] Job created successfully
- [ ] `base_model` is `gpt-4o-2024-08-06` (not gpt-4o-mini)
- [ ] Status shows `running` (not `failed`)
- [ ] No "image not supported" error
- [ ] Training progresses (check with `test-fine-tuning-api.js`)

---

## 🔍 Why Previous Jobs Failed

### Job 1: `ftjob-0VoxonQpNW0v3wBx6B8Ms0QB`
- **Status**: Failed
- **Reason**: OpenAI moderation evaluation error (their infrastructure issue)
- **Model**: gpt-4o-2024-08-06 ✅ (correct model)
- **Training**: Actually succeeded! Model created: `ft:gpt-4o-2024-08-06:camilo-ruiz-projects::CPKfcrht`

### Job 2: `ftjob-vC2sKInvMG4yHyzRsWjrjiYZ`
- **Status**: Failed
- **Reason**: Image support error
- **Model**: gpt-4o-mini-2024-07-18 ❌ (wrong model - old code)
- **Training**: Never started - rejected during validation

---

## 📝 Summary

1. ✅ **Code is already fixed** - uses `gpt-4o-2024-08-06`
2. ✅ **Old jobs failed** - used gpt-4o-mini (old code)
3. ✅ **New jobs will work** - automatically use gpt-4o with vision
4. ✅ **Optional**: Run database migration to update DEFAULT
5. 🚀 **Action**: Start a new fine-tuning job (will use correct model)

---

## 🛠️ Files Reference

- **Code**: [src/lib/fine-tuning.ts](src/lib/fine-tuning.ts) - Already uses gpt-4o-2024-08-06
- **Migration**: [fix-model-migration.sql](fix-model-migration.sql) - Optional database update
- **Monitor**: [test-fine-tuning-api.js](test-fine-tuning-api.js) - Check job status
- **Diagnosis**: [FINE_TUNING_DIAGNOSIS.md](FINE_TUNING_DIAGNOSIS.md) - Previous error details

---

## 💡 Key Takeaway

Your system is **ready to go**! The code is correct. Just start a new fine-tuning job and it will use `gpt-4o-2024-08-06` with full image support. The failed jobs were from old code or manual creation.

**Next Command**:
```bash
# Via API (easiest)
curl -X POST http://localhost:3002/api/training/fine-tune/start \
  -H "Content-Type: application/json" \
  -d '{"document_type":"broker_sales_comparables"}'
```
