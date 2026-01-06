import Anthropic from '@anthropic-ai/sdk';
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

/**
 * Get Anthropic API key from environment
 * Called at runtime to ensure we get the actual key, not a build-time placeholder
 */
function getAnthropicApiKey(): string {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not configured');
  }

  return apiKey;
}

/**
 * Lazy-initialized Anthropic client
 * Created on first use to ensure environment variables are available at runtime
 */
let _anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!_anthropicClient) {
    const apiKey = getAnthropicApiKey();
    console.log('Initializing Anthropic client with API key:', apiKey.substring(0, 10) + '...');

    _anthropicClient = new Anthropic({
      apiKey: apiKey,
      maxRetries: 2,       // Retry failed requests twice for resilience
      timeout: 600000,     // 600 seconds (10 minutes) for multi-page document processing
    });
  }
  return _anthropicClient;
}

/**
 * Get the active Claude model for a document type
 * Currently returns Claude Sonnet 4.5 for all types
 * TODO: Integrate with fine-tuning system when Claude fine-tuning becomes available
 */
async function getActiveModelForDocumentType(documentType: DocumentType): Promise<string> {
  // For now, always use Claude Sonnet 4.5
  // In the future, this could return fine-tuned models per document type
  const model = 'claude-sonnet-4-5-20250929';
  console.log(`Using Claude model for ${documentType}: ${model}`);
  return model;
}

/**
 * Extract JSON from Claude response content
 * Handles markdown code blocks and attempts basic cleanup
 */
function extractJSONFromResponse(content: string): any {
  try {
    // STEP 1: Extract and log verification tag content BEFORE removal
    // These tags contain critical debugging info (counts, completeness checks)
    let cleanedContent = content;

    // Extract <document_analysis> content
    const docAnalysisMatch = content.match(/<document_analysis>([\s\S]*?)<\/document_analysis>/i);
    if (docAnalysisMatch) {
      const analysisContent = docAnalysisMatch[1].trim();
      console.log('═══════════════════════════════════════════════════════════');
      console.log('[DOCUMENT ANALYSIS] Claude counted items before extraction:');
      console.log(analysisContent);
      console.log('═══════════════════════════════════════════════════════════');
      cleanedContent = cleanedContent.replace(/<document_analysis>[\s\S]*?<\/document_analysis>/gi, '');
    }

    // Extract <verification> content
    const verificationMatch = content.match(/<verification>([\s\S]*?)<\/verification>/i);
    if (verificationMatch) {
      const verificationContent = verificationMatch[1].trim();
      console.log('═══════════════════════════════════════════════════════════');
      console.log('[VERIFICATION CHECK] Claude verified extraction completeness:');
      console.log(verificationContent);
      console.log('═══════════════════════════════════════════════════════════');
      cleanedContent = cleanedContent.replace(/<verification>[\s\S]*?<\/verification>/gi, '');
    }

    // Log if verification tags were found
    if (docAnalysisMatch || verificationMatch) {
      console.log('[JSON Parser] ✓ Claude followed enforcement instructions and provided verification data');
    } else {
      console.warn('[JSON Parser] ⚠ No verification tags found - Claude may not have followed counting instructions');
    }

    // STEP 2: Try parsing as JSON first
    try {
      return JSON.parse(cleanedContent);
    } catch (firstError) {
      console.log('Direct JSON parse failed, attempting extraction from markdown...');

      // STEP 3: Extract from markdown code blocks (```json ... ```)
      const jsonBlockMatch = cleanedContent.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonBlockMatch) {
        const extracted = jsonBlockMatch[1].trim();
        console.log('Extracted JSON from markdown code block');
        return JSON.parse(extracted);
      }

      // STEP 4: Try extracting any code block
      const anyBlockMatch = cleanedContent.match(/```\s*([\s\S]*?)\s*```/);
      if (anyBlockMatch) {
        const extracted = anyBlockMatch[1].trim();
        console.log('Extracted content from generic code block');
        return JSON.parse(extracted);
      }

      // STEP 5: Attempt basic cleanup: remove markdown formatting
      const cleaned = cleanedContent
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();

      console.log('Attempting to parse cleaned content');
      return JSON.parse(cleaned);
    }
  } catch (extractError) {
    console.error('Failed to extract and parse JSON from response:', extractError);
    throw new Error(`Could not parse JSON from Claude response. First 500 chars: ${content.substring(0, 500)}`);
  }
}

/**
 * Classification prompt for document type identification
 * Instructs Claude to identify one of 8 commercial real estate document types
 */
