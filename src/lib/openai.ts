import OpenAI from 'openai';
import { decryptApiKey } from './auth';
import type {
  DocumentType,
  DocumentClassification,
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
- Tenant name & suite/unit number
- Lease start & expiration dates
- Rent commencement date
- Base rent (current & escalations)
- Lease type (NNN, Gross, Modified Gross)
- CAM / Operating expense reimbursements
- Security deposit
- Renewal/extension options
- Free rent or concessions
- Square footage leased
- Occupancy status

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
    "tenants": [
      {
        "tenantName": "ABC Company",
        "suiteUnit": "Suite 101",
        "leaseStart": "2024-01-01",
        "leaseEnd": "2026-12-31",
        "rentCommencementDate": "2024-02-01",
        "baseRent": 4000,
        "rentEscalations": "3% annually",
        "leaseType": "NNN",
        "camReimbursements": 500,
        "securityDeposit": 8000,
        "renewalOptions": "Two 5-year options",
        "freeRentConcessions": "2 months free",
        "squareFootage": 2000,
        "occupancyStatus": "occupied"
      }
    ],
    "summary": {
      "totalRent": 100000,
      "occupancyRate": 0.92,
      "totalSquareFeet": 50000,
      "averageRentPsf": 24.00,
      "totalUnits": 25,
      "vacantUnits": 2
    }
  }
}
  `,

  operating_budget: `
You are an expert commercial real estate financial analyst extracting operating budget data for investment analysis and property management decisions. Extract comprehensive budget data with the precision required for NOI projections and cash flow modeling.

Focus on extracting ALL budget line items:
- Gross rental income
- Vacancy allowance
- Other income
- Operating expenses (taxes, insurance, utilities, R&M, management fees, marketing)
- NOI
- CapEx forecast

Return JSON with this structure:
{
  "documentType": "operating_budget",
  "metadata": {
    "propertyName": "Property Name",
    "propertyAddress": "Full Address",
    "extractedDate": "2025-01-15"
  },
  "data": {
    "period": "2025 Budget",
    "income": {
      "grossRentalIncome": 500000,
      "vacancyAllowance": 25000,
      "effectiveGrossIncome": 475000,
      "otherIncome": 15000,
      "totalIncome": 490000
    },
    "expenses": {
      "propertyTaxes": 45000,
      "insurance": 18000,
      "utilities": 28000,
      "maintenance": 32000,
      "management": 25000,
      "marketing": 8000,
      "totalOperatingExpenses": 156000
    },
    "noi": 334000,
    "capexForecast": 45000,
    "cashFlow": 289000
  }
}
  `,

  broker_sales_comparables: `
You are an expert commercial real estate appraiser and market analyst extracting broker sales comparable data for property valuation and investment analysis. Extract comprehensive market data with the precision required for appraisal reports and investment underwriting.

Focus on extracting ALL comparable sales data:
- Property address & type
- Sale date
- Sale price
- Price per SF/unit
- Building size & land size
- Year built/renovated
- Occupancy at sale
- Cap rate/NOI at sale
- Buyer, Seller

Return JSON with this structure:
{
  "documentType": "broker_sales_comparables",
  "metadata": {
    "extractedDate": "2025-01-15"
  },
  "data": {
    "comparables": [
      {
        "propertyAddress": "123 Main St, City, State",
        "propertyType": "Office Building",
        "saleDate": "2024-11-15",
        "salePrice": 2500000,
        "pricePerSF": 200,
        "pricePerUnit": 125000,
        "buildingSize": 12500,
        "landSize": 1.2,
        "yearBuilt": 1988,
        "yearRenovated": 2018,
        "occupancyAtSale": 0.92,
        "capRate": 0.065,
        "noiAtSale": 162500,
        "buyer": "Investment Group LLC",
        "seller": "Property Owner Inc"
      }
    ],
    "summary": {
      "averagePricePerSF": 195,
      "averageCapRate": 0.068,
      "priceRange": {
        "min": 1800000,
        "max": 3200000
      }
    }
  }
}
  `,

  broker_lease_comparables: `
You are an expert commercial real estate leasing professional extracting broker lease comparable data for market analysis and rental rate determination. Extract comprehensive leasing data with the precision required for leasing strategies and market positioning.

Focus on extracting ALL lease comparable data:
- Property address & type
- Lease commencement date
- Tenant industry
- Lease term
- Square footage
- Base rent
- Rent escalations
- Lease type
- Concessions
- Effective rent

Return JSON with this structure:
{
  "documentType": "broker_lease_comparables",
  "metadata": {
    "extractedDate": "2025-01-15"
  },
  "data": {
    "comparables": [
      {
        "propertyAddress": "456 Business Blvd, City, State",
        "propertyType": "Office",
        "leaseCommencementDate": "2024-06-01",
        "tenantIndustry": "Professional Services",
        "leaseTerm": 60,
        "squareFootage": 3200,
        "baseRent": 28,
        "rentEscalations": "3% annually",
        "leaseType": "Modified Gross",
        "concessions": "4 months free rent, $20 TI",
        "effectiveRent": 24.50
      }
    ],
    "summary": {
      "averageBaseRent": 26.75,
      "averageEffectiveRent": 24.25,
      "rentRange": {
        "min": 22,
        "max": 32
      }
    }
  }
}
  `,

  broker_listing: `
