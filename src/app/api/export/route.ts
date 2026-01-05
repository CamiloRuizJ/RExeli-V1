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
// PROFESSIONAL EXCEL STYLING - RExeli Brand Colors
// ============================================================================

// Emerald/teal brand color scheme
const COLORS = {
  emerald700: 'FF047857',  // Dark emerald for titles
  emerald600: 'FF059669',  // Header background
  emerald100: 'FFD1FAE5',  // Title background
  emerald50: 'FFF0FDF4',   // Section header background
  white: 'FFFFFFFF',
  gray100: 'FFF3F4F6',     // Alternating row
  gray300: 'FFD1D5DB',     // Border color
  gray700: 'FF374151',     // Dark text
};

// Thin border style for cells
const thinBorder: Partial<ExcelJS.Border> = {
  style: 'thin',
  color: { argb: COLORS.gray300 }
};

const allBorders: Partial<ExcelJS.Borders> = {
  top: thinBorder,
  left: thinBorder,
  bottom: thinBorder,
  right: thinBorder,
};

/**
 * Style a title row (main sheet title)
 */
function styleTitleRow(row: ExcelJS.Row, sheet: ExcelJS.Worksheet, colspan: number = 2): void {
  // Merge cells for title
  if (colspan > 1) {
    sheet.mergeCells(row.number, 1, row.number, colspan);
  }
  row.font = { bold: true, size: 14, color: { argb: COLORS.emerald700 } };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: COLORS.emerald100 }
  };
  row.alignment = { horizontal: 'left', vertical: 'middle' };
  row.height = 24;
  row.eachCell((cell) => {
    cell.border = allBorders;
  });
}

/**
 * Style a section header row (subsection titles)
 */
function styleSectionHeader(row: ExcelJS.Row, sheet: ExcelJS.Worksheet, colspan: number = 2): void {
  if (colspan > 1) {
    sheet.mergeCells(row.number, 1, row.number, colspan);
  }
  row.font = { bold: true, size: 12, color: { argb: COLORS.gray700 } };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: COLORS.emerald50 }
  };
  row.alignment = { horizontal: 'left', vertical: 'middle' };
  row.height = 20;
  row.eachCell((cell) => {
    cell.border = allBorders;
  });
}

/**
 * Style a table header row
 */
function styleHeaderRow(row: ExcelJS.Row): void {
  row.font = { bold: true, size: 11, color: { argb: COLORS.white } };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: COLORS.emerald600 }
  };
  row.alignment = { horizontal: 'center', vertical: 'middle' };
  row.height = 20;
  row.eachCell((cell) => {
    cell.border = allBorders;
  });
}

/**
 * Style a data row with borders
 */
function styleDataRow(row: ExcelJS.Row, isAlternate: boolean = false): void {
  if (isAlternate) {
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.gray100 }
    };
  }
  row.alignment = { vertical: 'middle' };
  row.eachCell((cell) => {
    cell.border = allBorders;
  });
}

/**
 * Style a key-value pair row (label on left, value on right)
 */
function styleKeyValueRow(row: ExcelJS.Row): void {
  row.alignment = { vertical: 'middle' };
  const keyCell = row.getCell(1);
  keyCell.font = { bold: true };
  row.eachCell((cell) => {
    cell.border = allBorders;
  });
}

/**
 * Freeze header rows so they stay visible when scrolling
 */
function freezeRows(sheet: ExcelJS.Worksheet, rowCount: number): void {
  sheet.views = [{ state: 'frozen', ySplit: rowCount, xSplit: 0 }];
}

/**
 * Set consistent column widths
 */
