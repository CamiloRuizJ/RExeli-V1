/**
 * Data Transformers
 *
 * Transform raw extraction data from OpenAI into normalized structures
 * that match our display component expectations.
 */

import type {
  BrokerSalesComparablesData,
  BrokerLeaseComparablesData,
  OfferingMemoData,
  FinancialStatementsData,
  ExtractedData
} from './types';

/**
 * Transform BrokerSalesComparablesData from extraction format to display format
 */
export function transformBrokerSalesComparables(rawData: any): BrokerSalesComparablesData {
  // Check if already in correct format
  if (rawData.comparables && rawData.summary) {
    return rawData as BrokerSalesComparablesData;
  }

  // Extract comparables from either flat or nested structure
  const comparablesArray = rawData.comparableSales || rawData.comparables || [];

  // Transform nested comparables to flat structure for display
  const transformedComparables = comparablesArray.map((comp: any) => {
    // Handle nested structure
    if (comp.transactionDetails || comp.pricingMetrics || comp.propertyCharacteristics) {
      return {
        propertyAddress: comp.propertyAddress || comp.propertyCharacteristics?.propertyAddress || 'N/A',
        propertyType: comp.propertyCharacteristics?.propertyType || comp.propertyType || 'N/A',
        saleDate: comp.transactionDetails?.saleDate || comp.saleDate || '',
        salePrice: comp.transactionDetails?.salePrice || comp.salePrice || 0,
        pricePerSF: comp.pricingMetrics?.pricePerSquareFoot || comp.pricePerSF || 0,
        pricePerUnit: comp.pricingMetrics?.pricePerUnit || comp.pricePerUnit,
        buildingSize: comp.propertyCharacteristics?.totalBuildingSquareFeet || comp.buildingSize || 0,
        landSize: comp.propertyCharacteristics?.landAreaSquareFeet || comp.landSize,
        yearBuilt: comp.propertyCharacteristics?.yearBuilt || comp.yearBuilt,
        yearRenovated: comp.propertyCharacteristics?.yearRenovated || comp.yearRenovated,
        occupancyAtSale: comp.financialPerformance?.occupancyRateAtSale || comp.occupancyAtSale || 0,
        capRate: comp.financialPerformance?.capRateAtSale || comp.capRate,
        noiAtSale: comp.financialPerformance?.noiAtSale || comp.noiAtSale,
        buyer: comp.transactionParties?.buyerName || comp.buyer,
        seller: comp.transactionParties?.sellerName || comp.seller,
      };
    }

    // Already flat, return as-is
    return comp;
  });

  // Calculate summary if not provided
  let summary = rawData.summary;

  if (!summary || !summary.averagePricePerSF) {
    // Try to get from marketAnalysis
    const pricingAnalysis = rawData.marketAnalysis?.pricingAnalysis;
    const capRateAnalysis = rawData.marketAnalysis?.capRateAnalysis;

    summary = {
      averagePricePerSF: pricingAnalysis?.averagePricePerSF || calculateAverage(transformedComparables, 'pricePerSF'),
      averageCapRate: capRateAnalysis?.averageCapRate || calculateAverage(transformedComparables, 'capRate'),
      priceRange: pricingAnalysis?.pricePerSFRange || calculateRange(transformedComparables, 'pricePerSF')
    };
  }

  // Return normalized structure
  return {
    comparables: transformedComparables,
    summary: summary,
    // Preserve additional data for potential future use
    marketSummary: rawData.marketSummary,
    marketAnalysis: rawData.marketAnalysis,
    comparableSales: rawData.comparableSales
  };
}

/**
 * Transform BrokerLeaseComparablesData from extraction format to display format
 */
