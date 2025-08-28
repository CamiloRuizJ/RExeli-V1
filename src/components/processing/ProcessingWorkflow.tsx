'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, RotateCw, AlertCircle, Clock, FileText, Brain, Database, FileSpreadsheet, Eye } from 'lucide-react';
import type { ProcessingStep, DocumentFile } from '@/lib/types';

interface ProcessingWorkflowProps {
  file: DocumentFile;
  steps: ProcessingStep[];
  currentStep: number;
  isComplete: boolean;
}

const STEP_ICONS = {
  1: FileText,
  2: Brain,
  3: Database,
  4: FileSpreadsheet,
  5: Eye
};

export function ProcessingWorkflow({ file, steps, currentStep, isComplete }: ProcessingWorkflowProps) {
  const getStepIcon = (stepId: number, status: ProcessingStep['status']) => {
    const IconComponent = STEP_ICONS[stepId as keyof typeof STEP_ICONS] || Clock;
    
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'processing':
        return <RotateCw className="w-6 h-6 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-6 h-6 text-red-500" />;
      default:
        return <IconComponent className="w-6 h-6 text-gray-400" />;
    }
  };

  const getStepColor = (status: ProcessingStep['status']) => {
    switch (status) {
      case 'completed':
        return 'border-green-200 bg-green-50';
      case 'processing':
        return 'border-blue-200 bg-blue-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const getProgressValue = () => {
    if (isComplete) return 100;
    if (steps.length === 0) return 0;
    
    const completedSteps = steps.filter(step => step.status === 'completed').length;
    return Math.round((completedSteps / steps.length) * 100);
  };

  const getOverallStatus = () => {
    if (isComplete) return 'Processing Complete';
    if (steps.some(step => step.status === 'error')) return 'Processing Error';
    if (steps.some(step => step.status === 'processing')) return 'Processing in Progress';
    return 'Waiting to Start';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>AI Processing Workflow</span>
          <span className="text-sm font-normal text-gray-500">
            {file.name}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">{getOverallStatus()}</span>
            <span className="text-gray-500">{getProgressValue()}%</span>
          </div>
          <Progress value={getProgressValue()} className="h-2" />
        </div>

        {/* Processing Steps */}
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={step.id} className="relative">
              <div className={`flex items-start space-x-4 p-4 rounded-lg border transition-colors duration-200 ${getStepColor(step.status)}`}>
                <div className="flex-shrink-0 mt-1">
                  {getStepIcon(step.id, step.status)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-medium text-gray-900">
                      Step {step.id}: {step.name}
                    </h3>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      step.status === 'completed' ? 'bg-green-100 text-green-800' :
                      step.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                      step.status === 'error' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {step.status === 'processing' ? 'In Progress' : step.status.charAt(0).toUpperCase() + step.status.slice(1)}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-2">
                    {step.description}
                  </p>
                  
                  {step.status === 'completed' && step.result != null ? (
                    <div className="mt-3 p-3 bg-white rounded border">
                      <div className="text-xs font-medium text-gray-700 mb-1">Result:</div>
                      {typeof step.result === 'string' ? (
                        <p className="text-sm text-gray-600">{step.result}</p>
                      ) : typeof step.result === 'object' && step.result !== null && 'type' in step.result ? (
                        <div className="space-y-1">
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Document Type:</span> {String((step.result as Record<string, unknown>).type).replace('_', ' ')}
                          </p>
                          {typeof (step.result as Record<string, unknown>).confidence === 'number' && (
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Confidence:</span> {((step.result as Record<string, unknown>).confidence as number * 100).toFixed(1)}%
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-600">
                          <pre className="whitespace-pre-wrap text-xs">
                            {JSON.stringify(step.result, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : null}
                  
                  {step.status === 'error' && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                      <div className="text-xs font-medium text-red-700 mb-1">Error:</div>
                      <p className="text-sm text-red-600">
                        {typeof step.result === 'string' ? step.result : 'An error occurred during processing'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="absolute left-7 top-16 w-0.5 h-6 bg-gray-200"></div>
              )}
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="pt-4 border-t">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Total Steps:</span>
              <span className="ml-2 text-gray-600">{steps.length}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Completed:</span>
              <span className="ml-2 text-gray-600">
                {steps.filter(step => step.status === 'completed').length}
              </span>
            </div>
          </div>
          
          {isComplete && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-green-800">
                  Processing completed successfully! Your data is ready for export.
                </span>
              </div>
            </div>
          )}
          
          {steps.some(step => step.status === 'error') && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium text-red-800">
                  Processing encountered errors. Please check the step details above.
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}