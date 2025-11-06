import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import type {
  ApiResponse,
  ExportResponse,
  ExtractedData,
  RentRollData,
  OperatingBudgetData,
  BrokerSalesComparablesData,
  BrokerLeaseComparablesData,
  BrokerListingData,
  OfferingMemoData,
  LeaseData,
  FinancialStatementsData,
  ComparableData,
  FinancialData
} from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    console.log('Export API: Processing request...');
    
    // Parse JSON with better error handling
    let requestBody;
    try {
      const requestText = await request.text();
      console.log('Raw request body:', requestText.substring(0, 200) + '...');
      requestBody = JSON.parse(requestText);
    } catch (jsonError) {
      console.error('JSON parsing error:', jsonError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: `Invalid JSON in request body: ${jsonError instanceof Error ? jsonError.message : 'Parse error'}`
      }, { status: 400 });
    }
    
    const { extractedData, options } = requestBody;
    console.log('Parsed request data:', { hasExtractedData: !!extractedData, options });

    if (!extractedData) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'No extracted data provided'
      }, { status: 400 });
    }
    
    // Validate extracted data structure
    if (!extractedData.documentType || !extractedData.data) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Invalid extracted data structure. Missing documentType or data.'
      }, { status: 400 });
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RExeli V1';
    workbook.created = new Date();

    // Generate Excel based on document type
    console.log(`Generating Excel for document type: ${extractedData.documentType}`);
    await generateExcelByType(workbook, extractedData, options);
    console.log('Excel generation completed');

    // Generate buffer
    console.log('Converting workbook to buffer...');
    const buffer = await workbook.xlsx.writeBuffer();
    console.log(`Excel buffer generated: ${buffer.byteLength} bytes`);

    // Create filename
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `RExeli_${extractedData.documentType}_${timestamp}.xlsx`;

    // Return the Excel file
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.byteLength.toString(),
      },
    });

  } catch (error) {
    console.error('Export API error:', error);
    
    // Provide more detailed error messages
    let errorMessage = 'Export failed';
    let statusCode = 500;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Handle specific Excel generation errors
      if (error.message.includes('JSON')) {
        statusCode = 400;
      } else if (error.message.includes('Invalid extracted data')) {
        statusCode = 400;
      }
    }
    
    return NextResponse.json<ApiResponse>({
      success: false,
      error: errorMessage,
    }, { status: statusCode });
  }
}

// ============================================================================
// DYNAMIC EXCEL EXPORT HELPER FUNCTIONS
// ============================================================================

/**
 * Convert camelCase field name to Title Case header
 * Example: "propertyAddress" → "Property Address"
 */
function camelCaseToTitleCase(str: string): string {
  return str
    .replace(/([A-Z])/g, ' $1') // Add space before capitals
    .replace(/^./, (char) => char.toUpperCase()) // Capitalize first letter
    .trim();
}

/**
 * Flatten nested objects using dot notation
 * Example: {propertyCharacteristics: {address: "123 Main"}} → {"propertyCharacteristics.address": "123 Main"}
 */
function flattenObject(obj: any, prefix: string = ''): Record<string, any> {
  const flattened: Record<string, any> = {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (value === null || value === undefined) {
        flattened[newKey] = 'N/A';
      } else if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        // Recursively flatten nested objects
        Object.assign(flattened, flattenObject(value, newKey));
      } else if (Array.isArray(value)) {
        // Convert arrays to comma-separated strings
        flattened[newKey] = value.join(', ');
      } else {
        flattened[newKey] = value;
      }
    }
  }

  return flattened;
}

/**
 * Generate dynamic Excel sheet from array of objects
 * Automatically detects all fields and creates columns for each
 */
