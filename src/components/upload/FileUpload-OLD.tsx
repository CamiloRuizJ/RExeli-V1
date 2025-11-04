'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DocumentFile, DocumentType } from '@/lib/types';

interface FileUploadProps {
  onFileUpload: (file: DocumentFile) => void;
  onUploadComplete: (file: DocumentFile, documentType: DocumentType) => void;
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
  const [uploadedFile, setUploadedFile] = useState<DocumentFile | null>(null);
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>('');
  const [showDocumentTypeSelection, setShowDocumentTypeSelection] = useState(false);

  // Document type options as required
  const documentTypes = [
    { value: 'rent_roll', label: 'Rent Roll' },
    { value: 'operating_budget', label: 'Operating Budget' },
    { value: 'broker_sales_comparables', label: 'Broker Sales Comparables' },
    { value: 'broker_lease_comparables', label: 'Broker Lease Comparables' },
    { value: 'broker_listing', label: 'Broker Listing' },
    { value: 'offering_memo', label: 'Offering Memo' },
    { value: 'lease_agreement', label: 'Lease Agreement' },
    { value: 'financial_statements', label: 'Financial Statements' }
  ] as const;

  // Handle document type confirmation
  const handleDocumentTypeConfirmation = useCallback(() => {
    if (uploadedFile && selectedDocumentType) {
      onUploadComplete(uploadedFile, selectedDocumentType as DocumentType);
      setShowDocumentTypeSelection(false);
      setUploadedFile(null);
      setSelectedDocumentType('');
    }
  }, [uploadedFile, selectedDocumentType, onUploadComplete]);

  // Reset file upload to start over
  const handleStartOver = useCallback(() => {
    setShowDocumentTypeSelection(false);
    setUploadedFile(null);
    setSelectedDocumentType('');
    setUploadingFiles(new Map());
  }, []);

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
      // Upload directly through our API endpoint (which handles Supabase upload)
      const formData = new FormData();
      formData.append('file', file);

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
          if (response.success && response.data) {
            const completedFile: DocumentFile = {
              ...documentFile,
              status: 'uploaded',
              uploadProgress: 100,
              supabaseUrl: response.data.url // URL from API response
            };

            setUploadingFiles(prev => {
              const newMap = new Map(prev);
              newMap.set(fileId, completedFile);
              return newMap;
            });

            // Show document type selection step instead of immediate completion
            setUploadedFile(completedFile);
            setShowDocumentTypeSelection(true);
          } else {
            throw new Error(response.error || 'Upload failed');
          }
        } else {
          const response = JSON.parse(xhr.responseText);
          throw new Error(response.error || `Upload failed with status ${xhr.status}`);
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

      // Upload through our API endpoint
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
    <div className="w-full space-y-6">
      {/* Document Type Selection Step */}
      {showDocumentTypeSelection && uploadedFile && (
        <Card className="card-hover border-2 border-green-300 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-green-700 flex items-center space-x-2">
              <CheckCircle className="w-6 h-6" />
              <span>Select Document Type</span>
            </CardTitle>
            <p className="text-gray-600">
              Choose the type of document you uploaded to ensure accurate data extraction
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Info */}
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{uploadedFile.name}</p>
                  <p className="text-sm text-gray-500">
                    {formatFileSize(uploadedFile.size)} • Upload complete
                  </p>
                </div>
              </div>
            </div>

            {/* Document Type Selector */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">
                Document Type <span className="text-red-500">*</span>
              </label>
              <Select value={selectedDocumentType} onValueChange={setSelectedDocumentType}>
                <SelectTrigger className="w-full h-12 text-left">
                  <SelectValue placeholder="Select the type of document you uploaded..." />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map((docType) => (
                    <SelectItem key={docType.value} value={docType.value}>
                      {docType.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                This helps our AI extract the most relevant data from your document
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-4">
              <Button
                onClick={handleDocumentTypeConfirmation}
                disabled={!selectedDocumentType}
                size="lg"
                className="flex-1"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                Continue to Processing
              </Button>
              <Button
                onClick={handleStartOver}
                variant="outline"
                size="lg"
              >
                Start Over
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* File Upload Section - hide when showing document type selection */}
      {!showDocumentTypeSelection && (
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
      )}

      {/* Upload Progress - show when not in document type selection mode */}
      {!showDocumentTypeSelection && uploadingFiles.size > 0 && (
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
