'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import type { DocumentFile } from '@/lib/types';

interface FileUploadProps {
  onFileUpload: (file: DocumentFile) => void;
  onUploadComplete: (file: DocumentFile) => void;
  onUploadError: (error: string) => void;
  isProcessing?: boolean;
}

export function FileUpload({ 
  onFileUpload, 
  onUploadComplete, 
  onUploadError,
  isProcessing = false 
}: FileUploadProps) {
  const [uploadingFiles, setUploadingFiles] = useState<Map<string, DocumentFile>>(new Map());

  const uploadFile = useCallback(async (file: File) => {
    const fileId = `${Date.now()}_${file.name}`;
    const documentFile: DocumentFile = {
      id: fileId,
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      uploadProgress: 0,
      status: 'uploading'
    };

    // Add to uploading files
    setUploadingFiles(prev => new Map(prev).set(fileId, documentFile));
    onFileUpload(documentFile);

    try {
      // Create FormData for upload
      const formData = new FormData();
      formData.append('file', file);

      // Upload with progress tracking
      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          const updatedFile = { ...documentFile, uploadProgress: progress };
          
          setUploadingFiles(prev => {
            const newMap = new Map(prev);
            newMap.set(fileId, updatedFile);
            return newMap;
          });
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          if (response.success) {
            const completedFile: DocumentFile = {
              ...documentFile,
              status: 'uploaded',
              uploadProgress: 100,
              supabaseUrl: response.data.url
            };
            
            setUploadingFiles(prev => {
              const newMap = new Map(prev);
              newMap.set(fileId, completedFile);
              return newMap;
            });
            
            onUploadComplete(completedFile);
          } else {
            throw new Error(response.error || 'Upload failed');
          }
        } else {
          throw new Error(`Upload failed with status ${xhr.status}`);
        }
      };

      xhr.onerror = () => {
        const errorFile = { ...documentFile, status: 'error' as const };
        setUploadingFiles(prev => {
          const newMap = new Map(prev);
          newMap.set(fileId, errorFile);
          return newMap;
        });
        onUploadError('Upload failed due to network error');
      };

      xhr.open('POST', '/api/upload');
      xhr.send(formData);

    } catch (error) {
      const errorFile = { ...documentFile, status: 'error' as const };
      setUploadingFiles(prev => {
        const newMap = new Map(prev);
        newMap.set(fileId, errorFile);
        return newMap;
      });
      
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      onUploadError(errorMessage);
    }
  }, [onFileUpload, onUploadComplete, onUploadError]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(uploadFile);
  }, [uploadFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    },
    maxSize: 25 * 1024 * 1024, // 25MB
    multiple: false,
    disabled: isProcessing
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: DocumentFile['status']) => {
    switch (status) {
      case 'uploading':
        return <Upload className="w-4 h-4 animate-spin" />;
      case 'uploaded':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: DocumentFile['status']) => {
    switch (status) {
      case 'uploading':
        return 'text-blue-600';
      case 'uploaded':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="w-full space-y-4">
      <Card className={`transition-colors duration-200 ${isDragActive ? 'border-blue-400 bg-blue-50' : 'border-dashed border-gray-300'}`}>
        <CardContent className="p-8">
          <div
            {...getRootProps()}
            className={`text-center cursor-pointer transition-colors duration-200 ${
              isDragActive ? 'text-blue-600' : 'text-gray-500'
            } ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:text-blue-600'}`}
          >
            <input {...getInputProps()} />
            <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragActive ? 'animate-bounce' : ''}`} />
            
            {isDragActive ? (
              <p className="text-lg font-medium">Drop your document here...</p>
            ) : (
              <div>
                <p className="text-lg font-medium mb-2">
                  {isProcessing ? 'Processing...' : 'Upload Real Estate Document'}
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  Drag & drop your PDF, JPEG, or PNG file here, or click to browse
                </p>
                <Button variant="outline" disabled={isProcessing}>
                  Choose File
                </Button>
              </div>
            )}
            
            <p className="text-xs text-gray-400 mt-4">
              Maximum file size: 25MB • Supported formats: PDF, JPEG, PNG
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Upload Progress */}
      {uploadingFiles.size > 0 && (
        <div className="space-y-3">
          {Array.from(uploadingFiles.values()).map((file) => (
            <Card key={file.id} className="p-4">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  {getStatusIcon(file.status)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </p>
                    <span className={`text-xs font-medium ${getStatusColor(file.status)}`}>
                      {file.status === 'uploading' ? `${file.uploadProgress}%` : file.status.toUpperCase()}
                    </span>
                  </div>
                  
                  <p className="text-xs text-gray-500 mb-2">
                    {formatFileSize(file.size)}
                  </p>
                  
                  {file.status === 'uploading' && (
                    <Progress value={file.uploadProgress} className="h-2" />
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}