const CLASSIFICATION_PROMPT = `You are an expert commercial real estate professional with 20+ years of experience in property investment, valuation, and portfolio management. Your expertise includes analyzing all types of commercial real estate documents for investment firms, property managers, and real estate professionals.

Analyze this document image with the precision of a seasoned commercial real estate analyst and classify it into one of these categories:

1. RENT_ROLL - Contains tenant information, unit/suite numbers, rental rates, lease terms, occupancy data, tenant mix analysis
2. OPERATING_BUDGET - Financial statements, operating budgets, income/expense projections, NOI calculations
3. BROKER_SALES_COMPARABLES - Market data showing recent property sales with pricing information, cap rates, price per square foot analysis
4. BROKER_LEASE_COMPARABLES - Lease comparable data with rental rates, concessions, lease terms for market analysis
5. BROKER_LISTING - Broker listing agreements with property owner, commission structures, marketing terms
6. OFFERING_MEMO - Marketing material for property sales/acquisitions, includes property details, financial projections, investment highlights
7. LEASE_AGREEMENT - Legal document between landlord and tenant with lease terms, rent escalations, CAM charges, tenant improvements
8. FINANCIAL_STATEMENTS - Income/expense statements, cash flow analysis, balance sheets, T-12 statements

As a real estate professional, focus on identifying key indicators that matter for investment decisions and property valuation.

Respond with this exact JSON structure:
{
  "type": "rent_roll|operating_budget|broker_sales_comparables|broker_lease_comparables|broker_listing|offering_memo|lease_agreement|financial_statements",
  "confidence": 0.95,
  "reasoning": "Brief explanation of classification decision based on real estate investment criteria"
}`;

/**
 * Specialized extraction prompts for each document type
 * Comprehensive prompts that instruct Claude on what data to extract and how to structure it
 */
