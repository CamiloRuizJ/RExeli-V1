# Training Upload - Architecture Fix

## Problem
- Training uploads fail with: `Cannot find module '/var/task/.next/server/chunks/pdf.worker.mjs'`
- Server-side PDF conversion using pdfjs-dist doesn't work in Vercel serverless

## Solution
**Use the SAME architecture as the working tool upload:**

### Current Tool Flow (WORKING ✅)
1. User selects PDF in browser
2. **Browser converts PDF → PNG** using `pdf-utils.ts` (client-side)
3. PNG uploaded to Supabase
4. Server receives PNG and sends to OpenAI
5. ✅ No server-side PDF conversion needed

### Apply to Training:
1. Update `src/lib/training-api.ts` `uploadBatchDocuments()`:
   - Before uploading, check if file is PDF
   - If PDF: Use `convertPdfToImage()` from `pdf-utils.ts` (same as tool)
   - Convert to PNG File object
   - Upload PNG (not PDF)

2. Remove server-side PDF conversion:
   - Delete `src/lib/pdf-utils-server.ts` (not needed)
   - Remove PDF conversion from `src/lib/openai.ts`
   - Remove Sharp dependency

3. Benefits:
   - ✅ No pdfjs-dist worker bundling issues
   - ✅ No serverless compatibility problems
   - ✅ Consistent with tool architecture
   - ✅ Already proven to work

## Code Changes Needed

### File: `src/lib/training-api.ts`
```typescript
// In uploadBatchDocuments(), before uploading:
let fileToUpload = file;

if (file.type === 'application/pdf') {
  const { convertPdfToImage } = await import('@/lib/pdf-utils');
  const { imageBase64, mimeType } = await convertPdfToImage(file, 1);
  const response = await fetch(`data:${mimeType};base64,${imageBase64}`);
  const blob = await response.blob();
  const originalName = file.name.replace(/\.pdf$/i, '');
  fileToUpload = new File([blob], `${originalName}_page1.png`, { type: mimeType });
}

// Upload the converted file
await uploadFileDirectly(fileToUpload, 'documents');
```

### File: `src/lib/openai.ts`
```typescript
// Remove PDF conversion - just handle images
if (file.type === 'application/pdf') {
  throw new Error('PDFs should be converted to PNG before reaching this point');
}
```

## Why This Works
- Browser has Canvas API (pdf-utils.ts uses it)
- No server-side dependencies needed
- Same code path as tool = proven reliability
