import OpenAI from 'openai';
import { decryptApiKey } from './auth';
import type {
  DocumentType,
  DocumentClassification,
  ExtractedData,
  RentRollData,
  OfferingMemoData,
  LeaseData,
  ComparableData,
  FinancialData
} from './types';

// Get decrypted OpenAI API key
function getOpenAIApiKey(): string {
  const encryptedKey = process.env.ENCRYPTED_OPENAI_API_KEY;
  if (!encryptedKey) {
    // During build time, return a dummy key to prevent build errors
    if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
      console.warn('ENCRYPTED_OPENAI_API_KEY not found during build - using placeholder');
      return 'build-time-placeholder-key';
    }
    throw new Error('ENCRYPTED_OPENAI_API_KEY environment variable is required');
  }
  return decryptApiKey(encryptedKey);
}

// Following OpenAI Quickstart Guide best practices with encrypted API key
const openai = new OpenAI({
  apiKey: getOpenAIApiKey(),
});

// Validate API key is present (with build-time handling)
if (!process.env.ENCRYPTED_OPENAI_API_KEY && process.env.NODE_ENV === 'production' && process.env.VERCEL) {
  console.error('ENCRYPTED_OPENAI_API_KEY environment variable is required');
}

/**
 * Enhanced Real Estate Professional Document Classification Prompts
 */
const CLASSIFICATION_PROMPT = `
You are an expert commercial real estate professional with 20+ years of experience in property investment, valuation, and portfolio management. Your expertise includes analyzing all types of commercial real estate documents for investment firms, property managers, and real estate professionals.

Analyze this document image with the precision of a seasoned commercial real estate analyst and classify it into one of these categories:

1. RENT_ROLL - Contains tenant information, unit/suite numbers, rental rates, lease terms, occupancy data, tenant mix analysis
2. OFFERING_MEMO - Marketing material for property sales/acquisitions, includes property details, financial projections, investment highlights, market analysis
3. LEASE_AGREEMENT - Legal document between landlord and tenant with lease terms, rent escalations, CAM charges, tenant improvements
4. COMPARABLE_SALES - Market data showing recent property sales with pricing information, cap rates, price per square foot analysis
5. FINANCIAL_STATEMENT - Income/expense statements, cash flow analysis, NOI calculations, operating expense breakdowns, T-12 statements

As a real estate professional, focus on identifying key indicators that matter for investment decisions and property valuation.

Respond with this exact JSON structure:
{
  "type": "rent_roll|offering_memo|lease_agreement|comparable_sales|financial_statement",
  "confidence": 0.95,
  "reasoning": "Brief explanation of classification decision based on real estate investment criteria"
}
`;

/**
 * Specialized extraction prompts for each document type
 */
