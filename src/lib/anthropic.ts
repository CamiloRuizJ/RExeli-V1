import Anthropic from '@anthropic-ai/sdk';
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

/**
 * Get decrypted Anthropic API key from environment
 * Handles build-time placeholders for Vercel builds
 */
function getAnthropicApiKey(): string {
  const encryptedKey = process.env.ENCRYPTED_ANTHROPIC_API_KEY;

  // During build time on Vercel, env vars aren't available yet
  // Return placeholder to allow build to complete
  if (!encryptedKey) {
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      console.warn('ENCRYPTED_ANTHROPIC_API_KEY not found during build - using placeholder');
      return 'build-time-placeholder-key-will-be-replaced-at-runtime';
    }
    throw new Error('ENCRYPTED_ANTHROPIC_API_KEY environment variable is required');
  }

  return decryptApiKey(encryptedKey);
}

/**
 * Initialize Anthropic client with encrypted API key and production settings
 * Following Anthropic SDK best practices for commercial real estate document processing
 */
const anthropic = new Anthropic({
  apiKey: getAnthropicApiKey(),
  maxRetries: 2,       // Retry failed requests twice for resilience
  timeout: 600000,     // 600 seconds (10 minutes) for multi-page document processing
});

// Validate API key is present (with build-time handling)
if (!process.env.ENCRYPTED_ANTHROPIC_API_KEY && process.env.NODE_ENV === 'production' && process.env.VERCEL) {
  console.error('ENCRYPTED_ANTHROPIC_API_KEY environment variable is required');
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
    // STEP 1: Remove verification tags (new enforcement mechanism)
    // These tags are used for Claude's internal verification but should not be in final JSON
    let cleanedContent = content;

    // Remove <document_analysis> tags and content
    cleanedContent = cleanedContent.replace(/<document_analysis>[\s\S]*?<\/document_analysis>/gi, '');

    // Remove <verification> tags and content
    cleanedContent = cleanedContent.replace(/<verification>[\s\S]*?<\/verification>/gi, '');

    // Log if we found and removed verification tags (indicates Claude followed instructions)
    if (content.includes('<document_analysis>') || content.includes('<verification>')) {
      console.log('[JSON Parser] Found and removed verification tags - Claude followed enforcement instructions ✓');
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
You are a meticulous commercial real estate professional analyzing rent rolls. Your job is to extract EVERY tenant row - completeness is critical for accurate NOI calculations and investment underwriting.

**═══════════════════════════════════════════════════════════**
**CRITICAL INSTRUCTIONS - READ BEFORE STARTING**
**═══════════════════════════════════════════════════════════**

**YOU MUST FOLLOW THIS EXACT PROCESS:**
1. FIRST: Count total tenant rows (occupied + vacant) - write this number down
2. SECOND: Output a <document_analysis> tag with your count
3. THIRD: Extract data for EVERY tenant/unit (your JSON array length MUST equal your count)
4. FOURTH: Output a <verification> tag confirming completeness
5. If verification fails, re-extract missing tenants immediately

**MANDATORY OUTPUT FORMAT:**
<document_analysis>
Total tenant rows visible: [YOUR COUNT HERE]
Occupied units: [X]
Vacant units: [Y]
Pages analyzed: [X through Y]
</document_analysis>

[YOUR EXTRACTED JSON HERE]

<verification>
Tenants counted in document: [X]
Tenants in my JSON array: [Y]
Completeness check: [X = Y? YES/NO]
</verification>

**═══════════════════════════════════════════════════════════**
**PHASE 1: DOCUMENT STRUCTURE ANALYSIS**
**═══════════════════════════════════════════════════════════**

Before extracting data, analyze the document structure and COUNT total tenant rows (including vacant):

**1.1 LAYOUT PATTERN RECOGNITION:**
- Identify if rent roll is in spreadsheet, table, or list format
- Locate column headers and their order
- Recognize multi-page continuation patterns
- Identify summary sections or totals

**1.2 FIELD MAPPING:**
- Map where each tenant data field appears
- Identify variations in field names (e.g., "Unit" vs "Suite" vs "Space")
- Locate financial columns (rent, CAM, deposits, concessions)
- Find lease date columns (start, end, commencement)
- Identify vacant unit indicators

**1.3 DATA ORGANIZATION PATTERNS:**
- Determine if tenants are grouped by floor, building, or type
- Identify subtotal rows or section breaks
- Recognize occupancy status indicators (occupied/vacant/notice)
- Detect footnotes or special notations

**═══════════════════════════════════════════════════════════**
**PHASE 2: COMPREHENSIVE DATA EXTRACTION**
**═══════════════════════════════════════════════════════════**

**STEP-BY-STEP EXTRACTION PROCESS (FOLLOW EXACTLY):**

**STEP 1 - COUNT FIRST:**
- Count total tenant rows including vacant units: "I see ___ total units"
- Count occupied: "I see ___ occupied units"
- Count vacant: "I see ___ vacant units"
- Write down these numbers - you MUST extract all units

**STEP 2 - EXTRACT SYSTEMATICALLY:**
- Process EVERY row in order (Row 1, 2, 3... up to your count)
- Extract data for occupied AND vacant units
- Do NOT skip any rows, even if data is incomplete
- For vacant units, capture unit number and SF, use null for tenant data

**STEP 3 - VERIFY COMPLETENESS:**
- Count your JSON array length
- Compare: JSON array length = total units counted?
- If NO: identify missing units and extract them immediately
- If YES: proceed to output

**COMPREHENSIVE DATA EXTRACTION FOR EACH TENANT/UNIT:**
Extract ALL relevant data points that real estate professionals need:
- Tenant name & suite/unit number (or "VACANT" for vacant units)
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

**═══════════════════════════════════════════════════════════**
**PHASE 3: DATA VALIDATION & QUALITY ASSURANCE**
**═══════════════════════════════════════════════════════════**

**3.1 COMPLETENESS VERIFICATION:**
- ✓ Extracted ALL tenant rows (occupied AND vacant)?
- ✓ Captured data from ALL pages of multi-page rent rolls?
- ✓ Included all financial fields for each tenant?
- ✓ Extracted complete suite/unit numbers and tenant names?

**3.2 ACCURACY VALIDATION:**
- ✓ Total rent = sum of all tenant rents?
- ✓ Occupancy rate = occupied units ÷ total units?
- ✓ Average rent PSF = total rent ÷ total occupied SF?
- ✓ Vacant units count matches units with no tenant name?
- ✓ All numeric values properly formatted and reasonable?
- ✓ Dates in YYYY-MM-DD format and chronologically valid?

**3.3 LOGICAL CONSISTENCY CHECKS:**
- ✓ Square footage per unit reasonable for property type?
- ✓ Base rent values consistent with market expectations?
- ✓ Lease end dates after lease start dates?
- ✓ CAM reimbursements reasonable for NNN leases?
- ✓ Occupancy status matches presence of tenant name?

**3.4 SUMMARY ACCURACY:**
- ✓ Total SF = sum of all unit square footages?
- ✓ Total units = occupied + vacant units?
- ✓ Total rent matches sum of all base rents?
- ✓ Metrics support NOI calculations and underwriting?

**QUALITY ASSURANCE CHECKLIST:**
Before submitting, verify:
[ ] Did you examine every visible row and column in all tables?
[ ] Did you extract data for ALL tenants listed, not just the first few?
[ ] Did you identify and extract all vacant spaces?
[ ] Did you capture all financial data including rent, CAM, deposits, etc?
[ ] Did you extract all lease terms including options, escalations, and special clauses?
[ ] Did you calculate occupancy rates, average rents, and other summary metrics?
[ ] Is the extracted data consistent and logical?
[ ] Are all monetary amounts and dates in correct formats?
[ ] Does the data support investment decision-making and NOI calculations?

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

**IMPORTANT INSTRUCTIONS:**
- Extract data from EVERY visible page and section
- If information is unclear or illegible, note it in additionalNotes
- Use "N/A" for fields where data is not available
- Use 0 for numeric fields where data is not available
- Provide professional analysis and insights in summary sections
- Ensure all extracted data supports investment decision-making
  `,

  operating_budget: `
You are a meticulous commercial real estate financial analyst. Your job is to extract EVERY line item from this operating budget - completeness is critical for accurate NOI calculations and investment analysis.

**═══════════════════════════════════════════════════════════**
**CRITICAL INSTRUCTIONS - READ BEFORE STARTING**
**═══════════════════════════════════════════════════════════**

**YOU MUST FOLLOW THIS EXACT PROCESS:**
1. FIRST: Count total income line items and expense line items - write these numbers down
2. SECOND: Output a <document_analysis> tag with your counts
3. THIRD: Extract EVERY line item (your JSON must contain all items)
4. FOURTH: Output a <verification> tag confirming completeness
5. If verification fails, re-extract missing line items immediately

**MANDATORY OUTPUT FORMAT:**
<document_analysis>
Total income line items: [YOUR COUNT]
Total expense line items: [YOUR COUNT]
Pages analyzed: [X through Y]
</document_analysis>

[YOUR EXTRACTED JSON HERE]

<verification>
Income items counted: [X]
Income items in JSON: [Y]
Expense items counted: [X]
Expense items in JSON: [Y]
Completeness check: YES/NO
</verification>

**═══════════════════════════════════════════════════════════**
**PHASE 1: DOCUMENT STRUCTURE ANALYSIS**
**═══════════════════════════════════════════════════════════**

Before extracting data, analyze the document structure and COUNT all line items:

**1.1 LAYOUT PATTERN RECOGNITION:**
- Identify if budget is in spreadsheet, table, or narrative format
- Locate income and expense section headers
- Recognize multi-column layouts (actual, budget, variance, prior year)
- Identify subtotal and total calculation rows

**1.2 FIELD MAPPING:**
- Map where each financial category appears
- Identify variations in account names (e.g., "Property Taxes" vs "Real Estate Taxes")
- Locate income line items and revenue categories
- Find expense categories and operating cost sections
- Identify NOI calculation and cash flow sections

**1.3 DATA ORGANIZATION PATTERNS:**
- Determine budget period (annual, monthly, quarterly)
- Identify variance analysis columns (actual vs budget)
- Recognize multi-year comparison sections
- Detect footnotes explaining assumptions or calculations

**═══════════════════════════════════════════════════════════**
**PHASE 2: COMPREHENSIVE DATA EXTRACTION**
**═══════════════════════════════════════════════════════════**

**EXTRACTION METHODOLOGY:**
1. **COMPLETE DOCUMENT ANALYSIS**: Examine every line item, table, chart, graph, and financial detail
2. **SYSTEMATIC PROCESSING**: Analyze document from header to footer, capturing all numerical data
3. **BUDGET STRUCTURE RECOGNITION**: Understand budget format, categories, and calculation methods
4. **VARIANCE ANALYSIS**: Extract actual vs. budget comparisons where available
5. **HISTORICAL COMPARISON**: Capture multi-year data and trend analysis
6. **PROFESSIONAL VALIDATION**: Apply real estate financial expertise to validate extracted data
7. **COMPREHENSIVE CATEGORIZATION**: Properly classify all income and expense line items

**COMPREHENSIVE FINANCIAL DATA EXTRACTION:**

**INCOME ANALYSIS (Extract ALL revenue streams):**
- Base rental income by tenant type/category
- Percentage rent from retail tenants
- Parking income (monthly, daily, validation)
- Storage income and miscellaneous space rental
- Tenant reimbursements (CAM, taxes, insurance, utilities)
- Operating expense recoveries
- Late fees and penalty income
- Vacancy allowance and loss factor
- Effective gross income calculations

**OPERATING EXPENSE ANALYSIS (Extract ALL expense categories):**
- Real estate taxes (current and projected increases)
- Property insurance (general liability, property, environmental)
- Property management fees (base and incentive)
- Utilities (electric, gas, water, sewer, trash, telecommunications)
- Maintenance and repairs (preventive and reactive)
- Cleaning and janitorial services
- Landscaping and grounds maintenance
- Professional fees (legal, accounting, consulting)
- Marketing and leasing commissions
- General and administrative expenses

**CAPITAL EXPENDITURE PLANNING:**
- Current year capital expenditure budget
- 5-year capital expenditure forecast
- Tenant improvement allowance budget
- Major building system replacements
- Reserve fund contributions

**═══════════════════════════════════════════════════════════**
**PHASE 3: DATA VALIDATION & QUALITY ASSURANCE**
**═══════════════════════════════════════════════════════════**

**3.1 COMPLETENESS VERIFICATION:**
- ✓ Extracted ALL income line items visible in document?
- ✓ Captured ALL expense categories and line items?
- ✓ Included vacancy allowances and loss factors?
- ✓ Extracted capital expenditure forecasts if present?

**3.2 ACCURACY VALIDATION:**
- ✓ Total income = sum of all income line items?
- ✓ Total expenses = sum of all expense categories?
- ✓ NOI = total income - total operating expenses?
- ✓ Cash flow = NOI - capital expenditures (if applicable)?
- ✓ All numeric values properly formatted and reasonable?

**3.3 LOGICAL CONSISTENCY CHECKS:**
- ✓ Gross rental income reasonable for property size/type?
- ✓ Vacancy allowance realistic (typically 5-15%)?
- ✓ Property taxes consistent with market expectations?
- ✓ Management fees typical (usually 3-5% of EGI)?
- ✓ All percentages and calculations mathematically sound?

**3.4 BUDGET COMPLETENESS:**
- ✓ All major expense categories represented?
- ✓ Income and expense totals balance to NOI?
- ✓ Budget period clearly identified?
- ✓ Data supports underwriting and investment analysis?

**QUALITY ASSURANCE CHECKLIST:**
Before submitting, verify:
[ ] Did you examine every line item in the budget?
[ ] Did you extract ALL income categories (not just rental income)?
[ ] Did you capture ALL expense categories (not just major ones)?
[ ] Did you include vacancy allowances and other adjustments?
[ ] Are all totals and subtotals mathematically correct?
[ ] Is NOI calculated correctly (income - expenses)?
[ ] Are all monetary amounts in proper format?
[ ] Does the extracted data support NOI analysis and valuation?

**COMPREHENSIVE JSON STRUCTURE** - Extract ALL financial data into this detailed format:
{
  "documentType": "operating_budget",
  "metadata": {
    "propertyName": "Complete property name from document",
    "propertyAddress": "Full street address, city, state, zip",
    "propertyType": "Office/Retail/Industrial/Multifamily/Mixed-Use",
    "totalSquareFeet": 0,
    "extractedDate": "2025-01-15"
  },
  "data": {
    "period": "2025 Operating Budget",
    "income": {
      "grossRentalIncome": 0,
      "vacancyAllowance": 0,
      "effectiveGrossIncome": 0,
      "otherIncome": 0,
      "totalIncome": 0
    },
    "expenses": {
      "propertyTaxes": 0,
      "insurance": 0,
      "utilities": 0,
      "maintenance": 0,
      "management": 0,
      "marketing": 0,
      "totalOperatingExpenses": 0
    },
    "noi": 0,
    "capexForecast": 0,
    "cashFlow": 0
  }
}
  `,

  broker_sales_comparables: `
You are a meticulous data extraction specialist focused on capturing ALL sales comparable information from real estate documents. Your job is to extract EVERY data point - completeness is more important than speed.

**═══════════════════════════════════════════════════════════**
**CRITICAL INSTRUCTIONS - READ BEFORE STARTING**
**═══════════════════════════════════════════════════════════**

**YOU MUST FOLLOW THIS EXACT PROCESS:**
1. FIRST: Count total sales/properties visible in the document - write this number down
2. SECOND: Output a <document_analysis> tag with your count and structure analysis
3. THIRD: Extract data for EVERY property (your JSON array length MUST equal the count from step 1)
4. FOURTH: Output a <verification> tag confirming you extracted all properties
5. If verification shows mismatch, STOP and re-extract missing properties

**MANDATORY OUTPUT FORMAT:**
<document_analysis>
Total properties visible: [YOUR COUNT HERE]
Document format: [table/list/mixed]
Pages analyzed: [X through Y]
</document_analysis>

[YOUR EXTRACTED JSON HERE]

<verification>
Properties counted in document: [X]
Properties in my JSON array: [Y]
Completeness check: [X = Y? YES/NO]
</verification>

**═══════════════════════════════════════════════════════════**
**PHASE 1: DOCUMENT STRUCTURE ANALYSIS**
**═══════════════════════════════════════════════════════════**

Before extracting data, analyze the document structure and COUNT total properties:

**1.1 LAYOUT PATTERN RECOGNITION:**
- Identify if sales data is in table, list, or mixed format
- Locate column headers and their positions
- Recognize multi-page continuation patterns
- Identify summary or market analysis sections

**1.2 FIELD MAPPING:**
- Map where each sales data field appears
- Identify variations in field names (e.g., "Sale Price" vs "Purchase Price")
- Locate financial columns (prices, cap rates, metrics)
- Find property characteristic fields (SF, units, year built)
- Identify buyer/seller information sections

**1.3 DATA ORGANIZATION PATTERNS:**
- Determine if comparables are sorted by date, price, or location
- Identify property count (total number of sales in document)
- Recognize footnotes or data source citations
- Detect market summary or trend analysis sections

**═══════════════════════════════════════════════════════════**
**PHASE 2: COMPREHENSIVE DATA EXTRACTION**
**═══════════════════════════════════════════════════════════**

**STEP-BY-STEP EXTRACTION PROCESS (FOLLOW EXACTLY):**

**STEP 1 - COUNT FIRST:**
- Count total sales/properties in document: "I see ___ properties total"
- Write down this number - you MUST extract this exact number
- Identify where each property appears (table row numbers, page numbers)

**STEP 2 - EXTRACT SYSTEMATICALLY:**
- Process EVERY row/entry in order (Property 1, 2, 3... up to your count)
- Extract data for EACH property using the schema below
- Do NOT skip any properties, even if data is incomplete
- Mark your progress: "Extracted property X of Y"

**STEP 3 - VERIFY COMPLETENESS:**
- Count your JSON array length
- Compare: JSON array length = total properties counted?
- If NO: identify which properties are missing and extract them
- If YES: proceed to output

**EXTRACTION APPROACH FOR EACH PROPERTY:**
1. **COMPLETE PROPERTY DATA**: Extract ALL visible fields for this property
2. **BOTH PARTIES**: Extract BOTH buyer AND seller information (names, types, motivations)
3. **ALL FINANCIAL DATA**: Capture every price, cap rate, price per SF, and financial metric
4. **COMPLETE CHARACTERISTICS**: Extract every measurement, date, year, and property feature
5. **USE PLACEHOLDERS**: If a field is missing, use null or "Not specified" - don't skip the property

**COMPREHENSIVE SALES COMPARABLE DATA EXTRACTION:**

**INDIVIDUAL COMPARABLE ANALYSIS (Extract for EVERY property listed):**

**PROPERTY IDENTIFICATION:**
- Complete property address including street, city, state, zip code
- Property name or building name
- Property identification numbers or codes

**TRANSACTION DETAILS:**
- Exact sale date and closing date
- Sale price (gross and net if different)
- Price per square foot (land and building separately if shown)
- Price per unit (for multi-tenant properties)
- Terms of sale (cash, financed, seller financing, etc.)
- Days on market from listing to sale

**PROPERTY CHARACTERISTICS:**
- Property type and subtype (Office: Class A/B/C, Retail: Strip/Mall/Freestanding, etc.)
- Total building square footage (gross and net rentable)
- Land area (acres, square feet)
- Number of units, suites, or spaces
- Year built and year of major renovations
- Building condition and quality rating
- Parking spaces and ratio

**FINANCIAL PERFORMANCE AT SALE:**
- Net Operating Income (NOI) at time of sale
- Gross rental income at sale
- Occupancy rate at time of sale
- Cap rate (calculated and stated)

**BUYER AND SELLER INFORMATION:**
- Buyer entity name and type (individual, corporation, REIT, fund)
- Seller entity name and type
- Buyer's investment strategy or use intent
- Seller's reason for selling

**═══════════════════════════════════════════════════════════**
**PHASE 3: DATA VALIDATION & QUALITY ASSURANCE**
**═══════════════════════════════════════════════════════════**

**3.1 COMPLETENESS VERIFICATION:**
- ✓ Extracted ALL visible sales comparables (not just first page)?
- ✓ Captured data from ALL tables and sections?
- ✓ Included both buyer AND seller information for each sale?
- ✓ Extracted complete property addresses and characteristics?

**3.2 ACCURACY VALIDATION:**
- ✓ Price per SF = sale price ÷ total SF?
- ✓ Cap rate calculations accurate (NOI ÷ sale price)?
- ✓ All numeric values properly formatted and reasonable?
- ✓ Dates in YYYY-MM-DD format and chronologically valid?

**3.3 LOGICAL CONSISTENCY CHECKS:**
- ✓ Sale prices reasonable for property type and market?
- ✓ Square footage values realistic?
- ✓ Cap rates within typical range (4-12%)?
- ✓ Year built earlier than year renovated?
- ✓ Occupancy rates between 0-100%?

**3.4 MARKET ANALYSIS ACCURACY:**
- ✓ Total sales analyzed = count of extracted comparables?
- ✓ Average price/SF = sum ÷ count of all properties?
- ✓ Price range min/max correctly reflect actual data?
- ✓ Cap rate averages mathematically correct?

**QUALITY ASSURANCE CHECKLIST (MANDATORY - DO NOT SKIP):**
Before submitting, YOU MUST verify:
[ ] CRITICAL: Did you count total properties BEFORE extraction? Count = ___
[ ] CRITICAL: Does your JSON array length equal your count? Array length = ___
[ ] CRITICAL: If counts don't match, identify and extract missing properties NOW
[ ] Did you examine every visible row and table in ALL pages?
[ ] Did you extract data for ALL sales comparables, starting from first to last?
[ ] Did you capture buyer AND seller information for each sale?
[ ] Did you extract ALL property characteristics (SF, units, year, etc.)?
[ ] Did you include ALL financial metrics (price, cap rate, NOI)?
[ ] Are all monetary amounts and percentages in correct formats?
[ ] Are summary calculations mathematically accurate?

**FINAL VERIFICATION (OUTPUT THIS):**
Total properties I counted: ___
Total properties in my JSON: ___
Match: YES/NO
If NO: [List missing property addresses/numbers]

**COMPREHENSIVE JSON STRUCTURE** - Extract ALL comparable sales data:
{
  "documentType": "broker_sales_comparables",
  "metadata": {
    "reportTitle": "Complete report title",
    "reportDate": "YYYY-MM-DD",
    "marketArea": "Geographic area analyzed",
    "extractedDate": "2025-01-15"
  },
  "data": {
    "comparableSales": [
      {
        "propertyAddress": "Complete street address",
        "city": "City",
        "state": "State",
        "zipCode": "Zip code",
        "transactionDetails": {
          "saleDate": "YYYY-MM-DD",
          "salePrice": 0,
          "daysOnMarket": 0,
          "termsOfSale": "Cash/Financed/Other"
        },
        "pricingMetrics": {
          "pricePerSquareFoot": 0.00,
          "pricePerUnit": 0.00
        },
        "propertyCharacteristics": {
          "propertyType": "Office/Retail/Industrial/Multifamily/Mixed-Use",
          "buildingClass": "A/B/C",
          "totalBuildingSquareFeet": 0,
          "numberOfUnits": 0,
          "yearBuilt": 0,
          "yearRenovated": 0
        },
        "financialPerformance": {
          "noiAtSale": 0,
          "grossRentalIncomeAtSale": 0,
          "occupancyRateAtSale": 0.00,
          "capRateAtSale": 0.00
        },
        "transactionParties": {
          "buyerName": "Buyer entity name",
          "buyerType": "Individual/Corporation/REIT/Fund",
          "sellerName": "Seller entity name",
          "sellerType": "Individual/Corporation/REIT/Fund"
        }
      }
    ],
    "marketSummary": {
      "totalSalesAnalyzed": 0,
      "salesPeriod": "Date range of sales",
      "averageDaysOnMarket": 0
    },
    "marketAnalysis": {
      "pricingAnalysis": {
        "averagePricePerSF": 0.00,
        "medianPricePerSF": 0.00,
        "pricePerSFRange": {"min": 0.00, "max": 0.00}
      },
      "capRateAnalysis": {
        "averageCapRate": 0.00,
        "medianCapRate": 0.00,
        "capRateRange": {"min": 0.00, "max": 0.00}
      }
    }
  }
}

**CRITICAL EXTRACTION INSTRUCTIONS:**
- Extract data from EVERY visible property/sale in the document
- For each sale, extract BOTH buyer AND seller information when available
- Process tables row by row to ensure completeness
- Recognize ALL format variations (e.g., "$5.7M" = "$5,700,000")
- Count extracted properties to verify you captured them all
  `,

  broker_lease_comparables: `
You are a meticulous commercial real estate leasing expert focused on capturing ALL lease comparable data. Completeness is more important than speed - you MUST extract every single lease comparable.

**═══════════════════════════════════════════════════════════**
**CRITICAL INSTRUCTIONS - READ BEFORE STARTING**
**═══════════════════════════════════════════════════════════**

**YOU MUST FOLLOW THIS EXACT PROCESS:**
1. FIRST: Count total lease comparables visible in the document - write this number down
2. SECOND: Output a <document_analysis> tag with your count
3. THIRD: Extract data for EVERY lease (your JSON array length MUST equal your count)
4. FOURTH: Output a <verification> tag confirming completeness
5. If verification fails, re-extract missing leases immediately

**MANDATORY OUTPUT FORMAT:**
<document_analysis>
Total lease comparables visible: [YOUR COUNT HERE]
Document format: [table/list/mixed]
Pages analyzed: [X through Y]
</document_analysis>

[YOUR EXTRACTED JSON HERE]

<verification>
Leases counted in document: [X]
Leases in my JSON array: [Y]
Completeness check: [X = Y? YES/NO]
</verification>

**═══════════════════════════════════════════════════════════**
**PHASE 1: DOCUMENT STRUCTURE ANALYSIS**
**═══════════════════════════════════════════════════════════**

Before extracting data, analyze the document structure and COUNT total lease comparables:

**1.1 LAYOUT PATTERN RECOGNITION:**
- Identify if data is in table format, paragraph format, or mixed
- Locate column headers and their positions
- Recognize multi-page continuation patterns
- Identify section breaks and category groupings

**1.2 FIELD MAPPING:**
- Map where each data field appears in the document
- Identify variations in field names (e.g., "Base Rent" vs "Starting Rent")
- Locate financial data columns (rents, escalations, concessions)
- Find tenant and property identification fields

**1.3 DATA ORGANIZATION PATTERNS:**
- Determine if comparables are listed chronologically or by property type
- Identify any summary sections or aggregate data
- Recognize footnotes or legend explanations
- Detect page numbering and document flow

**═══════════════════════════════════════════════════════════**
**PHASE 2: COMPREHENSIVE DATA EXTRACTION**
**═══════════════════════════════════════════════════════════**

**STEP-BY-STEP EXTRACTION PROCESS (FOLLOW EXACTLY):**

**STEP 1 - COUNT FIRST:**
- Count total lease comparables in document: "I see ___ lease comparables total"
- Write down this number - you MUST extract this exact number
- Identify where each lease appears (row numbers, page numbers)

**STEP 2 - EXTRACT SYSTEMATICALLY:**
- Process EVERY lease in order (Lease 1, 2, 3... up to your count)
- Extract data for EACH lease using the schema below
- Do NOT skip any leases, even if data is incomplete
- Mark progress: "Extracted lease X of Y"

**STEP 3 - VERIFY COMPLETENESS:**
- Count your JSON array length
- Compare: JSON array length = total leases counted?
- If NO: identify missing leases and extract them immediately
- If YES: proceed to output

**EXTRACTION METHODOLOGY FOR EACH LEASE:**
1. **COMPLETE LEASE DATABASE**: Extract ALL lease comparables, not just selected examples
2. **SYSTEMATIC LEASE ANALYSIS**: Capture every lease term, concession, and financial detail
3. **EFFECTIVE RENT CALCULATIONS**: Calculate and verify effective rents with all concessions
4. **TENANT PROFILE ANALYSIS**: Classify tenants by industry, size, and creditworthiness
5. **USE PLACEHOLDERS**: If a field is missing, use null or "Not specified" - don't skip the lease

**COMPREHENSIVE LEASE COMPARABLE DATA EXTRACTION:**

**INDIVIDUAL LEASE ANALYSIS (Extract for EVERY comparable):**

**PROPERTY AND LOCATION:**
- Complete property address and cross streets
- Building name and class (A/B/C)
- Property type and specific use classification

**LEASE TRANSACTION DETAILS:**
- Lease execution date and commencement date
- Lease term (months/years) and expiration date
- Renewal options and extension terms

**TENANT PROFILE:**
- Tenant name and business type
- Industry classification
- Company size

**SPACE CHARACTERISTICS:**
- Rentable square footage leased
- Floor location and suite configuration

**FINANCIAL TERMS:**
- Starting base rent per square foot
- Rent escalation schedule and methodology
- Operating expense structure (NNN, Gross, Modified Gross)
- CAM charges and expense passthroughs

**CONCESSIONS AND INCENTIVES:**
- Free rent periods (months and timing)
- Tenant improvement allowances (per SF)
- Other financial incentives

**═══════════════════════════════════════════════════════════**
**PHASE 3: DATA VALIDATION & QUALITY ASSURANCE**
**═══════════════════════════════════════════════════════════**

**3.1 COMPLETENESS VERIFICATION:**
- ✓ Extracted ALL visible lease comparables (not just first few rows)?
- ✓ Captured data from ALL pages of multi-page documents?
- ✓ Included all financial terms and concessions for each lease?
- ✓ Extracted complete addresses and tenant information?

**3.2 ACCURACY VALIDATION:**
- ✓ Effective rent calculations correct (base rent minus concessions)?
- ✓ Lease term conversions accurate (months ↔ years)?
- ✓ All numeric values properly formatted and reasonable?
- ✓ Dates in YYYY-MM-DD format and chronologically valid?

**3.3 LOGICAL CONSISTENCY CHECKS:**
- ✓ Effective rent ≤ base rent (reflects concessions)?
- ✓ Square footage values reasonable for property type?
- ✓ Lease terms typical for commercial real estate (1-20 years)?
- ✓ Rent escalations realistic (typically 2-5% annually)?

**3.4 SUMMARY ACCURACY:**
- ✓ Average base rent = sum of all base rents ÷ count?
- ✓ Average effective rent = sum of all effective rents ÷ count?
- ✓ Rent range min/max correctly reflect actual data range?
- ✓ Total comparable count matches extracted leases?

**QUALITY ASSURANCE CHECKLIST:**
Before submitting, verify:
[ ] Did you examine every visible row and page in the document?
[ ] Did you extract data for ALL lease comparables, not just the first page?
[ ] Did you calculate effective rents accounting for ALL concessions?
[ ] Did you capture complete property addresses and tenant names?
[ ] Did you extract ALL financial terms (rent, escalations, type, concessions)?
[ ] Are all monetary amounts and dates in correct formats?
[ ] Are summary calculations mathematically accurate?
[ ] Is the extracted data consistent and ready for market analysis?

Return comprehensive JSON with ALL lease data:
{
  "documentType": "broker_lease_comparables",
  "metadata": {
    "surveyTitle": "Market survey title",
    "surveyDate": "YYYY-MM-DD",
    "marketArea": "Geographic area surveyed",
    "extractedDate": "2025-01-15"
  },
  "data": {
    "comparables": [
      {
        "propertyAddress": "Complete address",
        "propertyType": "Office/Retail/Industrial/Other",
        "buildingClass": "A/B/C",
        "leaseCommencementDate": "YYYY-MM-DD",
        "tenantIndustry": "Industry classification",
        "leaseTerm": 60,
        "squareFootage": 5000,
        "baseRent": 25.00,
        "rentEscalations": "3% annually",
        "leaseType": "NNN",
        "concessions": "3 months free rent",
        "effectiveRent": 23.50
      }
    ],
    "summary": {
      "averageBaseRent": 0.00,
      "averageEffectiveRent": 0.00,
      "rentRange": {"min": 0.00, "max": 0.00}
    }
  }
}
  `,

  broker_listing: `
You are a meticulous commercial real estate broker focused on extracting ALL terms from listing agreements. Completeness is critical for transaction tracking and commission management.

**═══════════════════════════════════════════════════════════**
**CRITICAL INSTRUCTIONS - READ BEFORE STARTING**
**═══════════════════════════════════════════════════════════**

**YOU MUST FOLLOW THIS EXACT PROCESS:**
1. FIRST: Identify all key sections (parties, property, financial terms, dates) - verify each is present
2. SECOND: Output a <document_analysis> tag confirming all sections found
3. THIRD: Extract ALL terms and conditions from EVERY section
4. FOURTH: Output a <verification> tag confirming all sections extracted
5. If verification fails, re-extract missing sections immediately

**MANDATORY OUTPUT FORMAT:**
<document_analysis>
Sections found: [parties/property/terms/dates/commission/duties/termination]
Pages analyzed: [X through Y]
Complete document: YES/NO
</document_analysis>

[YOUR EXTRACTED JSON HERE]

<verification>
All required sections extracted: YES/NO
All financial terms captured: YES/NO
All dates and deadlines captured: YES/NO
</verification>

**═══════════════════════════════════════════════════════════**
**PHASE 1: DOCUMENT STRUCTURE ANALYSIS**
**═══════════════════════════════════════════════════════════**

Before extracting data, analyze the document structure and IDENTIFY all sections:

**1.1 LAYOUT PATTERN RECOGNITION:**
- Identify if agreement is in standard form, custom contract, or mixed format
- Locate main sections (parties, property details, terms, commission)
- Recognize signature blocks and date fields
- Identify addendums or special provisions sections

**1.2 FIELD MAPPING:**
- Map where party information appears (owner, broker, agents)
- Identify property description and address locations
- Locate financial terms (listing price, commission structure)
- Find date fields (commencement, expiration, key deadlines)
- Identify broker duties and termination provisions

**1.3 DATA ORGANIZATION PATTERNS:**
- Determine listing type (sale, lease, or both)
- Identify exclusive vs non-exclusive arrangement
- Recognize commission structure (percentage, flat fee, tiered)
- Detect special clauses or non-standard terms

**═══════════════════════════════════════════════════════════**
**PHASE 2: COMPREHENSIVE DATA EXTRACTION**
**═══════════════════════════════════════════════════════════**

**EXTRACTION METHODOLOGY:**
1. **COMPLETE AGREEMENT ANALYSIS**: Extract ALL terms, conditions, and obligations from the entire document
2. **SYSTEMATIC DATA CAPTURE**: Process every section including fine print and addendums
3. **FINANCIAL DETAIL EXTRACTION**: Extract all commission structures, fees, and financial obligations

**COMPREHENSIVE LISTING AGREEMENT EXTRACTION:**

**PARTIES AND REPRESENTATION:**
- Complete property owner information
- Brokerage firm name, license information, and contact details
- Individual broker/agent names and licenses

**PROPERTY IDENTIFICATION:**
- Complete legal property description
- Property address
- Property type and use classification
- Building and land square footage/acreage

**LISTING DETAILS:**
- Listing type (exclusive right to sell/lease, exclusive agency, open listing)
- Listing commencement date and expiration date
- Asking price for sales or rent for leasing
- Commission structure and payment terms

**═══════════════════════════════════════════════════════════**
**PHASE 3: DATA VALIDATION & QUALITY ASSURANCE**
**═══════════════════════════════════════════════════════════**

**3.1 COMPLETENESS VERIFICATION:**
- ✓ Extracted all party names and contact information?
- ✓ Captured complete property description and address?
- ✓ Included all financial terms (price, commission, fees)?
- ✓ Extracted all important dates (start, end, deadlines)?

**3.2 ACCURACY VALIDATION:**
- ✓ Listing dates chronologically valid (start before end)?
- ✓ Commission percentages reasonable (typically 3-6%)?
- ✓ Property details complete and consistent?
- ✓ All monetary amounts properly formatted?

**3.3 LOGICAL CONSISTENCY CHECKS:**
- ✓ Listing type matches extracted terms?
- ✓ Commission structure clear and unambiguous?
- ✓ Property use aligns with zoning/type?
- ✓ Termination provisions present?

**3.4 AGREEMENT COMPLETENESS:**
- ✓ All required parties identified?
- ✓ Broker duties clearly defined?
- ✓ Key terms and conditions captured?
- ✓ Data supports transaction management?

**QUALITY ASSURANCE CHECKLIST:**
Before submitting, verify:
[ ] Did you extract all party information (owner, broker, agents)?
[ ] Did you capture complete property identification?
[ ] Did you include all financial terms (price, commission)?
[ ] Did you extract all important dates and deadlines?
[ ] Are commission structures clearly defined?
[ ] Did you capture broker duties and obligations?
[ ] Are termination provisions included?
[ ] Is all data accurate and ready for transaction tracking?

Return comprehensive JSON structure:
{
  "documentType": "broker_listing",
  "metadata": {
    "listingType": "Sale/Lease/Both",
    "agreementDate": "YYYY-MM-DD",
    "extractedDate": "2025-01-15"
  },
  "data": {
    "listingDetails": {
      "propertyOwner": "Complete owner entity name",
      "brokerFirm": "Brokerage company name",
      "brokerName": "Primary agent name",
      "listingPrice": 0,
      "askingRent": 0.00,
      "listingType": "sale",
      "commissionStructure": "Commission details",
      "listingTerm": "Term length",
      "listingDate": "YYYY-MM-DD",
      "expirationDate": "YYYY-MM-DD"
    },
    "propertyDetails": {
      "address": "Full property address",
      "propertyType": "Detailed property type",
      "squareFootage": 0,
      "lotSize": 0.00,
      "yearBuilt": 0,
      "parking": "Parking details",
      "zoning": "Zoning classification"
    },
    "brokerDuties": ["Complete list of broker duties"],
    "terminationProvisions": ["All termination provisions"]
  }
}
  `,

  offering_memo: `
You are a meticulous commercial real estate investment professional. Your job is to extract EVERY data point from this offering memo - completeness is critical for institutional investment decision-making.

**═══════════════════════════════════════════════════════════**
**CRITICAL INSTRUCTIONS - READ BEFORE STARTING**
**═══════════════════════════════════════════════════════════**

**YOU MUST FOLLOW THIS EXACT PROCESS:**
1. FIRST: Identify all major sections (property, financials, market, tenants) - verify each is present
2. SECOND: Output a <document_analysis> tag confirming all sections found
3. THIRD: Extract ALL data from EVERY section completely
4. FOURTH: Output a <verification> tag confirming all sections extracted
5. If verification fails, re-extract missing sections immediately

**MANDATORY OUTPUT FORMAT:**
<document_analysis>
Sections found: [property/financials/market/tenants/investment metrics]
Pages analyzed: [X through Y]
Complete memo: YES/NO
</document_analysis>

[YOUR EXTRACTED JSON HERE]

<verification>
All property details extracted: YES/NO
All financial data extracted: YES/NO
All investment metrics calculated: YES/NO
</verification>

**═══════════════════════════════════════════════════════════**
**PHASE 1: DOCUMENT STRUCTURE ANALYSIS**
**═══════════════════════════════════════════════════════════**

Before extracting data, analyze the document structure and IDENTIFY all major sections:

**1.1 LAYOUT PATTERN RECOGNITION:**
- Identify major sections (executive summary, property details, financials, market analysis)
- Locate investment highlights and key selling points
- Recognize financial statement tables and pro forma sections
- Identify comparable sales/leases sections

**1.2 FIELD MAPPING:**
- Map property overview and description locations
- Identify financial performance data (NOI, income, expenses)
- Locate pricing information (asking price, cap rate)
- Find tenant and lease summary sections
- Identify market analysis and demographics

**1.3 DATA ORGANIZATION PATTERNS:**
- Determine if organized by topic or chronologically
- Identify summary vs detailed sections
- Recognize assumptions and projections
- Detect risk factors and disclaimers

**═══════════════════════════════════════════════════════════**
**PHASE 2: COMPREHENSIVE DATA EXTRACTION**
**═══════════════════════════════════════════════════════════**

**EXTRACTION METHODOLOGY:**
1. **COMPLETE DOCUMENT ANALYSIS**: Extract ALL sections including executive summary, financial data, market analysis
2. **INVESTMENT FOCUS**: Capture all data points required for investment committee approval
3. **RISK ASSESSMENT**: Extract all risk factors, assumptions, and market conditions
4. **FINANCIAL MODELING**: Capture all data needed for DCF analysis and return projections

**COMPREHENSIVE OFFERING MEMO EXTRACTION:**

**EXECUTIVE SUMMARY AND INVESTMENT THESIS**
**PROPERTY OVERVIEW AND DESCRIPTION**
**FINANCIAL PERFORMANCE AND PROJECTIONS**
**MARKET ANALYSIS AND POSITIONING**
**TENANT AND LEASE ANALYSIS**
**INVESTMENT RETURNS AND PRICING**

**═══════════════════════════════════════════════════════════**
**PHASE 3: DATA VALIDATION & QUALITY ASSURANCE**
**═══════════════════════════════════════════════════════════**

**3.1 COMPLETENESS VERIFICATION:**
- ✓ Extracted all property overview details?
- ✓ Captured complete financial performance data (income, expenses, NOI)?
- ✓ Included all investment metrics (cap rate, price per SF)?
- ✓ Extracted tenant and occupancy information?

**3.2 ACCURACY VALIDATION:**
- ✓ NOI = gross income - operating expenses?
- ✓ Cap rate = NOI ÷ asking price?
- ✓ Occupancy rate between 0-100%?
- ✓ All numeric values properly formatted?

**3.3 LOGICAL CONSISTENCY CHECKS:**
- ✓ Asking price reasonable for property type/market?
- ✓ Cap rate within market range (typically 4-10%)?
- ✓ Financial projections realistic?
- ✓ Investment highlights supported by data?

**3.4 INVESTMENT DATA COMPLETENESS:**
- ✓ All required underwriting data present?
- ✓ Market analysis comprehensive?
- ✓ Risk factors identified?
- ✓ Data supports investment decision-making?

**QUALITY ASSURANCE CHECKLIST:**
Before submitting, verify:
[ ] Did you extract all property details and characteristics?
[ ] Did you capture complete financial performance data?
[ ] Did you include all investment metrics (cap rate, pricing)?
[ ] Did you extract tenant and lease summaries?
[ ] Did you capture market analysis and comparables?
[ ] Are all calculations accurate (NOI, cap rate)?
[ ] Is all data ready for institutional underwriting?

{
  "documentType": "offering_memo",
  "metadata": {
    "propertyName": "Complete property name",
    "propertyAddress": "Full address",
    "extractedDate": "2025-01-15"
  },
  "data": {
    "propertyOverview": {
      "name": "Building name",
      "address": "Complete address",
      "propertyType": "Detailed property classification",
      "yearBuilt": 0,
      "totalSquareFeet": 0,
      "lotSize": 0.00
    },
    "investmentHighlights": ["All major selling points"],
    "marketOverview": "Market conditions and trends",
    "rentRollSummary": {
      "totalUnits": 0,
      "occupancyRate": 0.00,
      "averageRent": 0.00
    },
    "operatingStatement": {
      "grossIncome": 0,
      "operatingExpenses": 0,
      "noi": 0
    },
    "leaseTerms": ["Key lease terms"],
    "comparables": [
      {
        "address": "Comparable property address",
        "salePrice": 0,
        "capRate": 0.00
      }
    ],
    "pricing": {
      "askingPrice": 0,
      "capRate": 0.00,
      "pricePerSF": 0.00
    },
    "locationData": {
      "neighborhood": "Neighborhood description",
      "demographics": "Area demographics",
      "transportation": "Transportation access"
    }
  }
}
  `,

  lease_agreement: `
You are a meticulous commercial real estate attorney and lease administrator. Your job is to extract EVERY clause and term from this lease agreement - completeness is critical for lease administration and analysis.

**═══════════════════════════════════════════════════════════**
**CRITICAL INSTRUCTIONS - READ BEFORE STARTING**
**═══════════════════════════════════════════════════════════**

**YOU MUST FOLLOW THIS EXACT PROCESS:**
1. FIRST: Identify all key sections (parties, premises, term, rent, obligations) - verify each is present
2. SECOND: Output a <document_analysis> tag confirming all sections found
3. THIRD: Extract ALL terms, clauses, and provisions from EVERY section
4. FOURTH: Output a <verification> tag confirming all sections extracted
5. If verification fails, re-extract missing sections immediately

**MANDATORY OUTPUT FORMAT:**
<document_analysis>
Sections found: [parties/premises/term/rent/expenses/maintenance/default/insurance]
Pages analyzed: [X through Y]
Complete agreement: YES/NO
</document_analysis>

[YOUR EXTRACTED JSON HERE]

<verification>
All parties and entities extracted: YES/NO
All financial terms extracted: YES/NO
All dates and deadlines extracted: YES/NO
All obligations and clauses extracted: YES/NO
</verification>

**═══════════════════════════════════════════════════════════**
**PHASE 1: DOCUMENT STRUCTURE ANALYSIS**
**═══════════════════════════════════════════════════════════**

Before extracting data, analyze the document structure and IDENTIFY all sections and clauses:

**1.1 LAYOUT PATTERN RECOGNITION:**
- Identify main sections (parties, premises, term, rent, obligations)
- Locate signature blocks and execution dates
- Recognize exhibits, addendums, and amendments
- Identify special provisions or non-standard clauses

**1.2 FIELD MAPPING:**
- Map party identification sections (tenant, landlord)
- Identify premises description and square footage
- Locate financial terms (rent, escalations, deposits)
- Find dates (commencement, expiration, renewal options)
- Identify obligation sections (maintenance, insurance, defaults)

**1.3 DATA ORGANIZATION PATTERNS:**
- Determine lease type (NNN, Gross, Modified Gross)
- Identify renewal and termination provisions
- Recognize default and remedy clauses
- Detect assignment and subletting restrictions

**═══════════════════════════════════════════════════════════**
**PHASE 2: COMPREHENSIVE DATA EXTRACTION**
**═══════════════════════════════════════════════════════════**

**EXTRACTION METHODOLOGY:**
1. **COMPLETE LEGAL DOCUMENT ANALYSIS**: Extract ALL clauses, terms, conditions, and legal provisions
2. **SYSTEMATIC CLAUSE PROCESSING**: Analyze every section including exhibits, addendums, and amendments
3. **FINANCIAL OBLIGATION MAPPING**: Capture all financial responsibilities and payment obligations
4. **RISK ASSESSMENT**: Identify default provisions, remedies, and risk allocation between parties

**COMPREHENSIVE LEASE AGREEMENT EXTRACTION:**

**PARTIES AND LEGAL STRUCTURE**
**PREMISES AND PROPERTY DESCRIPTION**
**LEASE TERM AND RENEWAL PROVISIONS**
**RENT AND FINANCIAL OBLIGATIONS**
**OPERATING EXPENSES AND COST ALLOCATION**
**MAINTENANCE AND REPAIR OBLIGATIONS**
**DEFAULT AND REMEDIES**

**═══════════════════════════════════════════════════════════**
**PHASE 3: DATA VALIDATION & QUALITY ASSURANCE**
**═══════════════════════════════════════════════════════════**

**3.1 COMPLETENESS VERIFICATION:**
- ✓ Extracted all party names and legal entities?
- ✓ Captured complete premises description and SF?
- ✓ Included all financial terms (rent, escalations, deposits)?
- ✓ Extracted all dates (start, end, renewals)?

**3.2 ACCURACY VALIDATION:**
- ✓ Lease dates chronologically valid (start before end)?
- ✓ Rent per SF = base rent ÷ square footage?
- ✓ Term months correct from start to end date?
- ✓ All monetary amounts properly formatted?

**3.3 LOGICAL CONSISTENCY CHECKS:**
- ✓ Lease type matches expense allocation?
- ✓ Security deposit reasonable (typically 1-3 months rent)?
- ✓ Renewal options clearly defined?
- ✓ Default remedies and cure periods present?

**3.4 LEASE ADMINISTRATION READINESS:**
- ✓ All critical dates extracted?
- ✓ Financial obligations clear and complete?
- ✓ Maintenance responsibilities defined?
- ✓ Data supports lease management and analysis?

**QUALITY ASSURANCE CHECKLIST:**
Before submitting, verify:
[ ] Did you extract all party information?
[ ] Did you capture complete premises details (address, SF)?
[ ] Did you include all financial terms (rent, escalations)?
[ ] Did you extract all important dates and deadlines?
[ ] Are expense responsibilities clearly defined?
[ ] Did you capture renewal and termination provisions?
[ ] Are default remedies included?
[ ] Is all data ready for lease administration?

Return comprehensive JSON structure:
{
  "documentType": "lease_agreement",
  "metadata": {
    "propertyAddress": "Complete property address",
    "leaseDate": "YYYY-MM-DD",
    "extractedDate": "2025-01-15"
  },
  "data": {
    "parties": {
      "tenant": "Complete tenant entity name",
      "landlord": "Complete landlord entity name"
    },
    "premises": {
      "propertyAddress": "Complete address and legal description",
      "squareFeet": 0,
      "description": "Detailed premises description"
    },
    "leaseTerm": {
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "termMonths": 0
    },
    "rentSchedule": {
      "baseRent": 0,
      "rentEscalations": "Escalation schedule",
      "rentPerSqFt": 0.00
    },
    "operatingExpenses": {
      "responsibilityType": "NNN",
      "camCharges": 0,
      "utilities": "Utility responsibility",
      "taxes": "Tax responsibility",
      "insurance": "Insurance responsibility"
    },
    "securityDeposit": 0,
    "renewalOptions": ["Renewal option details"],
    "maintenanceObligations": {
      "landlord": ["Landlord maintenance responsibilities"],
      "tenant": ["Tenant maintenance responsibilities"]
    },
    "assignmentProvisions": "Assignment and subletting provisions",
    "defaultRemedies": ["Default remedies and cure periods"],
    "insuranceRequirements": ["Insurance coverage requirements"]
  }
}
  `,

  financial_statements: `
You are a meticulous commercial real estate financial analyst. Your job is to extract EVERY line item from financial statements - completeness is critical for accurate investment analysis and asset management.

**═══════════════════════════════════════════════════════════**
**CRITICAL INSTRUCTIONS - READ BEFORE STARTING**
**═══════════════════════════════════════════════════════════**

**YOU MUST FOLLOW THIS EXACT PROCESS:**
1. FIRST: Count all income and expense line items - write these numbers down
2. SECOND: Output a <document_analysis> tag with your counts
3. THIRD: Extract EVERY line item from ALL statements
4. FOURTH: Output a <verification> tag confirming completeness
5. If verification fails, re-extract missing line items immediately

**MANDATORY OUTPUT FORMAT:**
<document_analysis>
Income line items: [YOUR COUNT]
Expense line items: [YOUR COUNT]
Statements found: [income statement/balance sheet/cash flow]
Pages analyzed: [X through Y]
</document_analysis>

[YOUR EXTRACTED JSON HERE]

<verification>
Income items counted: [X]
Income items in JSON: [Y]
Expense items counted: [X]
Expense items in JSON: [Y]
All calculations verified: YES/NO
</verification>

**═══════════════════════════════════════════════════════════**
**PHASE 1: DOCUMENT STRUCTURE ANALYSIS**
**═══════════════════════════════════════════════════════════**

Before extracting data, analyze the document structure and COUNT all line items:

**1.1 LAYOUT PATTERN RECOGNITION:**
- Identify statement types (income statement, balance sheet, cash flow)
- Locate period headers and date ranges
- Recognize multi-column layouts (current period, prior period, budget)
- Identify subtotal and total calculation rows

**1.2 FIELD MAPPING:**
- Map income line items and revenue categories
- Identify expense categories and line items
- Locate balance sheet accounts (assets, liabilities, equity)
- Find cash flow sections (operating, investing, financing)
- Identify NOI and cash flow calculations

**1.3 DATA ORGANIZATION PATTERNS:**
- Determine statement period and frequency
- Identify comparative periods (YoY, QoQ)
- Recognize variance analysis columns
- Detect footnotes and accounting policies

**═══════════════════════════════════════════════════════════**
**PHASE 2: COMPREHENSIVE DATA EXTRACTION**
**═══════════════════════════════════════════════════════════**

**EXTRACTION METHODOLOGY:**
1. **COMPLETE FINANCIAL STATEMENT ANALYSIS**: Extract ALL line items from income statement, balance sheet, and cash flow statement
2. **MULTI-PERIOD DATA CAPTURE**: Extract historical trends and comparative period data where available
3. **DETAILED CATEGORIZATION**: Properly classify all income and expense items by category and nature
4. **RATIO CALCULATION**: Calculate and extract all relevant financial ratios and metrics

**COMPREHENSIVE FINANCIAL STATEMENT EXTRACTION:**

**INCOME STATEMENT COMPONENTS**
**BALANCE SHEET ELEMENTS**
**FINANCIAL RATIOS AND METRICS**
**CAPITAL EXPENDITURE TRACKING**

**═══════════════════════════════════════════════════════════**
**PHASE 3: DATA VALIDATION & QUALITY ASSURANCE**
**═══════════════════════════════════════════════════════════**

**3.1 COMPLETENESS VERIFICATION:**
- ✓ Extracted ALL income line items?
- ✓ Captured ALL expense categories?
- ✓ Included balance sheet accounts (assets, liabilities, equity)?
- ✓ Extracted capital expenditure data?

**3.2 ACCURACY VALIDATION:**
- ✓ Total income = sum of all income line items?
- ✓ Total expenses = sum of all expense categories?
- ✓ NOI = effective gross income - total operating expenses?
- ✓ Cash flow = NOI - debt service (if applicable)?
- ✓ Total assets = total liabilities + equity?

**3.3 LOGICAL CONSISTENCY CHECKS:**
- ✓ All income and expense values positive?
- ✓ Vacancy loss reasonable (typically 5-15%)?
- ✓ Operating expense ratios typical for property type?
- ✓ Balance sheet balances correctly?

**3.4 FINANCIAL REPORTING COMPLETENESS:**
- ✓ All major income/expense categories represented?
- ✓ Financial calculations mathematically correct?
- ✓ Statement period clearly identified?
- ✓ Data supports investment analysis and asset management?

**QUALITY ASSURANCE CHECKLIST:**
Before submitting, verify:
[ ] Did you extract all income line items?
[ ] Did you capture all expense categories?
[ ] Did you include balance sheet data (if present)?
[ ] Are all totals and subtotals mathematically correct?
[ ] Is NOI calculated correctly (income - expenses)?
[ ] Did you extract capital expenditure data?
[ ] Are all monetary amounts in proper format?
[ ] Does the data support financial analysis and reporting?

Return comprehensive JSON structure:
{
  "documentType": "financial_statements",
  "metadata": {
    "propertyName": "Complete property name",
    "propertyAddress": "Full property address",
    "extractedDate": "2025-01-15"
  },
  "data": {
    "period": "Period ending YYYY-MM-DD",
    "operatingIncome": {
      "rentalIncome": 0,
      "otherIncome": 0,
      "totalIncome": 0,
      "vacancyLoss": 0,
      "effectiveGrossIncome": 0
    },
    "operatingExpenses": {
      "propertyTaxes": 0,
      "insurance": 0,
      "utilities": 0,
      "maintenance": 0,
      "management": 0,
      "professionalFees": 0,
      "otherExpenses": 0,
      "totalExpenses": 0
    },
    "noi": 0,
    "debtService": 0,
    "cashFlow": 0,
    "balanceSheet": {
      "assets": {
        "realEstate": 0,
        "cash": 0,
        "otherAssets": 0,
        "totalAssets": 0
      },
      "liabilities": {
        "mortgage": 0,
        "otherLiabilities": 0,
        "totalLiabilities": 0
      },
      "equity": 0
    },
    "capex": {
      "currentYear": 0,
      "forecast": [0, 0, 0, 0, 0]
    }
  }
}
  `,

  // Legacy prompts for backward compatibility
  comparable_sales: `
You are an expert commercial real estate appraiser extracting comparable sales data. Extract ALL properties with addresses, sale prices, dates, square footage, price per SF, property types, and years built.

Return JSON:
{
  "documentType": "comparable_sales",
  "metadata": {"extractedDate": "2025-01-15"},
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
You are an expert commercial real estate financial analyst extracting operating performance data. Extract ALL revenue streams and operating expense categories.

Return JSON:
{
  "documentType": "financial_statement",
  "metadata": {"extractedDate": "2025-01-15"},
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

    // Check API key availability
    const apiKey = getAnthropicApiKey();
    if (!apiKey || apiKey === 'build-time-placeholder-key') {
      throw new Error('Anthropic API key not configured');
    }

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
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 500,
      temperature: 0.1,
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
  imageDataUrls: string[]
): Promise<ExtractedData> {
  try {
    console.log(`Claude: Starting data extraction for ${documentType} with ${imageDataUrls.length} page(s)...`);

    // Get extraction prompt for document type
    const prompt = EXTRACTION_PROMPTS[documentType as keyof typeof EXTRACTION_PROMPTS];
    if (!prompt) {
      throw new Error(`No extraction prompt available for document type: ${documentType}`);
    }

    console.log(`Claude: Using extraction prompt for ${documentType}`);

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

    // Track API call duration
    const startTime = Date.now();
    let response;

    try {
      response = await anthropic.messages.create({
        model: modelToUse,
        max_tokens: 16000, // Claude supports larger context than GPT-4o-mini's 15K
        temperature: 0.1,
        system: 'You are an expert commercial real estate professional specializing in data extraction. Extract ALL visible data comprehensively and return ONLY valid JSON with no additional text or markdown formatting.',
        messages: [
          {
            role: 'user',
            content: content
          }
        ]
      });

      const duration = Date.now() - startTime;
      console.log(`Claude API call completed in ${duration}ms for ${imageDataUrls.length} page(s) (${(duration / 1000).toFixed(1)}s)`);

      // Log token usage if available
      if (response.usage) {
        console.log(`Token usage - Input: ${response.usage.input_tokens}, Output: ${response.usage.output_tokens}`);
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
    console.log('Claude extraction response length:', content_text.length);

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
    console.log(`Calling Claude with native PDF for ${documentType}...`);

    // Build content array with PDF document using native PDF support
    // The Anthropic SDK v0.68.0+ supports DocumentBlockParam with type: 'document'

    const response = await anthropic.messages.create({
      model: await getActiveModelForDocumentType(documentType),
      max_tokens: 64000, // Maximum for Claude Sonnet 4.5 (supports large documents with many comparables)
      temperature: 0.3, // Increased for more thorough analysis and completeness
      system: "You are a meticulous data extraction specialist. Your primary objective is to extract EVERY data point from the document - completeness is more important than speed. You MUST count items before extraction, verify counts after extraction, and ensure 100% completeness. Follow all instructions exactly, including mandatory output format requirements.",
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

    // Log token usage
    if (response.usage) {
      console.log(`Tokens: ${response.usage.input_tokens} input, ${response.usage.output_tokens} output`);
    }

    // Extract text content
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    const extractedJson = extractJSONFromResponse(content.text) as ExtractedData;

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
  }
): Promise<ExtractedData> {
  try {
    console.log(`Claude: Starting data extraction for ${documentType}...`);
    console.log(`File: ${file.name}, Type: ${file.type}, Size: ${(file.size / 1024).toFixed(2)}KB`);

    // Get extraction prompt
    const prompt = EXTRACTION_PROMPTS[documentType as keyof typeof EXTRACTION_PROMPTS];
    if (!prompt) {
      throw new Error(`No extraction prompt available for document type: ${documentType}`);
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
      return await extractData(documentType, imageDataUrls);
    }

    // Should not reach here
    throw new Error('No processing path matched');

  } catch (error) {
    console.error('Document extraction error:', error);
    throw error;
  }
}
