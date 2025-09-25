'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  DocumentType,
  ExtractedData
} from '@/lib/types';

export default function ToolPage() {
  const [currentFile, setCurrentFile] = useState<DocumentFile | null>(null);
  const [selectedDocumentType, setSelectedDocumentType] = useState<DocumentType | null>(null);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Refs for auto-scrolling
  const documentPreviewRef = useRef<HTMLDivElement>(null);
  const processingWorkflowRef = useRef<HTMLDivElement>(null);
  const resultsDisplayRef = useRef<HTMLDivElement>(null);

  // Smooth scroll function with offset for better visibility
  const scrollToElement = useCallback((elementRef: React.RefObject<HTMLDivElement | null>, offset = 80) => {
    if (elementRef.current) {
      const element = elementRef.current;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  }, []);

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

  // Initialize processing steps (removed auto-classification)
  const initializeSteps = useCallback((documentType: string): ProcessingStep[] => {
    const docTypeLabel = documentType.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');

    return [
      {
        id: 1,
        name: "Document Preparation",
        description: `Preparing ${docTypeLabel} document for AI processing`,
        status: 'pending'
      },
      {
        id: 2,
        name: "Data Extraction",
        description: `Extracting structured ${docTypeLabel.toLowerCase()} data using AI`,
        status: 'pending'
      },
      {
        id: 3,
        name: "Data Validation",
        description: "Validating extracted data for accuracy and completeness",
        status: 'pending'
      },
      {
        id: 4,
        name: "Results Preparation",
        description: "Preparing extracted data for display and Excel export",
        status: 'pending'
      }
    ];
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback((file: DocumentFile) => {
    setCurrentFile(file);
    setSelectedDocumentType(null);
    setProcessingSteps([]);
    setCurrentStep(0);
    setIsProcessing(false);
    setIsComplete(false);
    setExtractedData(null);
  }, []);

  // Handle upload completion with document type
  const handleUploadComplete = useCallback((file: DocumentFile, documentType: DocumentType) => {
    setCurrentFile(file);
    setSelectedDocumentType(documentType);
    toast.success(`Document uploaded and classified as ${documentType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}! Ready for AI processing.`);

    // Auto-scroll to document preview section after a brief delay
    setTimeout(() => {
      scrollToElement(documentPreviewRef, 100);
    }, 500);
  }, [scrollToElement]);

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

  // Start AI processing (now skips classification)
  const startProcessing = useCallback(async () => {
    if (!currentFile || !selectedDocumentType) return;

    setIsProcessing(true);
    setIsComplete(false);
    setExtractedData(null);

    const steps = initializeSteps(selectedDocumentType);
    setProcessingSteps(steps);
    setCurrentStep(1);

    // Auto-scroll to processing section when processing starts
    setTimeout(() => {
      scrollToElement(processingWorkflowRef, 100);
    }, 300);

    try {
      // Step 1: Document Preparation
      updateStep(1, 'processing');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing

      let fileToProcess = currentFile.file;

      // Handle PDF conversion on client side if needed
      if (currentFile.file.type === 'application/pdf') {
        try {
          console.log('Converting PDF to image on client side...');

          // Update step with specific PDF processing status
          updateStep(1, 'processing', 'Converting PDF to image for AI analysis...');

          // Dynamically import the PDF utilities
          const { convertPdfToImage } = await import('@/lib/pdf-utils');

          // Convert PDF to image (first page)
          const { imageBase64, mimeType } = await convertPdfToImage(currentFile.file, 1);

          // Convert base64 back to File object for API submission
          const response = await fetch(`data:${mimeType};base64,${imageBase64}`);
          const blob = await response.blob();

          // Create new file with descriptive name
          const originalName = currentFile.file.name.replace(/\.pdf$/i, '');
          fileToProcess = new File([blob], `${originalName}_page1.png`, { type: mimeType });

          console.log(`PDF converted to image successfully: ${Math.round(blob.size / 1024)}KB PNG`);

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

      updateStep(1, 'completed', 'Document prepared for processing');
      setCurrentStep(2);

      // Step 2: Data Extraction (skip classification, use selected document type)
      updateStep(2, 'processing');

      // Auto-scroll to keep processing section visible during step 2
      setTimeout(() => {
        scrollToElement(processingWorkflowRef, 80);
      }, 200);

      const extractionFormData = new FormData();
      extractionFormData.append('file', fileToProcess);
      extractionFormData.append('documentType', selectedDocumentType);

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
      updateStep(2, 'completed', `Extracted ${Object.keys(extracted.data || {}).length} data fields`);
      setCurrentStep(3);

      // Step 3: Data Validation
      updateStep(3, 'processing');

      // Auto-scroll to keep processing section visible during step 3
      setTimeout(() => {
        scrollToElement(processingWorkflowRef, 80);
      }, 200);
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate validation
      updateStep(3, 'completed', 'Data validation completed successfully');
      setCurrentStep(4);

      // Step 4: Results Preparation
      updateStep(4, 'processing');

      // Auto-scroll to keep processing section visible during step 4
      setTimeout(() => {
        scrollToElement(processingWorkflowRef, 80);
      }, 200);
      setExtractedData(extracted);
      await new Promise(resolve => setTimeout(resolve, 1000));
      updateStep(4, 'completed', 'Results prepared for display and export');

      setIsComplete(true);
      setIsProcessing(false);
      toast.success('AI processing completed successfully! Your data is ready.');

      // Auto-scroll to results section when processing completes
      setTimeout(() => {
        scrollToElement(resultsDisplayRef, 100);
      }, 800);

    } catch (error) {
      console.error('Processing error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';

      // Mark current step as error
      const currentStepId = Math.max(1, currentStep);
      updateStep(currentStepId, 'error', errorMessage);

      setIsProcessing(false);
      toast.error(`Processing failed: ${errorMessage}`);
    }
  }, [currentFile, selectedDocumentType, initializeSteps, updateStep, currentStep, scrollToElement]);

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
            <div ref={documentPreviewRef} className="space-y-8">
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
            <div ref={processingWorkflowRef} className="space-y-8">
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
            <div ref={resultsDisplayRef} className="space-y-8">
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
                  <p className="font-medium text-emerald-800">Document Selection</p>
                  <p className="text-emerald-600">Choose your document type manually</p>
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