import OpenAI from 'openai';
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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Commercial Real Estate Document Classification Prompts
 */
const CLASSIFICATION_PROMPT = `
You are an expert commercial real estate analyst. Analyze this document image and classify it into one of these categories:

1. RENT_ROLL - Contains tenant information, unit numbers, rental rates, lease terms, occupancy data
2. OFFERING_MEMO - Marketing material for property sales, includes property details, financial projections, highlights
3. LEASE_AGREEMENT - Legal document between landlord and tenant with lease terms
4. COMPARABLE_SALES - Market data showing recent property sales with pricing information
5. FINANCIAL_STATEMENT - Income/expense statements, cash flow analysis, NOI calculations

Respond with this exact JSON structure:
{
  "type": "rent_roll|offering_memo|lease_agreement|comparable_sales|financial_statement",
  "confidence": 0.95,
  "reasoning": "Brief explanation of classification decision"
}
`;

/**
 * Specialized extraction prompts for each document type
 */
const EXTRACTION_PROMPTS = {
  rent_roll: `
Extract rent roll data from this document. Focus on:
- Unit/suite numbers
- Tenant names (or "VACANT")
- Square footage
- Monthly rent amounts
- Lease start/end dates
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
Extract key property and financial data from this offering memorandum:
- Property details (name, address, type, year built)
- Financial metrics (asking price, cap rate, NOI)
- Key highlights and features

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
Extract lease terms and key data from this lease agreement:
- Tenant and landlord information
- Lease dates and rental terms
- Property details

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
Extract comparable sales data from this document:
- Property addresses
- Sale prices and dates
- Property characteristics

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
Extract financial data from this statement:
- Revenue items (rent, other income)
- Operating expenses by category
- Net operating income

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
 */
export async function classifyDocument(imageBase64: string): Promise<DocumentClassification> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: CLASSIFICATION_PROMPT },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No classification response received');
    }

    // Parse JSON response
    const classification = JSON.parse(content);
    return classification;
  } catch (error) {
    console.error('Document classification error:', error);
    throw new Error('Failed to classify document');
  }
}

/**
 * Extract structured data from a classified document
 */
export async function extractDocumentData(
  imageBase64: string, 
  documentType: DocumentType
): Promise<ExtractedData> {
  try {
    const prompt = EXTRACTION_PROMPTS[documentType as keyof typeof EXTRACTION_PROMPTS];
    if (!prompt) {
      throw new Error(`No extraction prompt available for document type: ${documentType}`);
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No extraction response received');
    }

    // Parse JSON response
    const extractedData = JSON.parse(content);
    return extractedData;
  } catch (error) {
    console.error('Document extraction error:', error);
    throw new Error('Failed to extract document data');
  }
}

/**
 * Convert file to base64 for OpenAI API
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data:image/jpeg;base64, prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
}

/**
 * Convert PDF page to image for processing
 */
export async function convertPdfPageToImage(file: File, pageNumber: number = 1): Promise<string> {
  // For V1, we'll assume PDFs are converted to images client-side
  // In production, this would use pdf2pic or similar server-side conversion
  return fileToBase64(file);
}