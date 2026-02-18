'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, type = 'text', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-200 mb-1.5">{label}</label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-400">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            type={type}
            className={cn(
              'w-full px-4 py-2.5 rounded-xl border bg-white border-gray-200',
              'dark:bg-dark-600 dark:border-dark-500',
              'text-gray-900 placeholder-gray-400',
              'dark:text-white dark:placeholder-gray-400',
              'focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50',
              'dark:focus:border-indigo-500 dark:focus:ring-indigo-900/50',
              'transition-all duration-200',
              icon && 'pl-10',
              error && 'border-red-300 focus:border-red-400 focus:ring-red-50 dark:border-red-500 dark:focus:border-red-400 dark:focus:ring-red-900/50',
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1.5 text-sm text-red-500 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
