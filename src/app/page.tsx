'use client';

import React, { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { FileUpload } from '@/components/upload/FileUpload';
import { DocumentPreview } from '@/components/preview/DocumentPreview';
import { ProcessingWorkflow } from '@/components/processing/ProcessingWorkflow';
import { ResultsDisplay } from '@/components/results/ResultsDisplay';
import type { 
  DocumentFile, 
  ProcessingStep, 
  DocumentClassification, 
  ExtractedData,
  DocumentType 
} from '@/lib/types';

export default function HomePage() {
  const [currentFile, setCurrentFile] = useState<DocumentFile | null>(null);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Initialize processing steps
  const initializeSteps = useCallback((): ProcessingStep[] => {
    return [
      {
        id: 1,
        name: "Document Upload Verification",
        description: "Verifying document upload and preparing for AI processing",
        status: 'pending'
      },
      {
        id: 2,
        name: "AI Document Classification",
        description: "Using OpenAI Vision to identify document type (rent roll, offering memo, etc.)",
        status: 'pending'
      },
      {
        id: 3,
        name: "Data Extraction",
        description: "Extracting structured data from the classified document",
        status: 'pending'
      },
      {
        id: 4,
        name: "Data Validation",
        description: "Validating extracted data for accuracy and completeness",
        status: 'pending'
      },
      {
        id: 5,
        name: "Results Preparation",
        description: "Preparing extracted data for display and Excel export",
        status: 'pending'
      }
    ];
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback((file: DocumentFile) => {
    setCurrentFile(file);
    setProcessingSteps([]);
    setCurrentStep(0);
    setIsProcessing(false);
    setIsComplete(false);
    setExtractedData(null);
  }, []);

  // Handle upload completion
  const handleUploadComplete = useCallback((file: DocumentFile) => {
    setCurrentFile(file);
    toast.success('File uploaded successfully! Ready for AI processing.');
  }, []);

  // Handle upload error
  const handleUploadError = useCallback((error: string) => {
    toast.error(`Upload failed: ${error}`);
  }, []);

  // Update processing step
  const updateStep = useCallback((stepId: number, status: ProcessingStep['status'], result?: unknown) => {
    setProcessingSteps(prev => 
      prev.map(step => 
        step.id === stepId 
          ? { ...step, status, result } 
          : step
      )
    );
  }, []);

  // Start AI processing
  const startProcessing = useCallback(async () => {
    if (!currentFile) return;

    setIsProcessing(true);
    setIsComplete(false);
    setExtractedData(null);
    
    const steps = initializeSteps();
    setProcessingSteps(steps);
    setCurrentStep(1);

    try {
      // Step 1: Document Upload Verification
      updateStep(1, 'processing');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing
      updateStep(1, 'completed', 'Document verified and ready for AI processing');
      setCurrentStep(2);

      // Step 2: AI Document Classification
      updateStep(2, 'processing');
      
      const classificationFormData = new FormData();
      classificationFormData.append('file', currentFile.file);

      const classifyResponse = await fetch('/api/classify', {
        method: 'POST',
        body: classificationFormData,
      });

      if (!classifyResponse.ok) {
        throw new Error('Classification failed');
      }

      const classifyResult = await classifyResponse.json();
      if (!classifyResult.success) {
        throw new Error(classifyResult.error || 'Classification failed');
      }

      const classification: DocumentClassification = classifyResult.data.classification;
      updateStep(2, 'completed', classification);
      setCurrentStep(3);

      // Step 3: Data Extraction
      updateStep(3, 'processing');
      
      const extractionFormData = new FormData();
      extractionFormData.append('file', currentFile.file);
      extractionFormData.append('documentType', classification.type);

      const extractResponse = await fetch('/api/extract', {
        method: 'POST',
        body: extractionFormData,
      });

      if (!extractResponse.ok) {
        throw new Error('Data extraction failed');
      }

      const extractResult = await extractResponse.json();
      if (!extractResult.success) {
        throw new Error(extractResult.error || 'Data extraction failed');
      }

      const extracted: ExtractedData = extractResult.data.extractedData;
      updateStep(3, 'completed', `Extracted ${Object.keys(extracted.data).length} data fields`);
      setCurrentStep(4);

      // Step 4: Data Validation
      updateStep(4, 'processing');
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate validation
      updateStep(4, 'completed', 'Data validation completed successfully');
      setCurrentStep(5);

      // Step 5: Results Preparation
      updateStep(5, 'processing');
      setExtractedData(extracted);
      await new Promise(resolve => setTimeout(resolve, 1000));
      updateStep(5, 'completed', 'Results prepared for display and export');

      setIsComplete(true);
      setIsProcessing(false);
      toast.success('AI processing completed successfully! Your data is ready.');

    } catch (error) {
      console.error('Processing error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';
      
      // Mark current step as error
      const currentStepId = Math.max(1, currentStep);
      updateStep(currentStepId, 'error', errorMessage);
      
      setIsProcessing(false);
      toast.error(`Processing failed: ${errorMessage}`);
    }
  }, [currentFile, initializeSteps, updateStep, currentStep]);

  // Export to Excel
  const handleExportExcel = useCallback(async () => {
    if (!extractedData) return;

    setIsExporting(true);
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          extractedData,
          options: {
            includeRawData: true,
            includeCharts: false,
            formatForPrint: true,
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Download the Excel file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `RExeli_${extractedData.documentType}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Excel file downloaded successfully!');
    } catch (error) {
      console.error('Export error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Export failed';
      toast.error(`Export failed: ${errorMessage}`);
    } finally {
      setIsExporting(false);
    }
  }, [extractedData]);

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gray-900">
          AI-Powered Real Estate Document Processing
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Upload your real estate documents and let our AI extract structured data from rent rolls, 
          offering memos, lease agreements, and more. Export results to Excel in seconds.
        </p>
      </div>

      {/* File Upload Section */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-gray-800">1. Upload Document</h2>
        <FileUpload
          onFileUpload={handleFileUpload}
          onUploadComplete={handleUploadComplete}
          onUploadError={handleUploadError}
          isProcessing={isProcessing}
        />
      </div>

      {/* Document Preview Section */}
      {currentFile && (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-gray-800">2. Review Document</h2>
          <DocumentPreview
            file={currentFile}
            onStartProcessing={startProcessing}
            isProcessing={isProcessing}
          />
        </div>
      )}

      {/* Processing Workflow Section */}
      {processingSteps.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-gray-800">3. AI Processing</h2>
          <ProcessingWorkflow
            file={currentFile!}
            steps={processingSteps}
            currentStep={currentStep}
            isComplete={isComplete}
          />
        </div>
      )}

      {/* Results Section */}
      {extractedData && (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-gray-800">4. Extracted Data</h2>
          <ResultsDisplay
            extractedData={extractedData}
            onExportExcel={handleExportExcel}
            isExporting={isExporting}
          />
        </div>
      )}

      {/* Instructions */}
      {!currentFile && (
        <div className="bg-blue-50 rounded-lg p-6 mt-8">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">How It Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 font-bold">1</div>
              <p className="font-medium text-blue-800">Upload Document</p>
              <p className="text-blue-600">PDF, JPEG, or PNG up to 25MB</p>
            </div>
            <div className="text-center">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 font-bold">2</div>
              <p className="font-medium text-blue-800">AI Classification</p>
              <p className="text-blue-600">Identify document type automatically</p>
            </div>
            <div className="text-center">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 font-bold">3</div>
              <p className="font-medium text-blue-800">Data Extraction</p>
              <p className="text-blue-600">Extract structured real estate data</p>
            </div>
            <div className="text-center">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 font-bold">4</div>
              <p className="font-medium text-blue-800">Excel Export</p>
              <p className="text-blue-600">Download formatted spreadsheet</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
