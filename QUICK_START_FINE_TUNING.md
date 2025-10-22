# Fine-Tuning Quick Start Guide

## Summary of Issue Resolution

**Problem:** User reported "OAuth token has expired" error with job `ftjob-0VoxonQpNW0v3wBx6B8Ms0QB`

**Root Cause:** The job failed due to an OpenAI infrastructure error during moderation evaluation, NOT an authentication issue. Training completed successfully (30/30 steps, loss: 0.11), but OpenAI's safety evaluation service encountered an error.

**Status:** ✅ **API connection is working perfectly**

---

## Quick Commands

### Check System Health
```bash
node diagnose-fine-tuning-connection.js
```

### List All Jobs
```bash
node test-fine-tuning-api.js list
```

### Check Specific Job Status
```bash
node test-fine-tuning-api.js status ftjob-0VoxonQpNW0v3wBx6B8Ms0QB
```

### Verify API Connection
```bash
node test-fine-tuning-api.js verify
```

---

## Creating a New Fine-Tuning Job

### Option 1: Via Training Dashboard (Recommended)
1. Navigate to `/training/dashboard`
2. Go to Fine-Tuning section
3. Select "Broker Sales Comparables" document type
4. Click "Start Fine-Tuning Job"
5. System will use the 10 verified training documents

### Option 2: Via API (Advanced)
```typescript
import { startFineTuningJob } from '@/lib/fine-tuning';

const job = await startFineTuningJob({
  document_type: 'broker_sales_comparables',
  triggered_by: 'manual',
  hyperparameters: {
    n_epochs: 3
  },
  notes: 'Retry after moderation failure'
});

console.log('Job created:', job.id);
```

---

## What Was Fixed

### 1. Enhanced Error Handling
- Better detection of moderation failures
- Clear error messages for OAuth vs API key issues
- Retry logic for transient failures
- API key format validation

### 2. Diagnostic Tools
- **diagnose-fine-tuning-connection.js** - Full system check
- **test-fine-tuning-api.js** - Job monitoring and verification
- **handle-moderation-failure.js** - Analyze specific failures

### 3. Improved Fine-Tuning Module
File: `src/lib/fine-tuning.ts`
- Added API key validation
- Enhanced error messages
- Special handling for moderation failures
- Better authentication error detection

---

## Understanding the Failed Job

### Job: ftjob-0VoxonQpNW0v3wBx6B8Ms0QB

**What Happened:**
1. ✅ Training file uploaded successfully
2. ✅ All 30 training steps completed
3. ✅ Loss improved from 0.84 to 0.11
4. ✅ Model created: `ft:gpt-4o-2024-08-06:camilo-ruiz-projects::CPKfcrht`
5. ❌ OpenAI moderation evaluation failed (infrastructure error)

**Not Your Fault:**
- Training data is fine
- API key is valid
- Configuration is correct
- This was an OpenAI-side error

**Action Required:**
Create a new job with the same data.

---

## Monitoring Jobs

### Check Job Progress
```bash
# List all jobs with summary
node test-fine-tuning-api.js list

# Get detailed status including events
node test-fine-tuning-api.js status <job-id>
```

### Job Status Meanings
- ✓ **succeeded** - Training completed, model ready
- ⟳ **running** - Currently training
- ⟳ **validating_files** - Checking training files
- ⋯ **queued** - Waiting to start
- ✗ **failed** - Error occurred
- ⊗ **cancelled** - Manually stopped

### Typical Timeline
- **File validation:** 1-5 minutes
- **Queue time:** Variable (0-24 hours)
- **Training:** 30-90 minutes for 10 documents
- **Evaluation:** 5-10 minutes
- **Total:** 1-25 hours (mostly queue time)

---

## Troubleshooting

### "API key invalid" Error
1. Check `.env.local` has `ENCRYPTED_OPENAI_API_KEY`
2. Verify `ENCRYPTION_KEY` is correct
3. Run: `node diagnose-fine-tuning-connection.js`

### "Permission denied" Error
1. Ensure API key is a PROJECT key (starts with `sk-proj-`)
2. Verify fine-tuning is enabled for your project
3. Check billing is active: https://platform.openai.com/account/billing

### "OAuth token expired" Error
**This was a misleading error.** The actual issue was:
- Not an authentication problem
- Job failed during OpenAI moderation
- API connection is working fine

If you see this error:
1. Run diagnostics first: `node diagnose-fine-tuning-connection.js`
2. Check if it's actually a different error
3. Verify the error isn't from an old cached session