function setColumnWidths(sheet: ExcelJS.Worksheet, widths: number[]): void {
  widths.forEach((width, index) => {
    const column = sheet.getColumn(index + 1);
    column.width = width;
  });
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
 * Now with professional styling
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
    const noDataRow = sheet.addRow(['No data available']);
    styleDataRow(noDataRow, false);
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
  const numColumns = headers.length;

  let headerRowNumber = 1;

  // Add optional title row with professional styling
  if (options.sheetTitle) {
    const titleRow = sheet.addRow([options.sheetTitle]);
    styleTitleRow(titleRow, sheet, numColumns);
    sheet.addRow([]); // Empty row for spacing
    headerRowNumber = 3;
  }

  // Add header row with professional styling
  const headerRow = sheet.addRow(headers);
  styleHeaderRow(headerRow);

  // Freeze the header row
  freezeRows(sheet, headerRowNumber);

  // Add data rows with alternating colors and borders
  data.forEach((item, index) => {
    const flatItem = flattenObject(item);
    const rowValues = allFields.map(field => {
      const value = flatItem[field];
      return value !== undefined && value !== null ? value : 'N/A';
    });
    const dataRow = sheet.addRow(rowValues);
    styleDataRow(dataRow, index % 2 === 1);
  });

  // Set consistent column widths based on header length
  sheet.columns.forEach((column, index) => {
    const headerLength = headers[index]?.length || 10;
    column.width = Math.max(headerLength + 4, 18); // Minimum 18, or header length + padding
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

  // Summary Sheet with professional styling
  const summarySheet = workbook.addWorksheet('Summary');
  setColumnWidths(summarySheet, [35, 30]);

  // Property Summary Title
  const titleRow = summarySheet.addRow(['Property Summary']);
  styleTitleRow(titleRow, summarySheet, 2);

  // Metadata rows
  if (data.metadata) {
    const metadataFlat = flattenObject(data.metadata);
    Object.entries(metadataFlat).forEach(([key, value]) => {
      const row = summarySheet.addRow([camelCaseToTitleCase(key), value]);
      styleKeyValueRow(row);
    });
  }
  summarySheet.addRow([]);

  // Financial Summary Section
  const financialTitleRow = summarySheet.addRow(['Financial Summary']);
  styleSectionHeader(financialTitleRow, summarySheet, 2);

  if (rentRollData.summary) {
    const summaryFlat = flattenObject(rentRollData.summary);
    Object.entries(summaryFlat).forEach(([key, value]) => {
      const row = summarySheet.addRow([camelCaseToTitleCase(key), value]);
      styleKeyValueRow(row);
    });
  }

  // Rent Roll Detail Sheet - Use dynamic generation with styling
  const detailSheet = workbook.addWorksheet('Rent Roll Details');
  generateDynamicArraySheet(detailSheet, rentRollData.tenants, {
    sheetTitle: 'Rent Roll - All Tenant Fields'
  });
}

async function generateOfferingMemoExcel(workbook: ExcelJS.Workbook, data: ExtractedData) {
  const offeringData = data.data as OfferingMemoData;
  const sheet = workbook.addWorksheet('Offering Memo');
  setColumnWidths(sheet, [35, 30]);

  // Main Title
  const titleRow = sheet.addRow(['Offering Memorandum']);
  styleTitleRow(titleRow, sheet, 2);

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
      sheet.addRow([]); // Spacing
      const sectionRow = sheet.addRow([section.name]);
      styleSectionHeader(sectionRow, sheet, 2);
      sectionFields.forEach(([key, value]) => {
        const displayKey = key.replace(section.prefix + '.', '');
        const row = sheet.addRow([camelCaseToTitleCase(displayKey), value]);
        styleKeyValueRow(row);
      });
    }
  });

  // Dynamic comparables if present - in separate sheet
  if (offeringData.comparables && Array.isArray(offeringData.comparables) && offeringData.comparables.length > 0) {
    const compSheet = workbook.addWorksheet('Comparables');
    generateDynamicArraySheet(compSheet, offeringData.comparables, {
      sheetTitle: 'Comparable Sales - All Fields'
    });
  }
}

async function generateLeaseExcel(workbook: ExcelJS.Workbook, data: ExtractedData) {
  const leaseData = data.data as LeaseData;
  const sheet = workbook.addWorksheet('Lease Agreement');
  setColumnWidths(sheet, [35, 35]);

  // Main Title
  const titleRow = sheet.addRow(['Lease Agreement']);
  styleTitleRow(titleRow, sheet, 2);

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
      sheet.addRow([]); // Spacing
      const sectionRow = sheet.addRow([section.name]);
      styleSectionHeader(sectionRow, sheet, 2);
      sectionFields.forEach(([key, value]) => {
        const displayKey = key.replace(section.prefix + '.', '');
        const row = sheet.addRow([camelCaseToTitleCase(displayKey), value]);
        styleKeyValueRow(row);
      });
    }
  });

  // Handle other top-level fields not in sections
  const topLevelFields = Object.entries(allData).filter(([key]) =>
    !sections.some(s => key.startsWith(s.prefix))
  );
  if (topLevelFields.length > 0) {
    sheet.addRow([]); // Spacing
    const otherRow = sheet.addRow(['Other Terms']);
    styleSectionHeader(otherRow, sheet, 2);
    topLevelFields.forEach(([key, value]) => {
      const row = sheet.addRow([camelCaseToTitleCase(key), value]);
      styleKeyValueRow(row);
    });
  }
}

