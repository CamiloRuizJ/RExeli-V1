'use client';

import { Download, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProgressBar } from './ProgressBar';
import type { TrainingMetrics, DocumentType } from '@/lib/types';
import { toast } from 'sonner';
import { useState } from 'react';

interface MetricsDashboardProps {
  metrics: TrainingMetrics[];
}

export function MetricsDashboard({ metrics }: MetricsDashboardProps) {
  const [exportingType, setExportingType] = useState<DocumentType | null>(null);

  const totalDocuments = metrics.reduce((sum, m) => sum + m.total_documents, 0);
  const totalVerified = metrics.reduce((sum, m) => sum + m.verified_documents, 0);
  const readyTypes = metrics.filter(m => m.ready_for_training).length;

  const handleExport = async (documentType: DocumentType) => {
    setExportingType(documentType);
    try {
      const { exportTrainingData } = await import('@/lib/training-api');
      const result = await exportTrainingData(documentType);

      toast.success(
        `Exported ${result.train_examples} training examples and ${result.validation_examples} validation examples`
      );

      // Download files
      if (result.train_file_url) {
        window.open(result.train_file_url, '_blank');
      }
      if (result.validation_file_url) {
        setTimeout(() => {
          window.open(result.validation_file_url, '_blank');
        }, 1000);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed';
      toast.error(message);
    } finally {
      setExportingType(null);
    }
  };

  const handleExportAll = async () => {
    const readyMetrics = metrics.filter(m => m.ready_for_training);

    for (const metric of readyMetrics) {
      await handleExport(metric.document_type);
      // Add delay between exports
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Documents</CardDescription>
            <CardTitle className="text-3xl">{totalDocuments}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Across {metrics.length} document types
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Verified Documents</CardDescription>
            <CardTitle className="text-3xl">{totalVerified}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {totalDocuments > 0
                ? Math.round((totalVerified / totalDocuments) * 100)
                : 0}
              % verification rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Ready for Training</CardDescription>
            <CardTitle className="text-3xl">{readyTypes}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {readyTypes} of {metrics.length} types ready
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Overall Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Progress</CardTitle>
          <CardDescription>
            Verification progress by document type
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {metrics.map((metric) => {
            const percentage =
              metric.total_documents > 0
                ? Math.round(
                    (metric.verified_documents / metric.total_documents) * 100
                  )
                : 0;

            const variant =
              percentage >= 100
                ? 'success'
                : percentage >= 50
                ? 'default'
                : 'warning';

            return (
              <div key={metric.document_type}>
                <ProgressBar
                  current={metric.verified_documents}
                  total={metric.total_documents}
                  label={formatDocumentType(metric.document_type)}
                  variant={variant}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Document Type Details */}
      <Card>
        <CardHeader>
          <CardTitle>Document Type Details</CardTitle>
          <CardDescription>
            Detailed metrics and export options
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metrics.map((metric) => (
              <DocumentTypeMetric
                key={metric.document_type}
                metric={metric}
                onExport={handleExport}
                isExporting={exportingType === metric.document_type}
              />
            ))}
          </div>

          {readyTypes > 0 && (
            <div className="mt-6 pt-6 border-t">
              <Button
                onClick={handleExportAll}
                disabled={exportingType !== null}
                size="lg"
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Export All Ready Types ({readyTypes})
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DocumentTypeMetric({
  metric,
  onExport,
  isExporting,
}: {
  metric: TrainingMetrics;
  onExport: (type: DocumentType) => void;
  isExporting: boolean;
}) {
  const {
    document_type,
    total_documents,
    verified_documents,
    rejected_documents,
    ready_for_training,
    minimum_examples_met,
    train_set_size,
    validation_set_size,
  } = metric;

  const percentage =
    total_documents > 0
      ? Math.round((verified_documents / total_documents) * 100)
      : 0;

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <h4 className="font-medium">{formatDocumentType(document_type)}</h4>
          {ready_for_training ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : minimum_examples_met ? (
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Total</p>
            <p className="font-medium">{total_documents}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Verified</p>
            <p className="font-medium text-green-600">{verified_documents}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Rejected</p>
            <p className="font-medium text-red-600">{rejected_documents}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Progress</p>
            <p className="font-medium">{percentage}%</p>
          </div>
        </div>

        {verified_documents > 0 && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Train: {train_set_size}</span>
            <span>Val: {validation_set_size}</span>
            {!minimum_examples_met && (
              <span className="text-yellow-600">
                Need at least 50 verified examples
              </span>
            )}
          </div>
        )}
      </div>

      <div className="ml-4">
        <Button
          onClick={() => onExport(document_type)}
          disabled={!ready_for_training || isExporting}
          size="sm"
        >
          {isExporting ? (
            'Exporting...'
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Export
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function formatDocumentType(type: DocumentType): string {
  const labels: Record<DocumentType, string> = {
    rent_roll: 'Rent Roll',
    operating_budget: 'Operating Budget',
    broker_sales_comparables: 'Broker Sales Comparables',
    broker_lease_comparables: 'Broker Lease Comparables',
    broker_listing: 'Broker Listing',
    offering_memo: 'Offering Memo',
    lease_agreement: 'Lease Agreement',
    financial_statements: 'Financial Statements',
    comparable_sales: 'Comparable Sales',
    financial_statement: 'Financial Statement',
    unknown: 'Unknown',
  };

  return labels[type] || type;
}
