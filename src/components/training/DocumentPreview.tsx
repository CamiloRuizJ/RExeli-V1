'use client';

import { useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DocumentPreviewProps {
  fileUrl: string;
  fileType?: string;
  className?: string;
}

export function DocumentPreview({ fileUrl, fileType, className }: DocumentPreviewProps) {
  const [zoom, setZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [rotation, setRotation] = useState(0);

  const isPdf = fileType?.includes('pdf') || fileUrl.toLowerCase().endsWith('.pdf');
  const isImage = fileType?.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp)$/i.test(fileUrl);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  return (
    <div className={cn('flex flex-col h-full bg-gray-50 dark:bg-gray-900 rounded-lg border', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b bg-background">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomOut}
            disabled={zoom <= 50}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[60px] text-center">
            {zoom}%
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomIn}
            disabled={zoom >= 200}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRotate}
          >
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>

        {isPdf && totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Preview Area */}
      <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
        <div
          style={{
            transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
            transformOrigin: 'center center',
            transition: 'transform 0.2s ease-out',
          }}
        >
          {isPdf ? (
            <PDFPreview
              fileUrl={fileUrl}
              currentPage={currentPage}
              onPagesLoad={setTotalPages}
            />
          ) : isImage ? (
            <img
              src={fileUrl}
              alt="Document preview"
              className="max-w-full h-auto shadow-lg"
            />
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <p>Preview not available for this file type</p>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                Download to view
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Simple PDF preview using iframe
function PDFPreview({
  fileUrl,
  currentPage,
  onPagesLoad,
}: {
  fileUrl: string;
  currentPage: number;
  onPagesLoad: (pages: number) => void;
}) {
  useEffect(() => {
    // In a real implementation, you'd use pdf.js to get page count
    // For now, we'll assume single page
    onPagesLoad(1);
  }, [fileUrl, onPagesLoad]);

  return (
    <iframe
      src={`${fileUrl}#page=${currentPage}`}
      className="w-full min-h-[400px] md:min-h-[500px] lg:min-h-[600px] bg-white shadow-lg"
      title="PDF Preview"
    />
  );
}