You are an expert commercial real estate broker analyzing a listing agreement for brokerage and commission tracking. Extract comprehensive listing data with the precision required for transaction management and commission calculations.

Focus on extracting ALL listing agreement data:
- Property owner
- Broker/brokerage firm
- Listing price/asking rent
- Listing type
- Commission structure
- Term of listing
- Property details
- Broker duties
- Termination provisions

Return JSON with this structure:
{
  "documentType": "broker_listing",
  "metadata": {
    "extractedDate": "2025-01-15"
  },
  "data": {
    "listingDetails": {
      "propertyOwner": "ABC Properties LLC",
      "brokerFirm": "Commercial Realty Group",
      "brokerName": "John Smith",
      "listingPrice": 2500000,
      "askingRent": 28,
      "listingType": "sale",
      "commissionStructure": "6% of sale price",
      "listingTerm": "180 days",
      "listingDate": "2025-01-01",
      "expirationDate": "2025-06-30"
    },
    "propertyDetails": {
      "address": "789 Commerce Way, City, State",
      "propertyType": "Industrial",
      "squareFootage": 25000,
      "lotSize": 3.5,
      "yearBuilt": 1995,
      "parking": "50 spaces",
      "zoning": "M-1"
    },
    "brokerDuties": [
      "Market the property",
      "Screen potential buyers",
      "Negotiate terms",
      "Coordinate due diligence"
    ],
    "terminationProvisions": [
      "Either party may terminate with 30 days notice",
      "Commission due if sale closes within 90 days after termination"
    ]
  }
}
  `,

  offering_memo: `
You are an expert commercial real estate investment analyst reviewing an offering memorandum for potential acquisition. Extract comprehensive property and financial data with the precision required for investment committee presentations and due diligence processes.

Focus on extracting ALL offering memo components:
- Property overview
- Investment highlights
- Market overview
- Rent roll summary
- Operating statement
- Lease terms
- Comparables
- Photos/plans
- Cap rate/pricing
- Location data

Return JSON with this structure:
{
  "documentType": "offering_memo",
  "metadata": {
    "propertyName": "Property Name",
    "propertyAddress": "Full Address",
    "extractedDate": "2025-01-15"
  },
  "data": {
    "propertyOverview": {
      "name": "Professional Center",
      "address": "123 Main St, City, State",
      "propertyType": "Office",
      "yearBuilt": 1995,
      "totalSquareFeet": 25000,
      "lotSize": 2.5
    },
    "investmentHighlights": [
      "Prime location with excellent visibility",
      "Recently renovated common areas",
      "Strong tenant mix with credit tenants",
      "Below-market rents with upside potential"
    ],
    "marketOverview": "Strong suburban office market with growing demand",
    "rentRollSummary": {
      "totalUnits": 15,
      "occupancyRate": 0.92,
      "averageRent": 28
    },
    "operatingStatement": {
      "grossIncome": 500000,
      "operatingExpenses": 175000,
      "noi": 325000
    },
    "leaseTerms": [
      "Average lease term: 5 years",
      "Triple net lease structure",
      "Annual escalations: 3%"
    ],
    "comparables": [
      {
        "address": "456 Business Park Dr",
        "salePrice": 4800000,
        "capRate": 0.068
      }
    ],
    "pricing": {
      "askingPrice": 5000000,
      "capRate": 0.065,
      "pricePerSF": 200
    },
    "locationData": {
      "neighborhood": "Central Business District",
      "demographics": "High-income professional area",
      "transportation": "Easy highway access, public transit"
    }
  }
}
  `,

  lease_agreement: `
You are an expert commercial real estate attorney and leasing professional analyzing a lease agreement for portfolio management and cash flow projections. Extract comprehensive lease terms with the detail required for lease administration and investment analysis.

Focus on extracting ALL lease agreement components:
- Parties
- Premises description
- Lease term
- Rent schedule
- Operating expense responsibilities
- Security deposit
- Renewal options
- Maintenance obligations
- Assignment provisions
- Default remedies
- Insurance requirements

