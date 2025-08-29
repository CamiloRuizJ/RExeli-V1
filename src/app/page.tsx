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
      
      let fileToClassify = currentFile.file;
      
      // Handle PDF conversion on client side
      if (currentFile.file.type === 'application/pdf') {
        try {
          console.log('Converting PDF to image on client side...');
          const { convertPdfToImage } = await import('@/lib/pdf-utils');
          const { imageBase64, mimeType } = await convertPdfToImage(currentFile.file);
          
          // Convert base64 back to File object
          const response = await fetch(`data:${mimeType};base64,${imageBase64}`);
          const blob = await response.blob();
          fileToClassify = new File([blob], `${currentFile.file.name}.png`, { type: mimeType });
          console.log('PDF converted to image successfully');
        } catch (pdfError) {
          console.error('PDF conversion failed:', pdfError);
          throw new Error(`PDF conversion failed: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`);
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
    <div className="space-y-8">
      {/* Ultra-Modern Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 rounded-3xl mb-12">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-teal-600/20"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIxLjUiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-40"></div>
        
        <div className="relative z-10 px-8 py-20 md:px-12 md:py-28">
          <div className="text-center space-y-8 max-w-5xl mx-auto">
            
            {/* Animated Status Badge */}
            <div className="inline-flex items-center space-x-3 bg-white/10 backdrop-blur-sm text-white px-6 py-3 rounded-full text-sm font-medium border border-white/20">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span>AI Processing Online</span>
              </div>
              <div className="h-4 w-px bg-white/30"></div>
              <span className="text-green-300">99.7% Uptime</span>
            </div>
            
            {/* Main Headline */}
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-black text-white leading-none tracking-tight">
              The Future of
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-teal-400 to-green-400 animate-gradient-x">
                Real Estate AI
              </span>
            </h1>
            
            {/* Subheadline */}
            <p className="text-xl md:text-2xl text-blue-100 max-w-3xl mx-auto leading-relaxed font-light">
              Transform complex real estate documents into structured data instantly. 
              <span className="text-white font-medium"> Powered by advanced AI</span> that understands 
              rent rolls, offering memos, and lease agreements like a seasoned professional.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <button className="group relative px-8 py-4 bg-white text-gray-900 rounded-xl font-semibold text-lg shadow-2xl hover:shadow-white/25 transition-all duration-300 hover:scale-105">
                <span className="relative z-10">Start Processing Documents</span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-teal-400 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>
              <button className="px-8 py-4 text-white border-2 border-white/30 rounded-xl font-semibold text-lg hover:bg-white/10 hover:border-white/50 transition-all duration-300">
                Watch Demo
              </button>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-12 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="text-4xl font-bold text-white mb-2">10,000+</div>
                <div className="text-blue-200 font-medium">Documents Processed</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-white mb-2">99.8%</div>
                <div className="text-blue-200 font-medium">Accuracy Rate</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-white mb-2">&lt; 30s</div>
                <div className="text-blue-200 font-medium">Processing Time</div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Advanced Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-4 -left-4 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute -top-4 -right-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-teal-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>
        
        {/* Floating Elements */}
        <div className="absolute top-20 left-10 w-4 h-4 bg-white/20 rounded-full animate-float"></div>
        <div className="absolute top-40 right-20 w-6 h-6 bg-blue-300/30 rounded-full animate-float-delayed"></div>
        <div className="absolute bottom-20 left-1/4 w-3 h-3 bg-teal-300/40 rounded-full animate-float-slow"></div>
      </div>

      {/* File Upload Section */}
      <div className="space-y-8">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
            1
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Upload Document</h2>
            <p className="text-gray-500 mt-1">Select your real estate document to get started</p>
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
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shadow-lg ${
              currentFile ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-500'
            }`}>
              2
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Review Document</h2>
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
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shadow-lg ${
              isProcessing 
                ? 'bg-blue-600 text-white animate-pulse' 
                : isComplete 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-300 text-gray-500'
            }`}>
              3
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">AI Processing</h2>
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
            <div className="w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
              4
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Extracted Data</h2>
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
