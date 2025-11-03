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
    // Try parsing as JSON first
    return JSON.parse(content);
  } catch (firstError) {
    console.log('Direct JSON parse failed, attempting extraction from markdown...');

    try {
      // Extract from markdown code blocks (```json ... ```)
      const jsonBlockMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonBlockMatch) {
        const extracted = jsonBlockMatch[1].trim();
        console.log('Extracted JSON from markdown code block');
        return JSON.parse(extracted);
      }

      // Try extracting any code block
      const anyBlockMatch = content.match(/```\s*([\s\S]*?)\s*```/);
      if (anyBlockMatch) {
        const extracted = anyBlockMatch[1].trim();
        console.log('Extracted content from generic code block');
        return JSON.parse(extracted);
      }

      // Attempt basic cleanup: remove markdown formatting
      const cleaned = content
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();

      console.log('Attempting to parse cleaned content');
      return JSON.parse(cleaned);
    } catch (extractError) {
      console.error('Failed to extract and parse JSON from response:', extractError);
      throw new Error(`Could not parse JSON from Claude response. First 500 chars: ${content.substring(0, 500)}`);
    }
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

**QUALITY ASSURANCE CHECKLIST:**
- Did you examine every visible row and column in all tables?
- Did you extract data for ALL tenants listed, not just the first few?
- Did you identify and extract all vacant spaces?
- Did you capture all financial data including rent, CAM, deposits, etc?
- Did you extract all lease terms including options, escalations, and special clauses?
- Did you calculate occupancy rates, average rents, and other summary metrics?
- Is the extracted data consistent and logical?
- Are all monetary amounts and dates in correct formats?

**IMPORTANT INSTRUCTIONS:**
- Extract data from EVERY visible page and section
- If information is unclear or illegible, note it in additionalNotes
- Use "N/A" for fields where data is not available
- Use 0 for numeric fields where data is not available
- Provide professional analysis and insights in summary sections
- Ensure all extracted data supports investment decision-making
  `,

  operating_budget: `
You are a seasoned commercial real estate financial analyst and asset manager with 20+ years of experience in investment underwriting, NOI optimization, and property financial management. Your task is to perform a systematic, comprehensive extraction of ALL financial data visible in this operating budget document.

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
You are a data extraction specialist focused on capturing ALL sales comparable information from real estate documents. Your primary task is to systematically extract every data point visible in the document FIRST, then organize and analyze it.

**EXTRACTION APPROACH:**
1. **DOCUMENT SCAN**: Examine EVERY section, table, row, column, and text block in the document
2. **COMPLETE INVENTORY**: Count ALL properties/sales shown - extract data for EACH ONE, not just the first
3. **BOTH PARTIES**: For every sale, extract BOTH buyer AND seller information (names, types, motivations)
4. **ALL FINANCIAL DATA**: Capture every price, cap rate, price per SF, and financial metric shown
5. **COMPLETE CHARACTERISTICS**: Extract every measurement, date, year, and property feature visible
6. **TABLE PROCESSING**: Process tables row by row, ensuring no properties are skipped
7. **VERIFICATION**: Count extracted properties against visible properties to ensure completeness

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
You are a seasoned commercial real estate leasing expert with 20+ years of experience in market analysis, lease negotiations, and rental rate determination. Your task is to perform comprehensive extraction of ALL lease comparable data for market positioning and leasing strategy development.

**EXTRACTION METHODOLOGY:**
1. **COMPLETE LEASE DATABASE SCAN**: Extract ALL lease comparables, not just selected examples
2. **SYSTEMATIC LEASE ANALYSIS**: Capture every lease term, concession, and financial detail
3. **EFFECTIVE RENT CALCULATIONS**: Calculate and verify effective rents with all concessions
4. **TENANT PROFILE ANALYSIS**: Classify tenants by industry, size, and creditworthiness

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
You are a seasoned commercial real estate broker with 20+ years of experience in property marketing, transaction management, and commission negotiations. Extract comprehensive listing agreement data for complete transaction tracking and commission management.

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
You are a seasoned commercial real estate investment professional with 20+ years of experience in acquisitions, underwriting, and investment analysis. Extract comprehensive investment-grade data from this offering memorandum for institutional investment decision-making.

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
You are a seasoned commercial real estate attorney and lease administrator with 20+ years of experience in lease drafting, negotiation, and portfolio management. Extract comprehensive legal and financial terms from this lease agreement for complete lease administration and investment analysis.

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
You are a seasoned commercial real estate financial analyst and asset manager with 20+ years of experience in property financial management, NOI optimization, and investment reporting. Extract comprehensive financial performance data for complete investment analysis and asset management decisions.

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
 * @param file - File object (PDF, image, or JSON)
 * @returns Base64 encoded string (without data URL prefix)
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (data:image/png;base64,)
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
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
 * Extract data from native PDF using Claude (for PDFs ≤5 pages)
 * @param documentType - Type of document
 * @param pdfBase64 - Base64 encoded PDF
 * @param prompt - Extraction prompt
 * @returns Extracted structured data
 */
async function extractDataFromNativePDF(
  documentType: DocumentType,
  pdfBase64: string,
  prompt: string
): Promise<ExtractedData> {
  const startTime = Date.now();

  try {
    console.log(`Calling Claude with native PDF for ${documentType}...`);

    // Build content array with PDF document
    // NOTE: Check if current Anthropic SDK version supports PDF documents
    // If not, we may need to fall back to image conversion

    const response = await anthropic.messages.create({
      model: await getActiveModelForDocumentType(documentType),
      max_tokens: 16000,
      temperature: 0.1,
      system: "You are an expert commercial real estate document analyst with 20+ years of experience.",
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document' as any, // Type assertion for PDF support
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64
              }
            } as any,
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

    const extractedJson = extractJSONFromResponse(content.text);
    return extractedJson as ExtractedData;

  } catch (error) {
    console.error('Native PDF extraction error:', error);

    // If PDF support fails, provide helpful error message
    if (error instanceof Error && error.message.includes('document')) {
      throw new Error(
        'Native PDF support not available in current Anthropic SDK version. ' +
        'Please convert PDF to images on client-side using convertPdfToAllImages().'
      );
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
 * @returns Extracted structured data matching document type schema
 *
 * @example
 * // Single image
 * const data = await extractDocumentData(imageFile, 'rent_roll');
 *
 * // Multi-page PDF (converted to JSON client-side)
 * const data = await extractDocumentData(jsonFile, 'operating_budget');
 */
export async function extractDocumentData(
  file: File,
  documentType: DocumentType
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
    // SCENARIO 2: PDF file (hybrid approach)
    else if (file.type === 'application/pdf') {
      // Estimate page count
      const estimatedPages = estimatePdfPageCount(file);
      console.log(`PDF detected. Estimated pages: ${estimatedPages}`);

      if (estimatedPages <= 5) {
        // Use NATIVE PDF support for small documents
        console.log('Using NATIVE PDF processing (≤5 pages estimated)');
        const pdfBase64 = await fileToBase64(file);

        // Call Claude with native PDF - returns ExtractedData directly
        return await extractDataFromNativePDF(documentType, pdfBase64, prompt);
      } else {
        // Reject - client should have converted to PNG
        throw new Error(
          `PDF has ${estimatedPages} estimated pages (>5). ` +
          `Please convert to images on client-side for better control. ` +
          `The client should use convertPdfToAllImages() before uploading.`
        );
      }
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