async function generateComparableExcel(workbook: ExcelJS.Workbook, data: ExtractedData) {
  const compData = data.data as ComparableData;

  const sheet = workbook.addWorksheet('Comparable Sales');

  // Title row
  const titleRow = sheet.addRow(['Comparable Sales Analysis']);
  styleTitleRow(titleRow, sheet, 7);
  sheet.addRow([]); // Spacing

  const headers = ['Address', 'Sale Price', 'Sale Date', 'Square Feet', 'Price Per Sq Ft', 'Property Type', 'Year Built'];
  const headerRow = sheet.addRow(headers);
  styleHeaderRow(headerRow);

  // Freeze header
  freezeRows(sheet, 3);

  compData.properties.forEach((property, index) => {
    const row = sheet.addRow([
      property.address,
      property.salePrice,
      property.saleDate,
      property.squareFeet,
      property.pricePerSqFt,
      property.propertyType,
      property.yearBuilt || 'N/A'
    ]);
    styleDataRow(row, index % 2 === 1);
  });

  setColumnWidths(sheet, [30, 18, 15, 15, 18, 20, 12]);
}

async function generateFinancialExcel(workbook: ExcelJS.Workbook, data: ExtractedData) {
  const finData = data.data as FinancialData;

  const sheet = workbook.addWorksheet('Financial Statement');
  setColumnWidths(sheet, [30, 25]);

  // Title
  const titleRow = sheet.addRow(['Financial Statement']);
  styleTitleRow(titleRow, sheet, 2);

  const periodRow = sheet.addRow(['Period', finData.period]);
  styleKeyValueRow(periodRow);
  sheet.addRow([]);

  // Revenue Section
  const revenueTitle = sheet.addRow(['Revenue']);
  styleSectionHeader(revenueTitle, sheet, 2);

  const revenueRows = [
    ['Gross Rent', finData.revenue.grossRent],
    ['Other Income', finData.revenue.otherIncome],
    ['Total Revenue', finData.revenue.totalRevenue]
  ];
  revenueRows.forEach(([key, value]) => {
    const row = sheet.addRow([key, value]);
    styleKeyValueRow(row);
  });
  sheet.addRow([]);

  // Expenses Section
  const expensesTitle = sheet.addRow(['Expenses']);
  styleSectionHeader(expensesTitle, sheet, 2);

  const expenseRows = [
    ['Operating Expenses', finData.expenses.operatingExpenses],
    ['Maintenance', finData.expenses.maintenance],
    ['Insurance', finData.expenses.insurance],
    ['Taxes', finData.expenses.taxes],
    ['Utilities', finData.expenses.utilities],
    ['Management', finData.expenses.management],
    ['Total Expenses', finData.expenses.totalExpenses]
  ];
  expenseRows.forEach(([key, value]) => {
    const row = sheet.addRow([key, value]);
    styleKeyValueRow(row);
  });
  sheet.addRow([]);

  // NOI - highlight as important
  const noiTitle = sheet.addRow(['Summary']);
  styleSectionHeader(noiTitle, sheet, 2);
  const noiRow = sheet.addRow(['Net Operating Income', finData.netOperatingIncome]);
  styleKeyValueRow(noiRow);
  noiRow.font = { bold: true, size: 12 };
}

// New specialized Excel generators with professional styling
async function generateOperatingBudgetExcel(workbook: ExcelJS.Workbook, data: ExtractedData) {
  const sheet = workbook.addWorksheet('Operating Budget');
  const budgetData = data.data as OperatingBudgetData;
  setColumnWidths(sheet, [35, 25]);

  // Title
  const titleRow = sheet.addRow(['Operating Budget - ' + (data.metadata.propertyName || 'Unknown Property')]);
  styleTitleRow(titleRow, sheet, 2);

  const periodRow = sheet.addRow(['Period', budgetData.period || 'N/A']);
  styleKeyValueRow(periodRow);
  sheet.addRow([]);

  // Income Section
  if (budgetData.income) {
    const incomeTitle = sheet.addRow(['Income']);
    styleSectionHeader(incomeTitle, sheet, 2);
    const incomeFlat = flattenObject(budgetData.income);
    Object.entries(incomeFlat).forEach(([key, value]) => {
      const row = sheet.addRow([camelCaseToTitleCase(key), value]);
      styleKeyValueRow(row);
    });
    sheet.addRow([]);
  }

  // Expenses Section
  if (budgetData.expenses) {
    const expensesTitle = sheet.addRow(['Expenses']);
    styleSectionHeader(expensesTitle, sheet, 2);
    const expensesFlat = flattenObject(budgetData.expenses);
    Object.entries(expensesFlat).forEach(([key, value]) => {
      const row = sheet.addRow([camelCaseToTitleCase(key), value]);
      styleKeyValueRow(row);
    });
    sheet.addRow([]);
  }

  // Summary Section
  const summaryTitle = sheet.addRow(['Summary']);
  styleSectionHeader(summaryTitle, sheet, 2);

  if (budgetData.noi !== undefined) {
    const row = sheet.addRow(['NOI', budgetData.noi]);
    styleKeyValueRow(row);
  }
  if (budgetData.capexForecast !== undefined) {
    const row = sheet.addRow(['CapEx Forecast', budgetData.capexForecast]);
    styleKeyValueRow(row);
  }
  if (budgetData.cashFlow !== undefined) {
    const row = sheet.addRow(['Cash Flow', budgetData.cashFlow]);
    styleKeyValueRow(row);
  }
}

