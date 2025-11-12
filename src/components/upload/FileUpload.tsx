'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle, CheckCircle, ArrowRight, Info, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { uploadFileDirectly } from '@/lib/supabase-client';
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
      console.log('[FileUpload] Starting direct Supabase upload for:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)}MB)`);

      // Simulate progress updates during upload (Supabase SDK doesn't provide upload progress)
      const progressInterval = setInterval(() => {
        setUploadingFiles(prev => {
          const currentFile = prev.get(fileId);
          if (currentFile && currentFile.uploadProgress < 90) {
            const newProgress = Math.min(currentFile.uploadProgress + 10, 90);
            const updatedFile = { ...currentFile, uploadProgress: newProgress };
            const newMap = new Map(prev);
            newMap.set(fileId, updatedFile);
            return newMap;
          }
          return prev;
        });
      }, 200);

      // Upload directly to Supabase Storage (bypasses Vercel completely!)
      const uploadResult = await uploadFileDirectly(file, 'documents');

      // Clear progress interval
      clearInterval(progressInterval);

      console.log('[FileUpload] Direct upload successful:', uploadResult.url);

      // Now send only metadata to our API endpoint for database record creation
      const metadataResponse = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          supabaseUrl: uploadResult.url,
          filename: uploadResult.filename,
          size: file.size,
          mimeType: file.type,
          path: uploadResult.path
        })
      });

      // Handle potential HTML error responses
      const contentType = metadataResponse.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        // Got HTML instead of JSON - likely a 413 or 500 error
        const htmlText = await metadataResponse.text();
        console.error('[FileUpload] Received HTML response instead of JSON:', htmlText.substring(0, 200));
        throw new Error('Server returned an error page. Please try again or contact support.');
      }

      const metadataResult = await metadataResponse.json();

      if (!metadataResponse.ok || !metadataResult.success) {
        throw new Error(metadataResult.error || `Metadata save failed with status ${metadataResponse.status}`);
      }

      const completedFile: DocumentFile = {
        ...documentFile,
        status: 'uploaded',
        uploadProgress: 100,
        supabaseUrl: uploadResult.url
      };

      setUploadingFiles(prev => {
        const newMap = new Map(prev);
        newMap.set(fileId, completedFile);
        return newMap;
      });

      // Show document type selection step
      setUploadedFile(completedFile);
      setShowDocumentTypeSelection(true);

    } catch (error) {
      console.error('[FileUpload] Upload error:', error);

      const errorFile = { ...documentFile, status: 'error' as const };
      setUploadingFiles(prev => {
        const newMap = new Map(prev);
        newMap.set(fileId, errorFile);
        return newMap;
      });

      const errorMessage = error instanceof Error ? error.message : 'Upload failed';

      // Provide user-friendly error messages
      let userMessage = errorMessage;
      if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
        userMessage = 'Network error. Please check your connection and try again.';
      } else if (errorMessage.includes('413') || errorMessage.includes('too large')) {
        userMessage = 'File size limit exceeded. Please use a smaller file (max 25MB).';
      } else if (errorMessage.includes('Supabase')) {
        userMessage = 'Storage service error. Please try again later.';
      }

      onUploadError(userMessage);
    }
  }, [onFileUpload, onUploadError]);

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
      {/* Info Card - Upload Warnings and Recommendations */}
      {!showDocumentTypeSelection && (
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-sky-50">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Info className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 space-y-3">
                  <h3 className="font-semibold text-blue-900 text-lg">Before You Upload</h3>
                  <div className="space-y-2 text-sm text-blue-800">
                    <div className="flex items-start space-x-2">
                      <FileText className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600" />
                      <p><span className="font-medium">Recommended:</span> PDFs under 10 pages for optimal processing speed</p>
                    </div>
                    <div className="flex items-start space-x-2">
                      <Clock className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600" />
                      <p><span className="font-medium">Processing time:</span> 1-3 minutes for simple documents, up to 5 minutes for complex multi-page files</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
              <label className="text-xl font-bold text-black">
                Document Type <span className="text-red-500">*</span>
              </label>
              <Select value={selectedDocumentType} onValueChange={setSelectedDocumentType}>
                <SelectTrigger className="w-full h-16 text-left text-lg font-bold text-black">
                  <SelectValue placeholder="Select the type of document you uploaded..." />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map((docType) => (
                    <SelectItem key={docType.value} value={docType.value} className="text-base font-medium">
                      {docType.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-600 font-medium">
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
        <Card className={`card-hover transition-all duration-500 ${
          isDragActive
            ? 'border-2 border-blue-500 bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 shadow-2xl scale-[1.02] ring-4 ring-blue-200 ring-opacity-50'
            : 'border-2 border-dashed border-gray-300 hover:border-emerald-400 hover:shadow-lg hover:scale-[1.01]'
        }`}>
        <CardContent className="p-10 sm:p-12">
          <div
            {...getRootProps()}
            className={`text-center cursor-pointer transition-all duration-300 ${
              isDragActive ? 'text-blue-600' : 'text-gray-600'
            } ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:text-blue-600'}`}
          >
            <input {...getInputProps()} />

            {/* Upload Icon with Enhanced Animation */}
            <div className={`mx-auto mb-6 transition-all duration-500 ${
              isDragActive ? 'scale-125 rotate-6' : 'hover:scale-110 hover:-rotate-3'
            }`}>
              <div className={`relative w-20 h-20 mx-auto rounded-2xl flex items-center justify-center transition-all duration-500 ${
                isDragActive
                  ? 'bg-gradient-to-br from-blue-100 to-indigo-200 border-2 border-blue-400 shadow-lg'
                  : 'bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 hover:border-emerald-300 hover:shadow-md'
              }`}>
                {isDragActive && (
                  <div className="absolute inset-0 rounded-2xl bg-blue-400 animate-ping opacity-20"></div>
                )}
                <Upload className={`w-10 h-10 transition-all duration-300 ${
                  isDragActive ? 'animate-bounce text-blue-600' : 'text-gray-400 group-hover:text-emerald-600'
                }`} />
              </div>
            </div>

            {isDragActive ? (
              <div className="space-y-3 animate-in fade-in-50 slide-in-from-top-2 duration-300">
                <p className="text-2xl font-bold text-blue-600 animate-pulse">Drop your document here! 🎯</p>
                <p className="text-base text-blue-500">Release to start processing instantly</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 bg-gradient-to-r from-gray-900 via-emerald-800 to-gray-900 bg-clip-text text-transparent">
                    {isProcessing ? 'Processing your document...' : 'Upload Your Real Estate Document'}
                  </p>
                  <p className="text-base text-gray-600 mb-6 max-w-lg mx-auto leading-relaxed">
                    Drag & drop your file here, or click to browse. We support rent rolls,
                    offering memos, lease agreements, and more.
                  </p>
                </div>

                <Button
                  className="px-8 py-3 text-lg font-semibold bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-600 hover:from-emerald-700 hover:via-emerald-800 hover:to-teal-700 focus-ring shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 mr-2" />
                      Choose File
                    </>
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
        <div className="space-y-4 animate-in slide-in-from-bottom-4 fade-in-50 duration-500">
          {Array.from(uploadingFiles.values()).map((file) => (
            <Card key={file.id} className="p-6 card-hover border border-gray-200 shadow-md hover:shadow-lg transition-all duration-300 animate-in slide-in-from-left-2 fade-in-50">
              <div className="flex items-center space-x-4">
                <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                  file.status === 'uploading'
                    ? 'bg-gradient-to-br from-blue-100 to-blue-200 ring-2 ring-blue-300 ring-opacity-50'
                    : file.status === 'uploaded'
                    ? 'bg-gradient-to-br from-green-100 to-emerald-200 ring-2 ring-green-300 ring-opacity-50 animate-in zoom-in-50 duration-500'
                    : 'bg-gradient-to-br from-red-100 to-red-200 ring-2 ring-red-300 ring-opacity-50'
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
                      <p className="text-xs text-gray-400">Uploading directly to secure storage (bypassing server limits)...</p>
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
