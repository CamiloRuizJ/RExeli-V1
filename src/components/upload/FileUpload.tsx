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
      // Step 1: Get signed upload URL from our API
      const urlResponse = await fetch('/api/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          fileSize: file.size,
        }),
      });

      if (!urlResponse.ok) {
        const errorData = await urlResponse.json();
        throw new Error(errorData.error || 'Failed to get upload URL');
      }

      const { data: urlData } = await urlResponse.json();
      const { uploadUrl, publicUrl } = urlData;

      // Step 2: Upload directly to Supabase using signed URL
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
        if (xhr.status === 200 || xhr.status === 201) {
          const completedFile: DocumentFile = {
            ...documentFile,
            status: 'uploaded',
            uploadProgress: 100,
            supabaseUrl: publicUrl
          };

          setUploadingFiles(prev => {
            const newMap = new Map(prev);
            newMap.set(fileId, completedFile);
            return newMap;
          });

          onUploadComplete(completedFile);
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

      // Upload directly to Supabase using signed URL
      xhr.open('POST', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);

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
    <div className="w-full space-y-6">
      <Card className={`card-hover transition-all duration-300 ${
        isDragActive 
          ? 'border-2 border-blue-400 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg' 
          : 'border-2 border-dashed border-gray-200 hover:border-blue-300'
      }`}>
        <CardContent className="p-10">
          <div
            {...getRootProps()}
            className={`text-center cursor-pointer transition-all duration-300 ${
              isDragActive ? 'text-blue-600 scale-105' : 'text-gray-600'
            } ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:text-blue-600'}`}
          >
            <input {...getInputProps()} />
            
            {/* Upload Icon with Animation */}
            <div className={`mx-auto mb-6 transition-all duration-300 ${
              isDragActive ? 'scale-110' : 'hover:scale-105'
            }`}>
              <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center ${
                isDragActive 
                  ? 'bg-blue-100 border-2 border-blue-300' 
                  : 'bg-gray-50 border-2 border-gray-200'
              }`}>
                <Upload className={`w-8 h-8 ${
                  isDragActive ? 'animate-bounce text-blue-600' : 'text-gray-400'
                }`} />
              </div>
            </div>
            
            {isDragActive ? (
              <div className="space-y-2">
                <p className="text-xl font-semibold text-blue-600">Drop your document here</p>
                <p className="text-sm text-blue-500">We&apos;ll process it instantly</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-2xl font-semibold text-gray-900 mb-2">
                    {isProcessing ? 'Processing your document...' : 'Upload Your Real Estate Document'}
                  </p>
                  <p className="text-gray-500 mb-6 max-w-md mx-auto">
                    Drag & drop your file here, or click to browse. We support rent rolls, 
                    offering memos, lease agreements, and more.
                  </p>
                </div>
                
                <Button 
                  className="px-8 py-3 text-lg font-medium bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus-ring" 
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    'Choose File'
                  )}
                </Button>
                
                {/* Supported File Types */}
                <div className="flex items-center justify-center space-x-4 mt-6 text-xs text-gray-400">
                  <div className="flex items-center space-x-1">
                    <FileText className="w-3 h-3" />
                    <span>PDF</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center space-x-1">
                    <FileText className="w-3 h-3" />
                    <span>JPEG</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center space-x-1">
                    <FileText className="w-3 h-3" />
                    <span>PNG</span>
                  </div>
                  <span>•</span>
                  <span>Up to 25MB</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upload Progress */}
      {uploadingFiles.size > 0 && (
        <div className="space-y-4">
          {Array.from(uploadingFiles.values()).map((file) => (
            <Card key={file.id} className="p-6 card-hover border border-gray-100 shadow-sm">
              <div className="flex items-center space-x-4">
                <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                  file.status === 'uploading' 
                    ? 'bg-blue-100' 
                    : file.status === 'uploaded' 
                    ? 'bg-green-100' 
                    : 'bg-red-100'
                }`}>
                  {getStatusIcon(file.status)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-base font-semibold text-gray-900 truncate">
                      {file.name}
                    </p>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      file.status === 'uploading' 
                        ? 'bg-blue-100 text-blue-700' 
                        : file.status === 'uploaded' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {file.status === 'uploading' 
                        ? `${file.uploadProgress}%` 
                        : file.status === 'uploaded' 
                        ? 'Ready' 
                        : 'Error'
                      }
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-500 mb-3">
                    {formatFileSize(file.size)} • {file.type.split('/')[1]?.toUpperCase() || 'Unknown'}
                  </p>
                  
                  {file.status === 'uploading' && (
                    <div className="space-y-2">
                      <Progress value={file.uploadProgress} className="h-2 bg-gray-100" />
                      <p className="text-xs text-gray-400">Uploading to secure storage...</p>
                    </div>
                  )}
                  
                  {file.status === 'uploaded' && (
                    <p className="text-xs text-green-600 font-medium">✓ Upload complete, ready for AI processing</p>
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