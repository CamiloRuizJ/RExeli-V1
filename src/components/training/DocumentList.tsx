'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FileText, Eye, Trash2, CheckCircle, AlertCircle, Clock, Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QualityRating } from './QualityRating';
import type { TrainingDocument, DocumentType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DocumentListProps {
  documents: TrainingDocument[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onDelete?: (id: string) => void;
}

export function DocumentList({
  documents,
  isLoading = false,
  onRefresh,
  onDelete,
}: DocumentListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }

    setDeletingId(id);
    try {
      const { deleteDocument } = await import('@/lib/training-api');
      await deleteDocument(id);
      toast.success('Document deleted successfully');
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Delete failed';
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg">
        <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No documents found</h3>
        <p className="text-muted-foreground">
          Upload some documents to get started
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Verification</TableHead>
            <TableHead>Quality</TableHead>
            <TableHead>Uploaded</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => (
            <TableRow key={doc.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium truncate max-w-[200px]">
                    {doc.file_name}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <DocumentTypeBadge type={doc.document_type} />
              </TableCell>
              <TableCell>
                <ProcessingStatusBadge status={doc.processing_status} />
              </TableCell>
              <TableCell>
                <VerificationStatusBadge status={doc.verification_status} />
              </TableCell>
              <TableCell>
                {doc.quality_score !== undefined ? (
                  <QualityRating
                    rating={doc.quality_score}
                    readonly
                    size="sm"
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {new Date(doc.upload_date).toLocaleDateString()}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-2">
                  {doc.processing_status === 'completed' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                    >
                      <Link href={`/admin/training/verify/${doc.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(doc.id)}
                    disabled={deletingId === doc.id}
                  >
                    {deletingId === doc.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DocumentTypeBadge({ type }: { type: DocumentType }) {
  const labels: Record<DocumentType, string> = {
    rent_roll: 'Rent Roll',
    operating_budget: 'Budget',
    broker_sales_comparables: 'Sales Comps',
    broker_lease_comparables: 'Lease Comps',
    broker_listing: 'Listing',
    offering_memo: 'Offering',
    lease_agreement: 'Lease',
    financial_statements: 'Financial',
    comparable_sales: 'Sales',
    financial_statement: 'Financial',
    unknown: 'Unknown',
  };

  return (
    <Badge variant="outline" className="font-normal">
      {labels[type] || type}
    </Badge>
  );
}

function ProcessingStatusBadge({ status }: { status: string }) {
  const config = {
    pending: { icon: Clock, label: 'Pending', className: 'bg-gray-100 text-gray-700' },
    processing: { icon: Loader2, label: 'Processing', className: 'bg-blue-100 text-blue-700' },
    completed: { icon: CheckCircle, label: 'Completed', className: 'bg-green-100 text-green-700' },
    failed: { icon: AlertCircle, label: 'Failed', className: 'bg-red-100 text-red-700' },
  };

  const { icon: Icon, label, className } = config[status as keyof typeof config] || config.pending;

  return (
    <Badge variant="secondary" className={cn('gap-1', className)}>
      <Icon className={cn('h-3 w-3', status === 'processing' && 'animate-spin')} />
      {label}
    </Badge>
  );
}

function VerificationStatusBadge({ status }: { status: string }) {
  const config = {
    unverified: { label: 'Unverified', className: 'bg-gray-100 text-gray-700' },
    in_review: { label: 'In Review', className: 'bg-yellow-100 text-yellow-700' },
    verified: { label: 'Verified', className: 'bg-green-100 text-green-700' },
    rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
  };

  const { label, className } = config[status as keyof typeof config] || config.unverified;

  return (
    <Badge variant="secondary" className={className}>
      {label}
    </Badge>
  );
}
