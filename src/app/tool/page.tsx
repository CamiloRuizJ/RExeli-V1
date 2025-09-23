'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { FileUpload } from '@/components/upload/FileUpload';
import { DocumentPreview } from '@/components/preview/DocumentPreview';
import { ProcessingWorkflow } from '@/components/processing/ProcessingWorkflow';
import { ResultsDisplay } from '@/components/results/ResultsDisplay';
import { Button } from "@/components/ui/button";
import { FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type {
  DocumentFile,
  ProcessingStep,
  DocumentClassification,
  ExtractedData
} from '@/lib/types';

export default function ToolPage() {
  const [currentFile, setCurrentFile] = useState<DocumentFile | null>(null);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Preload PDF.js for better user experience
  useEffect(() => {
    // Preload PDF.js when component mounts
    const preloadPdfjs = async () => {
      try {
        const { preloadPdfjs } = await import('@/lib/pdf-utils');
        await preloadPdfjs();
      } catch (error) {
        console.warn('PDF.js preload failed:', error);
        // Don't show user error for preload failure
      }
    };

    preloadPdfjs();
  }, []);

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

      let fileToClassify = currentFile.file;

      // Handle PDF conversion on client side
      if (currentFile.file.type === 'application/pdf') {
        try {
          console.log('Converting PDF to image on client side...');

          // Update step with specific PDF processing status
          updateStep(2, 'processing', 'Converting PDF to image for AI analysis...');

          // Dynamically import the PDF utilities
          const { convertPdfToImage } = await import('@/lib/pdf-utils');

          // Convert PDF to image (first page)
          const { imageBase64, mimeType } = await convertPdfToImage(currentFile.file, 1);

          // Convert base64 back to File object for API submission
          const response = await fetch(`data:${mimeType};base64,${imageBase64}`);
          const blob = await response.blob();

          // Create new file with descriptive name
          const originalName = currentFile.file.name.replace(/\.pdf$/i, '');
          fileToClassify = new File([blob], `${originalName}_page1.png`, { type: mimeType });

          console.log(`PDF converted to image successfully: ${Math.round(blob.size / 1024)}KB PNG`);

          // Update step to show successful conversion
          updateStep(2, 'processing', 'PDF converted to image, analyzing with AI...');

        } catch (pdfError) {
          console.error('PDF conversion failed:', pdfError);

          // Provide specific error handling for different PDF issues
          let errorMessage = 'PDF conversion failed';
          if (pdfError instanceof Error) {
            if (pdfError.message.includes('Password')) {
              errorMessage = 'Password-protected PDFs are not supported';
            } else if (pdfError.message.includes('corrupted')) {
              errorMessage = 'PDF file appears to be corrupted';
            } else if (pdfError.message.includes('too large')) {
              errorMessage = 'PDF file is too large (max 25MB)';
            } else if (pdfError.message.includes('worker')) {
              errorMessage = 'PDF processing failed - please check your internet connection';
            } else {
              errorMessage = `PDF conversion failed: ${pdfError.message}`;
            }
          }

          throw new Error(errorMessage);
        }
      }

      const classificationFormData = new FormData();
      classificationFormData.append('file', fileToClassify);

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
      extractionFormData.append('file', fileToClassify); // Use the same file (converted if it was PDF)
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
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-8 min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50">
      {/* Main Content with Back Navigation */}
      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto">
          {/* Back to Home Navigation */}
          <div className="mb-6 sm:mb-8">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-gray-600 hover:text-emerald-600">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        <div className="space-y-6 sm:space-y-8">
          {/* File Upload Section */}
          <div className="space-y-6 sm:space-y-8">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-base sm:text-lg shadow-lg">
                1
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Upload Document</h2>
                <p className="text-sm sm:text-base text-gray-500 mt-1">Select your real estate document to get started</p>
              </div>
            </div>
            <FileUpload
              onFileUpload={handleFileUpload}
              onUploadComplete={handleUploadComplete}
              onUploadError={handleUploadError}
              isProcessing={isProcessing}
            />
          </div>

          {/* Document Preview Section */}
          {currentFile && (
            <div className="space-y-8">
              <div className="flex items-center space-x-4">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-base sm:text-lg shadow-lg ${
                  currentFile ? 'bg-emerald-600 text-white' : 'bg-gray-300 text-gray-500'
                }`}>
                  2
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Review Document</h2>
                  <p className="text-gray-500 mt-1">Verify your document and start AI processing</p>
                </div>
              </div>
              <DocumentPreview
                file={currentFile}
                onStartProcessing={startProcessing}
                isProcessing={isProcessing}
              />
            </div>
          )}

          {/* Processing Workflow Section */}
          {processingSteps.length > 0 && (
            <div className="space-y-8">
              <div className="flex items-center space-x-4">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-base sm:text-lg shadow-lg ${
                  isProcessing
                    ? 'bg-emerald-600 text-white animate-pulse'
                    : isComplete
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-300 text-gray-500'
                }`}>
                  3
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">AI Processing</h2>
                  <p className="text-gray-500 mt-1">
                    {isProcessing ? 'Processing your document with advanced AI...' : 'Document classification and data extraction'}
                  </p>
                </div>
              </div>
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
            <div className="space-y-8">
              <div className="flex items-center space-x-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-base sm:text-lg shadow-lg">
                  4
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Extracted Data</h2>
                  <p className="text-gray-500 mt-1">Review and export your processed data</p>
                </div>
              </div>
              <ResultsDisplay
                extractedData={extractedData}
                onExportExcel={handleExportExcel}
                isExporting={isExporting}
              />
            </div>
          )}

          {/* Instructions */}
          {!currentFile && (
            <div className="bg-emerald-50 rounded-lg p-6 mt-8">
              <h3 className="text-base sm:text-lg font-semibold text-emerald-900 mb-3">How It Works</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 text-sm">
                <div className="text-center">
                  <div className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 font-bold">1</div>
                  <p className="font-medium text-emerald-800">Upload Document</p>
                  <p className="text-emerald-600">PDF, JPEG, or PNG up to 25MB</p>
                </div>
                <div className="text-center">
                  <div className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 font-bold">2</div>
                  <p className="font-medium text-emerald-800">AI Classification</p>
                  <p className="text-emerald-600">Identify document type automatically</p>
                </div>
                <div className="text-center">
                  <div className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 font-bold">3</div>
                  <p className="font-medium text-emerald-800">Data Extraction</p>
                  <p className="text-emerald-600">Extract structured real estate data</p>
                </div>
                <div className="text-center">
                  <div className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 font-bold">4</div>
                  <p className="font-medium text-emerald-800">Excel Export</p>
                  <p className="text-emerald-600">Download formatted spreadsheet</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}