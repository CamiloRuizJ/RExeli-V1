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
  | 'offering_memo' 
  | 'lease_agreement'
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
  data: RentRollData | OfferingMemoData | LeaseData | ComparableData | FinancialData;
}

export interface RentRollData {
  properties: {
    unitNumber: string;
    tenant: string;
    squareFeet: number;
    monthlyRent: number;
    leaseStart: string;
    leaseEnd: string;
    occupancyStatus: 'occupied' | 'vacant' | 'notice';
  }[];
  summary: {
    totalRent: number;
    occupancyRate: number;
    totalSquareFeet: number;
    averageRentPsf: number;
  };
}

export interface OfferingMemoData {
  propertyDetails: {
    name: string;
    address: string;
    propertyType: string;
    yearBuilt?: number;
    totalSquareFeet: number;
    lotSize?: number;
  };
  financials: {
    askingPrice: number;
    capRate?: number;
    noi?: number;
    grossRent?: number;
    expenses?: number;
  };
  highlights: string[];
}

export interface LeaseData {
  tenant: string;
  landlord: string;
  propertyAddress: string;
  leaseStart: string;
  leaseEnd: string;
  monthlyRent: number;
  squareFeet: number;
  rentPerSqFt: number;
  securityDeposit?: number;
  terms: string[];
}

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