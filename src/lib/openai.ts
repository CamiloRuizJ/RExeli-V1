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
 * Helper function to attempt fixing truncated JSON responses
 */
function attemptJSONFix(malformedJson: string): string | null {
  try {
    console.log('Attempting to fix malformed JSON...');
    console.log('Original JSON length:', malformedJson.length);

    // Stage 1: Fix character corruption and encoding issues
    let fixedJson = malformedJson
      // Fix common property name corruptions
      .replace(/operatiatio/g, 'operatingExpenseRatio')
      .replace(/ngExpenseR/g, 'operatingExpenseR')
      .replace(/averageRentPs/g, 'averageRentPsf')
      .replace(/totalReturnProjectio/g, 'totalReturnProjection')
      .replace(/debtServiceCoverageRati/g, 'debtServiceCoverageRatio')
      .replace(/cashOnCashRetur/g, 'cashOnCashReturn')
      .replace(/occupancyRat/g, 'occupancyRate')
      .replace(/noiPerSquareFoo/g, 'noiPerSquareFoot')
      // Fix truncated common property names
      .replace(/"[a-zA-Z0-9_]+atio":/g, (match) => {
        if (match.includes('operatio')) return '"operatingExpenseRatio":';
        if (match.includes('ratio')) return match.replace('atio', 'ratio');
        return match;
      })
      .replace(/"[a-zA-Z0-9_]+Rate":/g, (match) => {
        if (match.includes('occupanc')) return '"occupancyRate":';
        if (match.includes('rent')) return '"rentGrowthRate":';
        return match;
      })
      .replace(/"[a-zA-Z0-9_]+Return":/g, (match) => {
        if (match.includes('cash')) return '"cashOnCashReturn":';
        if (match.includes('total')) return '"totalReturnProjection":';
        return match;
      })
      // Remove invalid control characters but keep valid whitespace
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
      // Fix broken Unicode sequences
      .replace(/\\u[0-9a-fA-F]{0,3}(?![0-9a-fA-F])/g, '');

    // Stage 2: Fix structural JSON issues
    // Find and fix unquoted property names
    fixedJson = fixedJson.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

    // Fix property names with invalid characters
    fixedJson = fixedJson.replace(/"([^"]*[^a-zA-Z0-9_][^"]*)":/g, (match, propName) => {
      const cleanName = propName.replace(/[^a-zA-Z0-9_]/g, '');
      return `"${cleanName}":`;
    });

    // Fix trailing commas in objects and arrays
    fixedJson = fixedJson.replace(/,(\s*[}\]])/g, '$1');

    // Stage 3: Handle truncated JSON
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let lastChar = '';
    let quoteCount = 0;

    for (let i = 0; i < fixedJson.length; i++) {
      const char = fixedJson[i];

      if (char === '"' && lastChar !== '\\') {
        inString = !inString;
        quoteCount++;
      } else if (!inString) {
        if (char === '{') braceCount++;
        else if (char === '}') braceCount--;
        else if (char === '[') bracketCount++;
        else if (char === ']') bracketCount--;
      }

      lastChar = char;
    }

    console.log(`Structural analysis: braces=${braceCount}, brackets=${bracketCount}, inString=${inString}, quotes=${quoteCount}`);

    // Remove incomplete trailing content - more comprehensive cleanup
    // Handle incomplete property names like "market (without closing quote)
    fixedJson = fixedJson.replace(/,\s*"[^"]*$/, '');
    // Handle incomplete property definitions like "prop":
    fixedJson = fixedJson.replace(/,\s*"[^"]*"\s*:\s*$/, '');
    // Handle incomplete quoted strings that aren't property names
    fixedJson = fixedJson.replace(/:\s*"[^"]*$/, ': "incomplete"');
    // Handle trailing colons
    fixedJson = fixedJson.replace(/:\s*$/, ': null');
    // Handle trailing commas
    fixedJson = fixedJson.replace(/,\s*$/, '');

    // Special handling for truncated sections - look for common patterns
    if (fixedJson.includes('"qualityMetrics"') && !fixedJson.includes('"qualityMetrics": {')) {
      // If qualityMetrics section is incomplete, remove it entirely
      fixedJson = fixedJson.replace(/,?\s*"qualityMetrics"[^}]*$/, '');
    }

    // Remove any incomplete object that doesn't have proper closing
    const lastOpenBrace = fixedJson.lastIndexOf('{');
    const lastCloseBrace = fixedJson.lastIndexOf('}');
    if (lastOpenBrace > lastCloseBrace) {
      // There's an unclosed object, find its start and remove it
      const beforeLastObject = fixedJson.substring(0, lastOpenBrace);
      const lastCommaBeforeObject = beforeLastObject.lastIndexOf(',');
      if (lastCommaBeforeObject > -1) {
        fixedJson = fixedJson.substring(0, lastCommaBeforeObject);
      }
    }

    // Close unclosed strings
    if (inString && quoteCount % 2 === 1) {
      fixedJson += '"';
    }

    // Close unclosed structures
    for (let i = 0; i < bracketCount; i++) {
      fixedJson += ']';
    }
    for (let i = 0; i < braceCount; i++) {
      fixedJson += '}';
    }

    console.log('Fixed JSON length:', fixedJson.length);
    console.log('Testing JSON validity...');

    // Test if the fixed JSON is valid
    const parsed = JSON.parse(fixedJson);
    console.log('JSON fix successful!');
    console.log('Parsed object keys:', Object.keys(parsed));

    return fixedJson;
  } catch (error) {
    console.error('Failed to fix malformed JSON:', error);
    console.log('Attempted fix preview:', malformedJson.substring(0, 500) + '...');
    return null;
  }
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

**QUALITY ASSURANCE CHECKLIST:**
- Did you examine every visible row and column in all tables?
- Did you extract data for ALL tenants listed, not just the first few?
- Did you identify and extract all vacant spaces?
- Did you capture all financial data including rent, CAM, deposits, etc?
- Did you extract all lease terms including options, escalations, and special clauses?
- Did you analyze the tenant mix and identify risk factors?
- Did you calculate occupancy rates, average rents, and other summary metrics?
- Did you extract property-level information including management and ownership?
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

**PROPERTY IDENTIFICATION:**
- Complete property name and address
- Property type, subtype, and class
- Property management company and contact information
- Ownership entity and structure
- Property size (total SF, rentable SF, units)
- Budget period and fiscal year details

**INCOME ANALYSIS (Extract ALL revenue streams):**
- Base rental income by tenant type/category
- Percentage rent from retail tenants
- Rent escalations and step-ups
- Parking income (monthly, daily, validation)
- Storage income and miscellaneous space rental
- Vending machine and laundry income
- Tenant reimbursements (CAM, taxes, insurance, utilities)
- Operating expense recoveries
- Management fee income (if applicable)
- Late fees and penalty income
- Lease termination fees
- Interest income on security deposits
- Application and processing fees
- Signage income
- Roof/tower/billboard rental income
- Utility reimbursements and chargebacks
- Administrative service fees
- Insurance claim recoveries
- Contingency income and reserves
- Vacancy allowance and loss factor
- Bad debt allowance and collection loss
- Effective gross income calculations

**OPERATING EXPENSE ANALYSIS (Extract ALL expense categories):**
- Real estate taxes (current and projected increases)
- Property insurance (general liability, property, environmental)
- Property management fees (base and incentive)
- Payroll and benefits (on-site staff)
- Utilities (electric, gas, water, sewer, trash, telecommunications)
- Maintenance and repairs (preventive and reactive)
- Cleaning and janitorial services
- Landscaping and grounds maintenance
- Snow removal and seasonal services
- Security services and systems
- Elevator maintenance and inspection
- HVAC maintenance and service contracts
- Fire safety and life safety systems
- Professional fees (legal, accounting, consulting)
- Marketing and leasing commissions
- Advertising and promotional expenses
- Office supplies and administrative costs
- Travel and transportation expenses
- Training and continuing education
- Licenses, permits, and regulatory fees
- Bank charges and merchant fees
- Bad debt expense
- General and administrative expenses
- Tenant relations and services
- Common area maintenance supplies
- Building supplies and materials
- Equipment rental and leasing
- Technology and software expenses
- Environmental compliance costs
- Reserve fund contributions

**CAPITAL EXPENDITURE PLANNING:**
- Current year capital expenditure budget
- 5-year capital expenditure forecast
- Deferred maintenance backlog
- Tenant improvement allowance budget
- Leasing commission budget
- Major building system replacements
- Energy efficiency improvements
- Technology and infrastructure upgrades
- Life safety and code compliance upgrades
- Parking lot and exterior improvements
- Common area renovation and upgrades
- Equipment replacement schedule
- Emergency reserve fund

**DEBT SERVICE AND FINANCING:**
- Mortgage principal and interest payments
- Loan terms, rates, and maturity dates
- Debt service coverage ratios
- Interest rate caps and floors
- Refinancing considerations
- Construction or renovation financing
- Line of credit availability and usage

**VARIANCE ANALYSIS (if available):**
- Budget vs. actual performance
- Variance explanations and causes
- Monthly and quarterly trending
- Year-over-year comparisons
- Industry benchmark comparisons
- Management commentary and analysis

