/**
 * OpenAI JSONL Export Utility
 * Generates OpenAI fine-tuning format training files
 * Following OpenAI's best practices for GPT-4o-mini fine-tuning
 */

import type {
  TrainingDocument,
  OpenAITrainingExample,
  OpenAIMessage,
  OpenAIUserContent,
  DocumentType,
  ExtractedData
} from './types';
import { supabase } from './training-utils';

/**
 * System prompts for each document type
 * These are the expert-level prompts used in production
 */
const SYSTEM_PROMPTS: Record<DocumentType, string> = {
  rent_roll: `You are an expert commercial real estate professional with 20+ years of experience analyzing rent rolls for investment analysis and property management decisions. Extract comprehensive rent roll data with the precision required for NOI calculations and investment underwriting.

Focus on extracting ALL relevant data points including tenant information, lease terms, rental rates, occupancy data, and financial metrics. Analyze tenant mix, identify risk factors, and provide professional insights.`,

  operating_budget: `You are a seasoned commercial real estate financial analyst and asset manager with 20+ years of experience in investment underwriting, NOI optimization, and property financial management. Extract comprehensive operating budget data with systematic precision.

Analyze income streams, operating expenses, capital expenditures, debt service, and financial performance metrics. Provide detailed variance analysis and professional insights on property financial performance.`,

  broker_sales_comparables: `You are a data extraction specialist focused on capturing ALL sales comparable information from real estate documents. Extract comprehensive market data including property characteristics, transaction details, pricing metrics, and market analysis.

Systematically process every property listed, capturing ALL financial data, buyer/seller information, and market context. Provide thorough comparable analysis for investment decision-making.`,

  broker_lease_comparables: `You are an expert commercial real estate leasing analyst with deep experience in market analysis and lease transaction evaluation. Extract comprehensive lease comparable data including tenant information, lease terms, rental rates, and market conditions.

Analyze lease structures, concessions, effective rents, and market trends. Provide professional insights on leasing market dynamics and pricing trends.`,

  broker_listing: `You are a commercial real estate broker and transaction specialist with expertise in listing agreements and property marketing. Extract complete listing information including property details, pricing, commission structures, and broker obligations.

Analyze listing terms, marketing strategies, and transaction requirements. Provide insights on property positioning and market competitiveness.`,

  offering_memo: `You are a commercial real estate investment professional with 20+ years of experience evaluating property acquisitions. Extract comprehensive offering memorandum data including property overview, financial performance, market analysis, and investment highlights.

Analyze investment opportunities, risk factors, return projections, and market positioning. Provide thorough due diligence insights for investment decision-making.`,

  lease_agreement: `You are a commercial real estate attorney and leasing specialist with extensive experience in lease negotiations and contract analysis. Extract complete lease agreement terms including parties, premises, rent schedules, operating expenses, and legal provisions.

Analyze lease obligations, rights, restrictions, and risk factors. Provide professional insights on lease terms and their implications for both landlords and tenants.`,

  financial_statements: `You are a commercial real estate financial analyst with expertise in property accounting and financial statement analysis. Extract comprehensive financial data including income statements, balance sheets, cash flows, and performance metrics.

Analyze financial performance, trends, ratios, and investment returns. Provide professional insights on property financial health and investment performance.`,

  // Legacy types for backward compatibility
  comparable_sales: `You are a data extraction specialist focused on capturing ALL sales comparable information from real estate documents. Extract comprehensive market data including property characteristics, transaction details, pricing metrics, and market analysis.`,

  financial_statement: `You are a commercial real estate financial analyst with expertise in property accounting and financial statement analysis. Extract comprehensive financial data including income statements, balance sheets, cash flows, and performance metrics.`,

  unknown: `You are an expert real estate document analyst. Extract all relevant information from this document in a structured format. Identify the document type and extract applicable data points.`
};

/**
 * User instruction prompts for extraction
 */
