// Core TypeScript definitions for RExeli V1

export interface DocumentFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  uploadProgress: number;
  status: 'uploading' | 'uploaded' | 'processing' | 'completed' | 'error';
  supabaseUrl?: string;
}

export interface ProcessingStep {
  id: number;
  name: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  result?: unknown;
}

export interface DocumentClassification {
  type: DocumentType;
  confidence: number;
  reasoning: string;
}

export type DocumentType =
  | 'rent_roll'
  | 'operating_budget'
  | 'broker_sales_comparables'
  | 'broker_lease_comparables'
  | 'broker_listing'
  | 'offering_memo'
  | 'lease_agreement'
  | 'financial_statements'
  // Legacy types for backward compatibility
  | 'comparable_sales'
  | 'financial_statement'
  | 'unknown';

export interface ExtractedData {
  documentType: DocumentType;
  metadata: {
    propertyName?: string;
    propertyAddress?: string;
    totalSquareFeet?: number;
    totalUnits?: number;
    extractedDate: string;
  };
  data: RentRollData | OperatingBudgetData | BrokerSalesComparablesData | BrokerLeaseComparablesData | BrokerListingData | OfferingMemoData | LeaseData | FinancialStatementsData | ComparableData | FinancialData;
}

export interface RentRollData {
  tenants: {
    tenantName: string;
    suiteUnit: string;
    leaseStart: string;
    leaseEnd: string;
    rentCommencementDate?: string;
    baseRent: number;
    rentEscalations?: string;
    leaseType: 'NNN' | 'Gross' | 'Modified Gross';
    camReimbursements?: number;
    securityDeposit?: number;
    renewalOptions?: string;
    freeRentConcessions?: string;
    squareFootage: number;
    occupancyStatus: 'occupied' | 'vacant' | 'notice';
  }[];
  summary: {
    totalRent: number;
    occupancyRate: number;
    totalSquareFeet: number;
    averageRentPsf: number;
    totalUnits: number;
    vacantUnits: number;
  };
}

export interface OfferingMemoData {
  propertyOverview: {
    name: string;
    address: string;
    propertyType: string;
    yearBuilt?: number;
    totalSquareFeet: number;
    lotSize?: number;
  };
  investmentHighlights: string[];
  marketOverview: string;
  rentRollSummary: {
    totalUnits: number;
    occupancyRate: number;
    averageRent: number;
  };
  operatingStatement: {
    grossIncome: number;
    operatingExpenses: number;
    noi: number;
  };
  leaseTerms: string[];
  comparables: {
    address: string;
    salePrice: number;
    capRate: number;
  }[];
  pricing: {
    askingPrice: number;
    capRate?: number;
    pricePerSF?: number;
  };
  locationData: {
    neighborhood: string;
    demographics?: string;
    transportation?: string;
  };
}

export interface LeaseData {
  parties: {
    tenant: string;
    landlord: string;
  };
  premises: {
    propertyAddress: string;
    squareFeet: number;
    description: string;
  };
  leaseTerm: {
    startDate: string;
    endDate: string;
    termMonths: number;
  };
  rentSchedule: {
    baseRent: number;
    rentEscalations?: string;
    rentPerSqFt: number;
  };
  operatingExpenses: {
    responsibilityType: 'NNN' | 'Gross' | 'Modified Gross';
    camCharges?: number;
    utilities?: string;
    taxes?: string;
    insurance?: string;
  };
  securityDeposit?: number;
  renewalOptions?: string[];
  maintenanceObligations: {
    landlord: string[];
    tenant: string[];
  };
  assignmentProvisions?: string;
  defaultRemedies: string[];
  insuranceRequirements: string[];
}

// New specialized document type interfaces
export interface OperatingBudgetData {
  period: string;
  income: {
    grossRentalIncome: number;
    vacancyAllowance: number;
    effectiveGrossIncome: number;
    otherIncome: number;
    totalIncome: number;
  };
  expenses: {
    propertyTaxes: number;
    insurance: number;
    utilities: number;
    maintenance: number;
    management: number;
    marketing: number;
    totalOperatingExpenses: number;
  };
  noi: number;
  capexForecast: number;
  cashFlow: number;
}

