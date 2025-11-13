import * as React from 'react';
import { cn } from '@/lib/utils';

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

const headingStyles = {
  h1: 'text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight',
  h2: 'text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight',
  h3: 'text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight',
  h4: 'text-lg sm:text-xl lg:text-2xl font-semibold',
  h5: 'text-base sm:text-lg lg:text-xl font-semibold',
  h6: 'text-sm sm:text-base lg:text-lg font-semibold',
};

export function Heading({
  as: Component = 'h2',
  className,
  children,
  ...props
}: HeadingProps) {
  return (
    <Component
      className={cn(headingStyles[Component], className)}
      {...props}
    >
      {children}
    </Component>
  );
}

// Convenience components
export function H1({ className, ...props }: Omit<HeadingProps, 'as'>) {
  return <Heading as="h1" className={className} {...props} />;
}

export function H2({ className, ...props }: Omit<HeadingProps, 'as'>) {
  return <Heading as="h2" className={className} {...props} />;
}

export function H3({ className, ...props }: Omit<HeadingProps, 'as'>) {
  return <Heading as="h3" className={className} {...props} />;
}

export function H4({ className, ...props }: Omit<HeadingProps, 'as'>) {
  return <Heading as="h4" className={className} {...props} />;
}

export function H5({ className, ...props }: Omit<HeadingProps, 'as'>) {
  return <Heading as="h5" className={className} {...props} />;
}

export function H6({ className, ...props }: Omit<HeadingProps, 'as'>) {
  return <Heading as="h6" className={className} {...props} />;
}