const EXTRACTION_INSTRUCTIONS: Record<DocumentType, string> = {
  rent_roll: `Extract comprehensive data from this rent roll document. Analyze ALL tenants and lease information, extract complete financial data, calculate occupancy metrics, and provide market insights. Include all tenant details, lease terms, rental rates, and property summary statistics.`,

  operating_budget: `Extract comprehensive data from this operating budget document. Analyze ALL income sources, operating expenses, capital expenditures, and financial metrics. Calculate NOI, operating ratios, and provide detailed variance analysis if available. Include all budget assumptions and performance indicators.`,

  broker_sales_comparables: `Extract comprehensive data from this broker sales comparable document. Analyze ALL comparable properties listed, extract complete pricing metrics (sale price, price per SF, cap rates), property characteristics, transaction details, and market analysis. Ensure every visible property is captured with full details.`,

  broker_lease_comparables: `Extract comprehensive data from this broker lease comparable document. Analyze ALL lease transactions, extract rental rates, lease terms, tenant information, concessions, and effective rents. Calculate market averages and provide leasing market insights.`,

  broker_listing: `Extract comprehensive data from this broker listing agreement. Analyze listing terms, property details, pricing information, commission structures, broker obligations, and marketing requirements. Include all contract terms and conditions.`,

  offering_memo: `Extract comprehensive data from this offering memorandum. Analyze property overview, financial performance, investment highlights, market analysis, tenant information, and investment metrics. Include all pricing information, return projections, and risk factors.`,

  lease_agreement: `Extract comprehensive data from this lease agreement. Analyze all parties, premises details, lease terms, rent schedules, operating expense provisions, renewal options, and legal terms. Include all financial obligations, rights, and restrictions for both landlord and tenant.`,

  financial_statements: `Extract comprehensive data from this financial statement document. Analyze operating income, operating expenses, NOI, debt service, cash flow, and balance sheet information. Calculate key financial ratios and performance metrics. Include all accounting details and notes.`,

  // Legacy types for backward compatibility
  comparable_sales: `Extract comprehensive data from this sales comparable document. Analyze ALL comparable properties listed, extract pricing metrics, property characteristics, and transaction details.`,

  financial_statement: `Extract comprehensive data from this financial statement document. Analyze operating income, expenses, NOI, and financial metrics.`,

  unknown: `Extract all relevant information from this document in a structured format.`
};

/**
 * Convert image file to base64 data URL
 */
async function fileToBase64DataUrl(fileUrl: string): Promise<string> {
  try {
    // Download file from Supabase Storage
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    // Determine MIME type from URL
    let mimeType = 'image/png';
    if (fileUrl.toLowerCase().endsWith('.jpg') || fileUrl.toLowerCase().endsWith('.jpeg')) {
      mimeType = 'image/jpeg';
    } else if (fileUrl.toLowerCase().endsWith('.pdf')) {
      mimeType = 'application/pdf';
    }

    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error('Error converting file to base64:', error);
    throw new Error(`Failed to convert file to base64: ${error}`);
  }
}

/**
 * Create OpenAI training example from training document
 */
export async function createTrainingExample(
  document: TrainingDocument
): Promise<OpenAITrainingExample> {
  console.log(`Creating training example for document: ${document.id}`);

  // Get system prompt for document type
  const systemPrompt = SYSTEM_PROMPTS[document.document_type] || SYSTEM_PROMPTS.rent_roll;

  // Get extraction instruction
  const userInstruction = EXTRACTION_INSTRUCTIONS[document.document_type] || EXTRACTION_INSTRUCTIONS.rent_roll;

  // Convert file to base64
  const base64Image = await fileToBase64DataUrl(document.file_url);

  // Use verified extraction if available, otherwise use raw extraction
  const extraction = document.verified_extraction || document.raw_extraction;

  if (!extraction) {
    throw new Error(`No extraction data available for document ${document.id}`);
  }

  // Create user content with text and image
  const userContent: OpenAIUserContent[] = [
    {
      type: 'text',
      text: userInstruction
    },
    {
      type: 'image_url',
      image_url: {
        url: base64Image,
        detail: 'high' // Use high detail for training
      }
    }
  ];

  // Create messages array
  const messages: OpenAIMessage[] = [
    {
      role: 'system',
      content: systemPrompt
    },
    {
      role: 'user',
      content: userContent
    },
    {
      role: 'assistant',
      content: JSON.stringify(extraction, null, 2) // Pretty print for readability
    }
  ];

  return { messages };
}