export interface BrokerSalesComparablesData {
  comparables: {
    propertyAddress: string;
    propertyType: string;
    saleDate: string;
    salePrice: number;
    pricePerSF: number;
    pricePerUnit?: number;
    buildingSize: number;
    landSize?: number;
    yearBuilt?: number;
    yearRenovated?: number;
    occupancyAtSale: number;
    capRate?: number;
    noiAtSale?: number;
    buyer?: string;
    seller?: string;
  }[];
  summary: {
    averagePricePerSF: number;
    averageCapRate?: number;
    priceRange: {
      min: number;
      max: number;
    };
  };
}

export interface BrokerLeaseComparablesData {
  comparables: {
    propertyAddress: string;
    propertyType: string;
    leaseCommencementDate: string;
    tenantIndustry: string;
    leaseTerm: number; // in months
    squareFootage: number;
    baseRent: number;
    rentEscalations?: string;
    leaseType: 'NNN' | 'Gross' | 'Modified Gross';
    concessions?: string;
    effectiveRent: number;
  }[];
  summary: {
    averageBaseRent: number;
    averageEffectiveRent: number;
    rentRange: {
      min: number;
      max: number;
    };
  };
}

export interface BrokerListingData {
  listingDetails: {
    propertyOwner: string;
    brokerFirm: string;
    brokerName?: string;
    listingPrice?: number;
    askingRent?: number;
    listingType: 'sale' | 'lease';
    commissionStructure: string;
    listingTerm: string;
    listingDate?: string;
    expirationDate?: string;
  };
  propertyDetails: {
    address: string;
    propertyType: string;
    squareFootage: number;
    lotSize?: number;
    yearBuilt?: number;
    parking?: string;
    zoning?: string;
  };
  brokerDuties: string[];
  terminationProvisions: string[];
}

export interface FinancialStatementsData {
  period: string;
  operatingIncome: {
    rentalIncome: number;
    otherIncome: number;
    totalIncome: number;
    vacancyLoss: number;
    effectiveGrossIncome: number;
  };
  operatingExpenses: {
    propertyTaxes: number;
    insurance: number;
    utilities: number;
    maintenance: number;
    management: number;
    professionalFees: number;
    otherExpenses: number;
    totalExpenses: number;
  };
  noi: number;
  debtService?: number;
  cashFlow?: number;
  balanceSheet?: {
    assets: {
      realEstate: number;
      cash: number;
      otherAssets: number;
      totalAssets: number;
    };
    liabilities: {
      mortgage: number;
      otherLiabilities: number;
      totalLiabilities: number;
    };
    equity: number;
  };
  capex?: {
    currentYear: number;
    forecast: number[];
  };
}

// Legacy types for backward compatibility
export interface ComparableData {
  properties: {
    address: string;
    salePrice: number;
    saleDate: string;
    squareFeet: number;
    pricePerSqFt: number;
    propertyType: string;
    yearBuilt?: number;
  }[];
}

export interface FinancialData {
  period: string;
  revenue: {
    grossRent: number;
    otherIncome: number;
    totalRevenue: number;
  };
  expenses: {
    operatingExpenses: number;
    maintenance: number;
    insurance: number;
    taxes: number;
    utilities: number;
    management: number;
    totalExpenses: number;
  };
  netOperatingIncome: number;
}

export interface ProcessingSession {
  id: string;
  documentId: string;
  steps: ProcessingStep[];
  classification?: DocumentClassification;
  extractedData?: ExtractedData;
  createdAt: string;
  updatedAt: string;
}

