'use client';

import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, icon, children, disabled, ...props }, ref) => {
    const variants = {
      primary: [
        'bg-indigo-500/80 text-white border border-indigo-400/30',
        'hover:bg-indigo-500/90 hover:border-indigo-300/50 hover:shadow-[0_4px_16px_rgba(99,102,241,0.3)]',
        'dark:bg-indigo-500/70 dark:border-indigo-400/20 dark:hover:bg-indigo-500/80 dark:hover:border-indigo-400/40',
        'backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_1px_3px_rgba(0,0,0,0.1)]',
        'focus:ring-indigo-300/50',
      ].join(' '),
      secondary: [
        'bg-white/40 text-gray-700 border border-white/50',
        'hover:bg-white/60 hover:border-white/70 hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]',
        'dark:bg-white/[0.08] dark:text-white dark:border-white/[0.12]',
        'dark:hover:bg-white/[0.14] dark:hover:border-white/[0.2]',
        'backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_3px_rgba(0,0,0,0.04)]',
        'dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06),0_1px_3px_rgba(0,0,0,0.2)]',
        'focus:ring-gray-200/50 dark:focus:ring-gray-500/30',
      ].join(' '),
      success: [
        'bg-emerald-500/80 text-white border border-emerald-400/30',
        'hover:bg-emerald-500/90 hover:border-emerald-300/50 hover:shadow-[0_4px_16px_rgba(16,185,129,0.3)]',
        'dark:bg-emerald-500/70 dark:border-emerald-400/20 dark:hover:bg-emerald-500/80',
        'backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_1px_3px_rgba(0,0,0,0.1)]',
        'focus:ring-emerald-300/50',
      ].join(' '),
      danger: [
        'bg-red-500/80 text-white border border-red-400/30',
        'hover:bg-red-500/90 hover:border-red-300/50 hover:shadow-[0_4px_16px_rgba(239,68,68,0.3)]',
        'dark:bg-red-500/70 dark:border-red-400/20 dark:hover:bg-red-500/80',
        'backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_1px_3px_rgba(0,0,0,0.1)]',
        'focus:ring-red-300/50',
      ].join(' '),
      ghost: [
        'bg-transparent text-gray-600 border border-transparent',
        'hover:bg-white/40 hover:border-white/50 hover:text-gray-900',
        'hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_1px_3px_rgba(0,0,0,0.04)]',
        'dark:text-white dark:hover:bg-white/[0.08] dark:hover:border-white/[0.12]',
        'dark:hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06),0_1px_3px_rgba(0,0,0,0.2)]',
        'backdrop-blur-md',
      ].join(' '),
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm rounded-xl',
      md: 'px-4 py-2.5 rounded-2xl',
      lg: 'px-6 py-3 text-lg rounded-2xl',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium transition-all duration-300 ease-out',
          'focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-transparent',
          'active:scale-[0.97]',
          variants[variant],
          sizes[size],
          (disabled || loading) && 'opacity-50 cursor-not-allowed',
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : icon ? (
          icon
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