function generateDynamicArraySheet(
  sheet: ExcelJS.Worksheet,
  data: any[],
  options: {
    sheetTitle?: string;
    excludeFields?: string[];
    fieldOrder?: string[];
  } = {}
): void {
  if (!data || data.length === 0) {
    sheet.addRow(['No data available']);
    return;
  }

  // Flatten first item to get all possible fields
  const firstItem = flattenObject(data[0]);
  let allFields = Object.keys(firstItem);

  // Apply field exclusions if specified
  if (options.excludeFields) {
    allFields = allFields.filter(field => !options.excludeFields!.includes(field));
  }

  // Apply field ordering if specified
  if (options.fieldOrder) {
    const orderedFields = options.fieldOrder.filter(field => allFields.includes(field));
    const remainingFields = allFields.filter(field => !options.fieldOrder!.includes(field));
    allFields = [...orderedFields, ...remainingFields];
  }

  // Generate headers with Title Case
  const headers = allFields.map(field => camelCaseToTitleCase(field));

  // Add optional title row
  if (options.sheetTitle) {
    sheet.addRow([options.sheetTitle]);
    sheet.addRow([]); // Empty row for spacing
  }

  // Add header row
  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  // Add data rows
  data.forEach(item => {
    const flatItem = flattenObject(item);
    const rowValues = allFields.map(field => {
      const value = flatItem[field];
      return value !== undefined && value !== null ? value : 'N/A';
    });
    sheet.addRow(rowValues);
  });

  // Auto-size columns
  sheet.columns.forEach((column, index) => {
    const headerLength = headers[index]?.length || 10;
    column.width = Math.max(headerLength + 2, 15); // Minimum 15, or header length + padding
  });
}

async function generateExcelByType(
  workbook: ExcelJS.Workbook, 
  extractedData: ExtractedData,
  _options: unknown
) {
  switch (extractedData.documentType) {
    case 'rent_roll':
      await generateRentRollExcel(workbook, extractedData);
      break;
    case 'operating_budget':
      await generateOperatingBudgetExcel(workbook, extractedData);
      break;
    case 'broker_sales_comparables':
      await generateBrokerSalesComparablesExcel(workbook, extractedData);
      break;
    case 'broker_lease_comparables':
      await generateBrokerLeaseComparablesExcel(workbook, extractedData);
      break;
    case 'broker_listing':
      await generateBrokerListingExcel(workbook, extractedData);
      break;
    case 'offering_memo':
      await generateOfferingMemoExcel(workbook, extractedData);
      break;
    case 'lease_agreement':
      await generateLeaseExcel(workbook, extractedData);
      break;
    case 'financial_statements':
      await generateFinancialStatementsExcel(workbook, extractedData);
      break;
    // Legacy cases for backward compatibility
    case 'comparable_sales':
      await generateComparableExcel(workbook, extractedData);
      break;
    case 'financial_statement':
      await generateFinancialExcel(workbook, extractedData);
      break;
    default:
      // Handle unknown document types with generic export
      await generateGenericExcel(workbook, extractedData);
  }
}

async function generateRentRollExcel(workbook: ExcelJS.Workbook, data: ExtractedData) {
  const rentRollData = data.data as RentRollData;

  // Summary Sheet
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.addRow(['Property Summary']);
  if (data.metadata) {
    const metadataFlat = flattenObject(data.metadata);
    Object.entries(metadataFlat).forEach(([key, value]) => {
      summarySheet.addRow([camelCaseToTitleCase(key), value]);
    });
  }
  summarySheet.addRow([]);

  summarySheet.addRow(['Financial Summary']);
  if (rentRollData.summary) {
    const summaryFlat = flattenObject(rentRollData.summary);
    Object.entries(summaryFlat).forEach(([key, value]) => {
      summarySheet.addRow([camelCaseToTitleCase(key), value]);
    });
  }

  // Rent Roll Detail Sheet - Use dynamic generation for ALL fields
  const detailSheet = workbook.addWorksheet('Rent Roll Details');
  generateDynamicArraySheet(detailSheet, rentRollData.tenants, {
    sheetTitle: 'Rent Roll - All Tenant Fields'
  });
}

