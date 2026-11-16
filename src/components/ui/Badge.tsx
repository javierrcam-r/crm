'use client';

import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray';
  className?: string;
}

const variants = {
  blue: 'bg-blue-400/15 text-blue-700 border-blue-300/30 dark:bg-blue-400/10 dark:text-blue-300 dark:border-blue-400/15',
  green: 'bg-emerald-400/15 text-emerald-700 border-emerald-300/30 dark:bg-emerald-400/10 dark:text-emerald-300 dark:border-emerald-400/15',
  yellow: 'bg-amber-400/15 text-amber-700 border-amber-300/30 dark:bg-amber-400/10 dark:text-amber-300 dark:border-amber-400/15',
  red: 'bg-red-400/15 text-red-700 border-red-300/30 dark:bg-red-400/10 dark:text-red-300 dark:border-red-400/15',
  purple: 'bg-purple-400/15 text-purple-700 border-purple-300/30 dark:bg-purple-400/10 dark:text-purple-300 dark:border-purple-400/15',
  gray: 'bg-gray-400/15 text-gray-600 border-gray-300/30 dark:bg-white/[0.06] dark:text-gray-200 dark:border-white/[0.1]',
};

export default function Badge({ children, variant = 'gray', className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-semibold',
      'backdrop-blur-sm border',
      'shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]',
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
}