### Job Stuck in "running" State
1. Check job events: `node test-fine-tuning-api.js status <job-id>`
2. Look for infrastructure upgrade messages
3. Wait - OpenAI may be retrying automatically
4. If stuck for >48 hours, contact OpenAI support

---

## Training Data Requirements

### Minimum Requirements
- **Minimum documents:** 10 (currently: 10 ✓)
- **Format:** JSONL (JSON Lines)
- **Structure:** OpenAI chat completion format
- **Quality:** Verified and validated

### Current Status
- **Document type:** Broker Sales Comparables
- **Verified documents:** 10
- **Training/validation split:** 80/20
- **Status:** Ready for fine-tuning ✅

---

## API Key Information

### Current Configuration
- **Type:** Project API key (`sk-proj-*`)
- **Storage:** Encrypted in `.env.local`
- **Encryption:** AES-256 with CryptoJS
- **Status:** Valid and active ✅

### Security Best Practices
- ✅ Keys are encrypted at rest
- ✅ Using project keys (not service account keys)
- ✅ Keys never logged or exposed
- ✅ Environment-based configuration

### Key Rotation
To rotate your API key:
1. Generate new key at: https://platform.openai.com/api-keys
2. Encrypt it: (use encryption utility)
3. Update `ENCRYPTED_OPENAI_API_KEY` in `.env.local`
4. Test: `node test-fine-tuning-api.js verify`

---

## File Structure

### Diagnostic Scripts
```
c:\Users\cruiz\RExeli-V1\
├── diagnose-fine-tuning-connection.js   # Full diagnostic suite
├── test-fine-tuning-api.js              # Job monitoring tool
├── handle-moderation-failure.js         # Failure analysis
└── FINE_TUNING_DIAGNOSIS.md            # Complete diagnosis report
```

### Source Files
```
src/lib/
├── fine-tuning.ts           # Fine-tuning job management (UPDATED)
├── auth.ts                  # API key encryption/decryption
├── openai.ts               # OpenAI client initialization
└── openai-export.ts        # Training data export
```

---

## Next Steps

### Immediate (Now)
1. ✅ Diagnosis complete - no auth issues
2. ⏭️ Create new fine-tuning job
3. 📊 Monitor job progress

### Short-term (This Week)
1. Deploy fine-tuned model when job succeeds
2. Test model performance
3. Monitor prediction quality

### Long-term (Ongoing)
1. Add more training documents as they're verified
2. Trigger new fine-tuning jobs at regular intervals
3. Version and compare model performance
4. Monitor OpenAI service status

---

## Support & Resources

### Documentation
- **Full diagnosis:** `FINE_TUNING_DIAGNOSIS.md`
- **This guide:** `QUICK_START_FINE_TUNING.md`

### OpenAI Resources
- **API Keys:** https://platform.openai.com/api-keys
- **Fine-tuning Docs:** https://platform.openai.com/docs/guides/fine-tuning
- **Service Status:** https://status.openai.com/
- **Support:** https://help.openai.com/

### Internal Resources
- **Training Dashboard:** `/training/dashboard`
- **Fine-tuning UI:** `/training/fine-tuning`
- **Document Upload:** `/training/documents`

---

## Common Questions

### Q: Is my API key still valid?
**A:** Yes! Run `node test-fine-tuning-api.js verify` to confirm.

### Q: Why did the job fail?
**A:** OpenAI infrastructure error during moderation evaluation, not your fault.

### Q: Can I recover the failed job?
**A:** Contact OpenAI support, but creating a new job is faster.

### Q: Do I need to fix my training data?
**A:** No, your training data is fine. The error was in OpenAI's evaluation service.

### Q: How long until I can try again?
**A:** You can create a new job immediately. The system is ready.

### Q: What's the cost?
**A:** Check OpenAI pricing: https://openai.com/api/pricing/
- Training: Based on tokens processed
- Usage: Based on API calls to fine-tuned model

---

## Quick Win

**To verify everything is working right now:**

```bash
# 1. Check system health
node test-fine-tuning-api.js verify

# Expected output:
# ✓ Connected successfully (96 models available)
# ✓ Fine-tuning API accessible
# ✓ All API tests passed!

# 2. Ready to create new job!
```

Your system is **ready and working**. The previous job failure was an OpenAI infrastructure issue, not a problem with your setup.

---

**Last Updated:** October 22, 2025
**Status:** Ready for New Fine-Tuning Jobs ✅