async function generateOfferingMemoExcel(workbook: ExcelJS.Workbook, data: ExtractedData) {
  const offeringData = data.data as OfferingMemoData;

  const sheet = workbook.addWorksheet('Offering Memo');

  sheet.addRow(['Property Overview']);
  sheet.addRow(['Name', offeringData.propertyOverview.name]);
  sheet.addRow(['Address', offeringData.propertyOverview.address]);
  sheet.addRow(['Property Type', offeringData.propertyOverview.propertyType]);
  sheet.addRow(['Year Built', offeringData.propertyOverview.yearBuilt || 'N/A']);
  sheet.addRow(['Total Square Feet', offeringData.propertyOverview.totalSquareFeet]);
  sheet.addRow(['Lot Size (Acres)', offeringData.propertyOverview.lotSize || 'N/A']);
  sheet.addRow([]);

  sheet.addRow(['Investment Highlights']);
  offeringData.investmentHighlights.forEach(highlight => {
    sheet.addRow(['', highlight]);
  });
  sheet.addRow([]);

  sheet.addRow(['Market Overview']);
  sheet.addRow(['', offeringData.marketOverview]);
  sheet.addRow([]);

  sheet.addRow(['Rent Roll Summary']);
  sheet.addRow(['Total Units', offeringData.rentRollSummary.totalUnits]);
  sheet.addRow(['Occupancy Rate', `${(offeringData.rentRollSummary.occupancyRate * 100).toFixed(1)}%`]);
  sheet.addRow(['Average Rent', `$${offeringData.rentRollSummary.averageRent}`]);
  sheet.addRow([]);

  sheet.addRow(['Operating Statement']);
  sheet.addRow(['Gross Income', offeringData.operatingStatement.grossIncome]);
  sheet.addRow(['Operating Expenses', offeringData.operatingStatement.operatingExpenses]);
  sheet.addRow(['NOI', offeringData.operatingStatement.noi]);
  sheet.addRow([]);

  sheet.addRow(['Pricing Information']);
  sheet.addRow(['Asking Price', offeringData.pricing.askingPrice]);
  sheet.addRow(['Cap Rate', offeringData.pricing.capRate ? `${(offeringData.pricing.capRate * 100).toFixed(2)}%` : 'N/A']);
  sheet.addRow(['Price per SF', offeringData.pricing.pricePerSF ? `$${offeringData.pricing.pricePerSF}` : 'N/A']);
  sheet.addRow([]);

  sheet.addRow(['Location Data']);
  sheet.addRow(['Neighborhood', offeringData.locationData.neighborhood]);
  sheet.addRow(['Demographics', offeringData.locationData.demographics || 'N/A']);
  sheet.addRow(['Transportation', offeringData.locationData.transportation || 'N/A']);
  sheet.addRow([]);

  if (offeringData.comparables && offeringData.comparables.length > 0) {
    sheet.addRow(['Comparable Sales']);
    sheet.addRow(['Address', 'Sale Price', 'Cap Rate']);
    offeringData.comparables.forEach(comp => {
      sheet.addRow([comp.address, comp.salePrice, `${(comp.capRate * 100).toFixed(2)}%`]);
    });
  }

  // Auto-fit columns
  sheet.columns.forEach(column => {
    column.width = 25;
  });
}

async function generateLeaseExcel(workbook: ExcelJS.Workbook, data: ExtractedData) {
  const leaseData = data.data as LeaseData;

  const sheet = workbook.addWorksheet('Lease Agreement');

  sheet.addRow(['Parties']);
  sheet.addRow(['Tenant', leaseData.parties.tenant]);
  sheet.addRow(['Landlord', leaseData.parties.landlord]);
  sheet.addRow([]);

  sheet.addRow(['Premises']);
  sheet.addRow(['Property Address', leaseData.premises.propertyAddress]);
  sheet.addRow(['Square Feet', leaseData.premises.squareFeet]);
  sheet.addRow(['Description', leaseData.premises.description]);
  sheet.addRow([]);

  sheet.addRow(['Lease Term']);
  sheet.addRow(['Start Date', leaseData.leaseTerm.startDate]);
  sheet.addRow(['End Date', leaseData.leaseTerm.endDate]);
  sheet.addRow(['Term (Months)', leaseData.leaseTerm.termMonths]);
  sheet.addRow([]);

  sheet.addRow(['Rent Schedule']);
  sheet.addRow(['Base Rent', leaseData.rentSchedule.baseRent]);
  sheet.addRow(['Rent per Sq Ft', leaseData.rentSchedule.rentPerSqFt]);
  sheet.addRow(['Rent Escalations', leaseData.rentSchedule.rentEscalations || 'None']);
  sheet.addRow([]);

  sheet.addRow(['Operating Expenses']);
  sheet.addRow(['Responsibility Type', leaseData.operatingExpenses.responsibilityType]);
  sheet.addRow(['CAM Charges', leaseData.operatingExpenses.camCharges || 'N/A']);
  sheet.addRow(['Utilities', leaseData.operatingExpenses.utilities || 'N/A']);
  sheet.addRow(['Taxes', leaseData.operatingExpenses.taxes || 'N/A']);
  sheet.addRow(['Insurance', leaseData.operatingExpenses.insurance || 'N/A']);
  sheet.addRow([]);

  sheet.addRow(['Other Terms']);
  sheet.addRow(['Security Deposit', leaseData.securityDeposit || 'N/A']);
  sheet.addRow(['Assignment Provisions', leaseData.assignmentProvisions || 'N/A']);
  sheet.addRow([]);

  if (leaseData.renewalOptions && leaseData.renewalOptions.length > 0) {
    sheet.addRow(['Renewal Options']);
    leaseData.renewalOptions.forEach(option => {
      sheet.addRow(['', option]);
    });
    sheet.addRow([]);
  }

  if (leaseData.maintenanceObligations) {
    sheet.addRow(['Maintenance Obligations']);
    sheet.addRow(['Landlord Responsibilities']);
    leaseData.maintenanceObligations.landlord.forEach(obligation => {
      sheet.addRow(['', obligation]);
    });
    sheet.addRow(['Tenant Responsibilities']);
    leaseData.maintenanceObligations.tenant.forEach(obligation => {
      sheet.addRow(['', obligation]);
    });
  }

  sheet.columns.forEach(column => {
    column.width = 30;
  });
}