const EXTRACTION_PROMPTS = {
  rent_roll: `
You are an expert commercial real estate professional analyzing a rent roll for investment analysis and property management decisions. Extract comprehensive rent roll data with the precision required for NOI calculations and investment underwriting.

Focus on extracting ALL relevant data points that real estate professionals need:
- Unit/suite numbers and floor locations
- Tenant names (company names, or "VACANT" for empty units)
- Square footage per unit (rentable and usable SF)
- Monthly rent amounts (base rent)
- Lease start/end dates and remaining lease terms
- Occupancy status and lease type (NNN, Modified Gross, Full Service)
- Annual rent escalations and CAM charges
- Security deposits and tenant improvements
- Lease expiration rollover schedule
- Tenant credit ratings if available

Return JSON with this structure:
{
  "documentType": "rent_roll",
  "metadata": {
    "propertyName": "Property Name",
    "propertyAddress": "Full Address",
    "totalSquareFeet": 50000,
    "totalUnits": 25,
    "extractedDate": "2025-01-15"
  },
  "data": {
    "properties": [
      {
        "unitNumber": "101",
        "tenant": "ABC Company",
        "squareFeet": 2000,
        "monthlyRent": 4000,
        "leaseStart": "2024-01-01",
        "leaseEnd": "2026-12-31",
        "occupancyStatus": "occupied"
      }
    ],
    "summary": {
      "totalRent": 100000,
      "occupancyRate": 0.92,
      "totalSquareFeet": 50000,
      "averageRentPsf": 24.00
    }
  }
}
  `,

  offering_memo: `
You are an expert commercial real estate investment analyst reviewing an offering memorandum for potential acquisition. Extract comprehensive property and financial data with the precision required for investment committee presentations and due diligence processes.

Focus on extracting critical investment metrics and property details:
- Property fundamentals (name, address, property type, year built, recent renovations)
- Financial performance (asking price, cap rate, NOI, cash-on-cash returns)
- Investment highlights and value-add opportunities
- Market positioning and competitive advantages
- Tenant mix and credit quality
- Physical property characteristics (building size, parking, amenities)
- Location attributes (demographics, traffic counts, nearby anchors)
- Investment thesis and growth projections
- Capital improvement requirements

Return JSON with this structure:
{
  "documentType": "offering_memo",
  "metadata": {
    "propertyName": "Property Name",
    "propertyAddress": "Full Address",
    "extractedDate": "2025-01-15"
  },
  "data": {
    "propertyDetails": {
      "name": "Professional Center",
      "address": "123 Main St, City, State",
      "propertyType": "Office",
      "yearBuilt": 1995,
      "totalSquareFeet": 25000,
      "lotSize": 2.5
    },
    "financials": {
      "askingPrice": 5000000,
      "capRate": 0.065,
      "noi": 325000,
      "grossRent": 500000,
      "expenses": 175000
    },
    "highlights": [
      "Prime location",
      "Recently renovated",
      "Strong tenant mix"
    ]
  }
}
  `,

  lease_agreement: `
You are an expert commercial real estate attorney and leasing professional analyzing a lease agreement for portfolio management and cash flow projections. Extract comprehensive lease terms with the detail required for lease administration and investment analysis.

Focus on extracting all financially relevant lease provisions:
- Tenant and landlord legal entities and contact information
- Leased premises description (suite number, square footage, common areas)
- Lease term (commencement, expiration, renewal options)
- Rental structure (base rent, escalations, percentage rent if applicable)
- Additional charges (CAM, taxes, insurance, utilities)
- Security deposit and personal guarantees
- Tenant improvement allowances and landlord work
- Assignment and subletting rights
- Default provisions and cure periods
- Early termination options and penalties
- Special clauses affecting cash flow

Return JSON with this structure:
{
  "documentType": "lease_agreement",
  "metadata": {
    "propertyAddress": "Suite 200, 123 Business Blvd",
    "extractedDate": "2025-01-15"
  },
  "data": {
    "tenant": "XYZ Corporation",
    "landlord": "Property Management LLC",
    "propertyAddress": "Suite 200, 123 Business Blvd",
    "leaseStart": "2024-06-01",
    "leaseEnd": "2029-05-31",
    "monthlyRent": 8500,
    "squareFeet": 3200,
    "rentPerSqFt": 31.88,
    "securityDeposit": 17000,
    "terms": [
      "5-year initial term",
      "3% annual escalations",
      "CAM charges additional"
    ]
  }
}
  `,

  comparable_sales: `
You are an expert commercial real estate appraiser and market analyst extracting comparable sales data for property valuation and investment analysis. Extract comprehensive market data with the precision required for appraisal reports and investment underwriting.

Focus on extracting all relevant valuation metrics:
- Property addresses and exact locations
- Sale prices and closing dates
- Property characteristics (SF, year built, property type, condition)
- Financial metrics (price per SF, cap rates, NOI at sale)
- Market conditions at time of sale
- Buyer and seller information (if available)
- Financing terms and assumptions
- Property improvements and renovations
- Occupancy levels at time of sale
- Special circumstances affecting the sale
- Days on market and marketing approach

Return JSON with this structure:
{
  "documentType": "comparable_sales",
  "metadata": {
    "extractedDate": "2025-01-15"
  },
  "data": {
    "properties": [
      {
        "address": "456 Commerce St",
        "salePrice": 2500000,
        "saleDate": "2024-11-15",
        "squareFeet": 12500,
        "pricePerSqFt": 200,
        "propertyType": "Retail",
        "yearBuilt": 1988
      }
    ]
  }
}
  `,

  financial_statement: `
You are an expert commercial real estate financial analyst extracting operating performance data for investment analysis and asset management decisions. Extract comprehensive financial data with the precision required for NOI calculations, budget variance analysis, and investor reporting.

Focus on extracting all revenue and expense line items:
- Revenue streams (base rent, percentage rent, reimbursements, parking, other income)
- Operating expenses by detailed category (management, maintenance, utilities, insurance, taxes, professional fees)
- Capital expenditures and tenant improvements
- Net operating income and cash flow calculations
- Occupancy rates and rental rate trends
- Budget vs actual variance analysis
- Year-over-year performance comparisons
- Expense ratios and benchmarking data
- Reserve fund allocations
- Debt service and capital structure (if shown)

Return JSON with this structure:
{
  "documentType": "financial_statement",
  "metadata": {
    "propertyName": "Property Name",
    "extractedDate": "2025-01-15"
  },
  "data": {
    "period": "Year Ending 2024",
    "revenue": {
      "grossRent": 480000,
      "otherIncome": 25000,
      "totalRevenue": 505000
    },
    "expenses": {
      "operatingExpenses": 85000,
      "maintenance": 32000,
      "insurance": 18000,
      "taxes": 45000,
      "utilities": 28000,
      "management": 25000,
      "totalExpenses": 233000
    },
    "netOperatingIncome": 272000
  }
}
  `
};

