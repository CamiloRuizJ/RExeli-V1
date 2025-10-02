# Training System - Quick Start Guide

## Get Started in 5 Minutes

### 1. Start the Development Server

```bash
npm run dev
```

### 2. Open Your Browser

Production: **https://rexeli.com/admin/training**

Local development: **http://localhost:3000/admin/training**

### 3. Upload Documents

1. Click on a document type tab (e.g., "Rent Roll")
2. Select the same type from the dropdown
3. Drag & drop up to 50 PDFs or images
4. Click "Upload X Files"
5. Wait for processing (30-60 seconds per document)

### 4. Verify Extractions

1. Click "View" on any completed document
2. Review the document on the left, data on the right
3. Edit any incorrect data directly in the JSON editor
4. Rate the quality (1-5 stars)
5. Add notes if needed
6. Click "Verify" to approve

**Keyboard Shortcuts:**
- `Ctrl+S` - Save changes
- `Ctrl+Enter` - Verify and move to next document

### 5. Monitor Progress

Click "View Metrics" to see:
- Total documents uploaded
- Verification progress
- Documents ready for export

### 6. Export Training Data

When you have 50+ verified documents:
1. Go to Metrics Dashboard
2. Click "Export" on the ready document type
3. Download the JSONL files
4. Upload to OpenAI for fine-tuning

## Document Type Goals

Upload 50 documents per type:
- [ ] Rent Roll (50 documents)
- [ ] Sales Comparables (50 documents)
- [ ] Lease Comparables (50 documents)
- [ ] Offering Memo (50 documents)
- [ ] Lease Agreement (50 documents)
- [ ] Operating Budget (50 documents)
- [ ] Broker Listing (50 documents)
- [ ] Financial Statements (50 documents)

**Total: 400 documents to collect**

## Tips for Efficiency

1. **Batch Upload**: Upload all 50 documents at once for each type
2. **Verify in Sequence**: Use Previous/Next buttons to move through documents
3. **Use Keyboard Shortcuts**: Ctrl+S to save, Ctrl+Enter to verify
4. **Work by Type**: Complete one document type before moving to the next
5. **Quality Over Speed**: Accurate verification is critical for training

## Common Issues

### Upload Failed
- Check file format (PDF, PNG, JPG only)
- Ensure file size < 10MB
- Verify internet connection

### Processing Stuck
- Wait up to 60 seconds for complex documents
- Check browser console for errors
- Refresh the page if needed

### Can't Edit Data
- Ensure JSON is valid
- Check for syntax errors (missing commas, brackets)
- Copy to external editor if needed

## Need More Help?

See the complete documentation:
- **User Guide**: `TRAINING_SYSTEM_GUIDE.md`
- **File Reference**: `TRAINING_SYSTEM_FILES.md`
- **Technical Summary**: `TRAINING_SYSTEM_SUMMARY.md`

## Ready?

**Start uploading now!** Your first batch of 50 documents awaits.

Production: **https://rexeli.com/admin/training**

Local development: **http://localhost:3000/admin/training**
