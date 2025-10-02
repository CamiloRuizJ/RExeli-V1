# AI Training Data Collection Backend

A complete, production-ready backend system for collecting, verifying, and exporting AI training data for OpenAI GPT-4o-mini fine-tuning. Built following OpenAI's best practices for fine-tuning with vision models.

## Overview

This system enables you to:
- Upload 50+ documents per document type (8 types = 400 total documents)
- Process documents through AI extraction pipeline
- Manually verify and correct extractions for training quality
- Automatically split data into train/validation sets (80/20)
- Export to OpenAI's JSONL format for fine-tuning
- Track quality metrics and training readiness

## Architecture

### Database Schema

**4 Main Tables:**
- `training_documents` - Main document storage with extraction data
- `training_metrics` - Aggregated metrics per document type
- `training_runs` - History of training exports and fine-tuning jobs
- `verification_edits` - Audit trail of verification changes

**Key Features:**
- Automatic metric updates via database triggers
- Quality scoring (0-1 scale)
- Train/validation/test split management
- Comprehensive audit trail
- Production-ready indexing for performance

### Storage Structure

**Supabase Storage Buckets:**
- `training-documents/` - Raw uploaded documents
  - Path: `{document_type}/{uuid}_{filename}`
- `training-exports/` - Generated JSONL files
  - Path: `{document_type}/{type}_{split}_{timestamp}.jsonl`

### API Endpoints

#### 1. Batch Upload
```bash
POST /api/training/batch-upload
Content-Type: multipart/form-data

# Upload multiple documents
files: File[]
documentType: DocumentType
createdBy: string (optional)

Response:
{
  "success": true,
  "uploaded": 50,
  "failed": 0,
  "documentIds": ["uuid1", "uuid2", ...],
  "errors": []
}
```

#### 2. Batch Processing
```bash
POST /api/training/process-batch
Content-Type: application/json

# Process documents through extraction pipeline
{
  "documentIds": ["uuid1", "uuid2", ...]
}

Response:
{
  "success": true,
  "processed": 48,
  "failed": 2,
  "results": [
    {"documentId": "uuid1", "success": true},
    {"documentId": "uuid2", "success": false, "error": "..."}
  ]
}
```

#### 3. Query Documents
```bash
GET /api/training/documents?document_type=rent_roll&verification_status=unverified&limit=50

Query Parameters:
- document_type: DocumentType
- processing_status: pending | processing | completed | failed
- verification_status: unverified | in_review | verified | rejected
- dataset_split: train | validation | test
- is_verified: boolean
- include_in_training: boolean
- limit: number (default 50)
- offset: number (default 0)

Response:
{
  "success": true,
  "documents": [...],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

#### 4. Get Single Document
```bash
GET /api/training/document/{id}

Response:
{
  "success": true,
  "document": {...},
  "editHistory": [...],
  "editCount": 3
}
```

#### 5. Verify Document
```bash
PATCH /api/training/verify/{id}
Content-Type: application/json

# Verify extraction with corrections
{
  "verified_extraction": {...}, // Corrected extraction data
  "verification_notes": "Fixed property address, corrected tenant count",
  "quality_score": 0.95, // 0-1 scale
  "verified_by": "user@example.com"
}

Response:
{
  "success": true,
  "document": {...},
  "message": "Document verified and ready for training"
}
```

#### 6. Reject Document
```bash
PATCH /api/training/reject/{id}
Content-Type: application/json

# Reject document (exclude from training)
{
  "rejection_reason": "Document quality too low, illegible text",
  "verified_by": "user@example.com"
}

Response:
{
  "success": true,
  "document": {...},
  "message": "Document excluded from training"
}
```

#### 7. Get Training Metrics
```bash
GET /api/training/metrics

Response:
{
  "success": true,
  "metrics": [
    {
      "document_type": "rent_roll",
      "total_documents": 50,
      "verified_documents": 48,
      "train_set_size": 38,
      "validation_set_size": 10,
      "average_quality_score": 0.92,
      "ready_for_training": true,
      "minimum_examples_met": true
    },
    ...
  ],
  "summary": {
    "total_documents": 400,
    "total_verified": 385,
    "types_ready_for_training": 7
  }
}
```

#### 8. Export Training Data
```bash
POST /api/training/export
Content-Type: application/json