export interface ExcelExportOptions {
  includeRawData: boolean;
  includeCharts: boolean;
  formatForPrint: boolean;
  documentType: DocumentType;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface UploadResponse {
  fileId: string;
  url: string;
  filename: string;
  size: number;
}

export interface ClassificationResponse {
  classification: DocumentClassification;
  extractionPrompt: string;
}

export interface ExtractionResponse {
  extractedData: ExtractedData;
  processingTime: number;
}

export interface ExportResponse {
  downloadUrl: string;
  filename: string;
  expiresAt: string;
}

// =====================================================
// AI Training System Types
// =====================================================

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type VerificationStatus = 'unverified' | 'in_review' | 'verified' | 'rejected';
export type DatasetSplit = 'train' | 'validation' | 'test';
export type VerificationAction = 'verify' | 'reject' | 'edit' | 'recheck';
export type TrainingStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface TrainingDocument {
  id: string;

  // File information
  file_path: string;
  file_name: string;
  file_url: string;
  file_size?: number;
  file_type?: string;
  document_type: DocumentType;

  // Processing status
  upload_date: string;
  processing_status: ProcessingStatus;
  processed_date?: string;
  error_message?: string;
  retry_count: number;

  // Extraction data
  raw_extraction?: ExtractedData;
  verified_extraction?: ExtractedData;
  extraction_confidence?: number;

  // Verification workflow
  verification_status: VerificationStatus;
  is_verified: boolean;
  verified_by?: string;
  verified_date?: string;
  verification_notes?: string;
  requires_recheck: boolean;

  // Training metadata
  dataset_split: DatasetSplit;
  training_version: number;
  include_in_training: boolean;
  quality_score?: number; // 0-1 score

  // Audit
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface TrainingMetrics {
  id: string;
  document_type: DocumentType;

  // Document counts
  total_documents: number;
  pending_documents: number;
  processing_documents: number;
  completed_documents: number;
  failed_documents: number;

  // Verification counts
  unverified_documents: number;
  verified_documents: number;
  rejected_documents: number;

  // Dataset split counts
  train_set_size: number;
  validation_set_size: number;
  test_set_size: number;

  // Quality metrics
  average_confidence?: number;
  average_quality_score?: number;
  ready_for_training: boolean;
  minimum_examples_met: boolean;

  // Training history
  last_export_date?: string;
  last_training_date?: string;
  training_runs: number;

  last_updated: string;
}

export interface TrainingRun {
  id: string;
  document_type: DocumentType;

  // Run metadata
  run_date: string;
  total_examples?: number;
  train_examples?: number;
  validation_examples?: number;

  // OpenAI fine-tuning info
  openai_job_id?: string;
  fine_tuned_model_id?: string;
  training_status: TrainingStatus;

  // Export info
  export_file_path?: string;
  export_file_size?: number;

  // Performance metrics
  training_accuracy?: number;
  validation_accuracy?: number;
  training_loss?: number;
  validation_loss?: number;

  // Audit
  created_by?: string;
  notes?: string;
}

export interface VerificationEdit {
  id: string;
  training_document_id: string;

  editor_id: string;
  edit_date: string;

  before_data?: ExtractedData;
  after_data?: ExtractedData;
  changes_made?: string;

  verification_action: VerificationAction;
}

// OpenAI Training Format
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | OpenAIUserContent[];
}

export interface OpenAIUserContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
}

export interface OpenAITrainingExample {
  messages: OpenAIMessage[];
}

// API Request/Response Types
export interface BatchUploadRequest {
  files: File[];
  document_type: DocumentType;
  created_by?: string;
}

export interface BatchUploadResponse {
  success: boolean;
  uploaded: number;
  failed: number;
  documentIds: string[];
  errors?: Array<{ filename: string; error: string }>;
}

export interface ProcessBatchRequest {
  documentIds: string[];
}

export interface ProcessBatchResponse {
  success: boolean;
  processed: number;
  failed: number;
  results: Array<{
    documentId: string;
    success: boolean;
    error?: string;
  }>;
}

export interface VerifyDocumentRequest {
  verified_extraction: ExtractedData;
  verification_notes?: string;
  feedback_categories?: string[]; // Structured feedback categories
  quality_score: number; // 0-1
  verified_by?: string;
}

export interface VerifyDocumentResponse {
  success: boolean;
  document: TrainingDocument;
  message: string;
}

export interface RejectDocumentRequest {
  rejection_reason: string;
  verified_by?: string;
}

export interface RejectDocumentResponse {
  success: boolean;
  document: TrainingDocument;
  message: string;
}

export interface TrainingDocumentsQuery {
  document_type?: DocumentType;
  processing_status?: ProcessingStatus;
  verification_status?: VerificationStatus;
  dataset_split?: DatasetSplit;
  is_verified?: boolean;
  include_in_training?: boolean;
  limit?: number;
  offset?: number;
}

export interface TrainingDocumentsResponse {
  success: boolean;
  documents: TrainingDocument[];
  total: number;
  limit: number;
  offset: number;
}

export interface TrainingMetricsResponse {
  success: boolean;
  metrics: TrainingMetrics[];
  summary: {
    total_documents: number;
    total_verified: number;
    types_ready_for_training: number;
  };
}

