import * as React from 'react';
import { cn } from '@/lib/utils';

export interface FormProps extends React.FormHTMLAttributes<HTMLFormElement> {}

export function Form({ className, ...props }: FormProps) {
  return (
    <form
      className={cn('space-y-6', className)}
      {...props}
    />
  );
}

export interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
}

export function FormField({
  label,
  error,
  required,
  htmlFor,
  className,
  children,
  ...props
}: FormFieldProps) {
  return (
    <div className={cn('space-y-2', className)} {...props}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="block text-sm font-medium text-gray-700"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {children}
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export interface FormErrorProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export function FormError({ className, children, ...props }: FormErrorProps) {
  if (!children) return null;

  return (
    <p
      role="alert"
      className={cn('text-sm text-red-600 mt-1', className)}
      {...props}
    >
      {children}
    </p>
  );
}

export interface FormHelperTextProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export function FormHelperText({ className, children, ...props }: FormHelperTextProps) {
  if (!children) return null;

  return (
    <p
      className={cn('text-sm text-gray-500 mt-1', className)}
      {...props}
    >
      {children}
    </p>
  );
}

export interface FormLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export function FormLabel({
  className,
  required,
  children,
  ...props
}: FormLabelProps) {
  return (
    <label
      className={cn('block text-sm font-medium text-gray-700 mb-2', className)}
      {...props}
    >
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
}
