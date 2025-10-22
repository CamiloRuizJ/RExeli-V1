/**
 * PDF Processing Utilities
 * Converts PDF files to images for OpenAI Vision API processing
 */

// PDF.js library instance - dynamically loaded
let pdfjsLib: typeof import('pdfjs-dist') | null = null;
let isLoadingPdfjs = false;
let pdfjsLoadPromise: Promise<typeof import('pdfjs-dist')> | null = null;

/**
 * Dynamically loads PDF.js library with proper worker configuration
 * This ensures compatibility with Next.js 15 and browser environments
 */
async function loadPdfjs(): Promise<typeof import('pdfjs-dist')> {
  // Return cached instance if already loaded
  if (pdfjsLib) {
    return pdfjsLib;
  }

  // Return existing promise if already loading
  if (pdfjsLoadPromise) {
    return pdfjsLoadPromise;
  }

  // Check if we're in server environment
  if (typeof window === 'undefined') {
    throw new Error('PDF.js can only be loaded in browser environment');
  }

  // Create loading promise
  pdfjsLoadPromise = (async () => {
    try {
      console.log('Loading PDF.js library...');

      // Use dynamic import for proper ESM compatibility with Next.js 15
      const pdfjs = await import('pdfjs-dist');

      // Configure worker with proper path for Next.js
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        // Try local worker first, then fallback to CDN
        const workerPaths = [
          // Local worker file we copied to public directory
          '/pdf.worker.min.mjs',
          // CDN fallback with correct .mjs extension
          `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`,
          // Secondary CDN fallback
          `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`,
          // Legacy .js fallback
          `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`
        ];

        // Use local worker first
        pdfjs.GlobalWorkerOptions.workerSrc = workerPaths[0];
        console.log(`PDF.js worker configured (local): ${pdfjs.GlobalWorkerOptions.workerSrc}`);
      }

      pdfjsLib = pdfjs;
      console.log(`PDF.js loaded successfully (version: ${pdfjs.version})`);

      return pdfjs;
    } catch (error) {
      console.error('Failed to load PDF.js:', error);
      // Reset loading state on error
      pdfjsLoadPromise = null;
      throw new Error(`Failed to load PDF.js library: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  })();

  return pdfjsLoadPromise;
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

  // Validate file input
  if (!file || file.type !== 'application/pdf') {
    throw new Error('Invalid file: Must be a PDF file');
  }

  // Check file size (max 25MB as per UI constraint)
  const maxSize = 25 * 1024 * 1024; // 25MB
  if (file.size > maxSize) {
    throw new Error(`File too large: ${Math.round(file.size / 1024 / 1024)}MB exceeds 25MB limit`);
  }

  try {
    console.log(`Converting PDF to image: ${file.name} (${Math.round(file.size / 1024)}KB), page ${pageNumber}`);

    // Dynamically load PDF.js
    const pdfjs = await loadPdfjs();

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Load PDF document with timeout
    const loadingTask = pdfjs.getDocument({
      data: arrayBuffer,
      // Add timeout and other options for better error handling
      disableStream: true,
      disableAutoFetch: true,
    });

    const pdfDocument = await loadingTask.promise;
    console.log(`PDF loaded: ${pdfDocument.numPages} pages`);

    // Validate page number
    if (pageNumber < 1 || pageNumber > pdfDocument.numPages) {
      console.warn(`Invalid page number ${pageNumber}, using page 1`);
      pageNumber = 1;
    }

    // Get the specified page
    const page = await pdfDocument.getPage(pageNumber);

    // Set up canvas for rendering with optimal scale
    const scale = 1.5; // Good balance of quality and size
    const viewport = page.getViewport({ scale });

    // Create canvas element (browser only)
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Unable to create canvas 2D context');
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    console.log(`Rendering PDF page ${pageNumber} at ${viewport.width}x${viewport.height} (scale: ${scale})`);

    // Render PDF page to canvas
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    await page.render(renderContext).promise;
    console.log('PDF page rendered to canvas successfully');

    // Convert canvas to base64 PNG with error handling
    const dataUrl = canvas.toDataURL('image/png');
    if (!dataUrl || !dataUrl.startsWith('data:image/png;base64,')) {
      throw new Error('Failed to convert canvas to PNG data URL');
    }

    const imageBase64 = dataUrl.split(',')[1];

    if (!imageBase64 || imageBase64.length === 0) {
      throw new Error('Generated image data is empty');
    }

    console.log(`PDF converted successfully: ${Math.round(imageBase64.length / 1024)}KB image data`);

    // Clean up
    await pdfDocument.destroy();

    return {
      imageBase64,
      mimeType: 'image/png'
    };

  } catch (error) {
    console.error('PDF conversion error:', error);

    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('Invalid PDF structure')) {
        throw new Error('Invalid PDF file: The file appears to be corrupted or not a valid PDF');
      } else if (error.message.includes('Password')) {
        throw new Error('Password-protected PDFs are not supported');
      } else if (error.message.includes('worker') || error.message.includes('Worker')) {
        throw new Error('PDF.js worker failed to load. Please try refreshing the page or check your internet connection');
      } else if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
        throw new Error('Network error while loading PDF.js. Please check your internet connection');
      } else if (error.message.includes('SecurityError')) {
        throw new Error('Browser security restrictions prevented PDF processing. Please try uploading a different file');
      }
    }

    throw new Error(`Failed to convert PDF to image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Convert all pages of a PDF file to images for multi-page extraction
 * @param file - PDF file from form data
 * @param onProgress - Optional callback to track conversion progress
 * @returns Array of base64 encoded PNG images, one per page
 */
export async function convertPdfToAllImages(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<Array<{
  imageBase64: string;
  mimeType: string;
  pageNumber: number;
}>> {
  // Check if we're in server environment
  if (typeof window === 'undefined') {
    throw new Error('PDF processing is not available on the server. This function should be called from the client side.');
  }

  // Validate file input
  if (!file || file.type !== 'application/pdf') {
    throw new Error('Invalid file: Must be a PDF file');
  }

  // Check file size (max 25MB as per UI constraint)
  const maxSize = 25 * 1024 * 1024; // 25MB
  if (file.size > maxSize) {
    throw new Error(`File too large: ${Math.round(file.size / 1024 / 1024)}MB exceeds 25MB limit`);
  }

  try {
    console.log(`Converting all pages of PDF to images: ${file.name} (${Math.round(file.size / 1024)}KB)`);

    // Dynamically load PDF.js
    const pdfjs = await loadPdfjs();

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Load PDF document
    const loadingTask = pdfjs.getDocument({
      data: arrayBuffer,
      disableStream: true,
      disableAutoFetch: true,
    });

    const pdfDocument = await loadingTask.promise;
    const numPages = pdfDocument.numPages;
    console.log(`PDF loaded: ${numPages} pages to convert`);

    // Warn if PDF has too many pages (potential token limit issues)
    if (numPages > 20) {
      console.warn(`PDF has ${numPages} pages. This may result in large API costs and potential token limits. Consider processing fewer pages.`);
    }

    const allPages: Array<{
      imageBase64: string;
      mimeType: string;
      pageNumber: number;
    }> = [];

    // Set up canvas once for reuse across all pages
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Unable to create canvas 2D context');
    }

    // Convert each page to an image
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      try {
        console.log(`Converting page ${pageNum} of ${numPages}...`);

        // Report progress
        if (onProgress) {
          onProgress(pageNum, numPages);
        }

        // Get the page
        const page = await pdfDocument.getPage(pageNum);

        // Set up canvas for rendering with optimal scale
        const scale = 1.5; // Good balance of quality and size
        const viewport = page.getViewport({ scale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        console.log(`Rendering page ${pageNum} at ${viewport.width}x${viewport.height} (scale: ${scale})`);

        // Render PDF page to canvas
        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;

        // Convert canvas to base64 PNG
        const dataUrl = canvas.toDataURL('image/png');
        if (!dataUrl || !dataUrl.startsWith('data:image/png;base64,')) {
          throw new Error(`Failed to convert page ${pageNum} to PNG data URL`);
        }

        const imageBase64 = dataUrl.split(',')[1];

        if (!imageBase64 || imageBase64.length === 0) {
          throw new Error(`Generated image data for page ${pageNum} is empty`);
        }

        console.log(`Page ${pageNum} converted: ${Math.round(imageBase64.length / 1024)}KB image data`);

        allPages.push({
          imageBase64,
          mimeType: 'image/png',
          pageNumber: pageNum
        });

      } catch (pageError) {
        console.error(`Error converting page ${pageNum}:`, pageError);
        throw new Error(`Failed to convert page ${pageNum}: ${pageError instanceof Error ? pageError.message : 'Unknown error'}`);
      }
    }

    // Clean up
    await pdfDocument.destroy();

    const totalSize = allPages.reduce((sum, page) => sum + page.imageBase64.length, 0);
    console.log(`All ${numPages} pages converted successfully. Total size: ${Math.round(totalSize / 1024)}KB`);

    return allPages;

  } catch (error) {
    console.error('Multi-page PDF conversion error:', error);

    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('Invalid PDF structure')) {
        throw new Error('Invalid PDF file: The file appears to be corrupted or not a valid PDF');
      } else if (error.message.includes('Password')) {
        throw new Error('Password-protected PDFs are not supported');
      } else if (error.message.includes('worker') || error.message.includes('Worker')) {
        throw new Error('PDF.js worker failed to load. Please try refreshing the page or check your internet connection');
      } else if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
        throw new Error('Network error while loading PDF.js. Please check your internet connection');
      } else if (error.message.includes('SecurityError')) {
        throw new Error('Browser security restrictions prevented PDF processing. Please try uploading a different file');
      } else if (error.message.includes('Failed to convert page')) {
        throw error; // Re-throw specific page conversion errors
      }
    }

    throw new Error(`Failed to convert PDF to images: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get PDF metadata (number of pages, etc.)
 * @param file - PDF file from form data
 * @returns PDF metadata including page count and document info
 */
export async function getPdfInfo(file: File): Promise<{
  numPages: number;
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
}> {
  // Check if we're in server environment
  if (typeof window === 'undefined') {
    throw new Error('PDF processing is not available on the server. This function should be called from the client side.');
  }

  // Validate file input
  if (!file || file.type !== 'application/pdf') {
    throw new Error('Invalid file: Must be a PDF file');
  }

  try {
    console.log(`Getting PDF info for: ${file.name}`);

    // Dynamically load PDF.js
    const pdfjs = await loadPdfjs();

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Load PDF document
    const loadingTask = pdfjs.getDocument({
      data: arrayBuffer,
      disableStream: true,
      disableAutoFetch: true,
    });

    const pdfDocument = await loadingTask.promise;

    // Get basic info
    const numPages = pdfDocument.numPages;

    // Get metadata
    let metadata: any = {};
    try {
      const metadataResult = await pdfDocument.getMetadata();
      metadata = metadataResult.info || {};
    } catch (metaError) {
      console.warn('Could not read PDF metadata:', metaError);
    }

    // Clean up
    await pdfDocument.destroy();

    console.log(`PDF info retrieved: ${numPages} pages`);

    return {
      numPages,
      title: metadata.Title || file.name,
      author: metadata.Author,
      subject: metadata.Subject,
      creator: metadata.Creator,
    };

  } catch (error) {
    console.error('PDF info extraction error:', error);

    // Fallback to basic file info
    console.warn('Falling back to basic file info due to error');
    return {
      numPages: 1, // Assume single page as fallback
      title: file.name,
      author: undefined,
      subject: undefined,
      creator: undefined,
    };
  }
}

/**
 * Pre-load PDF.js library for better user experience
 * Call this function early in the application lifecycle
 */
export async function preloadPdfjs(): Promise<void> {
  try {
    if (typeof window !== 'undefined') {
      await loadPdfjs();
      console.log('PDF.js preloaded successfully');
    }
  } catch (error) {
    console.warn('PDF.js preload failed:', error);
  }
}