export function transformBrokerLeaseComparables(rawData: any): BrokerLeaseComparablesData {
  // Check if already in correct format
  if (rawData.comparables && rawData.summary) {
    return rawData as BrokerLeaseComparablesData;
  }

  const comparablesArray = rawData.comparables || [];

  // Calculate summary if not provided
  let summary = rawData.summary;

  if (!summary) {
    summary = {
      averageBaseRent: calculateAverage(comparablesArray, 'baseRent'),
      averageEffectiveRent: calculateAverage(comparablesArray, 'effectiveRent'),
      rentRange: calculateRange(comparablesArray, 'baseRent')
    };
  }

  return {
    comparables: comparablesArray,
    summary: summary
  };
}

/**
 * Transform OfferingMemoData from extraction format to display format
 */
export function transformOfferingMemo(rawData: any): OfferingMemoData {
  // Ensure all required fields exist with defaults
  return {
    propertyOverview: rawData.propertyOverview || {
      name: '',
      address: '',
      propertyType: '',
      totalSquareFeet: 0
    },
    investmentHighlights: rawData.investmentHighlights || [],
    marketOverview: rawData.marketOverview || '',
    rentRollSummary: rawData.rentRollSummary || {
      totalUnits: 0,
      occupancyRate: 0,
      averageRent: 0
    },
    operatingStatement: rawData.operatingStatement || {
      grossIncome: 0,
      operatingExpenses: 0,
      noi: 0
    },
    leaseTerms: rawData.leaseTerms || [],
    comparables: rawData.comparables || [],
    pricing: rawData.pricing || {
      askingPrice: 0
    },
    locationData: rawData.locationData || {
      neighborhood: ''
    }
  };
}

/**
 * Transform FinancialStatementsData from extraction format to display format
 */
export function transformFinancialStatements(rawData: any): FinancialStatementsData {
  return {
    period: rawData.period || '',
    operatingIncome: rawData.operatingIncome || {
      rentalIncome: 0,
      otherIncome: 0,
      totalIncome: 0,
      vacancyLoss: 0,
      effectiveGrossIncome: 0
    },
    operatingExpenses: rawData.operatingExpenses || {
      propertyTaxes: 0,
      insurance: 0,
      utilities: 0,
      maintenance: 0,
      management: 0,
      professionalFees: 0,
      otherExpenses: 0,
      totalExpenses: 0
    },
    noi: rawData.noi || 0,
    debtService: rawData.debtService,
    cashFlow: rawData.cashFlow,
    balanceSheet: rawData.balanceSheet,
    capex: rawData.capex
  };
}

/**
 * Main transformer - routes to appropriate transformer based on document type
 */
export function transformExtractedData(extractedData: ExtractedData): ExtractedData {
  try {
    let transformedData = extractedData.data;

    switch (extractedData.documentType) {
      case 'broker_sales_comparables':
        transformedData = transformBrokerSalesComparables(extractedData.data);
        break;

      case 'broker_lease_comparables':
        transformedData = transformBrokerLeaseComparables(extractedData.data);
        break;

      case 'offering_memo':
        transformedData = transformOfferingMemo(extractedData.data);
        break;

      case 'financial_statements':
        transformedData = transformFinancialStatements(extractedData.data);
        break;

      // Other document types don't need transformation yet
      default:
        transformedData = extractedData.data;
    }

    return {
      ...extractedData,
      data: transformedData
    };
  } catch (error) {
    console.error('Error transforming extracted data:', error);
    // Return original data if transformation fails
    return extractedData;
  }
}

// Helper functions

function calculateAverage(array: any[], field: string): number {
  if (!array || array.length === 0) return 0;

  const values = array
    .map(item => item[field])
    .filter(val => val !== null && val !== undefined && !isNaN(val));

  if (values.length === 0) return 0;

  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

function calculateRange(array: any[], field: string): { min: number; max: number } {
  if (!array || array.length === 0) {
    return { min: 0, max: 0 };
  }

  const values = array
    .map(item => item[field])
    .filter(val => val !== null && val !== undefined && !isNaN(val));

  if (values.length === 0) {
    return { min: 0, max: 0 };
  }

  return {
    min: Math.min(...values),
    max: Math.max(...values)
  };
}
