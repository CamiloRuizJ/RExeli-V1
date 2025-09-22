/**
 * PDF Processing Utilities
 * Converts PDF files to images for OpenAI Vision API processing
 */

// Import PDF.js with proper server-side configuration
let pdfjsLib: typeof import('pdfjs-dist') | null;

if (typeof window !== 'undefined') {
  // Client-side: import PDF.js normally
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  pdfjsLib = require('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
} else {
  // Server-side: We'll handle PDFs differently to avoid canvas dependency
  pdfjsLib = null;
}

/**
 * Convert PDF file to image (PNG) for OpenAI Vision API
 * @param file - PDF file from form data
 * @param pageNumber - Page number to convert (default: 1)
 * @returns Base64 encoded PNG image
 */
export async function convertPdfToImage(file: File, pageNumber: number = 1): Promise<{
  imageBase64: string;
  mimeType: string;
}> {
  // Check if we're in server environment
  if (typeof window === 'undefined') {
    throw new Error('PDF processing is not available on the server. This function should be called from the client side.');
  }

  // Check if PDF.js is available
  if (!pdfjsLib) {
    throw new Error('PDF.js is not available. Make sure it is properly loaded.');
  }

  try {
    console.log(`Converting PDF to image: ${file.name}, page ${pageNumber}`);
    
    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDocument = await loadingTask.promise;
    
    console.log(`PDF loaded: ${pdfDocument.numPages} pages`);
    
    // Get the specified page (default to first page)
    const targetPage = Math.min(pageNumber, pdfDocument.numPages);
    const page = await pdfDocument.getPage(targetPage);
    
    // Set up canvas for rendering
    const scale = 1.5; // Good balance of quality and size
    const viewport = page.getViewport({ scale });
    
    // Create canvas element (browser only)
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    // Render PDF page to canvas
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };
    
    await page.render(renderContext).promise;
    console.log('PDF page rendered to canvas');
    
    // Convert canvas to base64 PNG
    const imageBase64 = canvas.toDataURL('image/png').split(',')[1];
    
    console.log(`PDF converted successfully: ${imageBase64.length} base64 characters`);
    
    return {
      imageBase64,
      mimeType: 'image/png'
    };
    
  } catch (error) {
    console.error('PDF conversion error:', error);
    throw new Error(`Failed to convert PDF to image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get PDF metadata (number of pages, etc.)
 */
export async function getPdfInfo(file: File): Promise<{
  numPages: number;
  title?: string;
  author?: string;
}> {
  // Simplified for MVP - return basic info
  return {
    numPages: 1,
    title: file.name,
    author: undefined,
  };
}