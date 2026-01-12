'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Package,
  ShoppingCart,
  BarChart3,
  Menu,
  X,
  Plus,
  Map,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Clientes', href: '/clientes', icon: Users },
  { name: 'Calendario', href: '/calendario', icon: Calendar },
  { name: 'Mapa Visitas', href: '/mapa', icon: Map },
  { name: 'Productos', href: '/productos', icon: Package },
  { name: 'Pedidos', href: '/pedidos', icon: ShoppingCart },
  { name: 'Reportes', href: '/reportes', icon: BarChart3 },
];

const quickActions = [
  { name: 'Nueva Visita', href: '/calendario/nueva', icon: Calendar },
  { name: 'Nuevo Pedido', href: '/pedidos/nuevo', icon: ShoppingCart },
  { name: 'Nuevo Cliente', href: '/clientes/nuevo', icon: Users },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="p-4 md:p-6 border-b border-gray-100">
        <h1 className="text-lg md:text-xl font-bold text-gray-900 tracking-tight">
          <span className="text-indigo-600">CRM</span> Camila Fernández
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">Sistema de Gestión</p>
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-b border-gray-100">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Acciones Rápidas
        </p>
        <div className="space-y-1">
          {quickActions.map((action) => (
            <Link
              key={action.name}
              href={action.href}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 rounded-xl
                       hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-200
                       group"
            >
              <div className="p-1 rounded-lg bg-gray-100 group-hover:bg-indigo-100 transition-colors">
                <Plus className="h-3 w-3" />
              </div>
              {action.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Menú Principal
        </p>
        {navigation.map((item, index) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200',
                'animate-slide-in opacity-0',
                active
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
              style={{ animationDelay: `${index * 0.05}s`, animationFillMode: 'forwards' }}
            >
              <Icon className={cn('h-5 w-5', active ? 'text-indigo-600' : 'text-gray-400')} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-100">
        <p className="text-[10px] text-gray-400 text-center">
          CRM Camila Fernández v1.0
        </p>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="md:hidden fixed top-3 left-3 z-50 p-2.5 rounded-xl bg-white border border-gray-200 shadow-md active:scale-95 transition-transform"
        aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
      >
        {mobileOpen ? (
          <X className="h-5 w-5 text-gray-600" />
        ) : (
          <Menu className="h-5 w-5 text-gray-600" />
        )}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-30"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-100',
          'flex flex-col z-40 transition-transform duration-300',
          'md:translate-x-0 shadow-sm',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