async function generateComparableExcel(workbook: ExcelJS.Workbook, data: ExtractedData) {
  const compData = data.data as ComparableData;
  
  const sheet = workbook.addWorksheet('Comparable Sales');
  
  const headers = ['Address', 'Sale Price', 'Sale Date', 'Square Feet', 'Price Per Sq Ft', 'Property Type', 'Year Built'];
  sheet.addRow(headers);
  
  // Style headers
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F3FF' } };
  
  compData.properties.forEach(property => {
    sheet.addRow([
      property.address,
      property.salePrice,
      property.saleDate,
      property.squareFeet,
      property.pricePerSqFt,
      property.propertyType,
      property.yearBuilt || 'N/A'
    ]);
  });
  
  sheet.columns.forEach(column => {
    column.width = 18;
  });
}

async function generateFinancialExcel(workbook: ExcelJS.Workbook, data: ExtractedData) {
  const finData = data.data as FinancialData;
  
  const sheet = workbook.addWorksheet('Financial Statement');
  
  sheet.addRow(['Financial Statement']);
  sheet.addRow(['Period', finData.period]);
  sheet.addRow([]);
  
  sheet.addRow(['Revenue']);
  sheet.addRow(['Gross Rent', finData.revenue.grossRent]);
  sheet.addRow(['Other Income', finData.revenue.otherIncome]);
  sheet.addRow(['Total Revenue', finData.revenue.totalRevenue]);
  sheet.addRow([]);
  
  sheet.addRow(['Expenses']);
  sheet.addRow(['Operating Expenses', finData.expenses.operatingExpenses]);
  sheet.addRow(['Maintenance', finData.expenses.maintenance]);
  sheet.addRow(['Insurance', finData.expenses.insurance]);
  sheet.addRow(['Taxes', finData.expenses.taxes]);
  sheet.addRow(['Utilities', finData.expenses.utilities]);
  sheet.addRow(['Management', finData.expenses.management]);
  sheet.addRow(['Total Expenses', finData.expenses.totalExpenses]);
  sheet.addRow([]);
  
  sheet.addRow(['Net Operating Income', finData.netOperatingIncome]);
  
  sheet.columns.forEach(column => {
    column.width = 20;
  });
}

