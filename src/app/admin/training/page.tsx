'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BatchUpload } from '@/components/training/BatchUpload';
import { DocumentList } from '@/components/training/DocumentList';
import { ProgressBar } from '@/components/training/ProgressBar';
import type {
  TrainingDocument,
  DocumentType,
  TrainingDocumentsQuery,
} from '@/lib/types';
import { fetchTrainingDocuments, fetchTrainingMetrics } from '@/lib/training-api';
import { toast } from 'sonner';

const DOCUMENT_TYPES: Array<{ value: DocumentType; label: string }> = [
  { value: 'rent_roll', label: 'Rent Roll' },
  { value: 'broker_sales_comparables', label: 'Sales Comparables' },
  { value: 'broker_lease_comparables', label: 'Lease Comparables' },
  { value: 'offering_memo', label: 'Offering Memo' },
  { value: 'lease_agreement', label: 'Lease Agreement' },
  { value: 'operating_budget', label: 'Operating Budget' },
  { value: 'broker_listing', label: 'Broker Listing' },
  { value: 'financial_statements', label: 'Financial Statements' },
];

export default function TrainingDashboardPage() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<DocumentType | 'all'>('all');
  const [documents, setDocuments] = useState<TrainingDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    processed: 0,
    verified: 0,
  });

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const query: TrainingDocumentsQuery = {
        limit: 100,
        offset: 0,
      };

      if (selectedType !== 'all') {
        query.document_type = selectedType;
      }

      const response = await fetchTrainingDocuments(query);
      setDocuments(response.documents);

      // Calculate stats
      const total = response.total;
      const processed = response.documents.filter(
        (d) => d.processing_status === 'completed'
      ).length;
      const verified = response.documents.filter((d) => d.is_verified).length;

      setStats({ total, processed, verified });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load documents';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [selectedType]);

  const handleUploadComplete = () => {
    loadDocuments();
    toast.success('Upload complete! Processing documents...');
  };

  const unverifiedDocs = documents.filter(
    (d) => d.processing_status === 'completed' && !d.is_verified
  );
  const verifiedDocs = documents.filter((d) => d.is_verified);
  const failedDocs = documents.filter((d) => d.processing_status === 'failed');

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Training Data Management</h1>
          <p className="text-muted-foreground mt-1">
            Upload, verify, and export training data for OpenAI fine-tuning
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={loadDocuments}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/admin/training/metrics')}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            View Metrics
          </Button>
        </div>
      </div>

      {/* Document Type Tabs */}
      <Tabs value={selectedType} onValueChange={(v) => setSelectedType(v as DocumentType | 'all')}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="all">All Documents</TabsTrigger>
          {DOCUMENT_TYPES.map((type) => (
            <TabsTrigger key={type.value} value={type.value}>
              {type.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Upload Section */}
        <TabsContent value={selectedType} className="space-y-6 mt-6">
          {/* Upload Card */}
          {selectedType !== 'all' && (
            <Card>
              <CardHeader>
                <CardTitle>Upload Documents</CardTitle>
                <CardDescription>
                  Upload PDF or image files for {DOCUMENT_TYPES.find(t => t.value === selectedType)?.label}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <Select
                    value={selectedType as string}
                    onValueChange={(v) => setSelectedType(v as DocumentType)}
                  >
                    <SelectTrigger className="w-full md:w-[300px]">
                      <SelectValue placeholder="Select document type" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <BatchUpload
                  documentType={selectedType as DocumentType}
                  onUploadComplete={handleUploadComplete}
                  maxFiles={50}
                />
              </CardContent>
            </Card>
          )}

          {/* Progress Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Progress Overview</CardTitle>
              <CardDescription>
                {selectedType === 'all' ? 'All document types' : DOCUMENT_TYPES.find(t => t.value === selectedType)?.label}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Total Documents</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold">{stats.processed}</p>
                  <p className="text-sm text-muted-foreground">Processed</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold">{stats.verified}</p>
                  <p className="text-sm text-muted-foreground">Verified</p>
                </div>
              </div>

              <ProgressBar
                current={stats.verified}
                total={stats.total}
                label="Verification Progress"
                variant={
                  stats.verified === stats.total
                    ? 'success'
                    : stats.verified > stats.total / 2
                    ? 'default'
                    : 'warning'
                }
              />
            </CardContent>
          </Card>

          {/* Documents List */}
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>
                {unverifiedDocs.length} pending verification, {verifiedDocs.length} verified
                {failedDocs.length > 0 && `, ${failedDocs.length} failed`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="pending" className="w-full">
                <TabsList>
                  <TabsTrigger value="pending">
                    Pending ({unverifiedDocs.length})
                  </TabsTrigger>
                  <TabsTrigger value="verified">
                    Verified ({verifiedDocs.length})
                  </TabsTrigger>
                  <TabsTrigger value="all">All ({documents.length})</TabsTrigger>
                  {failedDocs.length > 0 && (
                    <TabsTrigger value="failed">
                      Failed ({failedDocs.length})
                    </TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="pending" className="mt-4">
                  <DocumentList
                    documents={unverifiedDocs}
                    isLoading={isLoading}
                    onRefresh={loadDocuments}
                  />
                </TabsContent>

                <TabsContent value="verified" className="mt-4">
                  <DocumentList
                    documents={verifiedDocs}
                    isLoading={isLoading}
                    onRefresh={loadDocuments}
                  />
                </TabsContent>

                <TabsContent value="all" className="mt-4">
                  <DocumentList
                    documents={documents}
                    isLoading={isLoading}
                    onRefresh={loadDocuments}
                  />
                </TabsContent>

                {failedDocs.length > 0 && (
                  <TabsContent value="failed" className="mt-4">
                    <DocumentList
                      documents={failedDocs}
                      isLoading={isLoading}
                      onRefresh={loadDocuments}
                    />
                  </TabsContent>
                )}
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
