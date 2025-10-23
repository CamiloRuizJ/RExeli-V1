# Quick Reference: Multi-Page Training & Timeout Updates

## Summary of Changes

### Timeouts Extended (2min → 10min)

| Component | Before | After | File |
|-----------|--------|-------|------|
| OpenAI Client | 120s (2min) | 600s (10min) | `src/lib/openai.ts:36` |
| Fine-tuning Client | 60s (1min) | 600s (10min) | `src/lib/fine-tuning.ts:38` |
| Tool Page Fetch | 180s (3min) | 600s (10min) | `src/app/tool/page.tsx:301` |
| Vercel Functions | 240s (4min) | 300s (5min)* | `vercel.json:5` |

*Note: 300s is Vercel Pro tier maximum. Enterprise supports up to 900s.

### Multi-Page PDF Support Added

| Component | Change | File |
|-----------|--------|------|
| Server PDF Converter | Added `convertPdfToAllPngsServer()` | `src/lib/pdf-utils-server.ts:271-488` |
| Training Batch Process | Convert PDFs to multi-page before extraction | `src/app/api/training/process-batch/route.ts:117-146` |
| Training Export | Include all PDF pages in training examples | `src/lib/openai-export.ts:162-204` |
| User Warnings | Updated timeout messages | `src/app/tool/page.tsx:207-222` |

## Key Functions

### Server-Side Multi-Page Conversion
```typescript
// Convert all pages of PDF on server
import { convertPdfToAllPngsServer } from '@/lib/pdf-utils-server';

const pages = await convertPdfToAllPngsServer(pdfFile);
// Returns: Array<{ imageBase64, mimeType, pageNumber }>
```

### Training Batch Processing Flow
```typescript
// Download PDF → Convert All Pages → Create Multi-Page JSON → Extract
if (file.type === 'application/pdf') {
  const allPages = await convertPdfToAllPngsServer(file);
  const multiPageData = { type: 'multi-page', pages: allPages };
  fileToProcess = new File([JSON.stringify(multiPageData)], '...json');
}
const extractedData = await extractDocumentData(fileToProcess, documentType);
```

### Training Export with Multi-Page
```typescript
// In createTrainingExample()
if (document.file_type === 'application/pdf') {
  const allPages = await convertPdfToAllPngsServer(pdfFile);
  allPages.forEach(page => {
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:${page.mimeType};base64,${page.imageBase64}` }
    });
  });
}
```

## Processing Time Guidelines

| Pages | Estimated Time | Status |
|-------|---------------|--------|
| 1-5 | 1-2 minutes | Optimal |
| 5-10 | 2-4 minutes | Good |
| 10-15 | 4-7 minutes | Acceptable |
| 15-20 | 7-10 minutes | Max Recommended |
| 20+ | 10+ minutes | Split into chunks |

## Testing Commands

```bash
# Check timeout settings
grep -r "timeout.*600000" src/lib/

# Check multi-page implementation
grep -r "convertPdfToAllPngsServer" src/

# Check Vercel config
cat vercel.json | grep maxDuration
```

## Common Issues & Solutions

### Issue: Vercel timeout at 5 minutes
**Solution:** Vercel Pro max is 300s. Options:
1. Upgrade to Enterprise (900s max)
2. Implement async processing
3. Split large documents

### Issue: Memory errors with 20+ pages
**Solution:** Each page ~1-2MB. Limit to 15 pages or chunk documents.

### Issue: Training export fails
**Solution:** Check logs for PDF conversion errors. Verify file_type field in training_documents.

## Files Modified

```
Modified: 9 files
Added:    226 lines (pdf-utils-server.ts multi-page function)
Changed:  100 lines (training system updates)

Core changes:
✓ src/lib/openai.ts (timeout: 600s)
✓ src/lib/fine-tuning.ts (timeout: 600s)
✓ src/app/tool/page.tsx (timeout: 600s, messages)
✓ vercel.json (maxDuration: 300s)
✓ src/lib/pdf-utils-server.ts (convertPdfToAllPngsServer)
✓ src/app/api/training/process-batch/route.ts (multi-page support)
✓ src/lib/openai-export.ts (multi-page training examples)
```

## Validation Checklist

- [ ] Test tool page with 10-page PDF
- [ ] Test training upload with 10-page PDF
- [ ] Test training batch processing
- [ ] Test training export to JSONL
- [ ] Verify no timeout errors <15 pages
- [ ] Verify all pages included in training

## Documentation

Full details: `TRAINING_MULTIPAGE_TIMEOUT_FIX.md`
