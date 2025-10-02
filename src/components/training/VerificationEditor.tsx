'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Save, CheckCircle, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { QualityRating } from './QualityRating';
import { DocumentPreview } from './DocumentPreview';
import type { TrainingDocument, ExtractedData } from '@/lib/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface VerificationEditorProps {
  document: TrainingDocument;
  allDocumentIds?: string[]; // For navigation
  onSave?: () => void;
  onVerify?: () => void;
  onReject?: () => void;
}

export function VerificationEditor({
  document,
  allDocumentIds = [],
  onSave,
  onVerify,
  onReject,
}: VerificationEditorProps) {
  const router = useRouter();
  const [editedData, setEditedData] = useState<ExtractedData | null>(null);
  const [qualityScore, setQualityScore] = useState(document.quality_score || 0.8);
  const [notes, setNotes] = useState(document.verification_notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  // Initialize edited data
  useEffect(() => {
    const initialData = document.verified_extraction || document.raw_extraction;
    if (initialData) {
      setEditedData(initialData);
    }
  }, [document]);

  const currentIndex = allDocumentIds.indexOf(document.id);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < allDocumentIds.length - 1;

  const navigateToDocument = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < allDocumentIds.length) {
      router.push(`/admin/training/verify/${allDocumentIds[newIndex]}`);
    }
  };

  const handleSave = async () => {
    if (!editedData) return;

    setIsSaving(true);
    try {
      const { saveDocumentEdits } = await import('@/lib/training-api');
      await saveDocumentEdits(document.id, editedData, notes);
      toast.success('Changes saved successfully');
      if (onSave) onSave();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Save failed';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerify = async () => {
    if (!editedData) return;

    setIsVerifying(true);
    try {
      const { verifyDocument } = await import('@/lib/training-api');
      await verifyDocument(document.id, editedData, qualityScore, notes);
      toast.success('Document verified successfully');
      if (onVerify) {
        onVerify();
      } else if (hasNext) {
        navigateToDocument('next');
      } else {
        router.push('/admin/training');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed';
      toast.error(message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleReject = async () => {
    const reason = notes || 'Document rejected';

    setIsRejecting(true);
    try {
      const { rejectDocument } = await import('@/lib/training-api');
      await rejectDocument(document.id, reason);
      toast.success('Document rejected');
      if (onReject) {
        onReject();
      } else if (hasNext) {
        navigateToDocument('next');
      } else {
        router.push('/admin/training');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Rejection failed';
      toast.error(message);
    } finally {
      setIsRejecting(false);
    }
  };

  const updateField = (path: string[], value: unknown) => {
    if (!editedData) return;

    setEditedData(prevData => {
      if (!prevData) return prevData;

      const newData = JSON.parse(JSON.stringify(prevData));
      let current: Record<string, unknown> = newData;

      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]] as Record<string, unknown>;
      }

      current[path[path.length - 1]] = value;
      return newData;
    });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 's') {
          e.preventDefault();
          handleSave();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          handleVerify();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [editedData, qualityScore, notes]);

  if (!editedData) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">No extraction data available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="border-b p-4 bg-background">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{document.file_name}</h2>
            <p className="text-sm text-muted-foreground">
              Uploaded {new Date(document.upload_date).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateToDocument('prev')}
              disabled={!hasPrevious}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              {currentIndex + 1} / {allDocumentIds.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateToDocument('next')}
              disabled={!hasNext}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-2 gap-4 h-full p-4">
          {/* Document Preview */}
          <div className="overflow-hidden">
            <DocumentPreview
              fileUrl={document.file_url}
              fileType={document.file_type}
            />
          </div>

          {/* Data Editor */}
          <div className="overflow-y-auto space-y-4">
            <div className="space-y-4 pb-32">
              <div>
                <h3 className="text-lg font-semibold mb-4">Extracted Data</h3>
                <DataEditor
                  data={editedData}
                  onChange={setEditedData}
                />
              </div>

              {/* Quality Rating */}
              <div className="space-y-2">
                <Label>Quality Rating</Label>
                <QualityRating
                  rating={qualityScore}
                  onChange={setQualityScore}
                  size="lg"
                />
                <p className="text-xs text-muted-foreground">
                  Rate the quality of the extraction (1-5 stars)
                </p>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Verification Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about this verification..."
                  rows={4}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="border-t p-4 bg-background">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => router.push('/admin/training')}
          >
            Back to Dashboard
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isRejecting || isSaving || isVerifying}
            >
              {isRejecting ? (
                <>Rejecting...</>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={isSaving || isVerifying || isRejecting}
            >
              {isSaving ? (
                <>Saving...</>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save (Ctrl+S)
                </>
              )}
            </Button>
            <Button
              onClick={handleVerify}
              disabled={isVerifying || isSaving || isRejecting}
            >
              {isVerifying ? (
                <>Verifying...</>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Verify (Ctrl+Enter)
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// JSON Data Editor Component
function DataEditor({
  data,
  onChange,
}: {
  data: ExtractedData;
  onChange: (data: ExtractedData) => void;
}) {
  const [jsonString, setJsonString] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setJsonString(JSON.stringify(data, null, 2));
  }, [data]);

  const handleChange = (value: string) => {
    setJsonString(value);
    try {
      const parsed = JSON.parse(value);
      setError('');
      onChange(parsed);
    } catch (err) {
      setError('Invalid JSON');
    }
  };

  return (
    <div className="space-y-2">
      <Textarea
        value={jsonString}
        onChange={(e) => handleChange(e.target.value)}
        className="font-mono text-sm min-h-[400px]"
        placeholder="Extracted data..."
      />
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
      <p className="text-xs text-muted-foreground">
        Edit the JSON data directly. Changes are applied in real-time.
      </p>
    </div>
  );
}