const EXTRACTION_PROMPTS = {
  rent_roll: `
You are an expert commercial real estate analyst extracting rent roll data from this document.

**ACCURACY RULES:**
- Extract ALL data that appears in the document - be thorough and comprehensive
- NEVER invent or hallucinate data that is not in the document
- Use null for fields where data is genuinely not present
- Understand column headers intelligently - documents may use different naming conventions
  (e.g., "Unit #" = suiteUnit, "Monthly Rent" = baseRent, "Sq Ft" = squareFootage)

**FORMATTING:**
- Prices: Include "$" prefix (e.g., "$4,000")
- Percentages: Include "%" suffix (e.g., "92%")
- Dates: YYYY-MM-DD format when possible
- Square feet: number only

**EXTRACT ALL VISIBLE COLUMNS - Common rent roll fields include:**
- tenantName (use "VACANT" for vacant/empty units)
- suiteUnit / unitNumber / space
- squareFootage / rentableSF / usableSF
- baseRent / monthlyRent / annualRent (specify if monthly or annual)
- leaseStart / leaseEnd / expirationDate
- leaseType (NNN, Gross, Modified Gross, etc.)
- rentPerSF / rentPSF
- escalations / annualIncrease
- camCharges / operatingExpenses / additionalRent
- securityDeposit
- options / renewalOptions
- notes / comments

**IMPORTANT:** Include ANY additional columns that appear in the document, even if not listed above.
Use the exact column names from the document when possible.

Return JSON:
{
  "documentType": "rent_roll",
  "metadata": {
    "propertyName": "from document or null",
    "propertyAddress": "from document or null",
    "asOfDate": "date shown on rent roll or null",
    "extractedDate": "YYYY-MM-DD"
  },
  "data": {
    "tenants": [
      {
        "tenantName": "Actual tenant name",
        "suiteUnit": "101",
        "squareFootage": 2000,
        "baseRent": "$4,000",
        "leaseStart": "2024-01-01",
        "leaseEnd": "2026-12-31"
      }
    ],
    "summary": {
      "totalUnits": null,
      "totalSquareFootage": null,
      "occupiedSquareFootage": null,
      "occupancyRate": null,
      "totalMonthlyRent": null
    }
  }
}
  `,

  operating_budget: `
You are an expert commercial real estate analyst extracting operating budget/pro forma data.

**ACCURACY RULES:**
- Extract ALL line items that appear in the document - be thorough
- NEVER invent data - only extract what's visible
- Use null for missing values
- Understand document structure - budgets may be organized by category

**FORMATTING:**
- Amounts: Include "$" prefix (e.g., "$150,000")
- Percentages: Include "%" suffix
- Dates: YYYY-MM-DD format

**EXTRACT ALL VISIBLE LINE ITEMS - Common categories include:**

INCOME:
- grossPotentialRent / scheduledRent
- vacancyLoss / vacancy
- effectiveGrossIncome
- otherIncome (parking, laundry, etc.)
- reimbursements / recoveries
- totalIncome / totalRevenue

EXPENSES:
- propertyTaxes / realEstateTaxes
- insurance
- utilities (electric, gas, water, trash)
- repairs / maintenance
- management / propertyManagement
- administrative / general
- payroll / salaries
- landscaping / groundsKeeping
- security
- legal / professional
- reserves / replacementReserves
- totalExpenses / totalOperatingExpenses

BOTTOM LINE:
- noi / netOperatingIncome
- debtService
- cashFlow

Return JSON:
{
  "documentType": "operating_budget",
  "metadata": {
    "propertyName": null,
    "propertyAddress": null,
    "budgetPeriod": "2024" or "2024-2025",
    "extractedDate": "YYYY-MM-DD"
  },
  "data": {
    "income": {
      "grossPotentialRent": null,
      "vacancyLoss": null,
      "effectiveGrossIncome": null,
      "otherIncome": null,
      "totalIncome": null
    },
    "expenses": {
      "propertyTaxes": null,
      "insurance": null,
      "utilities": null,
      "management": null,
      "maintenance": null,
      "totalExpenses": null
    },
    "noi": null,
    "lineItems": []
  }
}

Include a "lineItems" array with ALL individual budget items exactly as they appear.
  `,

  broker_sales_comparables: `
You are an expert commercial real estate analyst extracting sales comparable data.

**ACCURACY RULES:**
- Extract ALL properties/sales shown in the document
- NEVER invent data - only extract what's visible
- Use null for fields not present
- Understand that different brokers format comparables differently

**FORMATTING:**
- Prices: Include "$" prefix (e.g., "$5,700,000" or "$5.7M")
- Percentages: Include "%" suffix (e.g., "5.5%")
- Dates: YYYY-MM-DD format
- Square feet: number only

**EXTRACT ALL VISIBLE FIELDS - Common sales comp fields include:**
- propertyName / name
- propertyAddress / address / location
- city, state, zip
- saleDate / closingDate / transactionDate
- salePrice / price / consideration
- buildingSize / squareFeet / SF / GLA / NRA
- landArea / lotSize / acres
- pricePerSF / pricePSF (extract if shown, don't calculate)
- pricePerUnit (for multifamily)
- capRate / cap
- noi / netOperatingIncome
- occupancy / occupancyRate
- yearBuilt / built
- propertyType / type / use
- propertyClass / class (A, B, C)
- numberOfUnits / units
- buyer / purchaser
- seller / grantor
- brokerNotes / comments

Return JSON:
{
  "documentType": "broker_sales_comparables",
  "metadata": {
    "reportTitle": null,
    "preparedBy": null,
    "reportDate": null,
    "extractedDate": "YYYY-MM-DD"
  },
  "data": {
    "comparableSales": [
      {
        "propertyAddress": "123 Main St, City, ST",
        "saleDate": "2024-06-15",
        "salePrice": "$5,700,000",
        "buildingSize": 50000,
        "pricePerSF": "$114",
        "capRate": "5.5%",
        "propertyType": "Office",
        "yearBuilt": 1995
      }
    ],
    "marketSummary": null
  }
}
  `,

  broker_lease_comparables: `
You are an expert commercial real estate analyst extracting lease comparable data.

**ACCURACY RULES:**
- Extract ALL lease comparables shown in the document
- NEVER invent data - only extract what's visible
- Use null for missing fields
- Understand varying broker formats and terminology

**FORMATTING:**
- Rent: Include "$" and units (e.g., "$25.00/SF/YR" or "$2,500/month")
- Percentages: Include "%" suffix
- Dates: YYYY-MM-DD format

**EXTRACT ALL VISIBLE FIELDS - Common lease comp fields include:**
- propertyName / buildingName
- propertyAddress / address / location
- tenantName / tenant
- suiteUnit / suite / space
- squareFootage / leasedSF / SF
- leaseType (NNN, FSG, MG, IG, etc.)
- baseRent / startingRent / facialRent
- effectiveRent (if shown - don't calculate)
- rentPerSF / rentPSF
- leaseCommencementDate / startDate
- leaseExpirationDate / endDate
- leaseTerm / term (months or years)
- freeRent / abatement / concessions
- tenantImprovements / TI / TIA
- escalations / annualIncreases / bumps
- options / renewalOptions
- executionDate / signedDate
- propertyType / use
- landlord

Return JSON:
{
  "documentType": "broker_lease_comparables",
  "metadata": {
    "surveyTitle": null,
    "preparedBy": null,
    "surveyDate": null,
    "extractedDate": "YYYY-MM-DD"
  },
  "data": {
    "comparables": [
      {
        "propertyAddress": "123 Main St",
        "tenantName": "ABC Corp",
        "squareFootage": 5000,
        "baseRent": "$25.00/SF/YR",
        "leaseType": "NNN",
        "leaseCommencementDate": "2025-04-01",
        "leaseTerm": "60 months"
      }
    ]
  }
}
  `,

  broker_listing: `
You are an expert commercial real estate analyst extracting broker listing data.

**ACCURACY RULES:**
- Extract ALL listing information shown in the document
- NEVER invent data - only extract what's visible
- Use null for missing values

**FORMATTING:**
- Prices: Include "$" prefix
- Percentages: Include "%" suffix
- Dates: YYYY-MM-DD format

**EXTRACT ALL VISIBLE FIELDS including:**
- propertyName / name
- propertyAddress / address
- propertyType / type
- listingPrice / askingPrice / price
- askingRent / leasingRate (for lease listings)
- squareFootage / buildingSize / SF
- landArea / lotSize
- pricePerSF
- capRate (if investment sale)
- noi
- yearBuilt
- zoning
- listingBroker / agent
- brokerFirm / company
- listingDate
- expirationDate
- propertyOwner / owner
- commissionRate / commission
- propertyDescription
- highlights / features

Return JSON:
{
  "documentType": "broker_listing",
  "metadata": {
    "extractedDate": "YYYY-MM-DD"
  },
  "data": {
    "propertyName": null,
    "propertyAddress": null,
    "propertyType": null,
    "listingPrice": null,
    "squareFootage": null,
    "pricePerSF": null,
    "listingDate": null,
    "expirationDate": null,
    "propertyOwner": null,
    "brokerFirm": null,
    "listingBroker": null,
    "description": null,
    "highlights": []
  }
}
  `,

  offering_memo: `
You are an expert commercial real estate analyst extracting offering memorandum data.

**ACCURACY RULES:**
- Extract ALL investment details from the document - be thorough
- NEVER invent data - only extract what's visible
- Use null for missing values
- OMs contain rich data - capture as much as possible

**FORMATTING:**
- Prices: Include "$" prefix
- Percentages: Include "%" suffix
- Dates: YYYY-MM-DD format

**EXTRACT ALL VISIBLE FIELDS including:**

PROPERTY INFORMATION:
- propertyName
- propertyAddress, city, state, zip
- propertyType / assetType
- propertyClass (A, B, C)
- yearBuilt / yearRenovated
- totalSquareFeet / GLA / NRA
- landArea / acres
- numberOfUnits (if multifamily)
- numberOfFloors / stories
- parkingSpaces / parkingRatio
- zoning

FINANCIAL METRICS:
- askingPrice / listPrice / guidancePrice
- pricePerSF / pricePSF
- pricePerUnit (multifamily)
- capRate / goingInCap
- noi / netOperatingIncome
- grossIncome / effectiveGrossIncome
- operatingExpenses
- occupancyRate / occupancy
- averageRent / avgRentPSF

TENANT/LEASE INFO (if included):
- majorTenants / tenantRoster
- walt / weightedAverageLeaseterm
- leaseExpiration schedule

INVESTMENT HIGHLIGHTS:
- investmentHighlights / keyPoints
- locationHighlights
- marketOverview

Return JSON:
{
  "documentType": "offering_memo",
  "metadata": {
    "propertyName": null,
    "propertyAddress": null,
    "preparedBy": null,
    "extractedDate": "YYYY-MM-DD"
  },
  "data": {
    "askingPrice": null,
    "capRate": null,
    "noi": null,
    "totalSquareFeet": null,
    "pricePerSF": null,
    "propertyType": null,
    "yearBuilt": null,
    "occupancyRate": null,
    "investmentHighlights": [],
    "tenantSummary": null
  }
}
  `,

  lease_agreement: `
You are an expert commercial real estate analyst extracting lease agreement data.

**ACCURACY RULES:**
- Extract ALL lease terms and provisions from the document
- NEVER invent data - only extract what's visible
- Use null for missing values
- Leases are detailed - capture key business terms

**FORMATTING:**
- Rent: Include "$" and specify if monthly/annual/PSF
- Percentages: Include "%" suffix
- Dates: YYYY-MM-DD format

**EXTRACT ALL VISIBLE FIELDS including:**

PARTIES:
- tenant / lessee
- landlord / lessor
- guarantor (if any)

PREMISES:
- propertyAddress / premises
- suiteNumber / unit
- squareFeet / rentableArea / usableArea
- floor

TERM:
- leaseCommencementDate / startDate
- leaseExpirationDate / endDate
- leaseTerm (months/years)
- rentCommencementDate (if different)

RENT:
- baseRent / minimumRent
- rentPerSF
- rentSchedule / escalations
- percentageRent (retail)
- additionalRent / CAM / operatingExpenses
- taxEscalations

OTHER TERMS:
- securityDeposit
- tenantImprovementAllowance / TI
- freeRent / abatement
- renewalOptions
- expansionOptions
- terminationRights
- useClause / permittedUse
- assignmentSublet provisions
- parkingAllocation

Return JSON:
{
  "documentType": "lease_agreement",
  "metadata": {
    "propertyAddress": null,
    "extractedDate": "YYYY-MM-DD"
  },
  "data": {
    "tenant": null,
    "landlord": null,
    "premises": null,
    "squareFeet": null,
    "baseRent": null,
    "rentPerSF": null,
    "leaseCommencementDate": null,
    "leaseExpirationDate": null,
    "leaseTerm": null,
    "leaseType": null,
    "securityDeposit": null,
    "renewalOptions": null,
    "rentEscalations": null,
    "additionalTerms": []
  }
}
  `,

  financial_statements: `
You are an expert commercial real estate analyst extracting financial statement data.

**ACCURACY RULES:**
- Extract ALL financial line items from the document
- NEVER invent data - only extract what's visible
- Use null for missing values
- Preserve the document's categorization and structure

**FORMATTING:**
- Amounts: Include "$" prefix
- Percentages: Include "%" suffix
- Dates: YYYY-MM-DD format

**EXTRACT ALL VISIBLE LINE ITEMS including:**

INCOME STATEMENT ITEMS:
- grossPotentialRent / scheduledRent
- vacancyLoss
- concessions
- effectiveGrossIncome
- otherIncome (itemize: parking, laundry, fees, etc.)
- totalRevenue / totalIncome

EXPENSE ITEMS:
- propertyTaxes / realEstateTaxes
- insurance
- utilities (itemize if shown)
- repairs / maintenance
- management / propertyManagement
- administrative
- payroll
- professional fees (legal, accounting)
- marketing
- landscaping
- security
- reserves / replacementReserves
- totalOperatingExpenses

BOTTOM LINE:
- noi / netOperatingIncome
- debtService / mortgagePayment
- cashFlowBeforeTax
- capitalExpenditures

BALANCE SHEET (if included):
- assets, liabilities, equity items

Return JSON:
{
  "documentType": "financial_statements",
  "metadata": {
    "propertyName": null,
    "period": "Year ending 2024" or "Jan-Dec 2024",
    "statementType": "Actual" or "Pro Forma" or "Budget",
    "extractedDate": "YYYY-MM-DD"
  },
  "data": {
    "income": {
      "grossPotentialRent": null,
      "vacancyLoss": null,
      "effectiveGrossIncome": null,
      "otherIncome": null,
      "totalIncome": null
    },
    "expenses": {
      "propertyTaxes": null,
      "insurance": null,
      "utilities": null,
      "management": null,
      "maintenance": null,
      "totalExpenses": null
    },
    "noi": null,
    "lineItems": []
  }
}

Include a "lineItems" array with ALL individual items exactly as they appear in the document.
  `,

  // Legacy prompts for backward compatibility
  comparable_sales: `
You are an expert CRE analyst. Extract ALL sales data from this document.
NEVER invent data. Use null for missing values.

Return JSON with all visible fields:
{
  "documentType": "comparable_sales",
  "metadata": {"extractedDate": "YYYY-MM-DD"},
  "data": {
    "properties": [{"address": null, "salePrice": null, "saleDate": null, "squareFeet": null, "pricePerSF": null}]
  }
}
  `,

  financial_statement: `
You are an expert CRE analyst. Extract ALL financial data from this document.
NEVER invent data. Use null for missing values.

Return JSON with all visible line items:
{
  "documentType": "financial_statement",
  "metadata": {"extractedDate": "YYYY-MM-DD"},
  "data": {
    "period": null,
    "totalRevenue": null,
    "totalExpenses": null,
    "netOperatingIncome": null,
    "lineItems": []
  }
}
  `
};

