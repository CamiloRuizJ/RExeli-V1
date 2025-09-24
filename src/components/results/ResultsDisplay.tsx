'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Eye, Download } from 'lucide-react';
import type { ExtractedData, RentRollData, OfferingMemoData, LeaseData, ComparableData, FinancialData } from '@/lib/types';

interface ResultsDisplayProps {
  extractedData: ExtractedData;
  onExportExcel: () => void;
  isExporting: boolean;
}

export function ResultsDisplay({ extractedData, onExportExcel, isExporting }: ResultsDisplayProps) {
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatPercentage = (decimal: number): string => {
    return `${(decimal * 100).toFixed(1)}%`;
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
            <table className="w-full text-sm">
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

  const renderOfferingMemoData = (data: OfferingMemoData) => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Property Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Property Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-500">Property Name</label>
              <p className="text-sm text-gray-900">{data.propertyOverview.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Address</label>
              <p className="text-sm text-gray-900">{data.propertyOverview.address}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Property Type</label>
              <p className="text-sm text-gray-900">{data.propertyOverview.propertyType}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Year Built</label>
              <p className="text-sm text-gray-900">{data.propertyOverview.yearBuilt || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Total Square Feet</label>
              <p className="text-sm text-gray-900">{formatNumber(data.propertyOverview.totalSquareFeet)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Financial Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Financial Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-500">Asking Price</label>
              <p className="text-lg font-bold text-green-600">{formatCurrency(data.pricing.askingPrice)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Cap Rate</label>
              <p className="text-sm text-gray-900">
                {data.pricing.capRate ? formatPercentage(data.pricing.capRate) : 'N/A'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">NOI</label>
              <p className="text-sm text-gray-900">
                {data.operatingStatement.noi ? formatCurrency(data.operatingStatement.noi) : 'N/A'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Gross Income</label>
              <p className="text-sm text-gray-900">
                {data.operatingStatement.grossIncome ? formatCurrency(data.operatingStatement.grossIncome) : 'N/A'}
              </p>
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
          <ul className="space-y-2">
            {data.investmentHighlights.map((highlight, index) => (
              <li key={index} className="flex items-start space-x-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <span className="text-sm text-gray-700">{highlight}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );

  const renderGenericData = (data: unknown, title: string) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-4 rounded">
          {JSON.stringify(data, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );

  const renderDataByType = () => {
    switch (extractedData.documentType) {
      case 'rent_roll':
        return renderRentRollData(extractedData.data as RentRollData);
      case 'offering_memo':
        return renderOfferingMemoData(extractedData.data as OfferingMemoData);
      case 'lease_agreement':
        return renderGenericData(extractedData.data, 'Lease Agreement Details');
      case 'comparable_sales':
        return renderGenericData(extractedData.data, 'Comparable Sales Data');
      case 'financial_statement':
        return renderGenericData(extractedData.data, 'Financial Statement Data');
      default:
        return renderGenericData(extractedData.data, 'Extracted Data');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Extracted Data Results</CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Document Type: {getDocumentTypeLabel(extractedData.documentType)}
              </p>
            </div>
            <Button onClick={onExportExcel} disabled={isExporting}>
              {isExporting ? (
                <>
                  <Download className="w-4 h-4 mr-2 animate-pulse" />
                  Exporting...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Export to Excel
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Property Name</label>
              <p className="text-sm text-gray-900">{extractedData.metadata.propertyName || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Property Address</label>
              <p className="text-sm text-gray-900">{extractedData.metadata.propertyAddress || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Extracted Date</label>
              <p className="text-sm text-gray-900">{extractedData.metadata.extractedDate}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Display */}
      {renderDataByType()}
    </div>
  );
}