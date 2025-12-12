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
import { ExportRequestSchema, safeValidateInput, formatValidationError, hasPrototypePollution } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    console.log('Export API: Processing request...');

    // Parse and validate JSON with Zod schema (SECURITY: prevents prototype pollution)
    let validatedRequest;
    try {
      const requestText = await request.text();
      console.log('Raw request body:', requestText.substring(0, 200) + '...');

      // Parse JSON
      const rawData = JSON.parse(requestText);

      // Security check: detect prototype pollution attempts
      if (hasPrototypePollution(rawData)) {
        console.error('SECURITY: Prototype pollution attempt detected in export request');
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Invalid request: malicious input detected'
        }, { status: 400 });
      }

      // Validate with Zod schema
      const validation = safeValidateInput(ExportRequestSchema, rawData);

      if (!validation.success) {
        console.error('Validation error:', validation.error);
        return NextResponse.json<ApiResponse>({
          success: false,
          error: formatValidationError(validation.error)
        }, { status: 400 });
      }

      validatedRequest = validation.data;
    } catch (jsonError) {
      console.error('JSON parsing error:', jsonError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: `Invalid JSON in request body: ${jsonError instanceof Error ? jsonError.message : 'Parse error'}`
      }, { status: 400 });
    }

    const { extractedData, options } = validatedRequest;
    console.log('Validated request data:', { documentType: extractedData.documentType, options });

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

  // Use dynamic flattening for all sections
  const allData = flattenObject(offeringData);

  // Group sections if they exist
  const sections = [
    { name: 'Property Overview', prefix: 'propertyOverview' },
    { name: 'Investment Highlights', prefix: 'investmentHighlights' },
    { name: 'Market Overview', prefix: 'marketOverview' },
    { name: 'Rent Roll Summary', prefix: 'rentRollSummary' },
    { name: 'Operating Statement', prefix: 'operatingStatement' },
    { name: 'Pricing Information', prefix: 'pricing' },
    { name: 'Location Data', prefix: 'locationData' }
  ];

  sections.forEach(section => {
    const sectionFields = Object.entries(allData).filter(([key]) => key.startsWith(section.prefix));
    if (sectionFields.length > 0) {
      sheet.addRow([section.name]);
      sectionFields.forEach(([key, value]) => {
        const displayKey = key.replace(section.prefix + '.', '');
        sheet.addRow([camelCaseToTitleCase(displayKey), value]);
      });
      sheet.addRow([]);
    }
  });

  // Dynamic comparables if present
  if (offeringData.comparables && Array.isArray(offeringData.comparables) && offeringData.comparables.length > 0) {
    generateDynamicArraySheet(sheet, offeringData.comparables, {
      sheetTitle: 'Comparable Sales - All Fields'
    });
  }

  sheet.columns.forEach(column => { column.width = 25; });
}