/**
 * Classify a document using OpenAI Vision API
 * Following OpenAI Quickstart Guide best practices
 */
export async function classifyDocument(file: File): Promise<DocumentClassification> {
  try {
    console.log('OpenAI: Starting document classification...');
    
    // Check API key availability
    const apiKey = getOpenAIApiKey();
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }
    
    let imageBase64: string;
    let mimeType: string;
    
    // Handle different file types
    if (file.type === 'application/pdf') {
      // For PDFs, we need to return an error since server-side PDF processing is complex
      throw new Error('PDF processing on server not supported. Please convert PDF to image on client side first.');
    } else {
      // Handle image files directly
      imageBase64 = await fileToBase64(file);
      mimeType = file.type;
      if (file.type === 'image/png') mimeType = 'image/png';
      else if (file.type === 'image/gif') mimeType = 'image/gif';
      else mimeType = 'image/jpeg';
    }
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Cost-effective model as specified
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: CLASSIFICATION_PROMPT },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: "low" // Use low detail to reduce token usage for free tier
              },
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.1, // Low temperature for consistent results
      response_format: { type: "json_object" }, // Ensure JSON response
    });

    console.log('OpenAI: Classification response received');
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No classification response received from OpenAI');
    }

    console.log('OpenAI classification response:', content);

    // Parse JSON response with OpenAI quickstart error handling pattern
    try {
      const classification = JSON.parse(content);
      
      // Validate required fields per OpenAI best practices
      if (!classification.type || classification.confidence === undefined || !classification.reasoning) {
        throw new Error('Invalid classification response structure');
      }
      
      console.log('Classification successful:', classification);
      return classification;
    } catch (jsonError) {
      console.error('Failed to parse classification JSON:', jsonError);
      console.error('Raw response:', content);
      throw new Error(`Invalid JSON response from OpenAI: ${content}`);
    }
  } catch (error: unknown) {
    console.error('Document classification error:', error);
    
    // OpenAI quickstart guide error handling patterns
    if (error && typeof error === 'object' && 'response' in error) {
      const apiError = error as { response?: { status?: number } };
      if (apiError.response?.status === 401) {
        throw new Error('OpenAI API authentication failed. Please check your API key.');
      } else if (apiError.response?.status === 429) {
        throw new Error('OpenAI API rate limit exceeded. Please try again later.');
      } else if (apiError.response?.status === 402) {
        throw new Error('OpenAI API quota exceeded. Please check your billing.');
      } else if (apiError.response?.status && apiError.response.status >= 500) {
        throw new Error('OpenAI API server error. Please try again later.');
      }
    }
    
    // Re-throw original error if it's already formatted
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to classify document');
  }
}

