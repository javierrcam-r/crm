'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  noPadding?: boolean;
}

export default function Modal({ isOpen, onClose, title, children, size = 'md', noPadding = false }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/30 backdrop-blur-md z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div
        className={cn(
          'w-full flex flex-col backdrop-blur-xl',
          'bg-white/70 dark:bg-[#0d2137]/80',
          'border-0 sm:border border-white/40 dark:border-white/[0.1]',
          'shadow-[0_8px_32px_rgba(0,0,0,0.12),inset_0_1px_2px_rgba(255,255,255,0.5)]',
          'dark:shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_2px_rgba(255,255,255,0.06)]',
          'rounded-t-3xl sm:rounded-3xl',
          'max-h-[92vh] sm:max-h-[90vh]',
          'transform transition-all duration-300 ease-out',
          'animate-in fade-in-0 slide-in-from-bottom-4 sm:zoom-in-95',
          sizes[size]
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-white/20 dark:border-white/[0.06] flex-shrink-0">
            <h2 className="text-base sm:text-xl font-semibold text-gray-900 dark:text-white truncate pr-2">{title}</h2>
            <button
              onClick={onClose}
              className={cn(
                'p-2 rounded-xl transition-all duration-200 group',
                'hover:bg-white/40 dark:hover:bg-white/[0.08]',
                'backdrop-blur-sm',
              )}
            >
              <X className="h-5 w-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-white transition-colors" />
            </button>
          </div>
        )}
        <div className={cn(
          'overflow-y-auto flex-1',
          !noPadding && 'p-4 sm:p-6',
          !title && 'pt-4 sm:pt-6'
        )}>
          {children}
        </div>
      </div>
    </div>
  );
}
