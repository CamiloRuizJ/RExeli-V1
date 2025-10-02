# Quick Start Guide - AI Training System

## TL;DR - Get Started in 5 Minutes

### 1. Run Database Migration
In Supabase Dashboard (SQL Editor):
```sql
-- Copy and paste entire contents of:
-- supabase/migrations/003_training_system.sql
```

### 2. Create Storage Buckets
In Supabase Dashboard (Storage):
- Create bucket: `training-documents` (50MB max, private)
- Create bucket: `training-exports` (100MB max, private)

### 3. Start Server
```bash
npm run dev
```

### 4. Test Upload (using curl or Postman)
```bash
curl -X POST http://localhost:3000/api/training/batch-upload \
  -F "documentType=rent_roll" \
  -F "files=@document1.pdf" \
  -F "files=@document2.pdf"
```

## Complete Workflow - Training Data Collection

### Step 1: Batch Upload (50 documents)
```bash
POST /api/training/batch-upload
Content-Type: multipart/form-data

Body:
- files: File[] (up to 50 PDFs)
- documentType: "rent_roll" | "operating_budget" | ...
- createdBy: "your@email.com" (optional)

Returns: { documentIds: ["uuid1", "uuid2", ...] }
```

### Step 2: Batch Process
```bash
POST /api/training/process-batch
Content-Type: application/json

Body:
{
  "documentIds": ["uuid1", "uuid2", "uuid3", ...]
}

Returns: { processed: 48, failed: 2, results: [...] }
```

### Step 3: Query Unverified Documents
```bash
GET /api/training/documents?document_type=rent_roll&verification_status=unverified&limit=50

Returns: { documents: [...], total: 50 }
```

### Step 4: Verify Each Document
```bash
PATCH /api/training/verify/{documentId}
Content-Type: application/json

Body:
{
  "verified_extraction": { /* corrected extraction data */ },
  "quality_score": 0.95,
  "verification_notes": "Fixed property address",
  "verified_by": "analyst@company.com"
}

Returns: { success: true, document: {...} }
```

### Step 5: Check Metrics
```bash
GET /api/training/metrics

Returns:
{
  "metrics": [
    {
      "document_type": "rent_roll",
      "verified_documents": 48,
      "ready_for_training": true
    }
  ]
}
```

### Step 6: Auto-Split Dataset
```bash
POST /api/training/auto-split
Content-Type: application/json

Body:
{
  "document_type": "rent_roll",
  "train_percentage": 80
}

Returns: { train_count: 40, validation_count: 10 }
```

### Step 7: Export to OpenAI Format
```bash
POST /api/training/export
Content-Type: application/json

Body:
{
  "document_type": "rent_roll"
}

Returns:
{
  "train_file_url": "https://...train.jsonl",
  "validation_file_url": "https://...validation.jsonl",
  "train_examples": 40,
  "validation_examples": 10
}
```

### Step 8: Download and Fine-Tune
1. Download JSONL files from URLs
2. Upload to OpenAI
3. Create fine-tuning job

```python
from openai import OpenAI
client = OpenAI()

# Upload files
train_file = client.files.create(
  file=open("rent_roll_train.jsonl", "rb"),
  purpose="fine-tune"
)

validation_file = client.files.create(
  file=open("rent_roll_validation.jsonl", "rb"),
  purpose="fine-tune"
)

# Create job
job = client.fine_tuning.jobs.create(
  training_file=train_file.id,
  validation_file=validation_file.id,
  model="gpt-4o-mini-2024-07-18",
  suffix="rent-roll-v1"
)
```

## Document Types Supported

1. `rent_roll` - Tenant rent rolls
2. `operating_budget` - Property budgets
3. `broker_sales_comparables` - Sales comparables
4. `broker_lease_comparables` - Lease comparables
5. `broker_listing` - Listing agreements
6. `offering_memo` - Offering memorandums
7. `lease_agreement` - Lease contracts
8. `financial_statements` - Financial statements

## Environment Variables Required

In `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Important!
ENCRYPTED_OPENAI_API_KEY=your-encrypted-openai-key
```

## Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/training/batch-upload` | Upload multiple files |
| POST | `/api/training/process-batch` | Process through AI |
| GET | `/api/training/documents` | Query documents |
| GET | `/api/training/document/{id}` | Get single document |
| PATCH | `/api/training/verify/{id}` | Verify extraction |
| PATCH | `/api/training/reject/{id}` | Reject document |
| GET | `/api/training/metrics` | Get training metrics |
| POST | `/api/training/export` | Export JSONL |
| POST | `/api/training/auto-split` | Auto train/val split |

## Quality Standards

- Minimum 50 verified documents per type
- Quality score > 0.90 recommended
- 80/20 train/validation split
- Reject illegible or incomplete documents
- Include all visible data in extractions

## Troubleshooting

**Database tables not found?**
→ Run migration in Supabase Dashboard

**Storage upload fails?**
→ Create training-documents bucket

**Processing fails?**
→ Check ENCRYPTED_OPENAI_API_KEY is set

**Export fails "insufficient data"?**
→ Need 50+ verified documents

**JSONL format invalid?**
→ System validates automatically, check verification data

## Files to Review

1. `TRAINING_SYSTEM_README.md` - Full documentation
2. `TRAINING_SYSTEM_IMPLEMENTATION_SUMMARY.md` - Technical details
3. `supabase/migrations/003_training_system.sql` - Database schema
4. `src/lib/training-utils.ts` - Helper functions
5. `src/lib/openai-export.ts` - Export logic

## Success Checklist

- [ ] Database migration executed
- [ ] Storage buckets created
- [ ] Environment variables set
- [ ] Can upload 50 documents
- [ ] Processing completes
- [ ] Verification works
- [ ] Metrics show progress
- [ ] Export generates JSONL
- [ ] Files download successfully

## Next Steps

1. Read `TRAINING_SYSTEM_README.md` for details
2. Run `npm run verify-training` (after setting env vars)
3. Start uploading training documents
4. Verify extractions systematically
5. Export when ready (50+ verified)
6. Create OpenAI fine-tuning jobs

## Support

All components are production-ready with:
- Comprehensive error handling
- Detailed logging
- Type safety
- Validation at every step
- Complete audit trails

For issues, check the logs and error messages - they're detailed and actionable.
