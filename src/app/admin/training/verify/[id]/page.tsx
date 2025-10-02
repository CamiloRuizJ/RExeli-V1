'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VerificationEditor } from '@/components/training/VerificationEditor';
import type { TrainingDocument } from '@/lib/types';
import { getTrainingDocument, fetchTrainingDocuments } from '@/lib/training-api';
import { toast } from 'sonner';

export default function VerifyDocumentPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;

  const [document, setDocument] = useState<TrainingDocument | null>(null);
  const [allDocumentIds, setAllDocumentIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDocument();
    loadAllDocumentIds();
  }, [documentId]);

  const loadDocument = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const doc = await getTrainingDocument(documentId);
      setDocument(doc);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load document';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAllDocumentIds = async () => {
    try {
      // Get all unverified documents to enable navigation
      const response = await fetchTrainingDocuments({
        processing_status: 'completed',
        is_verified: false,
        limit: 1000,
      });
      const ids = response.documents.map(d => d.id);
      setAllDocumentIds(ids);
    } catch (err) {
      console.error('Failed to load document IDs:', err);
    }
  };

  const handleVerify = () => {
    loadDocument();
  };

  const handleReject = () => {
    router.push('/admin/training');
  };

  const handleSave = () => {
    loadDocument();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">Document Not Found</h2>
          <p className="text-muted-foreground mb-6">
            {error || 'The requested document could not be loaded.'}
          </p>
          <Button onClick={() => router.push('/admin/training')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <VerificationEditor
      document={document}
      allDocumentIds={allDocumentIds}
      onSave={handleSave}
      onVerify={handleVerify}
      onReject={handleReject}
    />
  );
}
