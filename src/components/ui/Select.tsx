'use client';

import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options?: SelectOption[];
  placeholder?: string;
  children?: React.ReactNode;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, children, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-200 mb-1.5">{label}</label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={cn(
              'w-full px-4 py-2.5 rounded-2xl backdrop-blur-md appearance-none pr-10 cursor-pointer',
              'bg-white/50 border border-white/50',
              'dark:bg-white/[0.06] dark:border-white/[0.1]',
              'text-gray-900 dark:text-white',
              'shadow-[inset_0_1px_2px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.04)]',
              'dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.04),0_1px_2px_rgba(0,0,0,0.2)]',
              'focus:outline-none focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-200/30',
              'focus:bg-white/70 focus:shadow-[inset_0_1px_2px_rgba(255,255,255,0.5),0_2px_8px_rgba(99,102,241,0.1)]',
              'dark:focus:border-indigo-400/40 dark:focus:ring-indigo-500/20',
              'dark:focus:bg-white/[0.08]',
              'transition-all duration-300',
              error && 'border-red-300/50 focus:border-red-400/60 focus:ring-red-200/30 dark:border-red-500/30',
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" className="bg-white dark:bg-[#0d2137]">{placeholder}</option>
            )}
            {options ? options.map((option) => (
              <option key={option.value} value={option.value} className="bg-white dark:bg-[#0d2137]">
                {option.label}
              </option>
            )) : children}
          </select>
          <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-300 pointer-events-none" />
        </div>
        {error && (
          <p className="mt-1.5 text-sm text-red-500 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;