Return JSON with this structure:
{
  "documentType": "lease_agreement",
  "metadata": {
    "propertyAddress": "Suite 200, 123 Business Blvd",
    "extractedDate": "2025-01-15"
  },
  "data": {
    "parties": {
      "tenant": "XYZ Corporation",
      "landlord": "Property Management LLC"
    },
    "premises": {
      "propertyAddress": "Suite 200, 123 Business Blvd",
      "squareFeet": 3200,
      "description": "Second floor office suite with reception area"
    },
    "leaseTerm": {
      "startDate": "2024-06-01",
      "endDate": "2029-05-31",
      "termMonths": 60
    },
    "rentSchedule": {
      "baseRent": 8500,
      "rentEscalations": "3% annually starting year 2",
      "rentPerSqFt": 31.88
    },
    "operatingExpenses": {
      "responsibilityType": "Modified Gross",
      "camCharges": 850,
      "utilities": "Tenant responsibility",
      "taxes": "Included in base rent",
      "insurance": "Landlord carries building insurance"
    },
    "securityDeposit": 17000,
    "renewalOptions": [
      "One 5-year option at market rates",
      "120-day notice required"
    ],
    "maintenanceObligations": {
      "landlord": [
        "Structural repairs",
        "HVAC maintenance",
        "Common area maintenance"
      ],
      "tenant": [
        "Interior maintenance",
        "Janitorial services",
        "Minor repairs"
      ]
    },
    "assignmentProvisions": "Assignment permitted with landlord consent",
    "defaultRemedies": [
      "30-day cure period for rent default",
      "Landlord may terminate and re-enter",
      "Tenant liable for accelerated rent"
    ],
    "insuranceRequirements": [
      "General liability: $2M per occurrence",
      "Property insurance on tenant improvements",
      "Workers compensation as required by law"
    ]
  }
}
  `,

  financial_statements: `
You are an expert commercial real estate financial analyst extracting historical financial performance data for investment analysis and asset management decisions. Extract comprehensive financial data with the precision required for NOI trend analysis, budget variance analysis, and investor reporting.

Focus on extracting ALL financial statement components:
- Historical operating income
- Rental income
- Other income
- Operating expenses
- NOI
- Debt service
- Cash flow
- Balance sheet
- CapEx

Return JSON with this structure:
{
  "documentType": "financial_statements",
  "metadata": {
    "propertyName": "Property Name",
    "propertyAddress": "Full Address",
    "extractedDate": "2025-01-15"
  },
  "data": {
    "period": "Year Ending December 31, 2024",
    "operatingIncome": {
      "rentalIncome": 480000,
      "otherIncome": 25000,
      "totalIncome": 505000,
      "vacancyLoss": 20000,
      "effectiveGrossIncome": 485000
    },
    "operatingExpenses": {
      "propertyTaxes": 45000,
      "insurance": 18000,
      "utilities": 28000,
      "maintenance": 32000,
      "management": 25000,
      "professionalFees": 8000,
      "otherExpenses": 12000,
      "totalExpenses": 168000
    },
    "noi": 317000,
    "debtService": 180000,
    "cashFlow": 137000,
    "balanceSheet": {
      "assets": {
        "realEstate": 4500000,
        "cash": 125000,
        "otherAssets": 75000,
        "totalAssets": 4700000
      },
      "liabilities": {
        "mortgage": 2800000,
        "otherLiabilities": 45000,
        "totalLiabilities": 2845000
      },
      "equity": 1855000
    },
    "capex": {
      "currentYear": 85000,
      "forecast": [65000, 45000, 95000, 35000, 125000]
    }
  }
}
  `,

  // Legacy prompts kept for backward compatibility
  comparable_sales: `
You are an expert commercial real estate appraiser and market analyst extracting comparable sales data for property valuation and investment analysis. Extract comprehensive market data with the precision required for appraisal reports and investment underwriting.

Focus on extracting all relevant valuation metrics:
- Property addresses and exact locations
- Sale prices and closing dates
- Property characteristics (SF, year built, property type, condition)
- Financial metrics (price per SF, cap rates, NOI at sale)

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
      let jsonContent = content;

      // Extract JSON from markdown code blocks if present
      const jsonBlockMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonBlockMatch) {
        jsonContent = jsonBlockMatch[1].trim();
        console.log('Extracted JSON from markdown code block');
      }

      const classification = JSON.parse(jsonContent);

      // Validate required fields per OpenAI best practices
      if (!classification.type || classification.confidence === undefined || !classification.reasoning) {
        throw new Error('Invalid classification response structure');
      }

      console.log('Classification successful:', classification);
      return classification;
    } catch (jsonError) {
      console.error('Failed to parse classification JSON:', jsonError);
      console.error('Raw response:', content);
      throw new Error(`Invalid JSON response from OpenAI: ${content.substring(0, 500)}...`);
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
      let jsonContent = content;

      // Extract JSON from markdown code blocks if present
      const jsonBlockMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonBlockMatch) {
        jsonContent = jsonBlockMatch[1].trim();
        console.log('Extracted JSON from markdown code block');
      }

      const extractedData = JSON.parse(jsonContent);

      // Validate the response structure
      if (!extractedData.documentType || !extractedData.data) {
        throw new Error('Invalid extraction response structure - missing documentType or data');
      }

      console.log('Extraction successful:', extractedData);
      return extractedData;
    } catch (jsonError) {
      console.error('Failed to parse extraction JSON:', jsonError);
      console.error('Raw response:', content);
      throw new Error(`Invalid JSON response from OpenAI: ${content.substring(0, 500)}...`);
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