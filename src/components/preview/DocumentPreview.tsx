'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Eye, Download, RotateCw } from 'lucide-react';
import type { DocumentFile } from '@/lib/types';

interface DocumentPreviewProps {
  file: DocumentFile;
  onStartProcessing: () => void;
  isProcessing: boolean;
}

export function DocumentPreview({ file, onStartProcessing, isProcessing }: DocumentPreviewProps) {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileTypeDisplay = (type: string): string => {
    switch (type) {
      case 'application/pdf':
        return 'PDF Document';
      case 'image/jpeg':
      case 'image/jpg':
        return 'JPEG Image';
      case 'image/png':
        return 'PNG Image';
      default:
        return 'Document';
    }
  };

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  const handleImageError = () => {
    setImageLoading(false);
    setImageError(true);
  };

  const openInNewTab = () => {
    if (file.supabaseUrl) {
      window.open(file.supabaseUrl, '_blank');
    }
  };

  const downloadFile = () => {
    if (file.supabaseUrl) {
      const link = document.createElement('a');
      link.href = file.supabaseUrl;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Document Info */}
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5" />
              <span>Document Details</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">File Name</label>
              <p className="text-sm text-gray-900 break-all">{file.name}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-500">File Type</label>
              <p className="text-sm text-gray-900">{getFileTypeDisplay(file.type)}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-500">File Size</label>
              <p className="text-sm text-gray-900">{formatFileSize(file.size)}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-500">Status</label>
              <p className={`text-sm font-medium ${
                file.status === 'uploaded' ? 'text-green-600' : 
                file.status === 'error' ? 'text-red-600' : 
                'text-blue-600'
              }`}>
                {file.status.charAt(0).toUpperCase() + file.status.slice(1)}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-4">
              <Button 
                onClick={onStartProcessing}
                className="w-full"
                disabled={isProcessing || file.status !== 'uploaded'}
              >
                {isProcessing ? (
                  <>
                    <RotateCw className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    Start AI Processing
                  </>
                )}
              </Button>
              
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={openInNewTab}
                  disabled={!file.supabaseUrl}
                  className="flex-1"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  View
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={downloadFile}
                  disabled={!file.supabaseUrl}
                  className="flex-1"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Document Preview */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Document Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {file.supabaseUrl ? (
              <div className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ minHeight: '400px' }}>
                {file.type.startsWith('image/') ? (
                  // Image Preview
                  <div className="relative">
                    {imageLoading && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    )}
                    {!imageError ? (
                      <img
                        src={file.supabaseUrl}
                        alt={file.name}
                        className={`w-full h-auto max-h-[600px] object-contain ${imageLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
                        onLoad={handleImageLoad}
                        onError={handleImageError}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12">
                        <FileText className="w-16 h-16 text-gray-400 mb-4" />
                        <p className="text-gray-500 text-center">
                          Unable to preview this image.<br />
                          <span className="text-sm">Use the View button to open in a new tab.</span>
                        </p>
                      </div>
                    )}
                  </div>
                ) : file.type === 'application/pdf' ? (
                  // PDF Preview using iframe
                  <div className="w-full h-[600px]">
                    <iframe
                      src={`${file.supabaseUrl}#view=FitH`}
                      className="w-full h-full border-0 rounded"
                      title={`Preview of ${file.name}`}
                    />
                  </div>
                ) : (
                  // Generic file preview
                  <div className="flex flex-col items-center justify-center py-12">
                    <FileText className="w-16 h-16 text-gray-400 mb-4" />
                    <p className="text-gray-500 text-center">
                      Preview not available for this file type.<br />
                      <span className="text-sm">Use the View button to open the document.</span>
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-lg">
                <FileText className="w-16 h-16 text-gray-300 mb-4" />
                <p className="text-gray-500">Document preview will appear here after upload completes</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}