/**
 * Classify a document using Claude Sonnet 4.5 Vision
 *
 * @param imageDataUrls - Array of base64-encoded image data URLs (supports multi-page documents)
 * @returns DocumentClassification with type, confidence, and reasoning
 *
 * @example
 * const classification = await classifyDocument(['data:image/png;base64,...']);
 */
export async function classifyDocument(imageDataUrls: string[]): Promise<DocumentClassification> {
  try {
    console.log(`Claude: Starting document classification for ${imageDataUrls.length} page(s)...`);

    // Build content array with images and text prompt
    const content: Array<{
      type: 'image';
      source: {
        type: 'base64';
        media_type: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
        data: string;
      };
    } | {
      type: 'text';
      text: string;
    }> = [];

    // Add all images first
    imageDataUrls.forEach((dataUrl) => {
      // Extract media type and base64 data from data URL
      const match = dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
      if (!match) {
        throw new Error('Invalid image data URL format');
      }

      const mediaType = match[1] as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
      const base64Data = match[2];

      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: base64Data
        }
      });
    });

    // Add classification prompt
    content.push({
      type: 'text',
      text: CLASSIFICATION_PROMPT
    });

    // Call Claude API
    const response = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 500,
      temperature: 0.0, // Zero temperature for accurate classification
      stop_sequences: ['</verification>'],
      system: 'You are an expert commercial real estate professional with 20+ years of experience analyzing property investment documents. Respond only with valid JSON.',
      messages: [
        {
          role: 'user',
          content: content
        }
      ]
    });

    console.log('Claude: Classification response received');

    // Extract text content from response
    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in Claude response');
    }

    const content_text = textContent.text;
    console.log('Claude classification response:', content_text);

    // Parse JSON response
    const classification = extractJSONFromResponse(content_text);

    // Validate required fields
    if (!classification.type || classification.confidence === undefined || !classification.reasoning) {
      throw new Error('Invalid classification response structure - missing required fields');
    }

    console.log('Classification successful:', classification);
    return classification;

  } catch (error: unknown) {
    console.error('Document classification error:', error);

    // Handle Anthropic API errors
    if (error && typeof error === 'object' && 'status' in error) {
      const apiError = error as { status?: number; message?: string };
      if (apiError.status === 401) {
        throw new Error('Claude API authentication failed. Please check your API key.');
      } else if (apiError.status === 429) {
        throw new Error('Claude API rate limit exceeded. Please try again later.');
      } else if (apiError.status && apiError.status >= 500) {
        throw new Error('Claude API server error. Please try again later.');
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
 * Extract structured data from a classified document using Claude Sonnet 4.5
 *
 * @param documentType - The classified document type (rent_roll, operating_budget, etc.)
 * @param imageDataUrls - Array of base64-encoded image data URLs (supports multi-page documents)
 * @returns ExtractedData with document type, metadata, and structured data
 *
 * @example
 * const data = await extractData('rent_roll', ['data:image/png;base64,...']);
 */
export async function extractData(
  documentType: DocumentType,
  imageDataUrls: string[],
  customPrompt?: string
): Promise<ExtractedData> {
  try {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  EXTRACTION PATH: IMAGE/MULTI-PAGE (64K tokens, temp 0.0) ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`Claude: Starting data extraction for ${documentType} with ${imageDataUrls.length} page(s)...`);

    // Use custom prompt if provided (includes user instructions), otherwise get default
    let prompt: string;
    if (customPrompt) {
      prompt = customPrompt;
      console.log(`Claude: Using custom prompt with user instructions for ${documentType}`);
    } else {
      const defaultPrompt = EXTRACTION_PROMPTS[documentType as keyof typeof EXTRACTION_PROMPTS];
      if (!defaultPrompt) {
        throw new Error(`No extraction prompt available for document type: ${documentType}`);
      }
      prompt = defaultPrompt;
      console.log(`Claude: Using default extraction prompt for ${documentType}`);
    }

    // Get active model (currently always Claude Sonnet 4.5)
    const modelToUse = await getActiveModelForDocumentType(documentType);

    // Build content array with images and extraction prompt
    const content: Array<{
      type: 'image';
      source: {
        type: 'base64';
        media_type: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
        data: string;
      };
    } | {
      type: 'text';
      text: string;
    }> = [];

    // Add all images first
    imageDataUrls.forEach((dataUrl, index) => {
      // Extract media type and base64 data from data URL
      const match = dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
      if (!match) {
        throw new Error(`Invalid image data URL format for page ${index + 1}`);
      }

      const mediaType = match[1] as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
      const base64Data = match[2];

      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: base64Data
        }
      });
    });

    // Add extraction prompt with multi-page instructions if applicable
    const promptText = imageDataUrls.length > 1
      ? `${prompt}\n\n**MULTI-PAGE DOCUMENT INSTRUCTIONS:**\n- You are viewing ${imageDataUrls.length} pages of this document\n- Extract data from ALL ${imageDataUrls.length} pages\n- Consolidate information across all pages\n- If data spans multiple pages, merge it appropriately\n- Ensure completeness by checking all pages for relevant information`
      : prompt;

    content.push({
      type: 'text',
      text: promptText
    });

    console.log(`Sending ${imageDataUrls.length} image(s) to Claude for extraction`);
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  DIAGNOSTIC: IMAGE PATH API PARAMETERS                     ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  Model: ${modelToUse}`);
    console.log(`║  Temperature: 0.0 (zero for accurate extraction)`);
    console.log(`║  max_tokens: 64000`);
    console.log(`║  Prompt length: ${promptText.length} chars`);
    console.log('╚════════════════════════════════════════════════════════════╝');

    // Track API call duration
    const startTime = Date.now();
    let response;

    try {
      response = await getAnthropicClient().messages.create({
        model: modelToUse,
        max_tokens: 64000,
        temperature: 0.0, // Zero temperature for accurate, deterministic extraction
        stop_sequences: ['</verification>'],
        system: "You are an expert commercial real estate analyst with 20+ years of experience. Your task is to thoroughly extract ALL data from this document. RULES: 1) Extract every piece of data visible in the document - be comprehensive. 2) NEVER invent or hallucinate data that is not in the document. 3) Understand document structure and column headers intelligently (e.g., 'Sq Ft' = squareFootage, 'Mo. Rent' = monthlyRent). 4) Use null only for fields genuinely not present. 5) Format prices with $ prefix, percentages with % suffix. 6) Include any additional fields found in the document, even if not in the template.",
        messages: [
          {
            role: 'user',
            content: content
          }
        ]
      });

      const duration = Date.now() - startTime;
      console.log(`Claude API call completed in ${duration}ms for ${imageDataUrls.length} page(s) (${(duration / 1000).toFixed(1)}s)`);

      // Log token usage with truncation detection
      if (response.usage) {
        const inputTokens = response.usage.input_tokens;
        const outputTokens = response.usage.output_tokens;
        const maxTokens = 16000; // Image path uses 16K max_tokens

        console.log(`Token usage: ${inputTokens} input, ${outputTokens} output (max: ${maxTokens})`);

        // Warn if output is close to max_tokens (likely truncation)
        if (outputTokens >= maxTokens * 0.95) {
          console.error(`⚠️  WARNING: Output tokens (${outputTokens}) near max_tokens limit (${maxTokens})!`);
          console.error('⚠️  Response may be TRUNCATED - Claude may not have finished extraction!');
          console.error('⚠️  This explains missing properties/line items in extraction results!');
          console.error('⚠️  NOTE: Image path uses only 16K tokens (vs 64K for native PDF)');
        } else if (outputTokens >= maxTokens * 0.85) {
          console.warn(`⚠️  CAUTION: Output tokens (${outputTokens}) at 85% of max_tokens (${maxTokens})`);
          console.warn('⚠️  Large document - verify all items were extracted');
        }
      }

    } catch (apiError) {
      const duration = Date.now() - startTime;
      console.error(`Claude API failed after ${duration}ms for ${imageDataUrls.length} page(s):`, apiError);
      throw apiError;
    }

    console.log('Claude: Extraction response received');

    // Extract text content from response
    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in Claude response');
    }

    const content_text = textContent.text;
    console.log(`[Image Path] Raw response length: ${content_text.length} characters`);
    console.log(`[Image Path] Raw response preview (first 500 chars):`);
    console.log(content_text.substring(0, 500));
    console.log(`[Image Path] Raw response preview (last 500 chars):`);
    console.log(content_text.substring(Math.max(0, content_text.length - 500)));

    // Parse JSON response with error recovery
    let extractedData;
    try {
      extractedData = extractJSONFromResponse(content_text);
    } catch (parseError) {
      console.error('Failed to parse extraction JSON:', parseError);
      console.error('Raw response preview:', content_text.substring(0, 500));
      throw new Error(`Invalid JSON response from Claude: ${content_text.substring(0, 500)}...`);
    }

    // Validate response structure
    if (!extractedData.documentType || !extractedData.data) {
      throw new Error('Invalid extraction response structure - missing documentType or data');
    }

    console.log('Extraction successful for document type:', extractedData.documentType);
    return extractedData;

  } catch (error) {
    console.error(`Document extraction error for ${documentType}:`, error);

    // Handle Anthropic API errors with user-friendly messages
    if (error && typeof error === 'object' && 'status' in error) {
      const apiError = error as { status?: number; message?: string };
      if (apiError.status === 401) {
        throw new Error('Claude API authentication failed. Please check your API key.');
      } else if (apiError.status === 429) {
        throw new Error('Claude API rate limit exceeded. Please try again later.');
      } else if (apiError.status && apiError.status >= 500) {
        throw new Error('Claude API server error. Please try again later.');
      }
    }

    // Re-throw with context
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to extract data from ${documentType} document`);
  }
}

