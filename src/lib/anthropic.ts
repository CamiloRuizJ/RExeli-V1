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
 * Handles build-time placeholders for Vercel builds
 */
function getAnthropicApiKey(): string {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // During build time, env vars may not be available yet
  // Return placeholder to allow build to complete
  // Actual values will be used at runtime when the API is called
  if (!apiKey) {
    console.warn('ANTHROPIC_API_KEY not found during build - using placeholder');
    return 'build-time-placeholder-key-will-be-replaced-at-runtime';
  }

  return apiKey;
}

/**
 * Initialize Anthropic client with API key and production settings
 * Following Anthropic SDK best practices for commercial real estate document processing
 */
const anthropic = new Anthropic({
  apiKey: getAnthropicApiKey(),
  maxRetries: 2,       // Retry failed requests twice for resilience
  timeout: 600000,     // 600 seconds (10 minutes) for multi-page document processing
});

// Validate API key is present (with build-time handling)
if (!process.env.ANTHROPIC_API_KEY && process.env.NODE_ENV === 'production' && process.env.VERCEL) {
  console.error('ANTHROPIC_API_KEY environment variable is required');
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
You are a commercial real estate analyst extracting rent roll data. Extract EVERY tenant row (occupied AND vacant) - completeness is critical for NOI calculations.

**EXTRACTION REQUIREMENTS:**
1. Count all tenant rows (occupied + vacant) across all pages
2. Extract complete data for every tenant/unit
3. Verify your JSON array length matches your count
4. Calculate accurate summary metrics

**DATA TO EXTRACT PER TENANT:**
- Tenant name & suite/unit (use "VACANT" for vacant units)
- Lease dates (start, end, commencement)
- Financial terms (base rent, escalations, CAM, deposits, concessions)
- Lease type (NNN, Gross, Modified Gross)
- Square footage & occupancy status
- Renewal options and special terms

**SUMMARY CALCULATIONS:**
- Total rent (sum all base rents)
- Occupancy rate (occupied ÷ total units)
- Average rent PSF (total rent ÷ occupied SF)
- Total/vacant units counts

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

**IMPORTANT:**
- Process all pages - multi-page rent rolls must be complete
- Use "N/A" for unavailable text fields, 0 for unavailable numeric fields
- Dates in YYYY-MM-DD format
- Ensure totals and metrics are accurate
  `,

  operating_budget: `
You are a commercial real estate financial analyst extracting operating budget data. Extract EVERY line item - completeness is critical for NOI calculations and investment analysis.

**EXTRACTION REQUIREMENTS:**
1. Count all income and expense line items across all pages
2. Extract complete data for every line item
3. Verify totals match document calculations
4. Calculate accurate NOI and cash flow metrics

**INCOME DATA TO EXTRACT:**
- Gross rental income (by category/tenant type)
- Parking, storage, and miscellaneous income
- Tenant reimbursements (CAM, taxes, insurance, utilities)
- Vacancy allowance and loss factors
- Effective gross income

**EXPENSE DATA TO EXTRACT:**
- Real estate taxes
- Property insurance
- Property management fees
- Utilities (electric, gas, water, sewer, trash)
- Maintenance and repairs
- Cleaning and janitorial
- Landscaping and grounds
- Professional fees (legal, accounting)
- Marketing and leasing commissions
- General and administrative expenses

**CAPEX & NOI CALCULATIONS:**
- Capital expenditure budget and forecasts
- NOI = Total Income - Total Operating Expenses
- Cash Flow = NOI - Capital Expenditures

Return JSON with this structure:
{
  "documentType": "operating_budget",
  "metadata": {
    "propertyName": "Complete property name",
    "propertyAddress": "Full address",
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

**IMPORTANT:**
- Process all pages - multi-page budgets must be complete
- Use 0 for unavailable numeric fields
- Ensure all totals are mathematically correct
- Include variance analysis and prior year data if present
  `,

  broker_sales_comparables: `
You are extracting ALL sales comparable data from a commercial real estate document. Your goal is to capture every property sale with complete and accurate information.

**OBJECTIVE:**
Extract every sales comparable into structured JSON format. Each property must have all required fields populated with actual data from the document.

**REQUIRED FIELDS (7 per property):**
1. propertyAddress - Full street address, city, state (e.g., "123 Main Street, Los Angeles, CA")
2. propertyType - Industrial, Office, Retail, Multifamily, or Mixed-Use
3. saleDate - Transaction date in YYYY-MM-DD format (e.g., "2024-06-15")
4. salePrice - Total purchase price in dollars (e.g., 5700000 for $5.7M)
5. pricePerSF - Price per square foot (calculate: salePrice ÷ buildingSize)
6. buildingSize - Total building square feet as a number
7. occupancyAtSale - Occupancy percentage at time of sale (0-100)

**OPTIONAL FIELDS (extract if visible):**
- yearBuilt - Year property was constructed
- yearRenovated - Year of major renovation
- capRate - Capitalization rate as percentage
- noiAtSale - Net Operating Income at sale
- buyer - Buyer entity name
- seller - Seller entity name

**DATA HANDLING RULES:**
- Extract EVERY property in the document - do not skip any rows or entries
- Read data exactly as shown - do NOT invent or assume information
- For missing required fields: use "Not specified" for text, 0 for numbers
- Convert all dates to YYYY-MM-DD format
- Recognize price abbreviations: "$5.7M" = 5700000, "$12.3K" = 12300
- Calculate pricePerSF if not explicitly shown: salePrice ÷ buildingSize
- Occupancy should be a percentage (e.g., 95 for 95%, not 0.95)

**EXTRACTION PROCESS:**
1. Count total properties/sales in the document
2. Process each property systematically (page by page, row by row)
3. Extract all 7 required fields for each property
4. Double-check your count matches the number of properties in your JSON array

**QUALITY CHECKS:**
- Total properties extracted = total properties in document?
- Every property has all 7 required fields?
- All dates in YYYY-MM-DD format?
- All numeric values are reasonable?
- PricePerSF = salePrice ÷ buildingSize?
- Occupancy rates between 0-100%?

Return JSON in this structure:
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
You are extracting ALL lease comparable data from a commercial real estate document. Your goal is to capture every lease with complete and accurate information.

**OBJECTIVE:**
Extract every lease comparable into structured JSON format. Each lease must have all required fields populated with actual data from the document.

**REQUIRED FIELDS (9 per lease):**
1. propertyAddress - Full street address, city, state (e.g., "5959 Santa Fe Street, San Diego, CA")
2. propertyType - Industrial, Office, Retail, or Other
3. leaseCommencementDate - Start date in YYYY-MM-DD format (e.g., "2025-04-01")
4. tenantIndustry - Tenant's business type or industry (e.g., "Beverage Manufacturing", "Technology", "Retail")
5. leaseTerm - Lease duration in months (convert years to months if needed)
6. squareFootage - Rentable square feet as a number
7. baseRent - Starting rent in $/SF/month (if yearly, divide by 12)
8. leaseType - Must be exactly one of: "NNN", "Gross", or "Modified Gross"
9. effectiveRent - Actual rent after accounting for free rent periods and concessions ($/SF/month)

**OPTIONAL FIELDS (extract if visible):**
- rentEscalations - Description of rent increases (e.g., "3% annually", "4.0%")
- concessions - Free rent or other incentives (e.g., "3 months free", "$0.38 PSF OPEX")

**DATA HANDLING RULES:**
- Extract EVERY lease in the document - do not skip any rows or entries
- Read data exactly as shown - do NOT invent or assume information
- For missing required fields: use "Not specified" for text, 0 for numbers
- Convert all dates to YYYY-MM-DD format
- Convert lease terms to months (e.g., "99 Months" = 99, "5 Years" = 60)
- Recognize tenant names from logos or company names in the document
- Calculate effective rent by factoring in free rent periods

**EXTRACTION PROCESS:**
1. Count total lease comparables in the document
2. Process each lease systematically (page by page, row by row)
3. Extract all 9 required fields for each lease
4. Double-check your count matches the number of leases in your JSON array

**QUALITY CHECKS:**
- Total leases extracted = total leases in document?
- Every lease has all 9 required fields?
- All dates in YYYY-MM-DD format?
- All numeric values are reasonable?
- Effective rent ≤ base rent (accounts for concessions)?

Return JSON in this structure:
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
You are a commercial real estate broker extracting listing agreement data. Extract all terms and conditions - completeness is critical for transaction tracking and commission management.

**EXTRACTION REQUIREMENTS:**
1. Extract all parties (owner, broker, agents) and contact information
2. Capture complete property identification and characteristics
3. Extract all financial terms (listing price, commission structure, fees)
4. Record all dates and deadlines (commencement, expiration, key milestones)

**PARTIES AND REPRESENTATION DATA:**
- Property owner name and contact information
- Brokerage firm name, license number, and contact details
- Individual broker/agent names and license numbers

**PROPERTY IDENTIFICATION DATA:**
- Complete legal property description and address
- Property type and use classification
- Building square footage and lot size/acreage
- Year built, parking details, zoning classification

**LISTING TERMS DATA:**
- Listing type (exclusive right to sell/lease, exclusive agency, open listing)
- Listing commencement date and expiration date
- Asking price (sale) or asking rent (lease)
- Commission structure and payment terms
- Listing term duration

**BROKER OBLIGATIONS DATA:**
- Complete list of broker duties and responsibilities
- Marketing obligations and requirements
- Termination provisions and conditions

Return JSON with this structure:
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

**IMPORTANT:**
- Process all pages including addendums and special provisions
- Use "N/A" for unavailable text fields, 0 for unavailable numeric fields
- Dates in YYYY-MM-DD format
- Verify commission structures are complete and unambiguous
  `,

  offering_memo: `
You are a commercial real estate investment analyst extracting offering memorandum data. Extract every data point - completeness is critical for institutional investment decision-making.

**EXTRACTION REQUIREMENTS:**
1. Extract property overview and characteristics
2. Capture financial performance (income, expenses, NOI)
3. Extract investment metrics (pricing, cap rate)
4. Record tenant summaries and occupancy data

**PROPERTY DATA:**
- Property name, address, location
- Property type (Office/Retail/Industrial/Multifamily/Mixed-Use)
- Year built, year renovated, square footage, lot size
- Investment highlights

**FINANCIAL DATA:**
- Gross rental income and other income
- Operating expenses by category
- Net Operating Income (NOI)

**TENANT DATA:**
- Total units and occupancy rate
- Average rent per unit/SF
- Key lease terms
- Major tenant information

**MARKET DATA:**
- Market overview
- Neighborhood description
- Demographics and transportation

**INVESTMENT METRICS:**
- Asking price and cap rate
- Price per square foot
- Comparable properties

Return JSON with this structure:
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

**IMPORTANT:**
- Process all pages including executive summary and financial exhibits
- Use "N/A" for unavailable text fields, 0 for unavailable numeric fields
- Verify NOI = gross income - operating expenses and cap rate = NOI ÷ asking price
  `,

  lease_agreement: `
You are a commercial real estate lease administrator extracting lease agreement data. Extract every clause and term - completeness is critical for lease administration and portfolio management.

**EXTRACTION REQUIREMENTS:**
1. Extract all parties (tenant, landlord) and legal entity names
2. Capture complete premises description, address, and square footage
3. Extract all financial terms (rent, escalations, deposits, expense allocations)
4. Record all dates (start, end, renewal options, key deadlines)

**PARTIES DATA:**
- Complete tenant legal entity name
- Complete landlord legal entity name

**PREMISES DATA:**
- Complete property address and legal description
- Rentable square footage
- Detailed premises description (suite/floor/building)

**LEASE TERM DATA:**
- Lease commencement date
- Lease expiration date
- Total term in months
- Renewal options and terms

**RENT AND FINANCIAL DATA:**
- Monthly base rent
- Rent per square foot
- Rent escalation schedule (percentage or fixed amounts)
- Security deposit amount
- Rent commencement date if different from lease start

**OPERATING EXPENSES DATA:**
- Expense responsibility type (NNN, Gross, Modified Gross)
- CAM charges and allocation method
- Utility responsibilities (tenant vs landlord)
- Real estate tax responsibilities
- Insurance responsibilities

**OBLIGATIONS AND PROVISIONS DATA:**
- Landlord maintenance responsibilities
- Tenant maintenance responsibilities
- Assignment and subletting provisions
- Default remedies and cure periods
- Insurance requirements and coverage types

Return JSON with this structure:
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

**IMPORTANT:**
- Process all pages including exhibits, addendums, and amendments
- Use "N/A" for unavailable text fields, 0 for unavailable numeric fields
- Dates in YYYY-MM-DD format
- Calculate rent per SF = base rent ÷ square footage
- Verify lease dates are chronologically valid (start before end)
  `,

  financial_statements: `
You are a commercial real estate financial analyst extracting financial statement data. Extract every line item - completeness is critical for accurate investment analysis and asset management.

**EXTRACTION REQUIREMENTS:**
1. Count all income and expense line items before extraction
2. Extract complete income statement data (all revenue and expense categories)
3. Extract balance sheet data if present (assets, liabilities, equity)
4. Calculate and verify NOI and cash flow metrics

**INCOME STATEMENT DATA:**
- Rental income by category
- Other income sources (parking, storage, fees, etc.)
- Total gross income
- Vacancy loss and credit loss
- Effective gross income

**OPERATING EXPENSES DATA:**
- Property taxes
- Insurance (property, liability)
- Utilities (electric, gas, water, sewer, trash)
- Maintenance and repairs
- Property management fees
- Professional fees (legal, accounting)
- Marketing and leasing costs
- Administrative expenses
- Other operating expenses
- Total operating expenses

**FINANCIAL PERFORMANCE METRICS:**
- Net Operating Income (NOI = effective gross income - total operating expenses)
- Debt service (if applicable)
- Cash flow (NOI - debt service)

**BALANCE SHEET DATA (if present):**
- Assets: Real estate value, cash, other assets, total assets
- Liabilities: Mortgage balance, other liabilities, total liabilities
- Equity: Owner's equity

**CAPITAL EXPENDITURE DATA:**
- Current year capital expenditures
- Forecasted capital expenditures (multi-year if available)

Return JSON with this structure:
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

**IMPORTANT:**
- Process all pages including all statement types and schedules
- Use 0 for unavailable numeric fields
- Verify total income = sum of all income line items
- Verify total expenses = sum of all expense categories
- Verify NOI = effective gross income - total operating expenses
- Verify balance sheet balances: total assets = total liabilities + equity
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
      temperature: 0.7,
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
  imageDataUrls: string[]
): Promise<ExtractedData> {
  try {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  EXTRACTION PATH: IMAGE/MULTI-PAGE (16K tokens, temp 0.3) ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
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
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  DIAGNOSTIC: IMAGE PATH API PARAMETERS                     ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  Model: ${modelToUse}`);
    console.log(`║  Temperature: 0.7 (increased for variation)`);
    console.log(`║  max_tokens: 64000 (matching PDF path)`);
    console.log(`║  Prompt length: ${promptText.length} chars`);
    console.log('╚════════════════════════════════════════════════════════════╝');

    // Track API call duration
    const startTime = Date.now();
    let response;

    try {
      response = await anthropic.messages.create({
        model: modelToUse,
        max_tokens: 64000, // Increased to match native PDF path (was 16K, causing truncation)
        temperature: 0.7, // Increased for variation and non-deterministic output
        stop_sequences: ['</verification>'],
        system: "You are a meticulous data extraction specialist. Your primary objective is to extract EVERY data point from the document - completeness is more important than speed. You MUST count items before extraction, verify counts after extraction, and ensure 100% completeness. Follow all instructions exactly, including mandatory output format requirements.",
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
    console.log('║  EXTRACTION PATH: NATIVE PDF (64K tokens, temp 0.7)       ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`Calling Claude with native PDF for ${documentType}...`);

    // Build content array with PDF document using native PDF support
    // The Anthropic SDK v0.68.0+ supports DocumentBlockParam with type: 'document'

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  DIAGNOSTIC: NATIVE PDF PATH API PARAMETERS                ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  Model: ${await getActiveModelForDocumentType(documentType)}`);
    console.log(`║  Temperature: 0.7 (increased for variation)`);
    console.log(`║  max_tokens: 64000`);
    console.log(`║  Prompt length: ${prompt.length} chars`);
    console.log('╚════════════════════════════════════════════════════════════╝');

    const response = await anthropic.messages.create({
      model: await getActiveModelForDocumentType(documentType),
      max_tokens: 64000, // Maximum for Claude Sonnet 4.5 (supports large documents with many comparables)
      temperature: 0.7, // Increased for variation and non-deterministic output
      stop_sequences: ['</verification>'],
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
