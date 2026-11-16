'use client';

import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export default function Card({ children, className, hover = false, padding = 'md' }: CardProps) {
  const paddings = {
    none: '',
    sm: 'p-3 md:p-4',
    md: 'p-4 md:p-6',
    lg: 'p-6 md:p-8',
  };

  return (
    <div
      className={cn(
        'rounded-2xl backdrop-blur-lg',
        'bg-white/60 dark:bg-white/[0.06]',
        'border border-white/50 dark:border-white/[0.08]',
        'shadow-[inset_0_1px_2px_rgba(255,255,255,0.5),0_2px_8px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)]',
        'dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.06),0_2px_8px_rgba(0,0,0,0.3)]',
        hover && 'transition-all duration-300 ease-out cursor-pointer hover:bg-white/70 dark:hover:bg-white/[0.1] hover:shadow-[inset_0_1px_2px_rgba(255,255,255,0.6),0_8px_24px_rgba(0,0,0,0.08)] dark:hover:shadow-[inset_0_1px_2px_rgba(255,255,255,0.08),0_8px_24px_rgba(0,0,0,0.4)] hover:border-white/60 dark:hover:border-white/[0.14] hover:-translate-y-0.5',
        paddings[padding],
        className
      )}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div className={cn('mb-4', className)}>
      {children}
    </div>
  );
}

interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function CardTitle({ children, className }: CardTitleProps) {
  return (
    <h3 className={cn('text-lg font-semibold text-gray-900 dark:text-white', className)}>
      {children}
    </h3>
  );
}

interface CardDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function CardDescription({ children, className }: CardDescriptionProps) {
  return (
    <p className={cn('text-sm text-gray-500 dark:text-gray-300 mt-1', className)}>
      {children}
    </p>
  );
}
