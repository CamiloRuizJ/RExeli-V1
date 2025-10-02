'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BatchUpload from './BatchUpload';
import DocumentList from './DocumentList';
import MetricsDashboard from './MetricsDashboard';
import { Upload, FileText, BarChart3 } from 'lucide-react';

export default function TrainingDashboard() {
  const [activeTab, setActiveTab] = useState('upload');

  return (
    <div className="w-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="upload" className="flex items-center space-x-2">
            <Upload className="w-4 h-4" />
            <span>Upload Documents</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center space-x-2">
            <FileText className="w-4 h-4" />
            <span>Document Library</span>
          </TabsTrigger>
          <TabsTrigger value="metrics" className="flex items-center space-x-2">
            <BarChart3 className="w-4 h-4" />
            <span>Analytics & Metrics</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Upload Training Documents
            </h2>
            <p className="text-gray-600 mb-6">
              Upload documents to train and improve the AI extraction models. Select a document type and upload multiple files at once.
            </p>
            <BatchUpload />
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Training Document Library
            </h2>
            <p className="text-gray-600 mb-6">
              View, manage, and verify all uploaded training documents. Track processing status and review extraction results.
            </p>
            <DocumentList />
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="mt-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Training Analytics & Metrics
            </h2>
            <p className="text-gray-600 mb-6">
              Monitor training data collection progress, extraction quality, and overall system performance.
            </p>
            <MetricsDashboard />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
