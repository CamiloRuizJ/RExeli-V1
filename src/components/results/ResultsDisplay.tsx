'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Eye, Download, Building, DollarSign, Calendar, Users, TrendingUp } from 'lucide-react';
import type {
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

interface ResultsDisplayProps {
  extractedData: ExtractedData;
  onExportExcel: () => void;
  isExporting: boolean;
}

export function ResultsDisplay({ extractedData, onExportExcel, isExporting }: ResultsDisplayProps) {
  const formatCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined || isNaN(amount)) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number | null | undefined): string => {
    if (num === null || num === undefined || isNaN(num)) return 'N/A';
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatPercentage = (decimal: number | null | undefined): string => {
    if (decimal === null || decimal === undefined || isNaN(decimal)) return 'N/A';
    return `${(decimal * 100).toFixed(1)}%`;
  };

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const formatSquareFeet = (sqft: number | null | undefined): string => {
    if (sqft === null || sqft === undefined || isNaN(sqft)) return 'N/A';
    return `${formatNumber(sqft)} SF`;
  };

  const formatYesNo = (value: boolean | null | undefined): string => {
    if (value === null || value === undefined) return 'N/A';
    return value ? 'Yes' : 'No';
  };

  const safeString = (value: string | null | undefined, fallback = 'Not provided'): string => {
    return value && value.trim() !== '' ? value : fallback;
  };

  const getDocumentTypeLabel = (type: string): string => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const renderRentRollData = (data: RentRollData) => (
    <div className="space-y-6">
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rent Roll Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(data.summary.totalRent)}
              </div>
              <div className="text-sm text-gray-500">Total Monthly Rent</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {formatPercentage(data.summary.occupancyRate)}
              </div>
              <div className="text-sm text-gray-500">Occupancy Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {formatNumber(data.summary.totalSquareFeet)}
              </div>
              <div className="text-sm text-gray-500">Total Sq Ft</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                ${data.summary.averageRentPsf.toFixed(2)}
              </div>
              <div className="text-sm text-gray-500">Avg Rent PSF</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Properties Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Unit Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table" aria-label="Unit details table">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Unit</th>
                  <th className="text-left p-2">Tenant</th>
                  <th className="text-right p-2">Sq Ft</th>
                  <th className="text-right p-2">Monthly Rent</th>
                  <th className="text-left p-2">Lease End</th>
                  <th className="text-left p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.tenants.slice(0, 10).map((tenant, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-medium">{tenant.suiteUnit}</td>
                    <td className="p-2">{tenant.tenantName}</td>
                    <td className="p-2 text-right">{formatNumber(tenant.squareFootage)}</td>
                    <td className="p-2 text-right">{formatCurrency(tenant.baseRent)}</td>
                    <td className="p-2">{tenant.leaseEnd}</td>
                    <td className="p-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        tenant.occupancyStatus === 'occupied' ? 'bg-green-100 text-green-800' :
                        tenant.occupancyStatus === 'vacant' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {tenant.occupancyStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.tenants.length > 10 && (
              <p className="text-sm text-gray-500 mt-2 text-center">
                Showing first 10 units. Full data available in Excel export.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderOperatingBudgetData = (data: OperatingBudgetData) => (
    <div className="space-y-6">
      {/* Key Metrics Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <DollarSign className="w-8 h-8 mx-auto text-green-600 mb-2" />
              <div className="text-2xl font-bold text-green-600">{formatCurrency(data.income.totalIncome)}</div>
              <div className="text-sm text-gray-500">Total Income</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <TrendingUp className="w-8 h-8 mx-auto text-red-600 mb-2" />
              <div className="text-2xl font-bold text-red-600">{formatCurrency(data.expenses.totalOperatingExpenses)}</div>
              <div className="text-sm text-gray-500">Operating Expenses</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Building className="w-8 h-8 mx-auto text-blue-600 mb-2" />
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(data.noi)}</div>
              <div className="text-sm text-gray-500">NOI</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Calendar className="w-8 h-8 mx-auto text-purple-600 mb-2" />
              <div className="text-2xl font-bold text-purple-600">{safeString(data.period)}</div>
              <div className="text-sm text-gray-500">Period</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Income Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <DollarSign className="w-5 h-5 mr-2 text-green-600" />
              Income Statement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm font-medium">Gross Rental Income</span>
              <span className="text-sm font-bold text-green-600">{formatCurrency(data.income.grossRentalIncome)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm">Less: Vacancy Allowance</span>
              <span className="text-sm text-red-600">({formatCurrency(data.income.vacancyAllowance)})</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm font-medium">Effective Gross Income</span>
              <span className="text-sm font-bold">{formatCurrency(data.income.effectiveGrossIncome)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm">Other Income</span>
              <span className="text-sm">{formatCurrency(data.income.otherIncome)}</span>
            </div>
            <div className="flex justify-between items-center py-2 bg-green-50 rounded px-2">
              <span className="text-sm font-bold">Total Income</span>
              <span className="text-sm font-bold text-green-600">{formatCurrency(data.income.totalIncome)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Expense Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-red-600" />
              Operating Expenses
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm">Property Taxes</span>
              <span className="text-sm">{formatCurrency(data.expenses.propertyTaxes)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm">Insurance</span>
              <span className="text-sm">{formatCurrency(data.expenses.insurance)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm">Utilities</span>
              <span className="text-sm">{formatCurrency(data.expenses.utilities)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm">Maintenance</span>
              <span className="text-sm">{formatCurrency(data.expenses.maintenance)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm">Management</span>
              <span className="text-sm">{formatCurrency(data.expenses.management)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm">Marketing</span>
              <span className="text-sm">{formatCurrency(data.expenses.marketing)}</span>
            </div>
            <div className="flex justify-between items-center py-2 bg-red-50 rounded px-2">
              <span className="text-sm font-bold">Total Expenses</span>
              <span className="text-sm font-bold text-red-600">{formatCurrency(data.expenses.totalOperatingExpenses)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cash Flow Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cash Flow Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(data.noi)}</div>
              <div className="text-sm text-gray-600">Net Operating Income</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(data.capexForecast)}</div>
              <div className="text-sm text-gray-600">CapEx Forecast</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{formatCurrency(data.cashFlow)}</div>
              <div className="text-sm text-gray-600">Net Cash Flow</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderBrokerSalesComparablesData = (data: BrokerSalesComparablesData) => {
    // Helper function to safely extract summary data with fallbacks
    const getSummaryValue = (field: string): any => {
      // Check direct summary field first
      if (data.summary && data.summary[field as keyof typeof data.summary] !== undefined) {
        return data.summary[field as keyof typeof data.summary];
      }

      // Fallback to marketAnalysis.pricingAnalysis for pricing fields
      const anyData = data as any;
      if (field === 'averagePricePerSF') {
        return anyData.marketAnalysis?.pricingAnalysis?.averagePricePerSF;
      }
      if (field === 'averageCapRate') {
        return anyData.marketAnalysis?.capRateAnalysis?.averageCapRate;
      }
      if (field === 'priceRange') {
        const pricingAnalysis = anyData.marketAnalysis?.pricingAnalysis;
        if (pricingAnalysis?.pricePerSFRange) {
          return pricingAnalysis.pricePerSFRange;
        }
      }

      return undefined;
    };

    const avgPricePerSF = getSummaryValue('averagePricePerSF');
    const avgCapRate = getSummaryValue('averageCapRate');
    const priceRange = getSummaryValue('priceRange') || { min: 0, max: 0 };

    return (
    <div className="space-y-6">
      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(avgPricePerSF)}</div>
              <div className="text-sm text-gray-500">Avg Price/SF</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{formatPercentage(avgCapRate)}</div>
              <div className="text-sm text-gray-500">Avg Cap Rate</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-lg font-bold text-purple-600">
                {formatCurrency(priceRange?.min)} - {formatCurrency(priceRange?.max)}
              </div>
              <div className="text-sm text-gray-500">Price Range</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Comparables Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sales Comparables</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Property Address</th>
                  <th className="text-left p-2">Sale Date</th>
                  <th className="text-right p-2">Sale Price</th>
                  <th className="text-right p-2">Price/SF</th>
                  <th className="text-right p-2">Building Size</th>
                  <th className="text-right p-2">Cap Rate</th>
                  <th className="text-right p-2">Occupancy</th>
                </tr>
              </thead>
              <tbody>
                {(data.comparables || (data as any).comparableSales || []).map((comp: any, index: number) => {
                  // Handle both flat and nested structures
                  const address = comp.propertyAddress || comp.propertyCharacteristics?.propertyAddress || 'N/A';
                  const saleDate = comp.saleDate || comp.transactionDetails?.saleDate;
                  const salePrice = comp.salePrice || comp.transactionDetails?.salePrice;
                  const pricePerSF = comp.pricePerSF || comp.pricingMetrics?.pricePerSquareFoot;
                  const buildingSize = comp.buildingSize || comp.propertyCharacteristics?.totalBuildingSquareFeet;
                  const capRate = comp.capRate || comp.financialPerformance?.capRateAtSale;
                  const occupancy = comp.occupancyAtSale || comp.financialPerformance?.occupancyRateAtSale;

                  return (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-medium">{safeString(address)}</td>
                    <td className="p-2">{formatDate(saleDate)}</td>
                    <td className="p-2 text-right font-bold text-green-600">{formatCurrency(salePrice)}</td>
                    <td className="p-2 text-right">{formatCurrency(pricePerSF)}</td>
                    <td className="p-2 text-right">{formatSquareFeet(buildingSize)}</td>
                    <td className="p-2 text-right">{formatPercentage(capRate)}</td>
                    <td className="p-2 text-right">{formatPercentage(occupancy)}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
    );
  };

  const renderBrokerLeaseComparablesData = (data: BrokerLeaseComparablesData) => {
    // Safe data extraction with fallbacks
    const avgBaseRent = data.summary?.averageBaseRent;
    const avgEffectiveRent = data.summary?.averageEffectiveRent;
    const rentRange = data.summary?.rentRange || { min: 0, max: 0 };

    return (
    <div className="space-y-6">
      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(avgBaseRent)}</div>
              <div className="text-sm text-gray-500">Avg Base Rent/SF</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{formatCurrency(avgEffectiveRent)}</div>
              <div className="text-sm text-gray-500">Avg Effective Rent/SF</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-lg font-bold text-purple-600">
                {formatCurrency(rentRange?.min)} - {formatCurrency(rentRange?.max)}
              </div>
              <div className="text-sm text-gray-500">Rent Range/SF</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Comparables Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lease Comparables</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Property Address</th>
                  <th className="text-left p-2">Tenant Industry</th>
                  <th className="text-left p-2">Lease Date</th>
                  <th className="text-right p-2">Square Feet</th>
                  <th className="text-right p-2">Base Rent/SF</th>
                  <th className="text-right p-2">Effective Rent/SF</th>
                  <th className="text-right p-2">Term (Years)</th>
                  <th className="text-left p-2">Type</th>
                </tr>
              </thead>
              <tbody>
                {(data.comparables || []).map((comp, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-medium">{safeString(comp.propertyAddress)}</td>
                    <td className="p-2">{safeString(comp.tenantIndustry)}</td>
                    <td className="p-2">{formatDate(comp.leaseCommencementDate)}</td>
                    <td className="p-2 text-right">{formatSquareFeet(comp.squareFootage)}</td>
                    <td className="p-2 text-right font-bold text-blue-600">{formatCurrency(comp.baseRent)}</td>
                    <td className="p-2 text-right font-bold text-green-600">{formatCurrency(comp.effectiveRent)}</td>
                    <td className="p-2 text-right">{comp.leaseTerm ? (comp.leaseTerm / 12).toFixed(1) : 'N/A'}</td>
                    <td className="p-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        comp.leaseType === 'NNN' ? 'bg-blue-100 text-blue-800' :
                        comp.leaseType === 'Gross' ? 'bg-green-100 text-green-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {comp.leaseType || 'N/A'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
    );
  };

  const renderBrokerListingData = (data: BrokerListingData) => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Listing Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <Building className="w-5 h-5 mr-2 text-blue-600" />
              Listing Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-500">Property Owner</label>
              <p className="text-sm text-gray-900">{safeString(data.listingDetails.propertyOwner)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Broker Firm</label>
              <p className="text-sm text-gray-900">{safeString(data.listingDetails.brokerFirm)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Broker Name</label>
              <p className="text-sm text-gray-900">{safeString(data.listingDetails.brokerName)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Listing Type</label>
              <p className="text-sm text-gray-900">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  data.listingDetails.listingType === 'sale'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {data.listingDetails.listingType.toUpperCase()}
                </span>
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Commission Structure</label>
              <p className="text-sm text-gray-900">{safeString(data.listingDetails.commissionStructure)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Listing Term</label>
              <p className="text-sm text-gray-900">{safeString(data.listingDetails.listingTerm)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Property Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <DollarSign className="w-5 h-5 mr-2 text-green-600" />
              Property Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-500">Address</label>
              <p className="text-sm text-gray-900">{safeString(data.propertyDetails.address)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Property Type</label>
              <p className="text-sm text-gray-900">{safeString(data.propertyDetails.propertyType)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Square Footage</label>
              <p className="text-sm text-gray-900">{formatSquareFeet(data.propertyDetails.squareFootage)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Lot Size</label>
              <p className="text-sm text-gray-900">{formatSquareFeet(data.propertyDetails.lotSize)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Year Built</label>
              <p className="text-sm text-gray-900">{data.propertyDetails.yearBuilt || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Zoning</label>
              <p className="text-sm text-gray-900">{safeString(data.propertyDetails.zoning)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pricing Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pricing Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.listingDetails.listingPrice && (
              <div className="text-center p-6 bg-green-50 rounded-lg">
                <div className="text-3xl font-bold text-green-600">{formatCurrency(data.listingDetails.listingPrice)}</div>
                <div className="text-sm text-gray-600">Listing Price</div>
              </div>
            )}
            {data.listingDetails.askingRent && (
              <div className="text-center p-6 bg-blue-50 rounded-lg">
                <div className="text-3xl font-bold text-blue-600">{formatCurrency(data.listingDetails.askingRent)}</div>
                <div className="text-sm text-gray-600">Asking Rent/SF</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Terms and Conditions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Broker Duties</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.brokerDuties.map((duty, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-sm text-gray-700">{duty}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Termination Provisions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.terminationProvisions.map((provision, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-sm text-gray-700">{provision}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderOfferingMemoData = (data: OfferingMemoData) => (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{formatCurrency(data.pricing.askingPrice)}</div>
              <div className="text-sm text-gray-500">Asking Price</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{formatPercentage(data.pricing.capRate)}</div>
              <div className="text-sm text-gray-500">Cap Rate</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{formatCurrency(data.operatingStatement.noi)}</div>
              <div className="text-sm text-gray-500">NOI</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{formatPercentage(data.rentRollSummary.occupancyRate)}</div>
              <div className="text-sm text-gray-500">Occupancy</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Property Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <Building className="w-5 h-5 mr-2 text-blue-600" />
              Property Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-500">Property Name</label>
              <p className="text-sm text-gray-900">{safeString(data.propertyOverview.name)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Address</label>
              <p className="text-sm text-gray-900">{safeString(data.propertyOverview.address)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Property Type</label>
              <p className="text-sm text-gray-900">{safeString(data.propertyOverview.propertyType)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Year Built</label>
              <p className="text-sm text-gray-900">{data.propertyOverview.yearBuilt || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Total Square Feet</label>
              <p className="text-sm text-gray-900">{formatSquareFeet(data.propertyOverview.totalSquareFeet)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Lot Size</label>
              <p className="text-sm text-gray-900">{formatSquareFeet(data.propertyOverview.lotSize)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Financial Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <DollarSign className="w-5 h-5 mr-2 text-green-600" />
              Financial Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm font-medium">Gross Income</span>
              <span className="text-sm font-bold">{formatCurrency(data.operatingStatement.grossIncome)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm">Operating Expenses</span>
              <span className="text-sm text-red-600">({formatCurrency(data.operatingStatement.operatingExpenses)})</span>
            </div>
            <div className="flex justify-between items-center py-2 bg-blue-50 rounded px-2">
              <span className="text-sm font-bold">Net Operating Income</span>
              <span className="text-sm font-bold text-blue-600">{formatCurrency(data.operatingStatement.noi)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm font-medium">Price Per SF</span>
              <span className="text-sm font-bold">{formatCurrency(data.pricing.pricePerSF)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Investment Highlights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Investment Highlights</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {data.investmentHighlights.map((highlight, index) => (
              <li key={index} className="flex items-start space-x-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <span className="text-sm text-gray-700">{highlight}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Comparables */}
      {data.comparables.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Comparables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Address</th>
                    <th className="text-right p-2">Sale Price</th>
                    <th className="text-right p-2">Cap Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.comparables.map((comp, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="p-2">{safeString(comp.address)}</td>
                      <td className="p-2 text-right font-bold text-green-600">{formatCurrency(comp.salePrice)}</td>
                      <td className="p-2 text-right">{formatPercentage(comp.capRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderLeaseAgreementData = (data: LeaseData) => (
    <div className="space-y-6">
      {/* Key Terms Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(data.rentSchedule.baseRent)}</div>
              <div className="text-sm text-gray-500">Monthly Base Rent</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{formatCurrency(data.rentSchedule.rentPerSqFt)}</div>
              <div className="text-sm text-gray-500">Rent Per SF</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{formatSquareFeet(data.premises.squareFeet)}</div>
              <div className="text-sm text-gray-500">Square Feet</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{data.leaseTerm.termMonths} mo</div>
              <div className="text-sm text-gray-500">Lease Term</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Parties and Premises */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <Users className="w-5 h-5 mr-2 text-blue-600" />
              Lease Parties
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-500">Tenant</label>
              <p className="text-sm text-gray-900">{safeString(data.parties.tenant)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Landlord</label>
              <p className="text-sm text-gray-900">{safeString(data.parties.landlord)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Property Address</label>
              <p className="text-sm text-gray-900">{safeString(data.premises.propertyAddress)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Premises Description</label>
              <p className="text-sm text-gray-900">{safeString(data.premises.description)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Lease Terms */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-green-600" />
              Lease Terms
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-500">Start Date</label>
              <p className="text-sm text-gray-900">{formatDate(data.leaseTerm.startDate)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">End Date</label>
              <p className="text-sm text-gray-900">{formatDate(data.leaseTerm.endDate)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Lease Type</label>
              <p className="text-sm text-gray-900">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  data.operatingExpenses.responsibilityType === 'NNN' ? 'bg-blue-100 text-blue-800' :
                  data.operatingExpenses.responsibilityType === 'Gross' ? 'bg-green-100 text-green-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {data.operatingExpenses.responsibilityType}
                </span>
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Security Deposit</label>
              <p className="text-sm text-gray-900">{formatCurrency(data.securityDeposit)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Terms */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <DollarSign className="w-5 h-5 mr-2 text-green-600" />
            Financial Terms
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium text-gray-700">Rent Schedule</h4>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm">Monthly Base Rent</span>
                <span className="text-sm font-bold text-green-600">{formatCurrency(data.rentSchedule.baseRent)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm">Rent Per Square Foot</span>
                <span className="text-sm font-bold">{formatCurrency(data.rentSchedule.rentPerSqFt)}</span>
              </div>
              <div>
                <span className="text-sm text-gray-500">Rent Escalations</span>
                <p className="text-sm text-gray-900">{safeString(data.rentSchedule.rentEscalations)}</p>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium text-gray-700">Operating Expenses</h4>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm">CAM Charges</span>
                <span className="text-sm">{formatCurrency(data.operatingExpenses.camCharges)}</span>
              </div>
              <div>
                <span className="text-sm text-gray-500">Utilities</span>
                <p className="text-sm text-gray-900">{safeString(data.operatingExpenses.utilities)}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Taxes</span>
                <p className="text-sm text-gray-900">{safeString(data.operatingExpenses.taxes)}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Insurance</span>
                <p className="text-sm text-gray-900">{safeString(data.operatingExpenses.insurance)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Terms */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Maintenance Obligations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Maintenance Obligations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Landlord Responsibilities</h4>
              <ul className="space-y-1">
                {data.maintenanceObligations.landlord.map((obligation, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-sm text-gray-700">{obligation}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Tenant Responsibilities</h4>
              <ul className="space-y-1">
                {data.maintenanceObligations.tenant.map((obligation, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-sm text-gray-700">{obligation}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Renewal and Assignment */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Additional Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Renewal Options</h4>
              {data.renewalOptions && data.renewalOptions.length > 0 ? (
                <ul className="space-y-1">
                  {data.renewalOptions.map((option, index) => (
                    <li key={index} className="text-sm text-gray-700">{option}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No renewal options specified</p>
              )}
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Assignment Provisions</h4>
              <p className="text-sm text-gray-700">{safeString(data.assignmentProvisions)}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderFinancialStatementsData = (data: FinancialStatementsData) => (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{formatCurrency(data.operatingIncome.totalIncome)}</div>
              <div className="text-sm text-gray-500">Total Income</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{formatCurrency(data.operatingExpenses.totalExpenses)}</div>
              <div className="text-sm text-gray-500">Total Expenses</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(data.noi)}</div>
              <div className="text-sm text-gray-500">NOI</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{formatCurrency(data.cashFlow)}</div>
              <div className="text-sm text-gray-500">Cash Flow</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Operating Income */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <DollarSign className="w-5 h-5 mr-2 text-green-600" />
              Operating Income - {data.period}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm">Rental Income</span>
              <span className="text-sm font-bold text-green-600">{formatCurrency(data.operatingIncome.rentalIncome)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm">Other Income</span>
              <span className="text-sm">{formatCurrency(data.operatingIncome.otherIncome)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm font-medium">Total Income</span>
              <span className="text-sm font-bold">{formatCurrency(data.operatingIncome.totalIncome)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm">Less: Vacancy Loss</span>
              <span className="text-sm text-red-600">({formatCurrency(data.operatingIncome.vacancyLoss)})</span>
            </div>
            <div className="flex justify-between items-center py-2 bg-green-50 rounded px-2">
              <span className="text-sm font-bold">Effective Gross Income</span>
              <span className="text-sm font-bold text-green-600">{formatCurrency(data.operatingIncome.effectiveGrossIncome)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Operating Expenses */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-red-600" />
              Operating Expenses
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm">Property Taxes</span>
              <span className="text-sm">{formatCurrency(data.operatingExpenses.propertyTaxes)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm">Insurance</span>
              <span className="text-sm">{formatCurrency(data.operatingExpenses.insurance)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm">Utilities</span>
              <span className="text-sm">{formatCurrency(data.operatingExpenses.utilities)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm">Maintenance</span>
              <span className="text-sm">{formatCurrency(data.operatingExpenses.maintenance)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm">Management</span>
              <span className="text-sm">{formatCurrency(data.operatingExpenses.management)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm">Professional Fees</span>
              <span className="text-sm">{formatCurrency(data.operatingExpenses.professionalFees)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm">Other Expenses</span>
              <span className="text-sm">{formatCurrency(data.operatingExpenses.otherExpenses)}</span>
            </div>
            <div className="flex justify-between items-center py-2 bg-red-50 rounded px-2">
              <span className="text-sm font-bold">Total Expenses</span>
              <span className="text-sm font-bold text-red-600">{formatCurrency(data.operatingExpenses.totalExpenses)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cash Flow Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cash Flow Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{formatCurrency(data.noi)}</div>
                <div className="text-sm text-gray-600">Net Operating Income</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{formatCurrency(data.debtService)}</div>
                <div className="text-sm text-gray-600">Debt Service</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{formatCurrency(data.cashFlow)}</div>
                <div className="text-sm text-gray-600">Net Cash Flow</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Balance Sheet */}
      {data.balanceSheet && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Balance Sheet</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-700 mb-3">Assets</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-1 border-b">
                    <span className="text-sm">Real Estate</span>
                    <span className="text-sm font-bold">{formatCurrency(data.balanceSheet.assets.realEstate)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b">
                    <span className="text-sm">Cash</span>
                    <span className="text-sm">{formatCurrency(data.balanceSheet.assets.cash)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b">
                    <span className="text-sm">Other Assets</span>
                    <span className="text-sm">{formatCurrency(data.balanceSheet.assets.otherAssets)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 bg-blue-50 rounded px-2">
                    <span className="text-sm font-bold">Total Assets</span>
                    <span className="text-sm font-bold text-blue-600">{formatCurrency(data.balanceSheet.assets.totalAssets)}</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-gray-700 mb-3">Liabilities & Equity</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-1 border-b">
                    <span className="text-sm">Mortgage</span>
                    <span className="text-sm">{formatCurrency(data.balanceSheet.liabilities.mortgage)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b">
                    <span className="text-sm">Other Liabilities</span>
                    <span className="text-sm">{formatCurrency(data.balanceSheet.liabilities.otherLiabilities)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b">
                    <span className="text-sm font-medium">Total Liabilities</span>
                    <span className="text-sm font-bold text-red-600">{formatCurrency(data.balanceSheet.liabilities.totalLiabilities)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 bg-green-50 rounded px-2">
                    <span className="text-sm font-bold">Owner's Equity</span>
                    <span className="text-sm font-bold text-green-600">{formatCurrency(data.balanceSheet.equity)}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CapEx Forecast */}
      {data.capex && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Capital Expenditures</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{formatCurrency(data.capex.currentYear)}</div>
                <div className="text-sm text-gray-600">Current Year CapEx</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-lg font-bold text-purple-600">
                  {data.capex.forecast.map((amount, index) => (
                    <div key={index} className="text-sm">
                      Year {index + 1}: {formatCurrency(amount)}
                    </div>
                  ))}
                </div>
                <div className="text-sm text-gray-600">Forecast</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderLegacyComparablesData = (data: ComparableData) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Comparable Sales Data</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Address</th>
                <th className="text-left p-2">Sale Date</th>
                <th className="text-right p-2">Sale Price</th>
                <th className="text-right p-2">Square Feet</th>
                <th className="text-right p-2">Price/SF</th>
                <th className="text-left p-2">Property Type</th>
                <th className="text-left p-2">Year Built</th>
              </tr>
            </thead>
            <tbody>
              {data.properties.map((property, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="p-2 font-medium">{safeString(property.address)}</td>
                  <td className="p-2">{formatDate(property.saleDate)}</td>
                  <td className="p-2 text-right font-bold text-green-600">{formatCurrency(property.salePrice)}</td>
                  <td className="p-2 text-right">{formatSquareFeet(property.squareFeet)}</td>
                  <td className="p-2 text-right">{formatCurrency(property.pricePerSqFt)}</td>
                  <td className="p-2">{safeString(property.propertyType)}</td>
                  <td className="p-2">{property.yearBuilt || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );

  const renderLegacyFinancialData = (data: FinancialData) => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Financial Summary - {data.period}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-700 mb-3">Revenue</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-sm">Gross Rent</span>
                  <span className="text-sm font-bold">{formatCurrency(data.revenue.grossRent)}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-sm">Other Income</span>
                  <span className="text-sm">{formatCurrency(data.revenue.otherIncome)}</span>
                </div>
                <div className="flex justify-between items-center py-2 bg-green-50 rounded px-2">
                  <span className="text-sm font-bold">Total Revenue</span>
                  <span className="text-sm font-bold text-green-600">{formatCurrency(data.revenue.totalRevenue)}</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-3">Expenses</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-sm">Operating Expenses</span>
                  <span className="text-sm">{formatCurrency(data.expenses.operatingExpenses)}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-sm">Maintenance</span>
                  <span className="text-sm">{formatCurrency(data.expenses.maintenance)}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-sm">Insurance</span>
                  <span className="text-sm">{formatCurrency(data.expenses.insurance)}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-sm">Taxes</span>
                  <span className="text-sm">{formatCurrency(data.expenses.taxes)}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-sm">Utilities</span>
                  <span className="text-sm">{formatCurrency(data.expenses.utilities)}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-sm">Management</span>
                  <span className="text-sm">{formatCurrency(data.expenses.management)}</span>
                </div>
                <div className="flex justify-between items-center py-2 bg-red-50 rounded px-2">
                  <span className="text-sm font-bold">Total Expenses</span>
                  <span className="text-sm font-bold text-red-600">{formatCurrency(data.expenses.totalExpenses)}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6 text-center p-6 bg-blue-50 rounded-lg">
            <div className="text-3xl font-bold text-blue-600">{formatCurrency(data.netOperatingIncome)}</div>
            <div className="text-sm text-gray-600">Net Operating Income</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderGenericData = (data: unknown, title: string) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <p className="text-sm text-gray-500 mt-1">
          This document type is not yet fully supported. Below is the raw extracted data.
        </p>
      </CardHeader>
      <CardContent>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <div className="flex items-center">
            <Eye className="w-4 h-4 text-yellow-600 mr-2" />
            <span className="text-sm font-medium text-yellow-800">
              Raw Data Preview - Enhanced formatting coming soon
            </span>
          </div>
        </div>
        <pre className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-4 rounded max-h-96 overflow-y-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );

  const renderDataByType = () => {
    try {
      switch (extractedData.documentType) {
        case 'rent_roll':
          return renderRentRollData(extractedData.data as RentRollData);
        case 'operating_budget':
          return renderOperatingBudgetData(extractedData.data as OperatingBudgetData);
        case 'broker_sales_comparables':
          return renderBrokerSalesComparablesData(extractedData.data as BrokerSalesComparablesData);
        case 'broker_lease_comparables':
          return renderBrokerLeaseComparablesData(extractedData.data as BrokerLeaseComparablesData);
        case 'broker_listing':
          return renderBrokerListingData(extractedData.data as BrokerListingData);
        case 'offering_memo':
          return renderOfferingMemoData(extractedData.data as OfferingMemoData);
        case 'lease_agreement':
          return renderLeaseAgreementData(extractedData.data as LeaseData);
        case 'financial_statements':
          return renderFinancialStatementsData(extractedData.data as FinancialStatementsData);
        // Legacy support
        case 'comparable_sales':
          return renderLegacyComparablesData(extractedData.data as ComparableData);
        case 'financial_statement':
          return renderLegacyFinancialData(extractedData.data as FinancialData);
        case 'unknown':
        default:
          return renderGenericData(extractedData.data, `${getDocumentTypeLabel(extractedData.documentType)} Data`);
      }
    } catch (error) {
      console.error('Error rendering document data:', error);
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-red-600">Display Error</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <Eye className="w-4 h-4 text-red-600 mr-2" />
                <span className="text-sm font-medium text-red-800">
                  Error displaying formatted data
                </span>
              </div>
              <p className="text-sm text-red-700 mb-4">
                There was an issue formatting the extracted data. The raw data is shown below for reference.
              </p>
              <pre className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-4 rounded max-h-96 overflow-y-auto">
                {JSON.stringify(extractedData.data, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      );
    }
  };

  return (
    <div className="space-y-6 print:space-y-4" role="main" aria-label="Extracted document data">
      {/* Header */}
      <Card className="print:shadow-none">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-xl sm:text-2xl truncate">
                Extracted Data Results
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  extractedData.documentType === 'rent_roll' ? 'bg-blue-100 text-blue-800' :
                  extractedData.documentType === 'operating_budget' ? 'bg-green-100 text-green-800' :
                  extractedData.documentType === 'broker_sales_comparables' ? 'bg-purple-100 text-purple-800' :
                  extractedData.documentType === 'broker_lease_comparables' ? 'bg-indigo-100 text-indigo-800' :
                  extractedData.documentType === 'broker_listing' ? 'bg-yellow-100 text-yellow-800' :
                  extractedData.documentType === 'offering_memo' ? 'bg-red-100 text-red-800' :
                  extractedData.documentType === 'lease_agreement' ? 'bg-teal-100 text-teal-800' :
                  extractedData.documentType === 'financial_statements' ? 'bg-orange-100 text-orange-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {getDocumentTypeLabel(extractedData.documentType)}
                </span>
                <span className="text-xs text-gray-500">
                  Processed {formatDate(extractedData.metadata.extractedDate)}
                </span>
              </div>
            </div>
            <div className="flex-shrink-0">
              <Button
                onClick={onExportExcel}
                disabled={isExporting}
                className="w-full sm:w-auto print:hidden"
                size="sm"
                aria-label={isExporting ? 'Exporting data to Excel' : 'Export data to Excel'}
              >
                {isExporting ? (
                  <>
                    <Download className="w-4 h-4 mr-2 animate-pulse" aria-hidden="true" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-4 h-4 mr-2" aria-hidden="true" />
                    Export to Excel
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="min-w-0">
              <label className="text-sm font-medium text-gray-500 block">Property Name</label>
              <p className="text-sm text-gray-900 truncate" title={extractedData.metadata.propertyName || 'N/A'}>
                {safeString(extractedData.metadata.propertyName)}
              </p>
            </div>
            <div className="min-w-0">
              <label className="text-sm font-medium text-gray-500 block">Property Address</label>
              <p className="text-sm text-gray-900 truncate" title={extractedData.metadata.propertyAddress || 'N/A'}>
                {safeString(extractedData.metadata.propertyAddress)}
              </p>
            </div>
            <div className="min-w-0 sm:col-span-2 lg:col-span-1">
              <div className="grid grid-cols-2 gap-4">
                {extractedData.metadata.totalSquareFeet && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 block">Total SF</label>
                    <p className="text-sm text-gray-900">{formatSquareFeet(extractedData.metadata.totalSquareFeet)}</p>
                  </div>
                )}
                {extractedData.metadata.totalUnits && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 block">Total Units</label>
                    <p className="text-sm text-gray-900">{formatNumber(extractedData.metadata.totalUnits)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Display */}
      <div className="print:break-inside-avoid">
        {renderDataByType()}
      </div>

      {/* Footer for print */}
      <div className="hidden print:block mt-8 pt-4 border-t border-gray-200">
        <div className="text-xs text-gray-500 text-center">
          Generated by RExeli V1 - Real Estate Document Intelligence Platform
          <br />
          Extracted on {formatDate(extractedData.metadata.extractedDate)}
        </div>
      </div>
    </div>
  );
}