'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, CheckCircle, AlertCircle, Loader2, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { DocumentType } from '@/lib/types';
import { toast } from 'sonner';

interface FileUploadStatus {
  file: File;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
  documentId?: string;
}

interface BatchUploadProps {
  documentType: DocumentType;
  onUploadComplete?: (documentIds: string[]) => void;
  maxFiles?: number;
}

export function BatchUpload({
  documentType,
  onUploadComplete,
  maxFiles = 50,
}: BatchUploadProps) {
  const [files, setFiles] = useState<FileUploadStatus[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      status: 'pending' as const,
      progress: 0,
    }));
    setFiles(prev => [...prev, ...newFiles].slice(0, maxFiles));
  }, [maxFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg'],
    },
    maxFiles,
    disabled: isUploading,
  });

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setFiles([]);
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setIsUploading(true);

    try {
      // Import the API function
      const { uploadBatchDocuments, processBatchDocuments } = await import('@/lib/training-api');

      // Update all files to uploading status
      setFiles(prev =>
        prev.map(f => ({ ...f, status: 'uploading' as const, progress: 30 }))
      );

      // Upload files
      const filesToUpload = files.map(f => f.file);
      const uploadResult = await uploadBatchDocuments(filesToUpload, documentType);

      // Check if any uploads succeeded
      if (uploadResult.documentIds.length === 0) {
        // All uploads failed - get the first error message or use a generic message
        const errorMessage = uploadResult.errors?.[0]?.error || 'All uploads failed';
        throw new Error(errorMessage);
      }

      // Handle partial failures - update file statuses based on upload results
      if (uploadResult.errors && uploadResult.errors.length > 0) {
        // Map errors by filename for quick lookup
        const errorMap = new Map(
          uploadResult.errors.map(err => [err.filename, err.error])
        );

        setFiles(prev =>
          prev.map((f) => {
            const error = errorMap.get(f.file.name);
            if (error) {
              // This file failed
              return {
                ...f,
                status: 'error' as const,
                error: error,
                progress: 0,
              };
            } else {
              // This file succeeded - update to processing status
              return {
                ...f,
                status: 'processing' as const,
                progress: 60,
              };
            }
          })
        );
      } else {
        // All uploads succeeded - update all to processing
        setFiles(prev =>
          prev.map(f => ({
            ...f,
            status: 'processing' as const,
            progress: 60,
          }))
        );
      }

      // Process only the successfully uploaded documents
      await processBatchDocuments(uploadResult.documentIds);

      // Mark successfully processed files as completed
      const successfulFileNames = new Set(
        files.map((f, i) => {
          const errorMap = new Map(
            uploadResult.errors?.map(err => [err.filename, true]) || []
          );
          return !errorMap.has(f.file.name) ? f.file.name : null;
        }).filter(Boolean)
      );

      setFiles(prev =>
        prev.map(f => {
          if (f.status === 'error') {
            return f; // Keep error status
          }
          return {
            ...f,
            status: 'completed' as const,
            progress: 100,
          };
        })
      );

      // Show appropriate success message
      if (uploadResult.failed > 0) {
        toast.success(`Successfully uploaded ${uploadResult.uploaded} of ${uploadResult.uploaded + uploadResult.failed} files`);
        toast.error(`${uploadResult.failed} file(s) failed to upload`);
      } else {
        toast.success(`Successfully uploaded ${uploadResult.uploaded} files`);
      }

      // Notify parent only with successful document IDs
      if (onUploadComplete && uploadResult.documentIds.length > 0) {
        onUploadComplete(uploadResult.documentIds);
      }

      // Clear files after 2 seconds
      setTimeout(() => {
        setFiles([]);
        setIsUploading(false);
      }, 2000);

    } catch (error) {
      console.error('Upload error:', error);
      const message = error instanceof Error ? error.message : 'Upload failed';

      setFiles(prev =>
        prev.map(f => ({
          ...f,
          status: 'error' as const,
          error: message,
        }))
      );

      toast.error(message);
      setIsUploading(false);
    }
  };

  const pendingCount = files.filter(f => f.status === 'pending').length;
  const completedCount = files.filter(f => f.status === 'completed').length;
  const errorCount = files.filter(f => f.status === 'error').length;

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-gray-300 hover:border-primary',
          isUploading && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        {isDragActive ? (
          <p className="text-lg font-medium">Drop the files here...</p>
        ) : (
          <>
            <p className="text-lg font-medium mb-2">
              Drag & drop files here, or click to browse
            </p>
            <p className="text-sm text-muted-foreground">
              Upload up to {maxFiles} PDFs or images
            </p>
          </>
        )}
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">
              Files ({files.length})
            </h3>
            <div className="flex items-center gap-2">
              {pendingCount > 0 && (
                <Button
                  onClick={uploadFiles}
                  disabled={isUploading}
                  size="sm"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    `Upload ${pendingCount} Files`
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={clearAll}
                disabled={isUploading}
              >
                Clear All
              </Button>
            </div>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {files.map((fileStatus, index) => (
              <FileUploadItem
                key={index}
                fileStatus={fileStatus}
                onRemove={() => removeFile(index)}
                canRemove={!isUploading}
              />
            ))}
          </div>

          {/* Summary */}
          {(completedCount > 0 || errorCount > 0) && (
            <div className="flex items-center gap-4 text-sm">
              {completedCount > 0 && (
                <span className="text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" />
                  {completedCount} completed
                </span>
              )}
              {errorCount > 0 && (
                <span className="text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errorCount} failed
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FileUploadItem({
  fileStatus,
  onRemove,
  canRemove,
}: {
  fileStatus: FileUploadStatus;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const { file, status, progress, error } = fileStatus;

  const statusIcons = {
    pending: <File className="h-4 w-4 text-gray-400" />,
    uploading: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
    processing: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
    completed: <CheckCircle className="h-4 w-4 text-green-500" />,
    error: <AlertCircle className="h-4 w-4 text-red-500" />,
  };

  const statusLabels = {
    pending: 'Ready to upload',
    uploading: 'Uploading...',
    processing: 'Processing...',
    completed: 'Completed',
    error: 'Failed',
  };

  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg bg-background">
      {statusIcons[status]}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium truncate">{file.name}</p>
          <span className="text-xs text-muted-foreground ml-2">
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </span>
        </div>
        {status !== 'pending' && (
          <div className="space-y-1">
            <Progress value={progress} className="h-1" />
            <p className="text-xs text-muted-foreground">
              {error || statusLabels[status]}
            </p>
          </div>
        )}
      </div>
      {canRemove && status === 'pending' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