// New specialized Excel generators - using generic template for now
async function generateOperatingBudgetExcel(workbook: ExcelJS.Workbook, data: ExtractedData) {
  const sheet = workbook.addWorksheet('Operating Budget');
  const budgetData = data.data as OperatingBudgetData;

  sheet.addRow(['Operating Budget - ' + (data.metadata.propertyName || 'Unknown Property')]);
  sheet.addRow(['Period', budgetData.period]);
  sheet.addRow([]);

  sheet.addRow(['Income']);
  sheet.addRow(['Gross Rental Income', budgetData.income.grossRentalIncome]);
  sheet.addRow(['Vacancy Allowance', budgetData.income.vacancyAllowance]);
  sheet.addRow(['Effective Gross Income', budgetData.income.effectiveGrossIncome]);
  sheet.addRow(['Other Income', budgetData.income.otherIncome]);
  sheet.addRow(['Total Income', budgetData.income.totalIncome]);
  sheet.addRow([]);

  sheet.addRow(['Expenses']);
  sheet.addRow(['Property Taxes', budgetData.expenses.propertyTaxes]);
  sheet.addRow(['Insurance', budgetData.expenses.insurance]);
  sheet.addRow(['Utilities', budgetData.expenses.utilities]);
  sheet.addRow(['Maintenance', budgetData.expenses.maintenance]);
  sheet.addRow(['Management', budgetData.expenses.management]);
  sheet.addRow(['Marketing', budgetData.expenses.marketing]);
  sheet.addRow(['Total Operating Expenses', budgetData.expenses.totalOperatingExpenses]);
  sheet.addRow([]);

  sheet.addRow(['NOI', budgetData.noi]);
  sheet.addRow(['CapEx Forecast', budgetData.capexForecast]);
  sheet.addRow(['Cash Flow', budgetData.cashFlow]);

  sheet.columns.forEach(column => { column.width = 25; });
}

async function generateBrokerSalesComparablesExcel(workbook: ExcelJS.Workbook, data: ExtractedData) {
  const sheet = workbook.addWorksheet('Sales Comparables');
  const compData = data.data as any;

  // Add metadata section if available
  if (data.metadata) {
    sheet.addRow(['Document Information']);
    const metadataFlat = flattenObject(data.metadata);
    Object.entries(metadataFlat).forEach(([key, value]) => {
      sheet.addRow([camelCaseToTitleCase(key), value]);
    });
    sheet.addRow([]);
  }

  // Market Summary section if available
  if (compData.marketSummary) {
    sheet.addRow(['Market Summary']);
    const summaryFlat = flattenObject(compData.marketSummary);
    Object.entries(summaryFlat).forEach(([key, value]) => {
      sheet.addRow([camelCaseToTitleCase(key), value]);
    });
    sheet.addRow([]);
  }

  // Use dynamic sheet generation for comparable sales - exports ALL fields
  const salesData = compData.comparableSales || compData.comparables || [];
  if (Array.isArray(salesData) && salesData.length > 0) {
    generateDynamicArraySheet(sheet, salesData, {
      sheetTitle: 'Comparable Sales - All Extracted Fields'
    });
  }

  // Market Analysis section if available
  if (compData.marketAnalysis) {
    sheet.addRow([]);
    sheet.addRow(['Market Analysis']);
    const analysisFlat = flattenObject(compData.marketAnalysis);
    Object.entries(analysisFlat).forEach(([key, value]) => {
      sheet.addRow([camelCaseToTitleCase(key), value]);
    });
  }
}

async function generateBrokerLeaseComparablesExcel(workbook: ExcelJS.Workbook, data: ExtractedData) {
  const sheet = workbook.addWorksheet('Lease Comparables');
  const compData = data.data as BrokerLeaseComparablesData;

  // Use dynamic sheet generation to export ALL fields
  generateDynamicArraySheet(sheet, compData.comparables, {
    sheetTitle: 'Lease Comparables - All Extracted Fields'
  });

  // Add summary section
  sheet.addRow([]);
  sheet.addRow(['Summary']);
  sheet.addRow(['Average Base Rent', compData.summary.averageBaseRent || 'N/A']);
  sheet.addRow(['Average Effective Rent', compData.summary.averageEffectiveRent || 'N/A']);
  sheet.addRow(['Rent Range Min', compData.summary.rentRange?.min || 'N/A']);
  sheet.addRow(['Rent Range Max', compData.summary.rentRange?.max || 'N/A']);
}

