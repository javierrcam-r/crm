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
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div
        className={cn(
          'bg-white dark:bg-dark-700 w-full flex flex-col',
          'rounded-t-2xl sm:rounded-2xl shadow-2xl border-0 sm:border border-gray-200/50 dark:border-dark-500',
          'max-h-[92vh] sm:max-h-[90vh]',
          'transform transition-all duration-200 ease-out',
          'animate-in fade-in-0 slide-in-from-bottom-4 sm:zoom-in-95',
          sizes[size]
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-dark-500 flex-shrink-0">
            <h2 className="text-base sm:text-xl font-semibold text-gray-900 dark:text-white truncate pr-2">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors group flex-shrink-0"
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
