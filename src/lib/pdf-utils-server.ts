/**
 * Server-Side PDF Processing Utilities
 * Converts PDF files to PNG images for OpenAI Vision API processing in Node.js environment
 *
 * This module is specifically designed for server-side execution (API routes, serverless functions)
 * and uses Node.js-compatible libraries (pdfjs-dist/legacy and sharp).
 */

// @ts-ignore - Sharp has complex types, use dynamic import
import sharpLib from 'sharp';

// PDF.js types for Node.js environment
type PDFDocumentProxy = any;
type PDFPageProxy = any;

/**
 * Dynamically loads PDF.js for Node.js environment
 * Uses the legacy build which is compatible with Node.js
 */
async function loadPdfjsForNode() {
  try {
    // Use the legacy build which works in Node.js environment
    // The standard build requires browser APIs
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

    console.log('[PDF-Server] PDF.js loaded for Node.js environment');
    return pdfjs;
  } catch (error) {
    console.error('[PDF-Server] Failed to load PDF.js:', error);
    throw new Error(`Failed to load PDF.js for Node.js: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Convert PDF file to PNG image on the server side
 *
 * This function:
 * 1. Loads the PDF using pdfjs-dist (Node.js compatible version)
 * 2. Renders the first page to raw RGBA pixel data
 * 3. Converts the pixel data to PNG using sharp
 * 4. Returns base64-encoded PNG data
 *
 * @param file - PDF file from FormData or File object
 * @param pageNumber - Page number to convert (default: 1)
 * @returns Object containing base64 PNG data and mime type
 */
export async function convertPdfToPngServer(
  file: File,
  pageNumber: number = 1
): Promise<{ imageBase64: string; mimeType: string }> {
  console.log(`[PDF-Server] Starting PDF to PNG conversion for: ${file.name}`);
  console.log(`[PDF-Server] File size: ${Math.round(file.size / 1024)}KB, Type: ${file.type}`);

  // Validate input
  if (!file || file.type !== 'application/pdf') {
    throw new Error('Invalid file: Must be a PDF file');
  }

  try {
    // Step 1: Load PDF.js for Node.js
    const pdfjs = await loadPdfjsForNode();

    // Step 2: Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    console.log(`[PDF-Server] File loaded: ${arrayBuffer.byteLength} bytes`);

    // Step 3: Load PDF document
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(arrayBuffer),
      // Disable streaming for server-side processing
      disableStream: true,
      disableAutoFetch: true,
      // Disable font loading from external sources
      disableFontFace: false,
      // Use system fonts when possible
      useSystemFonts: true,
    });

    const pdfDocument: PDFDocumentProxy = await loadingTask.promise;
    console.log(`[PDF-Server] PDF loaded successfully: ${pdfDocument.numPages} pages`);

    // Validate page number
    if (pageNumber < 1 || pageNumber > pdfDocument.numPages) {
      console.warn(`[PDF-Server] Invalid page number ${pageNumber}, using page 1`);
      pageNumber = 1;
    }

    // Step 4: Get the page
    const page: PDFPageProxy = await pdfDocument.getPage(pageNumber);
    console.log(`[PDF-Server] Retrieved page ${pageNumber}`);

    // Step 5: Set up rendering parameters
    // Scale 2.0 provides good quality for OCR while keeping reasonable file size
    const scale = 2.0;
    const viewport = page.getViewport({ scale });

    const width = Math.floor(viewport.width);
    const height = Math.floor(viewport.height);

    console.log(`[PDF-Server] Rendering at ${width}x${height} (scale: ${scale})`);

    // Step 6: Create a canvas-like object for Node.js
    // pdfjs-dist in Node.js mode renders to a node-canvas compatible interface
    // We'll use a custom implementation that captures pixel data

    // Create a buffer to hold RGBA pixel data
    const canvasData = new Uint8ClampedArray(width * height * 4);

    // Create a minimal canvas context interface that pdfjs-dist expects
    const canvasContext = {
      canvas: {
        width,
        height,
        style: {},
      },
      // Capture image data
      getImageData: (x: number, y: number, w: number, h: number) => ({
        data: canvasData.slice(y * width * 4 + x * 4, (y + h) * width * 4 + (x + w) * 4),
        width: w,
        height: h,
      }),
      putImageData: (imageData: any, dx: number, dy: number) => {
        const src = imageData.data;
        const w = imageData.width;
        const h = imageData.height;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const srcIdx = (y * w + x) * 4;
            const dstIdx = ((dy + y) * width + (dx + x)) * 4;
            canvasData[dstIdx] = src[srcIdx];
            canvasData[dstIdx + 1] = src[srcIdx + 1];
            canvasData[dstIdx + 2] = src[srcIdx + 2];
            canvasData[dstIdx + 3] = src[srcIdx + 3];
          }
        }
      },
      // Stub methods that pdfjs-dist might call
      save: () => {},
      restore: () => {},
      translate: () => {},
      scale: () => {},
      transform: () => {},
      setTransform: () => {},
      resetTransform: () => {},
      fillRect: (x: number, y: number, w: number, h: number) => {
        // Fill with white background (255, 255, 255, 255)
        for (let py = y; py < y + h && py < height; py++) {
          for (let px = x; px < x + w && px < width; px++) {
            const idx = (py * width + px) * 4;
            canvasData[idx] = 255;     // R
            canvasData[idx + 1] = 255; // G
            canvasData[idx + 2] = 255; // B
            canvasData[idx + 3] = 255; // A
          }
        }
      },
      clearRect: () => {},
      strokeRect: () => {},
      beginPath: () => {},
      closePath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      rect: () => {},
      arc: () => {},
      arcTo: () => {},
      quadraticCurveTo: () => {},
      bezierCurveTo: () => {},
      fill: () => {},
      stroke: () => {},
      clip: () => {},
      isPointInPath: () => false,
      drawImage: () => {},
      createImageData: (w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h,
      }),
      createLinearGradient: () => ({
        addColorStop: () => {},
      }),
      createRadialGradient: () => ({
        addColorStop: () => {},
      }),
      createPattern: () => null,
      measureText: (text: string) => ({ width: text.length * 10 }),
      // Properties
      fillStyle: '#000000',
      strokeStyle: '#000000',
      globalAlpha: 1,
      lineWidth: 1,
      lineCap: 'butt' as const,
      lineJoin: 'miter' as const,
      miterLimit: 10,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      shadowBlur: 0,
      shadowColor: 'rgba(0, 0, 0, 0)',
      globalCompositeOperation: 'source-over' as const,
      font: '10px sans-serif',
      textAlign: 'start' as const,
      textBaseline: 'alphabetic' as const,
    };

    // Step 7: Render the page
    const renderContext = {
      canvasContext: canvasContext as any,
      viewport: viewport,
      // Optional: control rendering behavior
      intent: 'print' as const, // Use 'print' intent for better quality
    };

    console.log('[PDF-Server] Starting page render...');
    await page.render(renderContext).promise;
    console.log('[PDF-Server] Page rendered successfully');

    // Step 8: Convert RGBA pixel data to PNG using sharp
    console.log('[PDF-Server] Converting to PNG format...');

    const pngBuffer = await sharpLib(Buffer.from(canvasData.buffer), {
      raw: {
        width,
        height,
        channels: 4, // RGBA
      }
    })
    .png({
      compressionLevel: 9, // Maximum compression
      quality: 100, // High quality
    })
    .toBuffer();

    console.log(`[PDF-Server] PNG created: ${Math.round(pngBuffer.length / 1024)}KB`);

    // Step 9: Convert to base64
    const imageBase64 = pngBuffer.toString('base64');

    // Step 10: Clean up
    await pdfDocument.destroy();
    console.log('[PDF-Server] PDF conversion completed successfully');

    return {
      imageBase64,
      mimeType: 'image/png'
    };

  } catch (error) {
    console.error('[PDF-Server] PDF conversion error:', error);

    // Provide specific error messages
    if (error instanceof Error) {
      if (error.message.includes('Invalid PDF structure')) {
        throw new Error('Invalid PDF file: The file appears to be corrupted or not a valid PDF');
      } else if (error.message.includes('Password')) {
        throw new Error('Password-protected PDFs are not supported');
      } else if (error.message.includes('Cannot read properties')) {
        throw new Error('PDF rendering failed: Malformed PDF structure');
      }
    }

    throw new Error(`Failed to convert PDF to PNG: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get PDF metadata on server side
 * @param file - PDF file
 * @returns PDF metadata including page count
 */
export async function getPdfInfoServer(file: File): Promise<{
  numPages: number;
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
}> {
  if (!file || file.type !== 'application/pdf') {
    throw new Error('Invalid file: Must be a PDF file');
  }

  try {
    console.log(`[PDF-Server] Getting PDF info for: ${file.name}`);

    const pdfjs = await loadPdfjsForNode();
    const arrayBuffer = await file.arrayBuffer();

    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(arrayBuffer),
      disableStream: true,
      disableAutoFetch: true,
    });

    const pdfDocument: PDFDocumentProxy = await loadingTask.promise;
    const numPages = pdfDocument.numPages;

    // Try to get metadata
    let metadata: any = {};
    try {
      const metadataResult = await pdfDocument.getMetadata();
      metadata = metadataResult.info || {};
    } catch (metaError) {
      console.warn('[PDF-Server] Could not read PDF metadata:', metaError);
    }

    await pdfDocument.destroy();

    console.log(`[PDF-Server] PDF info retrieved: ${numPages} pages`);

    return {
      numPages,
      title: metadata.Title || file.name,
      author: metadata.Author,
      subject: metadata.Subject,
      creator: metadata.Creator,
    };

  } catch (error) {
    console.error('[PDF-Server] PDF info extraction error:', error);

    // Fallback to basic info
    return {
      numPages: 1,
      title: file.name,
    };
  }
}