/**
 * Export training data to OpenAI JSONL format
 * Returns separate train and validation files
 */
export async function exportTrainingData(
  documentType: DocumentType
): Promise<{
  train_file_path?: string;
  validation_file_path?: string;
  train_examples: number;
  validation_examples: number;
}> {
  console.log(`Exporting training data for document type: ${documentType}`);

  // Get all verified documents for this type
  const { data: trainDocs, error: trainError } = await supabase
    .from('training_documents')
    .select('*')
    .eq('document_type', documentType)
    .eq('is_verified', true)
    .eq('include_in_training', true)
    .eq('dataset_split', 'train')
    .order('created_at');

  if (trainError) {
    throw new Error(`Failed to fetch training documents: ${trainError.message}`);
  }

  const { data: validationDocs, error: validationError } = await supabase
    .from('training_documents')
    .select('*')
    .eq('document_type', documentType)
    .eq('is_verified', true)
    .eq('include_in_training', true)
    .eq('dataset_split', 'validation')
    .order('created_at');

  if (validationError) {
    throw new Error(`Failed to fetch validation documents: ${validationError.message}`);
  }

  console.log(`Found ${trainDocs?.length || 0} training docs, ${validationDocs?.length || 0} validation docs`);

  let train_file_path: string | undefined;
  let validation_file_path: string | undefined;

  // Process training documents
  if (trainDocs && trainDocs.length > 0) {
    const trainExamples: OpenAITrainingExample[] = [];

    for (const doc of trainDocs) {
      try {
        const example = await createTrainingExample(doc as TrainingDocument);
        trainExamples.push(example);
      } catch (error) {
        console.error(`Failed to create training example for doc ${doc.id}:`, error);
        // Continue with other documents
      }
    }

    // Convert to JSONL format (one JSON object per line)
    const trainJsonl = trainExamples.map(ex => JSON.stringify(ex)).join('\n');

    // Upload to Supabase Storage
    const trainFileName = `${documentType}_train_${Date.now()}.jsonl`;
    const { data: trainUpload, error: trainUploadError } = await supabase.storage
      .from('training-exports')
      .upload(`${documentType}/${trainFileName}`, trainJsonl, {
        contentType: 'application/jsonl',
        cacheControl: '3600'
      });

    if (trainUploadError) {
      console.error('Failed to upload training file:', trainUploadError);
    } else {
      const { data: trainUrl } = supabase.storage
        .from('training-exports')
        .getPublicUrl(`${documentType}/${trainFileName}`);
      train_file_path = trainUrl.publicUrl;
      console.log(`Training file uploaded: ${train_file_path}`);
    }
  }

  // Process validation documents
  if (validationDocs && validationDocs.length > 0) {
    const validationExamples: OpenAITrainingExample[] = [];

    for (const doc of validationDocs) {
      try {
        const example = await createTrainingExample(doc as TrainingDocument);
        validationExamples.push(example);
      } catch (error) {
        console.error(`Failed to create validation example for doc ${doc.id}:`, error);
        // Continue with other documents
      }
    }

    // Convert to JSONL format
    const validationJsonl = validationExamples.map(ex => JSON.stringify(ex)).join('\n');

    // Upload to Supabase Storage
    const validationFileName = `${documentType}_validation_${Date.now()}.jsonl`;
    const { data: validationUpload, error: validationUploadError } = await supabase.storage
      .from('training-exports')
      .upload(`${documentType}/${validationFileName}`, validationJsonl, {
        contentType: 'application/jsonl',
        cacheControl: '3600'
      });

    if (validationUploadError) {
      console.error('Failed to upload validation file:', validationUploadError);
    } else {
      const { data: validationUrl } = supabase.storage
        .from('training-exports')
        .getPublicUrl(`${documentType}/${validationFileName}`);
      validation_file_path = validationUrl.publicUrl;
      console.log(`Validation file uploaded: ${validation_file_path}`);
    }
  }

  // Update training metrics with last export date
  await supabase
    .from('training_metrics')
    .update({ last_export_date: new Date().toISOString() })
    .eq('document_type', documentType);

  return {
    train_file_path,
    validation_file_path,
    train_examples: trainDocs?.length || 0,
    validation_examples: validationDocs?.length || 0
  };
}