# Export to OpenAI JSONL format
{
  "document_type": "rent_roll"
}

Response:
{
  "success": true,
  "train_file_url": "https://..../rent_roll_train_1234567890.jsonl",
  "validation_file_url": "https://..../rent_roll_validation_1234567890.jsonl",
  "train_examples": 40,
  "validation_examples": 10,
  "message": "Successfully exported 50 training examples"
}
```

#### 9. Auto-Split Dataset
```bash
POST /api/training/auto-split
Content-Type: application/json

# Automatically assign train/validation split
{
  "document_type": "rent_roll", // optional, if omitted splits all types
  "train_percentage": 80 // optional, default 80
}

Response:
{
  "success": true,
  "splits": [
    {
      "document_type": "rent_roll",
      "train_count": 40,
      "validation_count": 10
    }
  ],
  "message": "Dataset split assigned: 80% train, 20% validation"
}
```

## Document Types Supported

1. **rent_roll** - Tenant rent roll documents
2. **operating_budget** - Property operating budgets
3. **broker_sales_comparables** - Sales comparable data
4. **broker_lease_comparables** - Lease comparable data
5. **broker_listing** - Broker listing agreements
6. **offering_memo** - Property offering memorandums
7. **lease_agreement** - Lease contracts
8. **financial_statements** - Financial statements

## OpenAI Training Format

The system exports data in OpenAI's required JSONL format:

```jsonl
{"messages": [
  {"role": "system", "content": "You are an expert commercial real estate analyst..."},
  {"role": "user", "content": [
    {"type": "text", "text": "Extract comprehensive data from this rent roll document..."},
    {"type": "image_url", "image_url": {"url": "data:image/png;base64,iVBORw0KG...", "detail": "high"}}
  ]},
  {"role": "assistant", "content": "{\"documentType\":\"rent_roll\",\"metadata\":{...},\"data\":{...}}"}
]}
```

Each line is a complete training example with:
- **System prompt**: Expert-level context for the document type
- **User content**: Instruction + base64-encoded document image (high detail)
- **Assistant response**: Verified extraction in JSON format

## Setup Instructions

### 1. Run Database Migration

Execute the migration to create tables:

```bash
# Using Supabase CLI (recommended)
supabase db push

# Or manually execute the SQL file in Supabase Dashboard:
# Dashboard > SQL Editor > New Query
# Copy and paste contents of: supabase/migrations/003_training_system.sql
```

### 2. Create Storage Buckets

In Supabase Dashboard:

1. **Create `training-documents` bucket:**
   - Storage > New Bucket
   - Name: `training-documents`
   - Public: No (requires authentication)
   - File size limit: 50MB
   - Allowed MIME types: `application/pdf`, `image/png`, `image/jpeg`

2. **Create `training-exports` bucket:**
   - Storage > New Bucket
   - Name: `training-exports`
   - Public: No (requires authentication)
   - File size limit: 100MB
   - Allowed MIME types: `application/jsonl`, `text/plain`

### 3. Environment Variables

Ensure these are set in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ENCRYPTED_OPENAI_API_KEY=your_encrypted_key
```

### 4. Deploy to Production

```bash
# Build and deploy
npm run build
vercel --prod

# Set environment variables in Vercel dashboard
```

## Workflow Example

### Complete Training Data Collection Workflow:

```bash
# 1. Upload 50 documents for rent_roll type
curl -X POST https://rexeli.com/api/training/batch-upload \
  -F "documentType=rent_roll" \
  -F "files=@document1.pdf" \
  -F "files=@document2.pdf" \
  # ... (50 files)

# 2. Process all uploaded documents
curl -X POST https://rexeli.com/api/training/process-batch \
  -H "Content-Type: application/json" \
  -d '{"documentIds": ["uuid1", "uuid2", ...]}'

# 3. Review and verify each extraction
curl -X PATCH https://rexeli.com/api/training/verify/{id} \
  -H "Content-Type: application/json" \
  -d '{
    "verified_extraction": {...},
    "quality_score": 0.95,
    "verified_by": "analyst@company.com"
  }'

# 4. Auto-assign train/validation split
curl -X POST https://rexeli.com/api/training/auto-split \
  -H "Content-Type: application/json" \
  -d '{"document_type": "rent_roll", "train_percentage": 80}'

# 5. Export to OpenAI format
curl -X POST https://rexeli.com/api/training/export \
  -H "Content-Type: application/json" \
  -d '{"document_type": "rent_roll"}'

# 6. Download JSONL files and upload to OpenAI
# Use the returned URLs to download train.jsonl and validation.jsonl
# Then create fine-tuning job via OpenAI API or dashboard
```