async function generateBrokerSalesComparablesExcel(workbook: ExcelJS.Workbook, data: ExtractedData) {
  // Summary sheet first
  const summarySheet = workbook.addWorksheet('Summary');
  setColumnWidths(summarySheet, [35, 30]);

  const compData = data.data as any;

  // Title
  const titleRow = summarySheet.addRow(['Broker Sales Comparables']);
  styleTitleRow(titleRow, summarySheet, 2);

  // Document Information section
  if (data.metadata) {
    summarySheet.addRow([]);
    const docInfoTitle = summarySheet.addRow(['Document Information']);
    styleSectionHeader(docInfoTitle, summarySheet, 2);
    const metadataFlat = flattenObject(data.metadata);
    Object.entries(metadataFlat).forEach(([key, value]) => {
      const row = summarySheet.addRow([camelCaseToTitleCase(key), value]);
      styleKeyValueRow(row);
    });
  }

  // Market Summary section if available
  if (compData.marketSummary) {
    summarySheet.addRow([]);
    const marketTitle = summarySheet.addRow(['Market Summary']);
    styleSectionHeader(marketTitle, summarySheet, 2);
    const summaryFlat = flattenObject(compData.marketSummary);
    Object.entries(summaryFlat).forEach(([key, value]) => {
      const row = summarySheet.addRow([camelCaseToTitleCase(key), value]);
      styleKeyValueRow(row);
    });
  }

  // Market Analysis section if available
  if (compData.marketAnalysis) {
    summarySheet.addRow([]);
    const analysisTitle = summarySheet.addRow(['Market Analysis']);
    styleSectionHeader(analysisTitle, summarySheet, 2);
    const analysisFlat = flattenObject(compData.marketAnalysis);
    Object.entries(analysisFlat).forEach(([key, value]) => {
      const row = summarySheet.addRow([camelCaseToTitleCase(key), value]);
      styleKeyValueRow(row);
    });
  }

  // Comparables in separate sheet with dynamic generation
  const salesData = compData.comparableSales || compData.comparables || [];
  if (Array.isArray(salesData) && salesData.length > 0) {
    const compSheet = workbook.addWorksheet('Comparable Sales');
    generateDynamicArraySheet(compSheet, salesData, {
      sheetTitle: 'Comparable Sales - All Extracted Fields'
    });
  }
}

async function generateBrokerLeaseComparablesExcel(workbook: ExcelJS.Workbook, data: ExtractedData) {
  const compData = data.data as BrokerLeaseComparablesData;

  // Summary sheet first
  const summarySheet = workbook.addWorksheet('Summary');
  setColumnWidths(summarySheet, [35, 25]);

  // Title
  const titleRow = summarySheet.addRow(['Broker Lease Comparables']);
  styleTitleRow(titleRow, summarySheet, 2);

  // Summary statistics section
  summarySheet.addRow([]);
  const summaryTitle = summarySheet.addRow(['Summary Statistics']);
  styleSectionHeader(summaryTitle, summarySheet, 2);

  const summaryRows = [
    ['Average Base Rent', compData.summary.averageBaseRent || 'N/A'],
    ['Average Effective Rent', compData.summary.averageEffectiveRent || 'N/A'],
    ['Rent Range Min', compData.summary.rentRange?.min || 'N/A'],
    ['Rent Range Max', compData.summary.rentRange?.max || 'N/A']
  ];
  summaryRows.forEach(([key, value]) => {
    const row = summarySheet.addRow([key, value]);
    styleKeyValueRow(row);
  });

  // Comparables in separate sheet with dynamic generation
  const compSheet = workbook.addWorksheet('Lease Comparables');
  generateDynamicArraySheet(compSheet, compData.comparables, {
    sheetTitle: 'Lease Comparables - All Extracted Fields'
  });
}