**BUDGET ASSUMPTIONS AND METHODOLOGY:**
- Occupancy rate assumptions
- Rent growth projections
- Expense inflation factors
- Market conditions considered
- Lease rollover assumptions
- Capital expenditure prioritization
- Budget preparation methodology
- Key performance indicators tracked

**COMPREHENSIVE JSON STRUCTURE** - Extract ALL financial data into this detailed format:
{
  "documentType": "operating_budget",
  "metadata": {
    "propertyName": "Complete property name from document",
    "propertyAddress": "Full street address, city, state, zip",
    "propertyType": "Office/Retail/Industrial/Multifamily/Mixed-Use",
    "propertyClass": "A/B/C",
    "totalSquareFeet": 0,
    "rentableSquareFeet": 0,
    "totalUnits": 0,
    "managementCompany": "Property management company",
    "ownerEntity": "Property owner entity",
    "budgetPeriod": "Fiscal year or budget period",
    "budgetType": "Operating Budget/Pro Forma/Actual Performance",
    "extractedDate": "2025-01-15",
    "documentPages": "Number of pages analyzed",
    "dataQuality": "Excellent/Good/Fair/Poor based on document clarity"
  },
  "data": {
    "budgetPeriod": "2025 Operating Budget",
    "fiscalYear": "Calendar Year/April-March/Other",
    "budgetApprovalDate": "Date budget was approved",
    "budgetPreparedBy": "Entity that prepared budget",

    "income": {
      "rentalIncome": {
        "baseRent": 0,
        "percentageRent": 0,
        "rentEscalations": 0,
        "parkingIncome": 0,
        "storageIncome": 0,
        "signageIncome": 0,
        "miscellaneousRental": 0,
        "totalRentalIncome": 0
      },
      "tenantReimbursements": {
        "camReimbursements": 0,
        "taxReimbursements": 0,
        "insuranceReimbursements": 0,
        "utilityReimbursements": 0,
        "totalReimbursements": 0
      },
      "otherIncome": {
        "lateFees": 0,
        "applicationFees": 0,
        "leaseTerminationFees": 0,
        "vendingIncome": 0,
        "interestIncome": 0,
        "insuranceRecoveries": 0,
        "miscellaneousIncome": 0,
        "totalOtherIncome": 0
      },
      "grossPotentialIncome": 0,
      "vacancyAllowance": 0,
      "badDebtAllowance": 0,
      "effectiveGrossIncome": 0,
      "occupancyRateAssumption": 0.00,
      "averageRentPsf": 0.00
    },

    "operatingExpenses": {
      "fixedExpenses": {
        "realEstateTaxes": 0,
        "propertyInsurance": 0,
        "totalFixedExpenses": 0
      },
      "variableExpenses": {
        "utilities": {
          "electricity": 0,
          "gas": 0,
          "water": 0,
          "sewer": 0,
          "trash": 0,
          "telecommunications": 0,
          "totalUtilities": 0
        },
        "maintenanceRepairs": {
          "generalMaintenance": 0,
          "preventiveMaintenance": 0,
          "hvacMaintenance": 0,
          "elevatorMaintenance": 0,
          "buildingSupplies": 0,
          "contractorServices": 0,
          "totalMaintenanceRepairs": 0
        },
        "operatingServices": {
          "janitorialCleaning": 0,
          "landscapingGrounds": 0,
          "snowRemoval": 0,
          "securityServices": 0,
          "totalOperatingServices": 0
        },
        "administrativeExpenses": {
          "propertyManagement": 0,
          "payrollBenefits": 0,
          "professionalFees": 0,
          "officeSupplies": 0,
          "marketingLeasing": 0,
          "totalAdministrative": 0
        },
        "otherExpenses": {
          "licensesPermits": 0,
          "bankCharges": 0,
          "training": 0,
          "travel": 0,
          "miscellaneous": 0,
          "totalOtherExpenses": 0
        },
        "totalVariableExpenses": 0
      },
      "totalOperatingExpenses": 0,
      "operatingExpenseRatio": 0.00,
      "expensePerSquareFoot": 0.00
    },

    "netOperatingIncome": 0,
    "noiMargin": 0.00,
    "noiPerSquareFoot": 0.00,

    "capitalExpenditures": {
      "currentYearCapex": {
        "tenantImprovements": 0,
        "leasingCommissions": 0,
        "buildingImprovements": 0,
        "equipmentReplacement": 0,
        "deferredMaintenance": 0,
        "totalCurrentCapex": 0
      },
      "fiveYearCapexForecast": [
        {"year": "2025", "amount": 0, "description": "Major items planned"},
        {"year": "2026", "amount": 0, "description": "Major items planned"},
        {"year": "2027", "amount": 0, "description": "Major items planned"},
        {"year": "2028", "amount": 0, "description": "Major items planned"},
        {"year": "2029", "amount": 0, "description": "Major items planned"}
      ],
      "reserveFunds": {
        "replacementReserve": 0,
        "tenantImprovementReserve": 0,
        "operatingReserve": 0,
        "totalReserves": 0
      }
    },

    "debtService": {
      "mortgagePrincipal": 0,
      "mortgageInterest": 0,
      "totalDebtService": 0,
      "debtServiceCoverageRatio": 0.00,
      "loanToValueRatio": 0.00,
      "interestRate": 0.00,
      "maturityDate": "Loan maturity date"
    },

    "cashFlow": {
      "netOperatingIncome": 0,
      "lessDebtService": 0,
      "beforeTaxCashFlow": 0,
      "cashOnCashReturn": 0.00,
      "internalRateOfReturn": 0.00
    },

    "varianceAnalysis": {
      "budgetVsActualAvailable": false,
      "majorVariances": [
        {
          "category": "Category with variance",
          "budgetAmount": 0,
          "actualAmount": 0,
          "variance": 0,
          "variancePercentage": 0.00,
          "explanation": "Reason for variance"
        }
      ],
      "yearOverYearComparison": [
        {
          "category": "Income/Expense category",
          "priorYear": 0,
          "currentYear": 0,
          "change": 0,
          "changePercentage": 0.00
        }
      ]
    },

    "budgetAssumptions": {
      "occupancyRate": 0.00,
      "rentGrowthRate": 0.00,
      "expenseInflationRate": 0.00,
      "marketConditions": "Description of market assumptions",
      "leaseRolloverAssumptions": "Assumptions about lease renewals",
      "capitalPriorities": "Key capital expenditure priorities",
      "riskFactors": ["List of identified risk factors"],
      "opportunities": ["List of identified opportunities"]
    },

    "keyPerformanceIndicators": {
      "noiPerSquareFoot": 0.00,
      "operatingExpenseRatio": 0.00,
      "occupancyRate": 0.00,
      "averageRentPsf": 0.00,
      "debtServiceCoverageRatio": 0.00,
      "cashOnCashReturn": 0.00,
      "capRate": 0.00,
      "totalReturnProjection": 0.00
    },

    "additionalNotes": "Any other relevant information, assumptions, or explanations extracted from the document"
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
7. **TEXT MINING**: Extract details from narrative text that may contain additional property information
8. **VERIFICATION**: Count extracted properties against visible properties to ensure completeness

**COMPREHENSIVE SALES COMPARABLE DATA EXTRACTION:**

**STEP 1: DOCUMENT SURVEY (Do this first to understand scope):**
- Scan the entire document to count how many properties/sales are present
- Identify all tables, charts, and data sections
- Note document structure and layout
- Estimate total data points to be extracted

**RECOGNITION GUIDE - SYNONYMS & FORMATS TO CAPTURE:**

**ADDRESS FORMATS (Extract ALL variations):**
- Full addresses: "123 Main St, Dallas, TX 75201"
- Partial addresses: "Main Street, Dallas" or "123 Main St"
- Property names with addresses: "Sunset Plaza, 456 Oak Ave"
- Address abbreviations: "St/Street, Ave/Avenue, Blvd/Boulevard, Dr/Drive, Rd/Road, Ln/Lane, Ct/Court, Pl/Place"
- Directionals: "N/North, S/South, E/East, W/West, NE/Northeast, SW/Southwest" etc.
- Building numbers: Unit #, Suite #, Building A/B/C, Tower 1/2

**NUMERIC VALUE FORMATS (Recognize ALL patterns):**
- Sale prices: "$5,712,000" | "$5.712M" | "$5,712K" | "5.7MM" | "5712000"
- Price per SF: "$170/SF" | "$170 per sq ft" | "$170 PSF" | "170.00/sqft"
- Square footage: "33,500 SF" | "33500 sq ft" | "33.5K SF" | "33,500 square feet"
- Cap rates: "6.5%" | "6.50 cap" | "6.5 cap rate" | "0.065"
- Units: "267 units" | "267 doors" | "267 apartments" | "267-unit"
- Acres: "2.5 AC" | "2.5 acres" | "2.5 acre site"

**PROPERTY CHARACTERISTIC SYNONYMS:**
- Building size: SF | Square Feet | Sq Ft | GLA | Gross Leasable Area | NRA | Net Rentable Area | RSF | Rentable Square Feet
- Property type: Multifamily | Multi-Family | Apartment | Residential | Garden Style | Mid-Rise | High-Rise
- Year built: Built | Constructed | Year of Construction | Vintage | Age | Original Construction
- Stories: Floors | Levels | Story Building | Floor Building

**TRANSACTION PARTY SYNONYMS:**
- Buyer: Purchaser | Acquirer | Grantee | New Owner | Acquiring Entity | Investment Group
- Seller: Vendor | Grantor | Previous Owner | Disposing Entity | Selling Entity
- Broker: Agent | Realtor | Representative | Listing Agent | Selling Agent | Brokerage

**DATE FORMAT VARIATIONS (Extract ALL formats):**
- Full dates: "June 15, 2023" | "06/15/2023" | "6/15/23" | "2023-06-15"
- Month/Year: "Jun 2023" | "June '23" | "6/2023" | "Q2 2023"
- Relative dates: "Last month" | "2 years ago" | "Recently sold"

**FINANCIAL TERMS SYNONYMS:**
- Sale price: Purchase Price | Transaction Value | Acquisition Cost | Sales Price | Gross Price
- Cap rate: Capitalization Rate | Cap | Going-in Cap Rate | Market Cap Rate | Overall Rate
- Price per unit: Price per Door | Per Unit Price | Unit Value | Per Door Value
- NOI: Net Operating Income | Net Income | Operating Income | NOI
- Expenses: Operating Expenses | OpEx | Annual Expenses | Operating Costs

**MEASUREMENT SYNONYMS:**
- Square feet: SF | Sq Ft | Square Footage | Sq. Feet | SQFT | s.f.
- Acres: AC | Acre | Acreage | Ac.
- Units: Doors | Apartments | Keys | Residential Units | Dwelling Units

**LOCATION & MARKET SYNONYMS:**
- Market area: Submarket | Market | Geographic Area | Region | Trade Area | Market Zone
- Neighborhood: Area | District | Subarea | Location | Vicinity | Market Segment
- Demographics: Population | Residents | Tenant Base | Market Demographics
- Proximity: Near | Close to | Adjacent to | Walking distance | Minutes from

**CONDITION & QUALITY SYNONYMS:**
- Property condition: Condition | State | Quality | Grade | Class | Maintenance Level
- Building class: Class A/B/C | Grade | Quality Rating | Investment Grade
- Occupancy: Occupied | Vacant | Leased | Available | Stabilized | Lease-up

**MARKET ANALYSIS TERMS:**
- Market trends: Trends | Direction | Movement | Market Activity | Performance
- Demand: Absorption | Take-up | Leasing Activity | Market Demand | Interest Level
- Supply: Inventory | Available Space | Pipeline | New Construction | Competitive Supply
- Pricing trends: Price Movement | Rate Changes | Market Rates | Rental Growth

**EXTRACTION EMPHASIS:**
When you see ANY of these synonyms or formats, treat them as CRITICAL DATA POINTS that must be captured. Don't skip variations - they all represent the same important information in different formats.

**DOCUMENT ANALYSIS:**
- Report title, date, and purpose
- Market area definition and boundaries
- Time period of sales analyzed
- Data sources and verification methods
- Appraiser/analyst credentials and company
- Subject property identification (if applicable)

**INDIVIDUAL COMPARABLE ANALYSIS (Extract for EVERY property listed):**

**PROPERTY IDENTIFICATION:**
- Complete property address including street, city, state, zip code
- Legal description and parcel number (if provided)
- Property name or building name
- Multiple Listing Service (MLS) number
- Property identification numbers or codes

**TRANSACTION DETAILS:**
- Exact sale date and closing date
- Sale price (gross and net if different)
- Price per square foot (land and building separately if shown)
- Price per unit (for multi-tenant properties)
- Price per door (for multifamily)
- Price per key (for hotels)
- Terms of sale (cash, financed, seller financing, etc.)
- Days on market from listing to sale
- Original listing price and any price reductions
- Sale-to-list price ratio

**PROPERTY CHARACTERISTICS:**
- Property type and subtype (Office: Class A/B/C, Retail: Strip/Mall/Freestanding, etc.)
- Total building square footage (gross and net rentable)
- Land area (acres, square feet)
- Number of units, suites, or spaces
- Number of stories/floors
- Year built and year of major renovations
- Construction type and materials
- Architectural style and design quality
- Building condition and quality rating
- Parking spaces and ratio (spaces per 1,000 SF)
- Parking type (surface, covered, garage)

**FINANCIAL PERFORMANCE AT SALE:**
- Net Operating Income (NOI) at time of sale
- Gross rental income at sale
- Operating expenses at sale
- Occupancy rate at time of sale
- Cap rate (calculated and stated)
- Gross rent multiplier (GRM)
- Operating expense ratio
- Rent per square foot at sale

**PHYSICAL FEATURES AND AMENITIES:**
- HVAC systems and quality
- Elevator service (number and condition)
- Accessibility compliance (ADA)
- Technology infrastructure
- Security systems
- Energy efficiency features
- Environmental certifications (LEED, Energy Star)
- Special features and amenities
- Common areas and facilities
- Signage opportunities and visibility

**LOCATION ANALYSIS:**
- Neighborhood classification and quality
- Street address and frontage characteristics
- Traffic counts and visibility
- Proximity to major highways and transportation
- Public transportation access
- Proximity to complementary businesses
- Demographics of surrounding area
- Zoning classification and restrictions
- Future development plans in area

**MARKET CONDITIONS AND CONTEXT:**
- Market conditions at time of sale
- Comparable sales date relative to current market
- Motivation of buyer and seller
- Marketing time and exposure
- Special circumstances affecting sale
- Broker involvement and commission structure
- Due diligence period and conditions
- Financing terms and assumability

**BUYER AND SELLER INFORMATION:**
- Buyer entity name and type (individual, corporation, REIT, fund)
- Seller entity name and type
- Buyer's investment strategy or use intent
- Seller's reason for selling
- Relationship between buyer and seller (arms-length or related party)
- Buyer's experience and portfolio
- Geographic focus of buyer

**ADJUSTMENTS AND COMPARABILITY FACTORS:**
- Time adjustments needed for market changes
- Location adjustments (superior/inferior location)
- Size adjustments (economy of scale differences)
- Condition adjustments (superior/inferior condition)
- Financing adjustments (cash equivalent value)
- Market conditions adjustments
- Property rights conveyed (fee simple, leasehold, etc.)

**MARKET ANALYSIS AND TRENDS:**
- Sales volume trends in the market
- Price appreciation or depreciation trends
- Absorption rates and inventory levels
- New construction activity
- Economic factors affecting market
- Interest rate environment impact
- Investment demand and capital availability

**COMPREHENSIVE JSON STRUCTURE** - Extract ALL comparable sales data:
{
  "documentType": "broker_sales_comparables",
  "metadata": {
    "reportTitle": "Complete report title",
    "reportDate": "YYYY-MM-DD",
    "marketArea": "Geographic area analyzed",
    "timeperiodAnalyzed": "Date range of sales analyzed",
    "dataSources": "Sources of comparable data",
    "analystCompany": "Company that prepared analysis",
    "analystCredentials": "Appraiser or analyst credentials",
    "subjectProperty": "Subject property if applicable",
    "extractedDate": "2025-01-15",
    "documentPages": "Number of pages analyzed",
    "dataQuality": "Excellent/Good/Fair/Poor based on document completeness"
  },
  "data": {
    "marketSummary": {
      "totalSalesAnalyzed": 0,
      "salesPeriod": "Date range of sales",
      "marketConditions": "Description of market conditions",
      "marketTrends": "Key trends affecting values",
      "averageDaysOnMarket": 0,
      "averageDiscountFromList": 0.00,
      "salesVelocity": "Fast/Moderate/Slow",
      "inventoryLevels": "High/Moderate/Low",
      "buyerDemand": "Strong/Moderate/Weak"
    },

    "comparableSales": [
      {
        "propertyId": "Unique identifier or sequence number",
        "propertyName": "Building or property name",
        "propertyAddress": "Complete street address",
        "city": "City",
        "state": "State",
        "zipCode": "Zip code",
        "legalDescription": "Legal description if provided",
        "mlsNumber": "MLS number if applicable",

        "transactionDetails": {
          "saleDate": "YYYY-MM-DD",
          "closingDate": "YYYY-MM-DD",
          "salePrice": 0,
          "originalListPrice": 0,
          "priceReductions": 0,
          "saleToListRatio": 0.00,
          "daysOnMarket": 0,
          "termsOfSale": "Cash/Financed/Seller financing/Other",
          "downPayment": 0,
          "financingTerms": "Loan terms if applicable",
          "specialConditions": "Any special sale conditions"
        },

        "pricingMetrics": {
          "pricePerSquareFoot": 0.00,
          "pricePerUnit": 0.00,
          "pricePerDoor": 0.00,
          "pricePerKey": 0.00,
          "landValuePerSquareFoot": 0.00,
          "improvementValuePerSquareFoot": 0.00
        },

        "propertyCharacteristics": {
          "propertyType": "Office/Retail/Industrial/Multifamily/Mixed-Use/Other",
          "propertySubtype": "Detailed property subtype",
          "buildingClass": "A/B/C/D",
          "totalBuildingSquareFeet": 0,
          "netRentableSquareFeet": 0,
          "landAreaSquareFeet": 0,
          "landAreaAcres": 0.00,
          "numberOfUnits": 0,
          "numberOfSuites": 0,
          "numberOfStories": 0,
          "yearBuilt": 0,
          "yearRenovated": 0,
          "constructionType": "Steel/Concrete/Wood frame/Other",
          "architecturalStyle": "Description of architectural style",
          "buildingCondition": "Excellent/Good/Average/Fair/Poor",
          "qualityRating": "Institutional/High/Average/Low"
        },

        "physicalFeatures": {
          "parkingSpaces": 0,
          "parkingRatio": 0.00,
          "parkingType": "Surface/Covered/Garage/Mixed",
          "elevators": 0,
          "hvacType": "Central/Individual/Mixed",
          "hvacCondition": "Excellent/Good/Average/Fair/Poor",
          "accessibilityCompliance": "Full ADA/Partial/Non-compliant",
          "technologyInfrastructure": "Fiber/T1/Basic/None",
          "securitySystems": "Description of security features",
          "energyEfficiencyFeatures": "Energy efficient features",
          "environmentalCertifications": "LEED/Energy Star/Other",
          "specialAmenities": ["List of special features and amenities"],
          "commonAreas": "Description of common areas",
          "signageOpportunities": "Signage visibility and opportunities"
        },

        "locationFactors": {
          "neighborhoodClass": "Prime/Good/Average/Below Average",
          "streetType": "Main arterial/Secondary/Local",
          "trafficCount": 0,
          "visibility": "Excellent/Good/Average/Poor",
          "proximityToHighways": "Distance to major highways",
          "publicTransitAccess": "Transit options and distance",
          "nearbyAmenities": ["List of nearby amenities"],
          "demographics": "Area demographic profile",
          "zoning": "Current zoning classification",
          "futureDevelopment": "Known future development plans"
        },

        "financialPerformance": {
          "noiAtSale": 0,
          "grossRentalIncomeAtSale": 0,
          "operatingExpensesAtSale": 0,
          "occupancyRateAtSale": 0.00,
          "capRateAtSale": 0.00,
          "grossRentMultiplier": 0.00,
          "operatingExpenseRatio": 0.00,
          "averageRentPerSF": 0.00,
          "effectiveGrossIncomeMultiplier": 0.00,
          "debtServiceCoverageRatio": 0.00
        },

        "marketConditionsAtSale": {
          "marketConditions": "Strong/Stable/Declining",
          "interestRateEnvironment": "Rising/Stable/Declining",
          "competitiveProperties": "Number of competing properties",
          "absorptionRate": "Market absorption rate",
          "constructionActivity": "New construction in area",
          "economicFactors": "Economic conditions affecting sale"
        },

        "transactionParties": {
          "buyerName": "Buyer entity name",
          "buyerType": "Individual/Corporation/REIT/Fund/Other",
          "buyerStrategy": "Owner-user/Investor/Developer/Other",
          "buyerExperience": "Experienced/New to market",
          "sellerName": "Seller entity name",
          "sellerType": "Individual/Corporation/REIT/Fund/Other",
          "sellerMotivation": "Retirement/1031 exchange/Portfolio optimization/Financial distress/Other",
          "relationshipType": "Arms-length/Related party",
          "brokerInvolvement": "Listing broker and buyer broker information",
          "commissionRate": 0.00
        },

        "comparabilityFactors": {
          "timeAdjustmentNeeded": 0.00,
          "locationAdjustment": "Superior/Inferior/Similar",
          "sizeAdjustment": "Larger/Smaller/Similar",
          "conditionAdjustment": "Better/Worse/Similar",
          "ageAdjustment": "Newer/Older/Similar",
          "amenityAdjustment": "Superior/Inferior/Similar",
          "overallComparability": "Excellent/Good/Fair/Poor",
          "adjustmentsSummary": "Summary of adjustments needed"
        },

        "additionalNotes": "Any additional relevant information about this comparable sale"
      }
    ],

    "marketAnalysis": {
      "salesVolumeAnalysis": {
        "totalDollarVolume": 0,
        "numberOfTransactions": 0,
        "averageTransactionSize": 0,
        "medianTransactionSize": 0,
        "volumeComparisonPriorPeriod": 0.00,
        "marketShare": {
          "byPropertyType": [
            {"type": "Property type", "percentage": 0.00, "volume": 0}
          ],
          "byBuyerType": [
            {"type": "Buyer type", "percentage": 0.00, "volume": 0}
          ]
        }
      },

      "pricingAnalysis": {
        "averagePricePerSF": 0.00,
        "medianPricePerSF": 0.00,
        "pricePerSFRange": {"min": 0.00, "max": 0.00},
        "priceAppreciation": {
          "quarterOverQuarter": 0.00,
          "yearOverYear": 0.00,
          "threeYearTrend": 0.00
        },
        "priceByPropertyType": [
          {"type": "Property type", "averagePricePerSF": 0.00, "salesCount": 0}
        ],
        "priceByLocation": [
          {"area": "Market subarea", "averagePricePerSF": 0.00, "salesCount": 0}
        ]
      },

      "capRateAnalysis": {
        "averageCapRate": 0.00,
        "medianCapRate": 0.00,
        "capRateRange": {"min": 0.00, "max": 0.00},
        "capRateByPropertyType": [
          {"type": "Property type", "averageCapRate": 0.00, "salesCount": 0}
        ],
        "capRateBySize": [
          {"sizeRange": "Size category", "averageCapRate": 0.00, "salesCount": 0}
        ],
        "capRateTrends": "Description of cap rate trends"
      },

      "marketTrends": {
        "overallMarketDirection": "Strengthening/Stable/Weakening",
        "priceTrajectory": "Rising/Stable/Declining",
        "demandFactors": ["List of factors driving demand"],
        "supplyFactors": ["List of factors affecting supply"],
        "economicdrivers": ["Key economic drivers"],
        "riskFactors": ["Market risk factors identified"],
        "opportunities": ["Market opportunities identified"],
        "forecast": "Near-term market outlook"
      }
    },

    "qualityMetrics": {
      "dataReliability": "High/Medium/Low",
      "sourceVerification": "All verified/Partially verified/Unverified",
      "timeAdjustmentRequired": true,
      "comparabilityScore": "Excellent/Good/Fair/Poor",
      "marketCoverageCompleteness": 0.00,
      "recommendedUse": "Direct comparison/Trend analysis/General market reference"
    },

    "additionalNotes": "Any other relevant market information, analyst commentary, or methodology notes"
  }
}

**CRITICAL EXTRACTION INSTRUCTIONS:**

**PHASE 1 - RAW DATA EXTRACTION (Complete this FIRST):**
- **PROPERTY INVENTORY**: Count how many properties/sales are shown in the document - extract data for ALL of them
- **SYNONYM RECOGNITION**: Use the synonym guide above - recognize ALL format variations (e.g., "Purchaser" = "Buyer", "$5.7M" = "$5,700,000")
- **BUYER AND SELLER**: For each sale, extract BOTH buyer name AND seller name using ALL party synonyms (Purchaser, Acquirer, Vendor, Grantor, etc.)
- **COMPLETE ADDRESSES**: Extract every address format - full addresses, partial addresses, property names with addresses
- **ALL FINANCIAL DATA**: Record every price format - "$5,712,000", "$5.712M", "5.7MM", etc. and all cap rate formats
- **BUILDING DETAILS**: Capture ALL measurement synonyms - SF, Sq Ft, Square Footage, RSF, GLA, NRA, etc.
- **TRANSACTION DETAILS**: Document ALL date formats and transaction terms using synonym recognition
- **PARTIES INFORMATION**: Extract using ALL party synonyms - Agent, Realtor, Representative, Listing Agent, etc.
- **TABLE PROCESSING**: Go through tables row by row recognizing ALL format variations
- **TEXT MINING**: Look for synonym variations in narrative text sections

**PHASE 2 - COMPLETENESS VERIFICATION (Do this SECOND):**
- **COUNT CHECK**: Verify you extracted the same number of properties shown in the document
- **SELLER CHECK**: Ensure each property has seller information (if shown in document)
- **DATA COMPLETENESS**: Check that no fields are unnecessarily empty when data is visible
- **CROSS-REFERENCE**: Verify consistency between related data points

**PHASE 3 - JSON ORGANIZATION (Do this THIRD):**
- Structure all extracted data into the JSON format
- Organize comparable sales by property ID (1, 2, 3, etc.)
- Populate all sections with extracted data points
- Ensure no extracted data is lost in the structuring process

**PHASE 4 - ANALYSIS (Only after all data is extracted and verified):**
- Calculate market analysis metrics from extracted data
- Apply professional insights to quality metrics
- Generate summary statistics

**CRITICAL REMINDERS:**
- If you see 5 properties in a document, extract all 5 - not just 1 or 2
- If seller names are visible, extract them along with buyer names
- Process every table row, every text section, every data point visible

**FINAL QUALITY ASSURANCE CHECKLIST:**
Before submitting your JSON response, verify:
- [ ] Property count in JSON matches property count visible in document
- [ ] Each property has both buyer AND seller information using ALL synonym variations (when available)
- [ ] All financial data captured in ALL formats - prices, cap rates, price/SF regardless of format variation
- [ ] All addresses extracted including partial addresses, property names, and abbreviations
- [ ] All measurements captured using ANY synonym - SF, Sq Ft, RSF, GLA, etc.
- [ ] No "N/A" or empty fields when data exists in ANY format in the document
- [ ] Transaction dates extracted in ANY format - full dates, month/year, relative dates
- [ ] Building characteristics captured using ALL synonyms - floors/stories, built/constructed, etc.
- [ ] Party information uses ALL variations - buyer/purchaser/acquirer, seller/vendor/grantor
- [ ] All numeric formats recognized - $5M, $5,000,000, 5MM, etc.

**SYNONYM REMINDER:** If you see "Purchaser: ABC Corp" extract it as buyerName. If you see "33.5K SF" extract it as 33,500 square feet.
  `,

  broker_lease_comparables: `
You are a seasoned commercial real estate leasing expert with 20+ years of experience in market analysis, lease negotiations, and rental rate determination. Your task is to perform comprehensive extraction of ALL lease comparable data for market positioning and leasing strategy development.

**EXTRACTION METHODOLOGY:**
1. **COMPLETE LEASE DATABASE SCAN**: Extract ALL lease comparables, not just selected examples
2. **SYSTEMATIC LEASE ANALYSIS**: Capture every lease term, concession, and financial detail
3. **MARKET CONTEXT CAPTURE**: Extract market commentary and leasing trends
4. **EFFECTIVE RENT CALCULATIONS**: Calculate and verify effective rents with all concessions
5. **TENANT PROFILE ANALYSIS**: Classify tenants by industry, size, and creditworthiness
6. **COMPARABLE QUALITY ASSESSMENT**: Evaluate relevance and reliability of each comparable

**COMPREHENSIVE LEASE COMPARABLE DATA EXTRACTION:**

**DOCUMENT METADATA:**
- Market survey title and date
- Geographic market area covered
- Leasing period analyzed
- Data sources and collection methods
- Broker/analyst company and credentials

**INDIVIDUAL LEASE ANALYSIS (Extract for EVERY comparable):**

**PROPERTY AND LOCATION:**
- Complete property address and cross streets
- Building name and class (A/B/C)
- Property type and specific use classification
- Neighborhood quality and location rating
- Transportation access and parking availability
- Building amenities and common areas
- Property management quality and reputation

**LEASE TRANSACTION DETAILS:**
- Lease execution date and commencement date
- Lease term (months/years) and expiration date
- Renewal options and extension terms
- Early termination clauses and penalties
- Assignment and subletting rights
- Lease guarantees and credit enhancement

**TENANT PROFILE:**
- Tenant name and business type
- Industry classification (NAICS code if available)
- Company size (employees, revenue if known)
- Credit quality assessment
- Local/regional/national tenant classification
- Tenant's business model and space requirements
- Previous leasing history in market

**SPACE CHARACTERISTICS:**
- Rentable square footage leased
- Usable square footage
- Floor location and suite configuration
- Window line exposure and views
- Ceiling heights and layout flexibility
- Condition of space at lease inception
- Special features or premium locations

**FINANCIAL TERMS:**
- Starting base rent per square foot
- Rent escalation schedule and methodology
- Operating expense structure (NNN, Gross, Modified Gross)
- CAM charges and expense passthroughs
- Utility arrangements and costs
- Parking charges (if applicable)
- Percentage rent clauses (retail)
- Additional rent and fees

**CONCESSIONS AND INCENTIVES:**
- Free rent periods (months and timing)
- Tenant improvement allowances (per SF)
- Moving allowances and expenses
- Broker commission structures
- Signage allowances and restrictions
- Reduced security deposits
- Other financial incentives

**EFFECTIVE RENT ANALYSIS:**
- Gross effective rent calculation
- Net effective rent after all concessions
- Present value of lease payments
- Equivalent level payment analysis
- Comparison to asking rents

Return comprehensive JSON with ALL lease data:
{
  "documentType": "broker_lease_comparables",
  "metadata": {
    "surveyTitle": "Market survey title",
    "surveyDate": "YYYY-MM-DD",
    "marketArea": "Geographic area surveyed",
    "leasingPeriod": "Period of leases analyzed",
    "dataSources": "Sources of lease data",
    "analystCompany": "Surveying company",
    "extractedDate": "2025-01-15",
    "totalComparables": 0
  },
  "data": {
    "marketOverview": {
      "averageAskingRent": 0.00,
      "averageEffectiveRent": 0.00,
      "concessionLevel": "High/Moderate/Low",
      "marketConditions": "Tenant/Landlord favorable",
      "vacancyRate": 0.00,
      "availableSpace": 0,
      "constructionActivity": "High/Moderate/Low",
      "marketTrends": "Strengthening/Stable/Weakening"
    },
    "comparables": [
      {
        "propertyName": "Building name",
        "propertyAddress": "Complete address",
        "propertyType": "Office/Retail/Industrial/Other",
        "buildingClass": "A/B/C",
        "neighborhoodQuality": "Prime/Good/Average/Below Average",
        "transportation": "Transportation access quality",
        "buildingAmenities": ["List all amenities"],
        "leaseDetails": {
          "leaseExecutionDate": "YYYY-MM-DD",
          "leaseCommencementDate": "YYYY-MM-DD",
          "leaseTerm": 0,
          "leaseExpiration": "YYYY-MM-DD",
          "renewalOptions": "Details of renewal terms",
          "earlyTermination": "Early termination provisions"
        },
        "tenantProfile": {
          "tenantName": "Tenant name",
          "industry": "Specific industry classification",
          "businessType": "Professional/Medical/Tech/Retail/etc",
          "companySize": "Large/Medium/Small",
          "creditQuality": "Strong/Average/Weak",
          "tenantClass": "National/Regional/Local",
          "spaceRequirements": "Specific space needs"
        },
        "spaceCharacteristics": {
          "rentableSquareFeet": 0,
          "usableSquareFeet": 0,
          "floorLocation": "Floor number/location",
          "suiteConfiguration": "Layout description",
          "windowExposure": "Exposure direction and quality",
          "ceilingHeight": 0.00,
          "layoutFlexibility": "Open/Private offices/Mixed",
          "conditionAtLease": "New/Renovated/As-is",
          "specialFeatures": ["Premium location features"]
        },
        "financialTerms": {
          "startingBaseRent": 0.00,
          "currentBaseRent": 0.00,
          "rentEscalations": "Detailed escalation schedule",
          "leaseStructure": "Triple Net/Gross/Modified Gross/Full Service",
          "camCharges": 0.00,
          "operatingExpenses": 0.00,
          "utilityArrangement": "Tenant/Landlord responsibility",
          "parkingCharges": 0.00,
          "percentageRent": "Details if applicable",
          "additionalCharges": 0.00
        },
        "concessionsIncentives": {
          "freeRentMonths": 0,
          "freeRentTiming": "Front-loaded/Back-loaded/Spread",
          "tenantImprovementAllowance": 0.00,
          "movingAllowance": 0.00,
          "brokerCommission": "Commission structure",
          "signageAllowance": 0.00,
          "securityDepositReduction": 0.00,
          "otherIncentives": ["List other incentives"]
        },
        "effectiveRentAnalysis": {
          "grossEffectiveRent": 0.00,
          "netEffectiveRent": 0.00,
          "effectiveRentPsf": 0.00,
          "presentValueLease": 0,
          "levelPaymentEquivalent": 0.00,
          "comparisonToAsking": 0.00,
          "totalConcessionValue": 0.00
        },
        "marketFactors": {
          "competitivePosition": "Superior/Average/Inferior",
          "timeOnMarket": 0,
          "marketingStrategy": "Aggressive/Standard/Limited",
          "landlordMotivation": "High/Moderate/Low",
          "tenantOptions": "Limited/Moderate/Extensive",
          "marketTiming": "Peak/Average/Soft market"
        },
        "additionalNotes": "Relevant lease terms or market conditions"
      }
    ],
    "marketAnalysis": {
      "rentTrends": {
        "askingRentTrend": "Rising/Stable/Declining",
        "effectiveRentTrend": "Rising/Stable/Declining",
        "rentGrowthRate": 0.00,
        "rentProjection": "Near-term rent outlook"
      },
      "concessionAnalysis": {
        "averageFreeRent": 0.00,
        "averageTIAllowance": 0.00,
        "concessionTrends": "Increasing/Stable/Decreasing",
        "concessionsBySize": [
          {"sizeRange": "0-2,500 SF", "averageConcession": 0.00},
          {"sizeRange": "2,501-5,000 SF", "averageConcession": 0.00},
          {"sizeRange": "5,001-10,000 SF", "averageConcession": 0.00},
          {"sizeRange": "10,000+ SF", "averageConcession": 0.00}
        ]
      },
      "leaseTermAnalysis": {
        "averageLeaseTerm": 0,
        "preferredTerms": "Landlord/tenant preferred terms",
        "termTrends": "Lengthening/Stable/Shortening",
        "renewalActivity": "High/Moderate/Low"
      },
      "tenantDemandAnalysis": {
        "overallDemand": "Strong/Moderate/Weak",
        "demandByIndustry": [
          {"industry": "Industry name", "demandLevel": "High/Medium/Low"}
        ],
        "tenantRequirements": "Common space requirements",
        "expansionActivity": "High/Moderate/Low"
      }
    },
    "summary": {
      "averageAskingRent": 0.00,
      "averageEffectiveRent": 0.00,
      "askingRentRange": {"min": 0.00, "max": 0.00},
      "effectiveRentRange": {"min": 0.00, "max": 0.00},
      "averageLeaseTermMonths": 0,
      "averageFreeRentMonths": 0.00,
      "averageTIAllowancePsf": 0.00,
      "marketRecommendations": "Key leasing strategy recommendations"
    }
  }
}
  `,

  broker_listing: `
You are a seasoned commercial real estate broker with 20+ years of experience in property marketing, transaction management, and commission negotiations. Extract comprehensive listing agreement data for complete transaction tracking and commission management.

**EXTRACTION METHODOLOGY:**
1. **COMPLETE AGREEMENT ANALYSIS**: Extract ALL terms, conditions, and obligations from the entire document
2. **SYSTEMATIC DATA CAPTURE**: Process every section including fine print and addendums
3. **LEGAL TERM IDENTIFICATION**: Capture all legal provisions, rights, and responsibilities
4. **FINANCIAL DETAIL EXTRACTION**: Extract all commission structures, fees, and financial obligations
5. **PROFESSIONAL EXPERTISE**: Apply brokerage knowledge to understand complex terms and relationships

**COMPREHENSIVE LISTING AGREEMENT EXTRACTION:**

**PARTIES AND REPRESENTATION:**
- Complete property owner information (individual/entity name, address, contact details)
- Authorized signatories and decision-makers
- Brokerage firm name, license information, and contact details
- Individual broker/agent names, licenses, and specializations
- Property attorney information if involved
- Property manager or representative if different from owner

**PROPERTY IDENTIFICATION:**
- Complete legal property description and parcel numbers
- Property address and cross-street references
- Property type, subtype, and use classification
- Building and land square footage/acreage
- Zoning classification and permitted uses
- Assessment and tax information
- Environmental status and compliance issues

**LISTING DETAILS:**
- Listing type (exclusive right to sell/lease, exclusive agency, open listing)
- Listing commencement date and expiration date
- Marketing strategy and approved marketing methods
- Asking price for sales or rent for leasing
- Price/rent adjustment authority and procedures
- Minimum acceptable terms and conditions
- Showing instructions and access procedures

**COMMISSION AND COMPENSATION:**
- Complete commission structure (percentage, flat fee, sliding scale)
- Commission splits between listing and selling brokers
- Bonus structures and performance incentives
- Commission payment timing and conditions
- Circumstances triggering commission obligations
- Protected list provisions and holdover periods
- Commission due on renewals, extensions, or expansions

**MARKETING AUTHORIZATION:**
- Approved marketing materials and channels
- MLS listing authorization and terms
- Signage rights and placement approval
- Advertising budget and responsibility
- Online marketing and social media permissions
- Photography and videography rights
- Showing procedures and security requirements

Return comprehensive JSON structure with ALL extracted data:
{
  "documentType": "broker_listing",
  "metadata": {
    "listingType": "Sale/Lease/Both",
    "agreementDate": "YYYY-MM-DD",
    "extractedDate": "2025-01-15"
  },
  "data": {
    "parties": {
      "propertyOwner": "Complete owner entity name",
      "ownerContact": "Contact information",
      "authorizedSignatory": "Authorized person",
      "brokerageFirm": "Brokerage company name",
      "brokerLicense": "License number",
      "listingAgent": "Primary agent name",
      "agentContact": "Agent contact information"
    },
    "property": {
      "legalDescription": "Complete legal description",
      "address": "Full property address",
      "propertyType": "Detailed property type",
      "buildingSize": 0,
      "landSize": 0.00,
      "zoning": "Zoning classification",
      "currentUse": "Current property use"
    },
    "listingTerms": {
      "listingPrice": 0,
      "askingRent": 0.00,
      "commissionRate": 0.00,
      "listingPeriod": "Term length",
      "startDate": "YYYY-MM-DD",
      "expirationDate": "YYYY-MM-DD"
    },
    "brokerObligations": ["Complete list of broker duties"],
    "ownerObligations": ["Complete list of owner duties"],
    "terminationClauses": ["All termination provisions"]
  }
}
  `,

  offering_memo: `
You are a seasoned commercial real estate investment professional with 20+ years of experience in acquisitions, underwriting, and investment analysis. Extract comprehensive investment-grade data from this offering memorandum for institutional investment decision-making.

**EXTRACTION METHODOLOGY:**
1. **COMPLETE DOCUMENT ANALYSIS**: Extract ALL sections including executive summary, financial data, market analysis, and appendices
2. **INVESTMENT FOCUS**: Capture all data points required for investment committee approval
3. **RISK ASSESSMENT**: Extract all risk factors, assumptions, and market conditions
4. **FINANCIAL MODELING**: Capture all data needed for DCF analysis and return projections
5. **DUE DILIGENCE SUPPORT**: Extract information to support comprehensive due diligence

**COMPREHENSIVE OFFERING MEMO EXTRACTION:**

**EXECUTIVE SUMMARY AND INVESTMENT THESIS**
**PROPERTY OVERVIEW AND DESCRIPTION**
**FINANCIAL PERFORMANCE AND PROJECTIONS**
**MARKET ANALYSIS AND POSITIONING**
**TENANT AND LEASE ANALYSIS**
**PHYSICAL PROPERTY ASSESSMENT**
**LOCATION AND DEMOGRAPHICS**
**INVESTMENT RETURNS AND PRICING**
**RISK FACTORS AND OPPORTUNITIES**
**TRANSACTION STRUCTURE**

{
  "documentType": "offering_memo",
  "metadata": {
    "propertyName": "Complete property name",
    "propertyAddress": "Full address",
    "offeringPrice": 0,
    "brokerageFirm": "Listing brokerage",
    "preparedBy": "Document preparer",
    "dateIssued": "YYYY-MM-DD",
    "extractedDate": "2025-01-15"
  },
  "data": {
    "executiveSummary": {
      "investmentThesis": "Primary investment opportunity description",
      "keyInvestmentHighlights": ["All major selling points"],
      "financialSummary": {
        "askingPrice": 0,
        "capRate": 0.00,
        "noi": 0,
        "pricePerSF": 0.00,
        "projectedReturns": "Return projections"
      }
    },
    "propertyOverview": {
      "propertyName": "Building name",
      "address": "Complete address",
      "propertyType": "Detailed property classification",
      "buildingClass": "A/B/C",
      "totalSquareFeet": 0,
      "landArea": 0.00,
      "yearBuilt": 0,
      "lastRenovated": 0,
      "numberOfUnits": 0,
      "parkingSpaces": 0,
      "occupancyRate": 0.00
    },
    "financialPerformance": {
      "currentYearActual": {
        "grossIncome": 0,
        "operatingExpenses": 0,
        "noi": 0,
        "capRate": 0.00
      },
      "projections": [
        {"year": "2025", "noi": 0, "capRate": 0.00},
        {"year": "2026", "noi": 0, "capRate": 0.00}
      ],
      "assumptions": ["Key financial assumptions"]
    },
    "tenantAnalysis": {
      "majorTenants": [
        {
          "tenantName": "Tenant name",
          "squareFeet": 0,
          "percentOfIncome": 0.00,
          "leaseExpiration": "YYYY-MM-DD",
          "creditRating": "Credit assessment"
        }
      ],
      "tenantDiversification": "Analysis of tenant mix",
      "leaseExpirationSchedule": "Rollover analysis"
    },
    "marketAnalysis": {
      "marketOverview": "Market conditions and trends",
      "competitivePosition": "Property's market position",
      "demographics": "Area demographics",
      "economicDrivers": ["Key economic factors"],
      "futureOutlook": "Market projections"
    },
    "investmentAnalysis": {
      "valuationSummary": "Valuation methodology",
      "comparableSales": [
        {
          "address": "Comparable property address",
          "salePrice": 0,
          "capRate": 0.00,
          "pricePerSF": 0.00
        }
      ],
      "returnProjections": {
        "year1CashOnCash": 0.00,
        "averageAnnualReturn": 0.00,
        "totalReturn": 0.00,
        "irr": 0.00
      }
    },
    "riskFactors": ["All identified risks"],
    "opportunities": ["Value-add opportunities"],
    "transactionStructure": {
      "askingPrice": 0,
      "dueDigiencePeriod": "Due diligence timeline",
      "closingTimeline": "Expected closing schedule",
      "brokerCommission": 0.00
    }
  }
}
  `,

  lease_agreement: `
You are a seasoned commercial real estate attorney and lease administrator with 20+ years of experience in lease drafting, negotiation, and portfolio management. Extract comprehensive legal and financial terms from this lease agreement for complete lease administration and investment analysis.

**EXTRACTION METHODOLOGY:**
1. **COMPLETE LEGAL DOCUMENT ANALYSIS**: Extract ALL clauses, terms, conditions, and legal provisions
2. **SYSTEMATIC CLAUSE PROCESSING**: Analyze every section including exhibits, addendums, and amendments
3. **LEGAL TERMINOLOGY RECOGNITION**: Properly interpret complex legal language and commercial lease terms
4. **FINANCIAL OBLIGATION MAPPING**: Capture all financial responsibilities and payment obligations
5. **RISK ASSESSMENT**: Identify default provisions, remedies, and risk allocation between parties

**COMPREHENSIVE LEASE AGREEMENT EXTRACTION:**

**PARTIES AND LEGAL STRUCTURE**
**PREMISES AND PROPERTY DESCRIPTION**
**LEASE TERM AND RENEWAL PROVISIONS**
**RENT AND FINANCIAL OBLIGATIONS**
**OPERATING EXPENSES AND COST ALLOCATION**
**USE CLAUSES AND RESTRICTIONS**
**MAINTENANCE AND REPAIR OBLIGATIONS**
**INSURANCE AND LIABILITY PROVISIONS**
**DEFAULT AND REMEDIES**
**ASSIGNMENT AND TRANSFER RIGHTS**
**SPECIAL PROVISIONS AND ADDENDUMS**

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
      "landlord": {
        "name": "Complete landlord entity name",
        "address": "Landlord address",
        "legalType": "Corporation/LLC/Individual/Partnership",
        "authorizedRepresentative": "Signatory name"
      },
      "tenant": {
        "name": "Complete tenant entity name",
        "address": "Tenant address",
        "legalType": "Corporation/LLC/Individual/Partnership",
        "guarantor": "Guarantor information if applicable"
      }
    },
    "premises": {
      "propertyAddress": "Complete address and legal description",
      "suiteUnit": "Specific suite/unit designation",
      "rentableSquareFeet": 0,
      "usableSquareFeet": 0,
      "commonAreaFactor": 0.00,
      "floorLocation": "Floor number and location",
      "description": "Detailed premises description",
      "includedAmenities": ["Parking spaces", "Storage", "Other included items"],
      "permittedUse": "Specific permitted use language",
      "exclusiveUseRights": "Any exclusive use provisions"
    },
    "leaseTerm": {
      "commencement": "YYYY-MM-DD",
      "expiration": "YYYY-MM-DD",
      "termInMonths": 0,
      "rentCommencementDate": "YYYY-MM-DD",
      "possessionDate": "YYYY-MM-DD",
      "renewalOptions": [
        {
          "optionNumber": 1,
          "termLength": "Length of renewal term",
          "rentDetermination": "Method for determining renewal rent",
          "noticeRequired": "Notice period required",
          "conditions": "Conditions for exercise"
        }
      ],
      "earlyTerminationRights": "Early termination provisions",
      "holdoverProvisions": "Holdover rent and terms"
    },
    "rentStructure": {
      "baseRent": {
        "monthlyAmount": 0,
        "annualAmount": 0,
        "perSquareFootRate": 0.00,
        "escalationSchedule": [
          {"effectiveDate": "YYYY-MM-DD", "monthlyRent": 0, "increase": "Amount/percentage"}
        ],
        "escalationType": "Fixed/CPI/Market/Percentage",
        "escalationFrequency": "Annual/Biennial/Other"
      },
      "percentageRent": {
        "applicable": false,
        "percentageRate": 0.00,
        "breakpoint": 0,
        "reportingRequirements": "Sales reporting obligations"
      },
      "additionalRent": {
        "parkingCharges": 0,
        "storageCharges": 0,
        "signageCharges": 0,
        "otherCharges": "Other recurring charges"
      }
    },
    "operatingExpenses": {
      "structure": "Triple Net/Gross/Modified Gross/Full Service",
      "camCharges": {
        "estimatedAnnual": 0,
        "reconciliationFrequency": "Annual/Monthly",
        "includedServices": ["Services included in CAM"],
        "excludedItems": ["Items excluded from CAM"]
      },
      "realEstateTaxes": {
        "responsibility": "Tenant/Landlord/Shared",
        "baseYear": "Tax base year if applicable",
        "assessmentAppeal": "Rights to contest assessments"
      },
      "insurance": {
        "responsibility": "Tenant/Landlord/Shared",
        "landlordCoverage": "Insurance carried by landlord",
        "tenantRequirements": ["Required tenant insurance coverage"]
      },
      "utilities": {
        "electricity": "Tenant/Landlord responsibility",
        "gas": "Tenant/Landlord responsibility",
        "water": "Tenant/Landlord responsibility",
        "hvac": "HVAC service responsibility",
        "janitorial": "Cleaning service responsibility"
      }
    },
    "securityDeposit": {
      "amount": 0,
      "form": "Cash/Letter of Credit/Other",
      "interestEarning": false,
      "returnConditions": "Conditions for return",
      "reductionProvisions": "Ability to reduce over time"
    },
    "tenantImprovements": {
      "allowance": 0,
      "allowancePerSF": 0.00,
      "approvalProcess": "TI approval requirements",
      "ownershipAtExpiration": "Who owns improvements at lease end",
      "restorationRequirements": "Requirements to restore premises"
    },
    "useAndOccupancy": {
      "permittedUse": "Specific permitted use language",
      "restrictedUses": ["Prohibited uses"],
      "exclusiveUse": "Any exclusive use rights granted",
      "operatingHours": "Required or permitted operating hours",
      "continuousOperation": "Continuous operation requirements",
      "coTenancy": "Co-tenancy requirements or benefits"
    },
    "maintenanceRepair": {
      "landlordObligations": ["Landlord maintenance responsibilities"],
      "tenantObligations": ["Tenant maintenance responsibilities"],
      "capitalImprovements": "Who pays for capital improvements",
      "hvacMaintenance": "HVAC maintenance responsibility",
      "structuralRepairs": "Structural repair responsibility"
    },
    "alterationsImprovements": {
      "consentRequired": "Landlord consent requirements",
      "approvalProcess": "Process for approving alterations",
      "constructionStandards": "Standards for tenant work",
      "removalRequirements": "Requirements to remove at lease end",
      "ownershipOfImprovements": "Who owns improvements"
    },
    "assignmentSubletting": {
      "assignmentRights": "Rights to assign lease",
      "sublettingRights": "Rights to sublet space",
      "landlordConsent": "Landlord consent requirements",
      "profitSharing": "Sharing of sublease profits",
      "recapture": "Landlord recapture rights"
    },
    "defaultRemedies": {
      "monetaryDefaults": {
        "curePeriod": "Days to cure monetary default",
        "remedies": ["Available remedies for monetary default"]
      },
      "nonMonetaryDefaults": {
        "cureperiod": "Days to cure non-monetary default",
        "remedies": ["Available remedies for non-monetary default"]
      },
      "landlordRemedies": ["All landlord remedies upon default"],
      "tenantRemedies": ["Tenant remedies for landlord default"],
      "damages": "Damages calculation methodology",
      "acceleration": "Rent acceleration provisions"
    },
    "insurance": {
      "generalLiability": {
        "minimumCoverage": 0,
        "additionalInsured": "Landlord as additional insured",
        "primaryNonContributory": "Primary and non-contributory language"
      },
      "propertyInsurance": {
        "coverage": "Required property insurance coverage",
        "replacementCost": "Replacement cost requirements"
      },
      "workersCompensation": "Workers compensation requirements",
      "businessInterruption": "Business interruption insurance",
      "certificateRequirements": "Insurance certificate delivery requirements"
    },
    "casualtyCondemnation": {
      "casualtyProvisions": "What happens if property is damaged",
      "repairObligations": "Repair obligations after casualty",
      "terminationRights": "Rights to terminate after casualty",
      "condemnationProvisions": "Condemnation/eminent domain provisions",
      "awardAllocation": "How condemnation awards are allocated"
    },
    "specialProvisions": {
      "signageRights": "Tenant signage rights and restrictions",
      "parkingAllocation": "Parking space allocation and terms",
      "quietEnjoyment": "Quiet enjoyment provisions",
      "accessRights": "24/7 access or restricted access",
      "environmentalProvisions": "Environmental compliance obligations",
      "hazardousMaterials": "Hazardous materials restrictions",
      "subordination": "Subordination to mortgages",
      "estoppelRequirements": "Estoppel certificate obligations"
    },
    "generalProvisions": {
      "governingLaw": "Governing state law",
      "attorneysFees": "Attorneys fees provisions",
      "notices": "How notices must be delivered",
      "severability": "Severability clause",
      "entireAgreement": "Integration/entire agreement clause",
      "amendments": "How lease can be amended",
      "brokerCommissions": "Broker commission obligations"
    },
    "exhibits": ["List of all exhibits and addendums"],
    "additionalNotes": "Any other significant lease terms or unusual provisions"
  }
}
  `,

  financial_statements: `
