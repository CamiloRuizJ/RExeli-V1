'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MetricsDashboard } from '@/components/training/MetricsDashboard';
import type { TrainingMetrics } from '@/lib/types';
import { fetchTrainingMetrics } from '@/lib/training-api';
import { toast } from 'sonner';

export default function TrainingMetricsPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<TrainingMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadMetrics = async () => {
    setIsLoading(true);
    try {
      const response = await fetchTrainingMetrics();
      setMetrics(response.metrics);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load metrics';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Training Metrics</h1>
          <p className="text-muted-foreground mt-1">
            View progress and export training data by document type
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={loadMetrics}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/admin/training')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>

      {/* Metrics Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Loading metrics...</p>
          </div>
        </div>
      ) : metrics.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <h3 className="text-lg font-medium mb-2">No Metrics Available</h3>
          <p className="text-muted-foreground mb-4">
            Upload some documents to see metrics
          </p>
          <Button onClick={() => router.push('/admin/training')}>
            Go to Dashboard
          </Button>
        </div>
      ) : (
        <MetricsDashboard metrics={metrics} />
      )}
    </div>
  );
}