/**
 * Convert File to base64 string
 * Server-side implementation using Node.js Buffer
 * @param file - File object (PDF, image, or JSON)
 * @returns Base64 encoded string (without data URL prefix)
 */
async function fileToBase64(file: File): Promise<string> {
  // Server-side: Use Buffer to convert File to base64
  // File object has arrayBuffer() method in both browser and Node.js
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return buffer.toString('base64');
}

/**
 * Estimate PDF page count from file size
 * This is a rough estimation - accurate count requires PDF parsing
 * @param file - PDF file
 * @returns Estimated page count
 */
function estimatePdfPageCount(file: File): number {
  // Rough estimation: ~100KB per page average
  const avgPageSize = 100 * 1024; // 100KB
  return Math.ceil(file.size / avgPageSize);
}

/**
 * Extract data from native PDF using Claude's native PDF support
 * Uses DocumentBlockParam with base64 PDF source (supported in SDK v0.68.0+)
 * @param documentType - Type of document
 * @param pdfBase64 - Base64 encoded PDF
 * @param prompt - Extraction prompt
 * @param userMetadata - Optional user metadata to merge with extracted data
 * @returns Extracted structured data
 */
async function extractDataFromNativePDF(
  documentType: DocumentType,
  pdfBase64: string,
  prompt: string,
  userMetadata?: {
    pdfFileName: string;
    rexeliUserName: string;
    rexeliUserEmail: string;
    extractionTimestamp: string;
    documentId: string;
  }
): Promise<ExtractedData> {
  const startTime = Date.now();

  try {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  EXTRACTION PATH: NATIVE PDF (64K tokens, temp 0.0)       ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`Calling Claude with native PDF for ${documentType}...`);

    // Build content array with PDF document using native PDF support
    // The Anthropic SDK v0.68.0+ supports DocumentBlockParam with type: 'document'

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  DIAGNOSTIC: NATIVE PDF PATH API PARAMETERS                ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  Model: ${await getActiveModelForDocumentType(documentType)}`);
    console.log(`║  Temperature: 0.0 (zero for accurate extraction)`);
    console.log(`║  max_tokens: 64000`);
    console.log(`║  Prompt length: ${prompt.length} chars`);
    console.log('╚════════════════════════════════════════════════════════════╝');

    const response = await getAnthropicClient().messages.create({
      model: await getActiveModelForDocumentType(documentType),
      max_tokens: 64000,
      temperature: 0.0, // Zero temperature for accurate, deterministic extraction
      stop_sequences: ['</verification>'],
      system: "You are an expert commercial real estate analyst with 20+ years of experience. Your task is to thoroughly extract ALL data from this document. RULES: 1) Extract every piece of data visible in the document - be comprehensive. 2) NEVER invent or hallucinate data that is not in the document. 3) Understand document structure and column headers intelligently (e.g., 'Sq Ft' = squareFootage, 'Mo. Rent' = monthlyRent). 4) Use null only for fields genuinely not present. 5) Format prices with $ prefix, percentages with % suffix. 6) Include any additional fields found in the document, even if not in the template.",
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ]
    });

    const duration = Date.now() - startTime;
    console.log(`Claude native PDF response received in ${duration}ms (${(duration / 1000).toFixed(2)}s)`);

    // Log token usage with truncation detection
    if (response.usage) {
      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      const maxTokens = 64000;

      console.log(`Token usage: ${inputTokens} input, ${outputTokens} output (max: ${maxTokens})`);

      // Warn if output is close to max_tokens (likely truncation)
      if (outputTokens >= maxTokens * 0.95) {
        console.error(`⚠️  WARNING: Output tokens (${outputTokens}) near max_tokens limit (${maxTokens})!`);
        console.error('⚠️  Response may be TRUNCATED - Claude may not have finished extraction!');
        console.error('⚠️  This explains missing properties/line items in extraction results!');
      } else if (outputTokens >= maxTokens * 0.85) {
        console.warn(`⚠️  CAUTION: Output tokens (${outputTokens}) at 85% of max_tokens (${maxTokens})`);
        console.warn('⚠️  Large document - verify all items were extracted');
      }
    }

    // Extract text content
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Log raw response preview for debugging
    const rawResponse = content.text;
    console.log(`[Native PDF] Raw response length: ${rawResponse.length} characters`);
    console.log(`[Native PDF] Raw response preview (first 500 chars):`);
    console.log(rawResponse.substring(0, 500));
    console.log(`[Native PDF] Raw response preview (last 500 chars):`);
    console.log(rawResponse.substring(Math.max(0, rawResponse.length - 500)));

    const extractedJson = extractJSONFromResponse(rawResponse) as ExtractedData;

    // Merge user metadata if provided
    if (userMetadata) {
      extractedJson.metadata = {
        ...extractedJson.metadata,
        ...userMetadata
      };
      console.log('[extractDataFromNativePDF] Merged user metadata into extraction result');
    }

    return extractedJson;

  } catch (error) {
    console.error('Native PDF extraction error:', error);

    // Log detailed error information for debugging
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }

    // Re-throw the actual error with context
    if (error instanceof Error) {
      throw new Error(`PDF extraction failed: ${error.message}`);
    }

    throw error;
  }
}

/**
 * Extract structured data from document using Claude Sonnet 4.5
 * Supports hybrid PDF processing and multi-page documents
 *
 * @param file - Document file (PDF, image, or multi-page JSON)
 * @param documentType - Type of document to extract
 * @param userMetadata - User and system metadata to merge with extraction
 * @returns Extracted structured data matching document type schema
 *
 * @example
 * // Single image
 * const data = await extractDocumentData(imageFile, 'rent_roll', userMetadata);
 *
 * // Multi-page PDF (converted to JSON client-side)
 * const data = await extractDocumentData(jsonFile, 'operating_budget', userMetadata);
 */
export async function extractDocumentData(
  file: File,
  documentType: DocumentType,
  userMetadata?: {
    pdfFileName: string;
    rexeliUserName: string;
    rexeliUserEmail: string;
    extractionTimestamp: string;
    documentId: string;
  },
  userInstructions?: string
): Promise<ExtractedData> {
  try {
    console.log(`Claude: Starting data extraction for ${documentType}...`);
    console.log(`File: ${file.name}, Type: ${file.type}, Size: ${(file.size / 1024).toFixed(2)}KB`);

    // Get extraction prompt
    let prompt = EXTRACTION_PROMPTS[documentType as keyof typeof EXTRACTION_PROMPTS];
    if (!prompt) {
      throw new Error(`No extraction prompt available for document type: ${documentType}`);
    }

    // PREPEND user instructions if provided (at START for better influence)
    if (userInstructions?.trim()) {
      console.log(`[Claude] Prepending user instructions to prompt: "${userInstructions.substring(0, 50)}..."`);
      prompt = `═══════════════════════════════════════════════════════════════════════════════
IMPORTANT - USER SPECIAL INSTRUCTIONS (PRIORITIZE THESE REQUIREMENTS):
${userInstructions.trim()}
═══════════════════════════════════════════════════════════════════════════════

${prompt}`;
    }

    let imageDataUrls: string[] = [];
    let numPages = 1;

    // SCENARIO 1: Multi-page JSON (from client-side PDF conversion)
    if (file.type === 'application/json' && file.name.includes('multipage')) {
      console.log('Processing multi-page document (PNG images)...');

      try {
        const fileText = await file.text();
        const multiPageData = JSON.parse(fileText);

        if (multiPageData.type === 'multi-page' && Array.isArray(multiPageData.pages)) {
          numPages = multiPageData.pages.length;
          console.log(`Multi-page document detected: ${numPages} pages`);

          imageDataUrls = multiPageData.pages.map((page: any) =>
            `data:${page.mimeType};base64,${page.imageBase64}`
          );
        } else {
          throw new Error('Invalid multi-page data format');
        }
      } catch (parseError) {
        console.error('Failed to parse multi-page data:', parseError);
        throw new Error('Invalid multi-page document format');
      }
    }
    // SCENARIO 2: PDF file (native PDF support for all page counts)
    else if (file.type === 'application/pdf') {
      // Estimate page count for logging (based on file size - may not reflect actual page count)
      const estimatedPages = estimatePdfPageCount(file);
      console.log(`PDF detected. Estimated ${estimatedPages} pages based on file size (actual page count may vary)`);

      // Use NATIVE PDF support for all PDFs regardless of page count
      // Claude Sonnet 4.5 can handle multi-page PDFs natively
      console.log('Using NATIVE PDF processing for all pages');
      const pdfBase64 = await fileToBase64(file);

      // Call Claude with native PDF - returns ExtractedData directly with merged user metadata
      return await extractDataFromNativePDF(documentType, pdfBase64, prompt, userMetadata);
    }
    // SCENARIO 3: Image file
    else if (file.type.startsWith('image/')) {
      const imageBase64 = await fileToBase64(file);
      const mimeType = file.type;
      imageDataUrls = [`data:${mimeType};base64,${imageBase64}`];
      console.log(`Single image: ${mimeType}`);
    }
    // SCENARIO 4: Unknown/unsupported type
    else {
      throw new Error(
        `Unsupported file type: ${file.type}. ` +
        `Supported types: PDF, JPEG, PNG, GIF, WebP, or multi-page JSON`
      );
    }

    // For PNG/image processing (scenarios 1 & 3), call extractData
    if (imageDataUrls.length > 0) {
      console.log(`Processing ${imageDataUrls.length} image(s) with Claude...`);
      return await extractData(documentType, imageDataUrls, prompt);
    }

    // Should not reach here
    throw new Error('No processing path matched');

  } catch (error) {
    console.error('Document extraction error:', error);
    throw error;
  }
}
