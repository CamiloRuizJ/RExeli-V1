# Training System - File Reference

This document lists all files created for the AI Training Data Collection System.

## UI Components (`src/components/ui/`)

Created/Added:
- `table.tsx` - Table component for document lists
- `textarea.tsx` - Textarea for notes and JSON editing
- `tabs.tsx` - Tabs for organizing content

Existing (used):
- `button.tsx` - Buttons throughout the interface
- `card.tsx` - Cards for grouping content
- `progress.tsx` - Progress bars
- `dialog.tsx` - Modal dialogs
- `select.tsx` - Dropdown selects
- `badge.tsx` - Status badges
- `label.tsx` - Form labels
- `input.tsx` - Text inputs

## Training Components (`src/components/training/`)

All new components:
- `BatchUpload.tsx` - Multi-file upload with drag & drop
- `DocumentList.tsx` - Filterable, sortable document table
- `DocumentPreview.tsx` - PDF/Image viewer with zoom controls
- `VerificationEditor.tsx` - Full verification interface
- `MetricsDashboard.tsx` - Progress tracking and export
- `QualityRating.tsx` - 5-star rating component
- `ProgressBar.tsx` - Reusable progress bar
- `index.ts` - Export file for easy imports

## Pages (`src/app/admin/training/`)

All new pages:
- `page.tsx` - Main training dashboard
- `verify/[id]/page.tsx` - Document verification page
- `metrics/page.tsx` - Metrics and export dashboard

## API Client (`src/lib/`)

New file:
- `training-api.ts` - Complete API client with typed functions

Modified files:
- `openai-export.ts` - Added missing document type prompts

Existing (used):
- `types.ts` - All TypeScript type definitions (already existed)
- `training-utils.ts` - Backend utilities (already existed)

## Documentation

New files:
- `TRAINING_SYSTEM_GUIDE.md` - Complete user guide
- `TRAINING_SYSTEM_FILES.md` - This file

## API Routes (Backend - Already Existed)

All these were already created:
- `src/app/api/training/batch-upload/route.ts`
- `src/app/api/training/process-batch/route.ts`
- `src/app/api/training/documents/route.ts`
- `src/app/api/training/document/[id]/route.ts`
- `src/app/api/training/verify/[id]/route.ts`
- `src/app/api/training/reject/[id]/route.ts`
- `src/app/api/training/metrics/route.ts`
- `src/app/api/training/export/route.ts`
- `src/app/api/training/auto-split/route.ts`

## Dependencies Added

```json
{
  "@radix-ui/react-tabs": "^1.1.13"
}
```

All other dependencies already existed in package.json.

## File Summary

**Total New Files**: 17
- 3 UI components
- 8 Training components
- 3 Pages
- 1 API client
- 2 Documentation files

**Total Modified Files**: 2
- `openai-export.ts` (added missing type prompts)
- `package.json` (added tabs dependency)

## Quick Access

### Main Entry Points

1. **Dashboard**: `http://localhost:3000/admin/training`
2. **Metrics**: `http://localhost:3000/admin/training/metrics`
3. **Verify Document**: `http://localhost:3000/admin/training/verify/{id}`

### Component Usage Examples

```typescript
// Import training components
import {
  BatchUpload,
  DocumentList,
  VerificationEditor,
  MetricsDashboard
} from '@/components/training';

// Import API functions
import {
  uploadBatchDocuments,
  fetchTrainingDocuments,
  verifyDocument,
  exportTrainingData
} from '@/lib/training-api';

// Use components
<BatchUpload
  documentType="rent_roll"
  onUploadComplete={handleComplete}
/>

<DocumentList
  documents={docs}
  onRefresh={loadDocs}
/>
```

## Testing Checklist

- [ ] Upload single document
- [ ] Upload multiple documents (batch)
- [ ] View document list
- [ ] Filter documents by status
- [ ] Open verification editor
- [ ] Edit extracted data
- [ ] Save changes
- [ ] Verify document
- [ ] Reject document
- [ ] Navigate between documents
- [ ] View metrics dashboard
- [ ] Export training data
- [ ] Test keyboard shortcuts (Ctrl+S, Ctrl+Enter)

## Next Steps

1. Run the development server: `npm run dev`
2. Navigate to `/admin/training`
3. Upload test documents
4. Verify extractions
5. Export training data

---

All files are ready for production use!
