'use client';

import { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface CreatedByInfoProps {
  creatorName?: string | null;
  createdAt?: string | null;
  className?: string;
}

/**
 * Icono de información que muestra quién creó el elemento y a qué día/hora.
 * Se puede abrir al pasar el cursor (hover) o al hacer clic (útil en móvil).
 */
export default function CreatedByInfo({ creatorName, createdAt, className = '' }: CreatedByInfoProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  let fechaTexto: string | null = null;
  if (createdAt) {
    try {
      fechaTexto = format(parseISO(createdAt), "dd/MM/yyyy 'a las' HH:mm", { locale: es });
    } catch {
      fechaTexto = null;
    }
  }

  return (
    <div
      ref={ref}
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="p-1 rounded-full text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:text-gray-400 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/30 transition-colors"
        aria-label="Información de creación"
      >
        <Info className="h-4 w-4" />
      </button>
      {open && (
        <div
          className="absolute top-full right-0 mt-2 z-50 w-56 animate-in fade-in-0 zoom-in-95"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-gray-900 dark:bg-dark-800 text-white text-xs rounded-xl px-3.5 py-3 shadow-xl border border-gray-700 dark:border-dark-500">
            <p className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider mb-2">
              Creado por
            </p>
            <p className="text-gray-100 font-medium leading-relaxed">
              {creatorName || 'Usuario desconocido'}
            </p>
            {fechaTexto && (
              <p className="text-gray-300 mt-1 leading-relaxed">{fechaTexto}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
