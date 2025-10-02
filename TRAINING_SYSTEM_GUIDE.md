# AI Training Data Collection System - User Guide

## Overview

The Training Data Management System is a complete, production-ready interface for collecting, verifying, and exporting training data for OpenAI fine-tuning. This system enables you to systematically upload documents, verify AI extractions, and export high-quality training datasets.

## Getting Started

### Access the Training Dashboard

Navigate to: `http://localhost:3000/admin/training`

## System Architecture

### Pages

1. **Main Dashboard** (`/admin/training`)
   - Upload documents in batches (up to 50 at once)
   - View all documents organized by type
   - Monitor processing and verification status
   - Quick access to pending verifications

2. **Document Verification** (`/admin/training/verify/[id]`)
   - Side-by-side document and data view
   - Edit extracted data with live JSON editor
   - Rate extraction quality (1-5 stars)
   - Add verification notes
   - Navigate between documents
   - Keyboard shortcuts (Ctrl+S to save, Ctrl+Enter to verify)

3. **Metrics Dashboard** (`/admin/training/metrics`)
   - View progress by document type
   - Monitor verification completion rates
   - Export training data when ready
   - Track dataset splits (train/validation)

## Workflow

### Step 1: Upload Documents

1. Go to the main dashboard
2. Select a document type from the tabs
3. Choose the document type from the dropdown
4. Drag & drop PDFs or images (or click to browse)
5. Click "Upload X Files" to start

The system will:
- Upload all files to Supabase storage
- Process each document with GPT-4o
- Extract structured data automatically
- Mark documents as ready for verification

### Step 2: Verify Extractions

1. Click "View" on any processed document
2. Review the document preview on the left
3. Edit the extracted data on the right
4. Rate the extraction quality (1-5 stars)
5. Add notes if needed
6. Choose an action:
   - **Save**: Save edits without verifying (work in progress)
   - **Verify**: Mark as verified and ready for training
   - **Reject**: Mark as rejected (won't be included in training)

**Tips:**
- Use Ctrl+S to quickly save changes
- Use Ctrl+Enter to verify and move to the next document
- Navigate with Previous/Next buttons
- Edit JSON directly for precise control

### Step 3: Monitor Progress

1. Go to the Metrics Dashboard
2. Review progress by document type
3. Check if types meet minimum requirements (50 verified examples)
4. View train/validation split counts

### Step 4: Export Training Data

When a document type is ready (50+ verified examples):

1. Go to Metrics Dashboard
2. Click "Export" on the ready document type
3. Two files will download:
   - Training set (80% of verified docs)
   - Validation set (20% of verified docs)
4. Files are in OpenAI JSONL format, ready for fine-tuning

## Document Types

The system supports 8 document types:

1. **Rent Roll** - Tenant and lease information
2. **Sales Comparables** - Comparable sales data
3. **Lease Comparables** - Comparable lease data
4. **Offering Memo** - Investment offering memorandums
5. **Lease Agreement** - Lease contracts
6. **Operating Budget** - Property operating budgets
7. **Broker Listing** - Broker listing agreements
8. **Financial Statements** - Property financial statements

## Best Practices

### Quality Control

1. **Verify Every Extraction**
   - Don't assume AI extractions are perfect
   - Check all numerical values
   - Verify dates and addresses
   - Ensure completeness

2. **Rate Quality Accurately**
   - 5 stars: Perfect extraction, no edits needed
   - 4 stars: Minor edits required
   - 3 stars: Moderate corrections needed
   - 2 stars: Significant corrections required
   - 1 star: Major issues, extensive editing

3. **Add Helpful Notes**
   - Document issues found
   - Note missing information
   - Explain complex edits
   - Flag unusual cases

### Efficiency Tips

1. **Batch Upload**
   - Upload 50 documents at once
   - Wait for processing to complete
   - Verify in sequence

2. **Use Keyboard Shortcuts**
   - Ctrl+S: Save changes
   - Ctrl+Enter: Verify and next
   - Reduces mouse clicks significantly

3. **Work by Document Type**
   - Complete one type at a time
   - Reduces context switching
   - Easier to spot patterns

## Data Requirements

### Minimum Requirements for Training

- **50+ verified documents** per document type
- **Quality score average** > 0.7 (3.5+ stars)
- **80/20 train/validation split** (automatic)

### Optimal Dataset

- **100+ verified documents** per type
- **Diverse examples** (different formats, layouts)
- **High quality ratings** (4+ stars average)
- **Thorough verification notes**

## Technical Details

### API Endpoints

- `POST /api/training/batch-upload` - Upload multiple files
- `POST /api/training/process-batch` - Process uploaded files
- `GET /api/training/documents` - Query documents with filters
- `GET /api/training/document/[id]` - Get single document
- `PATCH /api/training/verify/[id]` - Verify document
- `PATCH /api/training/reject/[id]` - Reject document
- `GET /api/training/metrics` - Get training metrics
- `POST /api/training/export` - Export training data

### Components

Located in `src/components/training/`:

- `BatchUpload.tsx` - Multi-file upload with progress
- `DocumentList.tsx` - Filterable document table
- `VerificationEditor.tsx` - Document verification interface
- `DocumentPreview.tsx` - PDF/Image viewer
- `MetricsDashboard.tsx` - Progress and export interface
- `QualityRating.tsx` - Star rating component
- `ProgressBar.tsx` - Progress visualization

### Data Flow

```
Upload → Storage → Processing → Extraction → Verification → Export
  ↓         ↓          ↓            ↓             ↓            ↓
Files   Supabase   GPT-4o      Structured    Manual      JSONL
                                  JSON        Review      Files
```

## Troubleshooting

### Upload Issues

**Problem**: Files fail to upload
- Check file format (PDF, PNG, JPG only)
- Verify file size (< 10MB recommended)
- Ensure stable internet connection
- Check browser console for errors

**Problem**: Processing takes too long
- Large documents may take 30-60 seconds
- Complex layouts take longer
- Wait for completion before refreshing

### Verification Issues

**Problem**: Can't edit extracted data
- Ensure JSON is valid
- Check for syntax errors
- Copy to external editor if needed

**Problem**: Changes not saving
- Check network connection
- Verify you're logged in
- Check browser console

### Export Issues

**Problem**: Export button disabled
- Need 50+ verified documents
- Check verification status
- Review metrics dashboard

**Problem**: Export files not downloading
- Check browser download settings
- Allow pop-ups for the site
- Check download folder

## Support

For issues or questions:
1. Check browser console for errors
2. Verify API endpoints are accessible
3. Check Supabase connection
4. Review application logs

## Next Steps

After collecting training data:

1. Upload JSONL files to OpenAI
2. Create fine-tuning job
3. Monitor training progress
4. Test fine-tuned model
5. Deploy to production
6. Continue collecting data for improvements

## Performance Tips

- Use Chrome or Edge for best performance
- Close unused browser tabs
- Process documents in smaller batches
- Clear browser cache if slow
- Use high-speed internet connection

---

**Ready to start?** Head to `/admin/training` and upload your first batch of documents!
