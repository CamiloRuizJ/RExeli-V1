'use client';

import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  current: number;
  total: number;
  label?: string;
  showPercentage?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  className?: string;
}

export function ProgressBar({
  current,
  total,
  label,
  showPercentage = true,
  variant = 'default',
  className,
}: ProgressBarProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  const variantClasses = {
    default: '[&>div]:bg-blue-500',
    success: '[&>div]:bg-green-500',
    warning: '[&>div]:bg-yellow-500',
    danger: '[&>div]:bg-red-500',
  };

  return (
    <div className={cn('space-y-2', className)}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between text-sm">
          {label && <span className="font-medium">{label}</span>}
          {showPercentage && (
            <span className="text-muted-foreground">
              {current} / {total} ({percentage}%)
            </span>
          )}
        </div>
      )}
      <Progress
        value={percentage}
        className={cn('h-2', variantClasses[variant])}
      />
    </div>
  );
}
