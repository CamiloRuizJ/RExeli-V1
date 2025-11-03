import { NextRequest, NextResponse } from 'next/server';
import { classifyDocument } from '@/lib/anthropic';
import type { ApiResponse, ClassificationResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    console.warn('DEPRECATED: /api/classify endpoint is deprecated. The application now uses manual document type selection instead of automatic classification.');

    // Return deprecation notice with helpful information
    const response: ApiResponse = {
      success: false,
      error: 'This endpoint has been deprecated. Please use manual document type selection with the /api/extract endpoint.',
      message: 'Auto-classification has been replaced with manual document type selection for improved accuracy and user control. Supported document types: rent_roll, operating_budget, broker_sales_comparables, broker_lease_comparables, broker_listing, offering_memo, lease_agreement, financial_statements.'
    };

    return NextResponse.json(response, {
      status: 410, // Gone - indicates the resource is no longer available
      headers: {
        'X-API-Deprecated': 'true',
        'X-Deprecation-Date': '2025-01-15',
        'X-Replacement-Endpoint': '/api/extract',
        'X-Supported-Document-Types': 'rent_roll,operating_budget,broker_sales_comparables,broker_lease_comparables,broker_listing,offering_memo,lease_agreement,financial_statements'
      }
    });

  } catch (error) {
    console.error('Classification API accessed (deprecated):', error);

    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Classification endpoint is deprecated. Use manual document type selection with /api/extract instead.'
    }, { status: 410 });
  }
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