async function generateBrokerListingExcel(workbook: ExcelJS.Workbook, data: ExtractedData) {
  const sheet = workbook.addWorksheet('Broker Listing');
  const listingData = data.data as BrokerListingData;
  setColumnWidths(sheet, [35, 35]);

  // Title
  const titleRow = sheet.addRow(['Broker Listing Details']);
  styleTitleRow(titleRow, sheet, 2);

  // Use dynamic flattening for all sections
  const allData = flattenObject(listingData);

  const sections = [
    { name: 'Listing Information', prefix: 'listingDetails' },
    { name: 'Property Details', prefix: 'propertyDetails' }
  ];

  sections.forEach(section => {
    const sectionFields = Object.entries(allData).filter(([key]) => key.startsWith(section.prefix));
    if (sectionFields.length > 0) {
      sheet.addRow([]); // Spacing
      const sectionRow = sheet.addRow([section.name]);
      styleSectionHeader(sectionRow, sheet, 2);
      sectionFields.forEach(([key, value]) => {
        const displayKey = key.replace(section.prefix + '.', '');
        const row = sheet.addRow([camelCaseToTitleCase(displayKey), value]);
        styleKeyValueRow(row);
      });
    }
  });

  // Handle broker duties and other non-object fields
  const otherFields = Object.entries(allData).filter(([key]) =>
    !sections.some(s => key.startsWith(s.prefix))
  );
  if (otherFields.length > 0) {
    sheet.addRow([]); // Spacing
    const otherTitle = sheet.addRow(['Additional Information']);
    styleSectionHeader(otherTitle, sheet, 2);
    otherFields.forEach(([key, value]) => {
      const row = sheet.addRow([camelCaseToTitleCase(key), value]);
      styleKeyValueRow(row);
    });
  }
}

async function generateFinancialStatementsExcel(workbook: ExcelJS.Workbook, data: ExtractedData) {
  const sheet = workbook.addWorksheet('Financial Statements');
  const finData = data.data as FinancialStatementsData;
  setColumnWidths(sheet, [35, 25]);

  // Title
  const titleRow = sheet.addRow(['Financial Statements - ' + (data.metadata.propertyName || 'Unknown Property')]);
  styleTitleRow(titleRow, sheet, 2);

  const periodRow = sheet.addRow(['Period', finData.period || 'N/A']);
  styleKeyValueRow(periodRow);

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
      sheet.addRow([]); // Spacing
      const sectionRow = sheet.addRow([section.name]);
      styleSectionHeader(sectionRow, sheet, 2);
      sectionFields.forEach(([key, value]) => {
        const displayKey = key.replace(section.prefix + '.', '');
        const row = sheet.addRow([camelCaseToTitleCase(displayKey), value]);
        styleKeyValueRow(row);
      });
    }
  });

  // Summary section
  sheet.addRow([]); // Spacing
  const summaryTitle = sheet.addRow(['Summary']);
  styleSectionHeader(summaryTitle, sheet, 2);

  if (finData.noi !== undefined) {
    const row = sheet.addRow(['NOI', finData.noi]);
    styleKeyValueRow(row);
  }
  if (finData.debtService !== undefined) {
    const row = sheet.addRow(['Debt Service', finData.debtService]);
    styleKeyValueRow(row);
  }
  if (finData.cashFlow !== undefined) {
    const row = sheet.addRow(['Cash Flow', finData.cashFlow]);
    styleKeyValueRow(row);
  }
}

async function generateGenericExcel(workbook: ExcelJS.Workbook, data: ExtractedData) {
  const sheet = workbook.addWorksheet('Extracted Data');
  setColumnWidths(sheet, [35, 50]);

  // Title
  const titleRow = sheet.addRow(['Extracted Data']);
  styleTitleRow(titleRow, sheet, 2);

  // Metadata
  const docTypeRow = sheet.addRow(['Document Type', data.documentType]);
  styleKeyValueRow(docTypeRow);
  const dateRow = sheet.addRow(['Extraction Date', data.metadata.extractedDate]);
  styleKeyValueRow(dateRow);
  sheet.addRow([]);

  // Data section
  const dataTitle = sheet.addRow(['Raw Data']);
  styleSectionHeader(dataTitle, sheet, 2);
  const dataRow = sheet.addRow([JSON.stringify(data.data, null, 2)]);
  styleDataRow(dataRow, false);
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