'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-200 mb-1.5">{label}</label>
        )}
        <textarea
          ref={ref}
          className={cn(
            'w-full px-4 py-2.5 rounded-2xl backdrop-blur-md',
            'bg-white/50 border border-white/50',
            'dark:bg-white/[0.06] dark:border-white/[0.1]',
            'text-gray-900 placeholder-gray-400',
            'dark:text-white dark:placeholder-gray-500',
            'shadow-[inset_0_1px_2px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.04)]',
            'dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.04),0_1px_2px_rgba(0,0,0,0.2)]',
            'focus:outline-none focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-200/30',
            'focus:bg-white/70 focus:shadow-[inset_0_1px_2px_rgba(255,255,255,0.5),0_2px_8px_rgba(99,102,241,0.1)]',
            'dark:focus:border-indigo-400/40 dark:focus:ring-indigo-500/20',
            'dark:focus:bg-white/[0.08]',
            'transition-all duration-300 min-h-[100px] resize-y',
            error && 'border-red-300/50 focus:border-red-400/60 focus:ring-red-200/30 dark:border-red-500/30',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-sm text-red-500 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export default Textarea;