async function generateBrokerListingExcel(workbook: ExcelJS.Workbook, data: ExtractedData) {
  const sheet = workbook.addWorksheet('Broker Listing');
  const listingData = data.data as BrokerListingData;

  sheet.addRow(['Broker Listing Details']);
  sheet.addRow([]);

  sheet.addRow(['Listing Information']);
  sheet.addRow(['Property Owner', listingData.listingDetails.propertyOwner]);
  sheet.addRow(['Broker Firm', listingData.listingDetails.brokerFirm]);
  sheet.addRow(['Broker Name', listingData.listingDetails.brokerName || 'N/A']);
  sheet.addRow(['Listing Type', listingData.listingDetails.listingType]);
  sheet.addRow(['Listing Price', listingData.listingDetails.listingPrice || 'N/A']);
  sheet.addRow(['Asking Rent', listingData.listingDetails.askingRent || 'N/A']);
  sheet.addRow(['Commission Structure', listingData.listingDetails.commissionStructure]);
  sheet.addRow(['Listing Term', listingData.listingDetails.listingTerm]);
  sheet.addRow([]);

  sheet.addRow(['Property Details']);
  sheet.addRow(['Address', listingData.propertyDetails.address]);
  sheet.addRow(['Property Type', listingData.propertyDetails.propertyType]);
  sheet.addRow(['Square Footage', listingData.propertyDetails.squareFootage]);
  sheet.addRow(['Lot Size', listingData.propertyDetails.lotSize || 'N/A']);
  sheet.addRow(['Year Built', listingData.propertyDetails.yearBuilt || 'N/A']);
  sheet.addRow([]);

  sheet.addRow(['Broker Duties']);
  listingData.brokerDuties.forEach(duty => sheet.addRow([duty]));

  sheet.columns.forEach(column => { column.width = 30; });
}

async function generateFinancialStatementsExcel(workbook: ExcelJS.Workbook, data: ExtractedData) {
  const sheet = workbook.addWorksheet('Financial Statements');
  const finData = data.data as FinancialStatementsData;

  sheet.addRow(['Financial Statements - ' + (data.metadata.propertyName || 'Unknown Property')]);
  sheet.addRow(['Period', finData.period]);
  sheet.addRow([]);

  sheet.addRow(['Operating Income']);
  sheet.addRow(['Rental Income', finData.operatingIncome.rentalIncome]);
  sheet.addRow(['Other Income', finData.operatingIncome.otherIncome]);
  sheet.addRow(['Total Income', finData.operatingIncome.totalIncome]);
  sheet.addRow(['Vacancy Loss', finData.operatingIncome.vacancyLoss]);
  sheet.addRow(['Effective Gross Income', finData.operatingIncome.effectiveGrossIncome]);
  sheet.addRow([]);

  sheet.addRow(['Operating Expenses']);
  sheet.addRow(['Property Taxes', finData.operatingExpenses.propertyTaxes]);
  sheet.addRow(['Insurance', finData.operatingExpenses.insurance]);
  sheet.addRow(['Utilities', finData.operatingExpenses.utilities]);
  sheet.addRow(['Maintenance', finData.operatingExpenses.maintenance]);
  sheet.addRow(['Management', finData.operatingExpenses.management]);
  sheet.addRow(['Professional Fees', finData.operatingExpenses.professionalFees]);
  sheet.addRow(['Other Expenses', finData.operatingExpenses.otherExpenses]);
  sheet.addRow(['Total Expenses', finData.operatingExpenses.totalExpenses]);
  sheet.addRow([]);

  sheet.addRow(['NOI', finData.noi]);
  sheet.addRow(['Debt Service', finData.debtService || 'N/A']);
  sheet.addRow(['Cash Flow', finData.cashFlow || 'N/A']);

  if (finData.balanceSheet) {
    sheet.addRow([]);
    sheet.addRow(['Balance Sheet']);
    sheet.addRow(['Total Assets', finData.balanceSheet.assets.totalAssets]);
    sheet.addRow(['Total Liabilities', finData.balanceSheet.liabilities.totalLiabilities]);
    sheet.addRow(['Equity', finData.balanceSheet.equity]);
  }

  sheet.columns.forEach(column => { column.width = 25; });
}

async function generateGenericExcel(workbook: ExcelJS.Workbook, data: ExtractedData) {
  const sheet = workbook.addWorksheet('Extracted Data');

  sheet.addRow(['Document Type', data.documentType]);
  sheet.addRow(['Extraction Date', data.metadata.extractedDate]);
  sheet.addRow([]);

  sheet.addRow(['Raw Data']);
  sheet.addRow([JSON.stringify(data.data, null, 2)]);

  sheet.columns.forEach(column => {
    column.width = 30;
  });
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}