/**
 * Create a training run record
 */
export async function createTrainingRun(data: {
  document_type: DocumentType;
  total_examples: number;
  train_examples: number;
  validation_examples: number;
  export_file_path?: string;
  export_file_size?: number;
  created_by?: string;
  notes?: string;
}): Promise<any> {
  console.log(`Creating training run record for ${data.document_type}`);

  const { data: run, error } = await supabase
    .from('training_runs')
    .insert(data)
    .select()
    .single();

  if (error) {
    console.error('Failed to create training run:', error);
    throw new Error(`Failed to create training run: ${error.message}`);
  }

  // Update metrics
  await supabase
    .from('training_metrics')
    .update({
      training_runs: supabase.rpc('increment_training_runs', { doc_type: data.document_type }),
      last_training_date: new Date().toISOString()
    })
    .eq('document_type', data.document_type);

  return run;
}

/**
 * Validate JSONL format
 * Ensures each line is valid JSON and follows OpenAI format
 */
export function validateJsonlFormat(jsonl: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const lines = jsonl.split('\n').filter(line => line.trim() !== '');

  lines.forEach((line, index) => {
    try {
      const obj = JSON.parse(line);

      // Validate structure
      if (!obj.messages || !Array.isArray(obj.messages)) {
        errors.push(`Line ${index + 1}: Missing or invalid 'messages' array`);
      } else {
        // Validate messages
        obj.messages.forEach((msg: any, msgIndex: number) => {
          if (!msg.role || !['system', 'user', 'assistant'].includes(msg.role)) {
            errors.push(`Line ${index + 1}, Message ${msgIndex + 1}: Invalid role`);
          }
          if (!msg.content) {
            errors.push(`Line ${index + 1}, Message ${msgIndex + 1}: Missing content`);
          }
        });
      }
    } catch (e) {
      errors.push(`Line ${index + 1}: Invalid JSON - ${e}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get training data statistics
 */
export async function getTrainingDataStats(documentType: DocumentType): Promise<{
  total_verified: number;
  train_ready: number;
  validation_ready: number;
  average_quality_score: number;
  meets_minimum: boolean;
}> {
  const { data, error } = await supabase
    .from('training_documents')
    .select('quality_score, dataset_split')
    .eq('document_type', documentType)
    .eq('is_verified', true)
    .eq('include_in_training', true);

  if (error) {
    throw new Error(`Failed to fetch training data stats: ${error.message}`);
  }

  const trainDocs = data?.filter(d => d.dataset_split === 'train') || [];
  const validationDocs = data?.filter(d => d.dataset_split === 'validation') || [];
  const qualityScores = data?.map(d => d.quality_score).filter(s => s !== null) || [];

  const average_quality_score = qualityScores.length > 0
    ? qualityScores.reduce((sum, score) => sum + (score || 0), 0) / qualityScores.length
    : 0;

  return {
    total_verified: data?.length || 0,
    train_ready: trainDocs.length,
    validation_ready: validationDocs.length,
    average_quality_score,
    meets_minimum: (data?.length || 0) >= 50 // OpenAI recommendation
  };
}
