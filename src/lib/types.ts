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