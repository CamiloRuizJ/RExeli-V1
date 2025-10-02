'use client';

import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QualityRatingProps {
  rating: number;
  maxRating?: number;
  onChange?: (rating: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function QualityRating({
  rating,
  maxRating = 5,
  onChange,
  readonly = false,
  size = 'md',
}: QualityRatingProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const handleClick = (value: number) => {
    if (!readonly && onChange) {
      onChange(value);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: maxRating }, (_, i) => {
        const starValue = i + 1;
        const normalizedRating = rating * maxRating; // Convert 0-1 to 0-5
        const isFilled = starValue <= normalizedRating;
        const isHalf = starValue - 0.5 === normalizedRating;

        return (
          <button
            key={i}
            type="button"
            onClick={() => handleClick(starValue / maxRating)} // Convert back to 0-1
            disabled={readonly}
            className={cn(
              'transition-colors',
              !readonly && 'hover:scale-110 cursor-pointer',
              readonly && 'cursor-default'
            )}
            aria-label={`Rate ${starValue} out of ${maxRating}`}
          >
            <Star
              className={cn(
                sizeClasses[size],
                isFilled
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'fill-none text-gray-300'
              )}
            />
          </button>
        );
      })}
      {readonly && (
        <span className="ml-2 text-sm text-muted-foreground">
          {(rating * maxRating).toFixed(1)}/{maxRating}
        </span>
      )}
    </div>
  );
}