export interface ExportTrainingDataRequest {
  document_type: DocumentType;
  dataset_split?: DatasetSplit; // If not specified, exports both train and validation
}

export interface ExportTrainingDataResponse {
  success: boolean;
  train_file_url?: string;
  validation_file_url?: string;
  train_examples?: number;
  validation_examples?: number;
  message: string;
}

export interface AutoSplitRequest {
  document_type?: DocumentType; // If not specified, splits all types
  train_percentage?: number; // Default 80
}

export interface AutoSplitResponse {
  success: boolean;
  splits: Array<{
    document_type: DocumentType;
    train_count: number;
    validation_count: number;
  }>;
  message: string;
}

// =====================================================
// Fine-Tuning & Model Management Types
// =====================================================

export type FineTuningStatus = 'pending' | 'uploading' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type ModelType = 'base' | 'fine_tuned';
export type DeploymentStatus = 'inactive' | 'testing' | 'active' | 'archived';

export interface FineTuningJob {
  id: string;
  document_type: DocumentType;

  // OpenAI job information
  openai_job_id?: string;
  openai_file_id?: string;
  openai_validation_file_id?: string;

  // Job status
  status: FineTuningStatus;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  failed_at?: string;

  // Training configuration
  base_model: string;
  hyperparameters?: {
    n_epochs?: number;
    batch_size?: number;
    learning_rate_multiplier?: number;
  };

  // Training data
  training_examples_count?: number;
  validation_examples_count?: number;
  training_file_url?: string;
  validation_file_url?: string;

  // Results
  fine_tuned_model_id?: string;
  trained_tokens?: number;

  // Metrics
  training_loss?: number;
  training_accuracy?: number;
  validation_loss?: number;
  validation_accuracy?: number;
  metrics?: Record<string, any>;

  // Error handling
  error_message?: string;
  error_code?: string;
  retry_count: number;

  // Trigger information
  triggered_by: string;
  triggered_at_count?: number;

  // Audit
  created_by?: string;
  notes?: string;
}

export interface ModelVersion {
  id: string;
  document_type: DocumentType;
  model_id: string;
  version_number: number;

  // Model type
  model_type: ModelType;
  fine_tuning_job_id?: string;

  // Deployment
  deployment_status: DeploymentStatus;
  deployed_at?: string;
  archived_at?: string;

  // Performance tracking
  total_requests: number;
  successful_extractions: number;
  failed_extractions: number;
  average_confidence?: number;
  user_satisfaction_score?: number;

  // A/B testing
  traffic_percentage: number;

  // Metrics
  performance_metrics?: Record<string, any>;

  // Audit
  created_at: string;
  updated_at: string;
  created_by?: string;
  notes?: string;
}

export interface TrainingTrigger {
  id: string;
  document_type: DocumentType;

  // Trigger configuration
  trigger_interval: number;
  last_trigger_count: number;
  next_trigger_at: number;

  // Auto-trigger settings
  auto_trigger_enabled: boolean;
  min_documents_required: number;

  // Last trigger information
  last_triggered_at?: string;
  last_job_id?: string;
  total_triggers: number;

  // Audit
  created_at: string;
  updated_at: string;
}

// API Request/Response Types for Fine-Tuning

export interface StartFineTuningRequest {
  document_type: DocumentType;
  hyperparameters?: {
    n_epochs?: number;
    batch_size?: number;
    learning_rate_multiplier?: number;
  };
  triggered_by?: string;
  notes?: string;
}

export interface StartFineTuningResponse {
  success: boolean;
  job: FineTuningJob;
  message: string;
}

export interface FineTuningStatusResponse {
  success: boolean;
  job: FineTuningJob;
  progress?: {
    current_step?: string;
    percentage?: number;
    estimated_completion?: string;
  };
}

export interface DeployModelRequest {
  deployment_status?: DeploymentStatus;
  traffic_percentage?: number;
  notes?: string;
}

export interface DeployModelResponse {
  success: boolean;
  model_version: ModelVersion;
  message: string;
}

export interface MonitorJobsResponse {
  success: boolean;
  active_jobs: FineTuningJob[];
  completed_count: number;
  failed_count: number;
  deployed_count: number;
  message: string;
}

export interface TriggerCheckResult {
  should_trigger: boolean;
  document_type: DocumentType;
  current_count: number;
  trigger_threshold: number;
  reason: string;
}