async function generateLeaseExcel(workbook: ExcelJS.Workbook, data: ExtractedData) {
  const leaseData = data.data as LeaseData;
  const sheet = workbook.addWorksheet('Lease Agreement');

  // Use dynamic flattening for all sections
  const allData = flattenObject(leaseData);

  const sections = [
    { name: 'Parties', prefix: 'parties' },
    { name: 'Premises', prefix: 'premises' },
    { name: 'Lease Term', prefix: 'leaseTerm' },
    { name: 'Rent Schedule', prefix: 'rentSchedule' },
    { name: 'Operating Expenses', prefix: 'operatingExpenses' },
    { name: 'Maintenance Obligations', prefix: 'maintenanceObligations' }
  ];

  sections.forEach(section => {
    const sectionFields = Object.entries(allData).filter(([key]) => key.startsWith(section.prefix));
    if (sectionFields.length > 0) {
      sheet.addRow([section.name]);
      sectionFields.forEach(([key, value]) => {
        const displayKey = key.replace(section.prefix + '.', '');
        sheet.addRow([camelCaseToTitleCase(displayKey), value]);
      });
      sheet.addRow([]);
    }
  });

  // Handle other top-level fields not in sections
  const topLevelFields = Object.entries(allData).filter(([key]) =>
    !sections.some(s => key.startsWith(s.prefix))
  );
  if (topLevelFields.length > 0) {
    sheet.addRow(['Other Terms']);
    topLevelFields.forEach(([key, value]) => {
      sheet.addRow([camelCaseToTitleCase(key), value]);
    });
  }

  sheet.columns.forEach(column => { column.width = 30; });
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
  sheet.addRow(['Period', budgetData.period || 'N/A']);
  sheet.addRow([]);

  // Use dynamic flattening for all sections
  if (budgetData.income) {
    sheet.addRow(['Income']);
    const incomeFlat = flattenObject(budgetData.income);
    Object.entries(incomeFlat).forEach(([key, value]) => {
      sheet.addRow([camelCaseToTitleCase(key), value]);
    });
    sheet.addRow([]);
  }

  if (budgetData.expenses) {
    sheet.addRow(['Expenses']);
    const expensesFlat = flattenObject(budgetData.expenses);
    Object.entries(expensesFlat).forEach(([key, value]) => {
      sheet.addRow([camelCaseToTitleCase(key), value]);
    });
    sheet.addRow([]);
  }

  // Other summary fields
  if (budgetData.noi !== undefined) sheet.addRow(['NOI', budgetData.noi]);
  if (budgetData.capexForecast !== undefined) sheet.addRow(['CapEx Forecast', budgetData.capexForecast]);
  if (budgetData.cashFlow !== undefined) sheet.addRow(['Cash Flow', budgetData.cashFlow]);

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

  // Use dynamic flattening for all sections
  const allData = flattenObject(listingData);

  const sections = [
    { name: 'Listing Information', prefix: 'listingDetails' },
    { name: 'Property Details', prefix: 'propertyDetails' }
  ];

  sections.forEach(section => {
    const sectionFields = Object.entries(allData).filter(([key]) => key.startsWith(section.prefix));
    if (sectionFields.length > 0) {
      sheet.addRow([section.name]);
      sectionFields.forEach(([key, value]) => {
        const displayKey = key.replace(section.prefix + '.', '');
        sheet.addRow([camelCaseToTitleCase(displayKey), value]);
      });
      sheet.addRow([]);
    }
  });

  // Handle broker duties and other non-object fields
  const otherFields = Object.entries(allData).filter(([key]) =>
    !sections.some(s => key.startsWith(s.prefix))
  );
  if (otherFields.length > 0) {
    otherFields.forEach(([key, value]) => {
      sheet.addRow([camelCaseToTitleCase(key), value]);
    });
  }

  sheet.columns.forEach(column => { column.width = 30; });
}

async function generateFinancialStatementsExcel(workbook: ExcelJS.Workbook, data: ExtractedData) {
  const sheet = workbook.addWorksheet('Financial Statements');
  const finData = data.data as FinancialStatementsData;

  sheet.addRow(['Financial Statements - ' + (data.metadata.propertyName || 'Unknown Property')]);
  sheet.addRow(['Period', finData.period || 'N/A']);
  sheet.addRow([]);

  // Use dynamic flattening for all sections
  const sections = [
    { name: 'Operating Income', prefix: 'operatingIncome' },
    { name: 'Operating Expenses', prefix: 'operatingExpenses' },
    { name: 'Balance Sheet', prefix: 'balanceSheet' }
  ];

  const allData = flattenObject(finData);

  sections.forEach(section => {
    const sectionFields = Object.entries(allData).filter(([key]) => key.startsWith(section.prefix));
    if (sectionFields.length > 0) {
      sheet.addRow([section.name]);
      sectionFields.forEach(([key, value]) => {
        const displayKey = key.replace(section.prefix + '.', '');
        sheet.addRow([camelCaseToTitleCase(displayKey), value]);
      });
      sheet.addRow([]);
    }
  });

  // Top-level summary fields
  if (finData.noi !== undefined) sheet.addRow(['NOI', finData.noi]);
  if (finData.debtService !== undefined) sheet.addRow(['Debt Service', finData.debtService]);
  if (finData.cashFlow !== undefined) sheet.addRow(['Cash Flow', finData.cashFlow]);

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