/**
 * Extract structured data from a classified document
 */
export async function extractDocumentData(
  file: File, 
  documentType: DocumentType
): Promise<ExtractedData> {
  try {
    console.log(`OpenAI: Starting data extraction for ${documentType}...`);
    
    const prompt = EXTRACTION_PROMPTS[documentType as keyof typeof EXTRACTION_PROMPTS];
    if (!prompt) {
      throw new Error(`No extraction prompt available for document type: ${documentType}`);
    }

    console.log(`OpenAI: Using extraction prompt for ${documentType}`);

    // Handle file conversion (should be image at this point)
    let imageBase64: string;
    let mimeType: string;
    
    if (file.type === 'application/pdf') {
      // PDFs should have been converted to images on client side
      throw new Error('PDF processing on server not supported. PDF should have been converted to image on client side.');
    } else {
      imageBase64 = await fileToBase64(file);
      mimeType = file.type;
      if (file.type === 'image/png') mimeType = 'image/png';
      else if (file.type === 'image/gif') mimeType = 'image/gif';
      else mimeType = 'image/jpeg';
    }
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: "low" // Use low detail to reduce token usage
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.1,
    });

    console.log('OpenAI: Extraction response received');
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No extraction response received from OpenAI');
    }

    console.log('OpenAI extraction response:', content);

    // Parse JSON response with better error handling
    try {
      const extractedData = JSON.parse(content);
      
      // Validate the response structure
      if (!extractedData.documentType || !extractedData.data) {
        throw new Error('Invalid extraction response structure - missing documentType or data');
      }
      
      console.log('Extraction successful:', extractedData);
      return extractedData;
    } catch (jsonError) {
      console.error('Failed to parse extraction JSON:', jsonError);
      console.error('Raw response:', content);
      throw new Error(`Invalid JSON response from OpenAI: ${content}`);
    }
  } catch (error) {
    console.error('Document extraction error:', error);
    
    // Re-throw with more specific error message
    if (error instanceof Error) {
      if (error.message.includes('401') || error.message.includes('invalid_api_key')) {
        throw new Error('OpenAI API authentication failed. Please check your API key.');
      } else if (error.message.includes('429')) {
        throw new Error('OpenAI API rate limit exceeded. Please try again later.');
      } else if (error.message.includes('insufficient_quota')) {
        throw new Error('OpenAI API quota exceeded. Please check your billing.');
      } else if (error.message.includes('No extraction prompt available')) {
        throw error; // Re-throw as is
      }
      throw error;
    }
    throw new Error('Failed to extract document data');
  }
}

/**
 * Convert file to base64 for OpenAI API (Server-side version)
 */
export async function fileToBase64(file: File): Promise<string> {
  console.log(`Converting file to base64: ${file.name}, ${file.size} bytes, ${file.type}`);
  
  // Validate file type
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
  if (!validTypes.includes(file.type)) {
    console.error(`Invalid file type: ${file.type}. Supported types: ${validTypes.join(', ')}`);
    throw new Error(`Unsupported file type: ${file.type}. Please upload JPG, PNG, or PDF files.`);
  }
  
  // Validate file size (max 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    console.error(`File too large: ${file.size} bytes. Max size: ${maxSize} bytes`);
    throw new Error(`File too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum size is 10MB.`);
  }
  
  try {
    // Convert File to ArrayBuffer, then to base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    
    console.log(`File converted successfully: ${base64.length} base64 characters`);
    return base64;
  } catch (error) {
    console.error('Error converting file to base64:', error);
    throw new Error('Failed to convert file to base64');
  }
}

/**
 * Convert PDF page to image for processing
 */
export async function convertPdfPageToImage(file: File, pageNumber: number = 1): Promise<string> {
  // For V1, we'll assume PDFs are converted to images client-side
  // In production, this would use pdf2pic or similar server-side conversion
  return fileToBase64(file);
}