## OpenAI Fine-Tuning

After exporting, use the JSONL files with OpenAI:

```python
# Using OpenAI Python SDK
from openai import OpenAI
client = OpenAI()

# Upload training file
training_file = client.files.create(
  file=open("rent_roll_train.jsonl", "rb"),
  purpose="fine-tune"
)

# Upload validation file
validation_file = client.files.create(
  file=open("rent_roll_validation.jsonl", "rb"),
  purpose="fine-tune"
)

# Create fine-tuning job
job = client.fine_tuning.jobs.create(
  training_file=training_file.id,
  validation_file=validation_file.id,
  model="gpt-4o-mini-2024-07-18",
  suffix="rent-roll-v1"
)

print(f"Fine-tuning job created: {job.id}")
```

## Quality Best Practices

### Data Quality Standards
- ✅ Only verify complete, accurate extractions
- ✅ Reject low-quality or illegible documents
- ✅ Maintain consistent field formatting
- ✅ Include all visible data points
- ✅ Target quality score > 0.90

### Training Data Requirements
- ✅ Minimum 50 verified examples per document type
- ✅ 80/20 train/validation split recommended
- ✅ Diverse document samples (different properties, formats)
- ✅ Consistent extraction format across all examples
- ✅ High-quality base64 images (use 'high' detail setting)

### Verification Workflow
1. Review raw AI extraction
2. Correct any errors or missing data
3. Add verification notes explaining changes
4. Assign quality score (0.0-1.0)
5. Mark as verified
6. System automatically includes in training set

## Monitoring and Metrics

The system tracks:
- **Document counts** by status (pending, processing, completed, failed)
- **Verification progress** (unverified, verified, rejected)
- **Dataset splits** (train vs validation sizes)
- **Quality scores** (average per document type)
- **Training readiness** (50+ verified examples)
- **Edit history** (full audit trail)

## Troubleshooting

### Common Issues

**Issue: Upload fails with "File too large"**
- Solution: Files must be under 50MB. Compress PDFs or reduce image quality.

**Issue: Processing fails with "Extraction error"**
- Solution: Check document quality. Ensure text is readable and not scanned at too low resolution.

**Issue: Export fails with "Insufficient training data"**
- Solution: Need at least 50 verified documents per type. Check metrics endpoint.

**Issue: JSONL format invalid**
- Solution: System validates format automatically. Check verification data structure.

## Files Reference

### Database
- `supabase/migrations/003_training_system.sql` - Database schema

### Types
- `src/lib/types.ts` - TypeScript type definitions

### Utilities
- `src/lib/training-utils.ts` - Helper functions and database operations
- `src/lib/openai-export.ts` - JSONL export and OpenAI format handling

### API Routes
- `src/app/api/training/batch-upload/route.ts`
- `src/app/api/training/process-batch/route.ts`
- `src/app/api/training/documents/route.ts`
- `src/app/api/training/document/[id]/route.ts`
- `src/app/api/training/verify/[id]/route.ts`
- `src/app/api/training/reject/[id]/route.ts`
- `src/app/api/training/metrics/route.ts`
- `src/app/api/training/export/route.ts`
- `src/app/api/training/auto-split/route.ts`

## Success Criteria Checklist

- ✅ Upload 50 PDFs at once per document type
- ✅ Automatic processing and extraction
- ✅ Manual verification workflow
- ✅ Quality scoring system (0-1 scale)
- ✅ Train/validation split automation (80/20)
- ✅ OpenAI-compliant JSONL export
- ✅ Metrics dashboard data
- ✅ Edit history tracking
- ✅ Production-ready error handling
- ✅ Comprehensive logging
- ✅ Database triggers for automatic metric updates
- ✅ Audit trail for all changes

## Support

For issues or questions:
1. Check this README thoroughly
2. Review database migration logs
3. Check API endpoint logs
4. Verify environment variables are set correctly
5. Ensure Supabase storage buckets are created

## License

Proprietary - RExeli V1 Training System