You are a seasoned commercial real estate financial analyst and asset manager with 20+ years of experience in property financial management, NOI optimization, and investment reporting. Extract comprehensive financial performance data for complete investment analysis and asset management decisions.

**EXTRACTION METHODOLOGY:**
1. **COMPLETE FINANCIAL STATEMENT ANALYSIS**: Extract ALL line items from income statement, balance sheet, and cash flow statement
2. **MULTI-PERIOD DATA CAPTURE**: Extract historical trends and comparative period data where available
3. **DETAILED CATEGORIZATION**: Properly classify all income and expense items by category and nature
4. **VARIANCE ANALYSIS**: Capture actual vs. budget comparisons and explanations
5. **RATIO CALCULATION**: Calculate and extract all relevant financial ratios and metrics
6. **PROFESSIONAL VALIDATION**: Apply real estate financial expertise to validate data consistency

**COMPREHENSIVE FINANCIAL STATEMENT EXTRACTION:**

**INCOME STATEMENT COMPONENTS**
**BALANCE SHEET ELEMENTS**
**CASH FLOW STATEMENT DATA**
**FINANCIAL RATIOS AND METRICS**
**BUDGET VARIANCE ANALYSIS**
**TREND ANALYSIS AND HISTORICAL DATA**
**CAPITAL EXPENDITURE TRACKING**
**DEBT ANALYSIS AND COVERAGE RATIOS**

