import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import type { 
  ApiResponse, 
  ExportResponse, 
  ExtractedData, 
  RentRollData, 
  OfferingMemoData,
  LeaseData,
  ComparableData,
  FinancialData 
} from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { extractedData, options } = await request.json();

    if (!extractedData) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'No extracted data provided'
      }, { status: 400 });
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RExeli V1';
    workbook.created = new Date();

    // Generate Excel based on document type
    await generateExcelByType(workbook, extractedData, options);

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

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
    
    const errorMessage = error instanceof Error ? error.message : 'Export failed';
    
    return NextResponse.json<ApiResponse>({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
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
    case 'offering_memo':
      await generateOfferingMemoExcel(workbook, extractedData);
      break;
    case 'lease_agreement':
      await generateLeaseExcel(workbook, extractedData);
      break;
    case 'comparable_sales':
      await generateComparableExcel(workbook, extractedData);
      break;
    case 'financial_statement':
      await generateFinancialExcel(workbook, extractedData);
      break;
    default:
      await generateGenericExcel(workbook, extractedData);
  }
}

async function generateRentRollExcel(workbook: ExcelJS.Workbook, data: ExtractedData) {
  const rentRollData = data.data as RentRollData;
  
  // Summary Sheet
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.addRow(['Property Summary']);
  summarySheet.addRow(['Property Name', data.metadata.propertyName || 'N/A']);
  summarySheet.addRow(['Property Address', data.metadata.propertyAddress || 'N/A']);
  summarySheet.addRow(['Total Square Feet', data.metadata.totalSquareFeet || 'N/A']);
  summarySheet.addRow(['Total Units', data.metadata.totalUnits || 'N/A']);
  summarySheet.addRow([]);
  
  summarySheet.addRow(['Financial Summary']);
  summarySheet.addRow(['Total Monthly Rent', rentRollData.summary.totalRent]);
  summarySheet.addRow(['Occupancy Rate', `${(rentRollData.summary.occupancyRate * 100).toFixed(1)}%`]);
  summarySheet.addRow(['Average Rent PSF', `$${rentRollData.summary.averageRentPsf.toFixed(2)}`]);
  
  // Rent Roll Detail Sheet
  const detailSheet = workbook.addWorksheet('Rent Roll Details');
  const headers = ['Unit Number', 'Tenant', 'Square Feet', 'Monthly Rent', 'Lease Start', 'Lease End', 'Status'];
  detailSheet.addRow(headers);
  
  // Style headers
  const headerRow = detailSheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F3FF' } };
  
  // Add data rows
  rentRollData.properties.forEach(property => {
    detailSheet.addRow([
      property.unitNumber,
      property.tenant,
      property.squareFeet,
      property.monthlyRent,
      property.leaseStart,
      property.leaseEnd,
      property.occupancyStatus
    ]);
  });
  
  // Auto-fit columns
  detailSheet.columns.forEach(column => {
    column.width = 15;
  });
}

async function generateOfferingMemoExcel(workbook: ExcelJS.Workbook, data: ExtractedData) {
  const offeringData = data.data as OfferingMemoData;
  
  const sheet = workbook.addWorksheet('Offering Memo');
  
  sheet.addRow(['Property Details']);
  sheet.addRow(['Name', offeringData.propertyDetails.name]);
  sheet.addRow(['Address', offeringData.propertyDetails.address]);
  sheet.addRow(['Property Type', offeringData.propertyDetails.propertyType]);
  sheet.addRow(['Year Built', offeringData.propertyDetails.yearBuilt || 'N/A']);
  sheet.addRow(['Total Square Feet', offeringData.propertyDetails.totalSquareFeet]);
  sheet.addRow(['Lot Size (Acres)', offeringData.propertyDetails.lotSize || 'N/A']);
  sheet.addRow([]);
  
  sheet.addRow(['Financial Information']);
  sheet.addRow(['Asking Price', offeringData.financials.askingPrice]);
  sheet.addRow(['Cap Rate', offeringData.financials.capRate ? `${(offeringData.financials.capRate * 100).toFixed(2)}%` : 'N/A']);
  sheet.addRow(['NOI', offeringData.financials.noi || 'N/A']);
  sheet.addRow(['Gross Rent', offeringData.financials.grossRent || 'N/A']);
  sheet.addRow(['Expenses', offeringData.financials.expenses || 'N/A']);
  sheet.addRow([]);
  
  sheet.addRow(['Property Highlights']);
  offeringData.highlights.forEach(highlight => {
    sheet.addRow(['', highlight]);
  });
  
  // Auto-fit columns
  sheet.columns.forEach(column => {
    column.width = 20;
  });
}

async function generateLeaseExcel(workbook: ExcelJS.Workbook, data: ExtractedData) {
  const leaseData = data.data as LeaseData;
  
  const sheet = workbook.addWorksheet('Lease Agreement');
  
  sheet.addRow(['Lease Information']);
  sheet.addRow(['Tenant', leaseData.tenant]);
  sheet.addRow(['Landlord', leaseData.landlord]);
  sheet.addRow(['Property Address', leaseData.propertyAddress]);
  sheet.addRow(['Lease Start', leaseData.leaseStart]);
  sheet.addRow(['Lease End', leaseData.leaseEnd]);
  sheet.addRow(['Monthly Rent', leaseData.monthlyRent]);
  sheet.addRow(['Square Feet', leaseData.squareFeet]);
  sheet.addRow(['Rent Per Sq Ft', leaseData.rentPerSqFt]);
  sheet.addRow(['Security Deposit', leaseData.securityDeposit || 'N/A']);
  sheet.addRow([]);
  
  sheet.addRow(['Lease Terms']);
  leaseData.terms.forEach(term => {
    sheet.addRow(['', term]);
  });
  
  sheet.columns.forEach(column => {
    column.width = 25;
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