Return comprehensive JSON structure:
{
  "documentType": "financial_statements",
  "metadata": {
    "propertyName": "Complete property name",
    "propertyAddress": "Full property address",
    "reportingPeriod": "Period covered by statements",
    "reportType": "Annual/Quarterly/Monthly/T-12",
    "auditedUnaudited": "Audited/Unaudited/Reviewed",
    "preparedBy": "CPA firm or internal",
    "extractedDate": "2025-01-15"
  },
  "data": {
    "incomeStatement": {
      "reportingPeriod": "Period ending YYYY-MM-DD",
      "revenues": {
        "rentalIncome": {
          "baseRent": 0,
          "percentageRent": 0,
          "parkingIncome": 0,
          "storageIncome": 0,
          "otherRentalIncome": 0,
          "totalRentalIncome": 0
        },
        "tenantReimbursements": {
          "camReimbursements": 0,
          "realEstateTaxReimbursements": 0,
          "insuranceReimbursements": 0,
          "utilityReimbursements": 0,
          "totalReimbursements": 0
        },
        "otherIncome": {
          "lateFees": 0,
          "applicationFees": 0,
          "forfeiture": 0,
          "vending": 0,
          "interest": 0,
          "miscellaneous": 0,
          "totalOtherIncome": 0
        },
        "grossPotentialRevenue": 0,
        "vacancyCreditLoss": 0,
        "effectiveGrossIncome": 0
      },
      "operatingExpenses": {
        "propertyOperations": {
          "propertyManagement": 0,
          "payrollAndBenefits": 0,
          "repairsAndMaintenance": 0,
          "contractServices": 0,
          "supplies": 0,
          "totalPropertyOperations": 0
        },
        "utilitiesServices": {
          "electricity": 0,
          "gas": 0,
          "water": 0,
          "sewer": 0,
          "trash": 0,
          "telephone": 0,
          "cable": 0,
          "totalUtilities": 0
        },
        "administrativeExpenses": {
          "accounting": 0,
          "legal": 0,
          "audit": 0,
          "consulting": 0,
          "bankCharges": 0,
          "officeExpenses": 0,
          "totalAdministrative": 0
        },
        "marketingLeasing": {
          "advertising": 0,
          "leasingCommissions": 0,
          "leasingCosts": 0,
          "totalMarketingLeasing": 0
        },
        "fixedExpenses": {
          "realEstateTaxes": 0,
          "propertyInsurance": 0,
          "totalFixed": 0
        },
        "otherExpenses": {
          "badDebt": 0,
          "miscellaneous": 0,
          "totalOther": 0
        },
        "totalOperatingExpenses": 0
      },
      "netOperatingIncome": 0,
      "nonOperatingItems": {
        "interestIncome": 0,
        "interestExpense": 0,
        "depreciationAmortization": 0,
        "gainLossOnSale": 0,
        "otherIncome": 0,
        "totalNonOperating": 0
      },
      "netIncome": 0
    },
    "balanceSheet": {
      "asOfDate": "YYYY-MM-DD",
      "assets": {
        "currentAssets": {
          "cash": 0,
          "accountsReceivable": 0,
          "prepaidExpenses": 0,
          "securityDepositsHeld": 0,
          "otherCurrentAssets": 0,
          "totalCurrentAssets": 0
        },
        "fixedAssets": {
          "landAtCost": 0,
          "buildingAtCost": 0,
          "furnitureFixtures": 0,
          "accumulatedDepreciation": 0,
          "netFixedAssets": 0
        },
        "otherAssets": {
          "deposits": 0,
          "deferredCharges": 0,
          "other": 0,
          "totalOtherAssets": 0
        },
        "totalAssets": 0
      },
      "liabilitiesEquity": {
        "currentLiabilities": {
          "accountsPayable": 0,
          "accruedExpenses": 0,
          "securityDeposits": 0,
          "currentPortionDebt": 0,
          "otherCurrentLiabilities": 0,
          "totalCurrentLiabilities": 0
        },
        "longTermLiabilities": {
          "mortgagePayable": 0,
          "notesPayable": 0,
          "otherLongTerm": 0,
          "totalLongTermLiabilities": 0
        },
        "totalLiabilities": 0,
        "equity": {
          "ownersEquity": 0,
          "retainedEarnings": 0,
          "totalEquity": 0
        },
        "totalLiabilitiesEquity": 0
      }
    },
    "cashFlowStatement": {
      "operatingActivities": {
        "netIncome": 0,
        "depreciation": 0,
        "changeInReceivables": 0,
        "changeInPayables": 0,
        "otherOperatingChanges": 0,
        "netCashFromOperations": 0
      },
      "investingActivities": {
        "capitalExpenditures": 0,
        "acquisitions": 0,
        "dispositions": 0,
        "netCashFromInvesting": 0
      },
      "financingActivities": {
        "debtProceeds": 0,
        "debtPayments": 0,
        "distributions": 0,
        "netCashFromFinancing": 0
      },
      "netChangeInCash": 0,
      "beginningCash": 0,
      "endingCash": 0
    },
    "financialRatios": {
      "profitabilityRatios": {
        "noiMargin": 0.00,
        "operatingMargin": 0.00,
        "returnOnAssets": 0.00,
        "returnOnEquity": 0.00
      },
      "efficiencyRatios": {
        "operatingExpenseRatio": 0.00,
        "noiPerSquareFoot": 0.00,
        "revenuePerSquareFoot": 0.00,
        "expensePerSquareFoot": 0.00
      },
      "leverageRatios": {
        "debtToAssetRatio": 0.00,
        "debtToEquityRatio": 0.00,
        "loanToValueRatio": 0.00,
        "debtServiceCoverageRatio": 0.00
      },
      "liquidityRatios": {
        "currentRatio": 0.00,
        "quickRatio": 0.00,
        "cashRatio": 0.00
      }
    },
    "capitalExpenditures": {
      "currentPeriod": {
        "buildingImprovements": 0,
        "tenantImprovements": 0,
        "leasingCosts": 0,
        "equipmentReplacements": 0,
        "other": 0,
        "totalCapex": 0
      },
      "futureCommitments": {
        "contractedWork": 0,
        "plannedImprovements": 0,
        "reserveRequirements": 0,
        "totalCommitments": 0
      }
    },
    "additionalNotes": "Management commentary, significant events, or other relevant information"
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

    // PDFs should have been converted to images on client side before reaching this point
    if (file.type === 'application/pdf') {
      throw new Error('PDF processing on server not supported. PDF should have been converted to image on client side.');
    }

    // Handle image files directly
    const imageBase64 = await fileToBase64(file);
    let mimeType = file.type;
    if (file.type === 'image/png') mimeType = 'image/png';
    else if (file.type === 'image/gif') mimeType = 'image/gif';
    else mimeType = 'image/jpeg';
    
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

    // PDFs should have been converted to images on client side before reaching this point
    if (file.type === 'application/pdf') {
      throw new Error('PDF processing on server not supported. PDF should have been converted to image on client side.');
    }

    // Handle image files directly
    const imageBase64 = await fileToBase64(file);
    let mimeType = file.type;
    if (file.type === 'image/png') mimeType = 'image/png';
    else if (file.type === 'image/gif') mimeType = 'image/gif';
    else mimeType = 'image/jpeg';
    
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
                detail: "high" // Use high detail for better extraction accuracy
              },
            },
          ],
        },
      ],
      max_tokens: 15000,
      temperature: 0.1,
      response_format: { type: "json_object" }, // Ensure JSON response
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

      // Attempt to parse JSON, with fallback for truncated responses
      let extractedData;
      try {
        extractedData = JSON.parse(jsonContent);
      } catch (parseError) {
        // If JSON is malformed, try to fix it by cleaning corruption and closing structures
        console.log('JSON parse failed, attempting to fix malformed JSON...', {
          errorMessage: parseError instanceof Error ? parseError.message : 'Unknown error',
          jsonLength: jsonContent.length,
          jsonPreview: jsonContent.substring(0, 200) + '...'
        });

        const fixedJson = attemptJSONFix(jsonContent);
        if (fixedJson) {
          try {
            extractedData = JSON.parse(fixedJson);
            console.log('Successfully recovered from malformed JSON');
          } catch (secondError) {
            console.error('Fixed JSON still invalid:', secondError);
            throw parseError;
          }
        } else {
          console.error('Could not fix malformed JSON');
          throw parseError;
        }
      }

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