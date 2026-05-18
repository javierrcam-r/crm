'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Calendar,
  CalendarOff,
  Package,
  BarChart3,
  Menu,
  X,
  Plus,
  Map,
  Shield,
  Settings,
  LogOut,
  TrendingUp,
  ClipboardList,
  UserCheck,
  Palmtree,
  Sparkles,
  DollarSign,
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import Badge from '@/components/ui/Badge';
import toast from 'react-hot-toast';
import { getSidebarConfig, isMenuVisible, type SidebarConfigItem } from '@/lib/services/sidebarConfig';
import NotificationBell from './NotificationBell';

const vendedorNavigation = [
  { key: 'dashboard', name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { key: 'clientes', name: 'Clientes', href: '/clientes', icon: Users },
  { key: 'calendario', name: 'Calendario', href: '/calendario', icon: Calendar },
  { key: 'mapa', name: 'Mapa Visitas', href: '/mapa', icon: Map },
  { key: 'productos', name: 'Productos', href: '/productos', icon: Package },
  { key: 'eventos', name: 'Eventos', href: '/eventos', icon: Calendar },
  { key: 'reportes', name: 'Reportes', href: '/reportes', icon: BarChart3 },
  { key: 'resumen_ventas', name: 'Resumen Ventas', href: '/resumen-ventas', icon: DollarSign },
];

const adminNavigation = [
  { key: 'usuarios', name: 'Usuarios', href: '/usuarios', icon: Shield },
  { key: 'asistente', name: 'Asistente IA', href: '/asistente', icon: Sparkles },
];

const supervisorNavigation = [
  { key: 'calendario', name: 'Calendario', href: '/calendario', icon: Calendar },
  { key: 'dias_no_laborables', name: 'Días no laborables', href: '/calendario/dias-no-laborables', icon: CalendarOff },
  { key: 'supervisores', name: 'Panel Supervisor', href: '/supervisores', icon: TrendingUp },
  { key: 'vendedores', name: 'Ver Vendedores', href: '/supervisores/vendedores', icon: Users },
  { key: 'gestion_clientes', name: 'Gestión Clientes', href: '/supervisores/clientes', icon: UserCheck },
  { key: 'metas', name: 'Metas de Ventas', href: '/supervisores/metas', icon: BarChart3 },
  { key: 'resumen_ventas', name: 'Resumen Ventas', href: '/resumen-ventas', icon: DollarSign },
  { key: 'eventos', name: 'Eventos', href: '/eventos', icon: Calendar },
  { key: 'vacaciones', name: 'Vacaciones', href: '/vacaciones', icon: Palmtree },
];

const actividadesEstrategicas = [
  { key: 'actividades', name: 'Objetivos Estratégicos', href: '/actividades', icon: ClipboardList },
  { key: 'vacaciones', name: 'Vacaciones', href: '/vacaciones', icon: Palmtree },
];

const quickActions = [
  { name: 'Nueva Visita', href: '/calendario/nueva', icon: Calendar },
  { name: 'Nuevo Cliente', href: '/clientes/nuevo', icon: Users },
];

const glassBase = 'bg-white/[0.12] dark:bg-white/[0.06] backdrop-blur-lg border border-white/30 dark:border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06),0_1px_3px_rgba(0,0,0,0.2)]';
const glassHover = 'hover:bg-white/[0.22] dark:hover:bg-white/[0.10] hover:border-white/40 dark:hover:border-white/[0.12] hover:shadow-[inset_0_1px_2px_rgba(255,255,255,0.4),0_2px_8px_rgba(0,0,0,0.06)] dark:hover:shadow-[inset_0_1px_2px_rgba(255,255,255,0.08),0_2px_8px_rgba(0,0,0,0.3)]';
const glassActive = 'bg-indigo-100/30 dark:bg-indigo-400/[0.10] backdrop-blur-lg border border-indigo-200/40 dark:border-indigo-400/[0.15] shadow-[inset_0_1px_2px_rgba(255,255,255,0.4),0_2px_8px_rgba(99,102,241,0.08)] dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.08),0_2px_8px_rgba(99,102,241,0.15)]';

function NavLink({
  href,
  icon: Icon,
  name,
  active,
  index,
  onClose,
}: {
  href: string;
  icon: any;
  name: string;
  active: boolean;
  index: number;
  onClose: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className={cn(
        'flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-200 text-[13px]',
        'animate-slide-in opacity-0',
        active
          ? cn(glassActive, 'text-indigo-700 dark:text-indigo-300 font-medium')
          : cn('border border-transparent', glassHover, 'text-gray-600 dark:text-gray-300')
      )}
      style={{ animationDelay: `${index * 0.04}s`, animationFillMode: 'forwards' }}
    >
      <div
        className={cn(
          'flex items-center justify-center w-7 h-7 rounded-lg transition-colors duration-200',
          active
            ? 'bg-indigo-200/40 dark:bg-indigo-400/20 text-indigo-600 dark:text-indigo-400'
            : 'bg-white/20 dark:bg-white/[0.05] text-gray-500 dark:text-gray-400'
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <span>{name}</span>
    </Link>
  );
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarConfig, setSidebarConfig] = useState<SidebarConfigItem[]>([]);
  const { isUserAdmin, userProfile, logout } = useAuth();

  useEffect(() => {
    getSidebarConfig().then(setSidebarConfig).catch(() => {});
  }, []);

  const filterByConfig = (items: { key: string; name: string; href: string; icon: any }[]) => {
    if (!userProfile || sidebarConfig.length === 0) return items;
    const rol = userProfile.rol;
    return items.filter(item => {
      const entry = sidebarConfig.find(c => c.menu_key === item.key && c.rol === rol);
      if (entry) return entry.visible;
      if (rol === 'supervisor') {
        const n1Entry = sidebarConfig.find(c => c.menu_key === item.key && c.rol === 'supervisor_nivel1');
        if (n1Entry) return n1Entry.visible;
      }
      return true;
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('crm_user_profile');
    localStorage.clear();
    sessionStorage.clear();
    if (logout) logout();
    window.location.href = '/login';
  };

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const closeMobile = () => setMobileOpen(false);

  const initials = useMemo(
    () => (userProfile?.nombre_completo ? getInitials(userProfile.nombre_completo) : ''),
    [userProfile?.nombre_completo]
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex-shrink-0 px-4 py-3.5 border-b border-white/10 dark:border-white/[0.04]">
        <div className="flex items-center gap-3">
          <Image src="/logo-disfero.png" alt="Disfero" width={36} height={36} className="w-9 h-9 object-contain flex-shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight truncate leading-tight">
              CRM <span className="text-indigo-600 dark:text-indigo-400">Disfero</span>
            </h1>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-tight">Sistema de Gestión</p>
          </div>
        </div>
      </div>

      {/* Scrollable */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
        {/* Quick Actions */}
        {(userProfile?.rol === 'vendedor' || userProfile?.rol === 'vendedor_tecnico') && (
          <div className="px-3 pt-4 pb-3 border-b border-white/10 dark:border-white/[0.04]">
            <p className="text-[10px] font-semibold text-gray-400/80 dark:text-gray-500 uppercase tracking-widest mb-2 px-1">
              Acciones Rápidas
            </p>
            <div className="space-y-1">
              {quickActions.map((action) => (
                <Link
                  key={action.name}
                  href={action.href}
                  onClick={closeMobile}
                  className={cn(
                    'flex items-center gap-2.5 px-2.5 py-2 text-[13px] text-gray-600 dark:text-gray-300 rounded-xl transition-all duration-200 group',
                    'border border-transparent', glassHover
                  )}
                >
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/20 dark:bg-white/[0.05] group-hover:bg-indigo-200/30 dark:group-hover:bg-indigo-400/15 transition-colors">
                    <Plus className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                  </div>
                  {action.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        <nav className="px-3 py-3 space-y-0.5">
          {/* Vendedor */}
          {(userProfile?.rol === 'vendedor' || userProfile?.rol === 'supervisor_vendedor' || userProfile?.rol === 'vendedor_tecnico') && (
            <>
              <p className="text-[10px] font-semibold text-gray-400/80 dark:text-gray-500 uppercase tracking-widest mb-1.5 px-1">
                Menú Principal
              </p>
              {filterByConfig(vendedorNavigation).map((item, index) => (
                <NavLink key={item.name} href={item.href} icon={item.icon} name={item.name} active={isActive(item.href)} index={index} onClose={closeMobile} />
              ))}
              <div className="my-3 border-t border-white/10 dark:border-white/[0.04]" />
            </>
          )}

          {/* Supervisor */}
          {(isUserAdmin || userProfile?.rol === 'supervisor' || userProfile?.rol === 'supervisor_nivel1' || userProfile?.rol === 'supervisor_vendedor') && (
            <>
              <p className="text-[10px] font-semibold text-gray-400/80 dark:text-gray-500 uppercase tracking-widest mb-1.5 px-1">
                Supervisión
              </p>
              {filterByConfig(supervisorNavigation).map((item, index) => (
                <NavLink key={item.name} href={item.href} icon={item.icon} name={item.name} active={isActive(item.href)} index={index} onClose={closeMobile} />
              ))}
              <div className="my-3 border-t border-white/10 dark:border-white/[0.04]" />
            </>
          )}

          {/* Marketing/Técnico Calendar */}
          {(userProfile?.rol === 'marketing' || userProfile?.rol === 'tecnico') && isMenuVisible(sidebarConfig, 'calendario', userProfile?.rol || '') && (
            <NavLink href="/calendario" icon={Calendar} name="Calendario" active={isActive('/calendario')} index={0} onClose={closeMobile} />
          )}

          {/* Marketing/Técnico/EventAssistant Events */}
          {(userProfile?.rol === 'marketing' || userProfile?.rol === 'tecnico' || userProfile?.rol === 'event_assistant') && isMenuVisible(sidebarConfig, 'eventos', userProfile?.rol || '') && (
            <NavLink href="/eventos" icon={Calendar} name="Eventos" active={isActive('/eventos')} index={1} onClose={closeMobile} />
          )}

          {/* Gestión */}
          {userProfile && userProfile.rol !== 'event_assistant' && (
            <>
              <p className="text-[10px] font-semibold text-gray-400/80 dark:text-gray-500 uppercase tracking-widest mb-1.5 px-1">
                {(userProfile.rol === 'marketing' || userProfile.rol === 'tecnico') ? 'Menú Principal' : 'Gestión'}
              </p>
              {filterByConfig(actividadesEstrategicas).map((item, index) => (
                <NavLink key={item.name} href={item.href} icon={item.icon} name={item.name} active={isActive(item.href)} index={index} onClose={closeMobile} />
              ))}
            </>
          )}

          {/* Admin */}
          {isUserAdmin && (
            <>
              <div className="my-3 border-t border-white/10 dark:border-white/[0.04]" />
              <p className="text-[10px] font-semibold text-gray-400/80 dark:text-gray-500 uppercase tracking-widest mb-1.5 px-1">
                Administración
              </p>
              {adminNavigation.map((item, index) => (
                <NavLink key={item.name} href={item.href} icon={item.icon} name={item.name} active={isActive(item.href)} index={supervisorNavigation.length + index} onClose={closeMobile} />
              ))}
            </>
          )}

          {/* Configuración */}
          <div className="my-3 border-t border-white/10 dark:border-white/[0.04]" />
          <NavLink href="/configuracion" icon={Settings} name="Configuración" active={isActive('/configuracion')} index={0} onClose={closeMobile} />
        </nav>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-3 py-3 border-t border-white/10 dark:border-white/[0.04]">
        {userProfile && (
          <div className="flex items-center gap-2.5 mb-2.5 pb-2.5 border-b border-white/10 dark:border-white/[0.04]">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 mb-0.5">Usuario:</p>
              <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{userProfile.nombre_completo}</p>
            </div>
            {initials && (
              <div className={cn(
                'flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-[11px] font-bold',
                'bg-indigo-100/40 dark:bg-indigo-400/15 text-indigo-600 dark:text-indigo-400',
                'border border-indigo-200/40 dark:border-indigo-400/20',
                'shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]'
              )}>
                {initials}
              </div>
            )}
          </div>
        )}
        
        <button
          onClick={handleLogout}
          className={cn(
            'w-full flex items-center gap-2.5 px-2.5 py-2 text-[13px] text-gray-500 dark:text-gray-400 rounded-xl transition-all duration-200 group',
            'border border-transparent',
            'hover:bg-red-100/20 dark:hover:bg-red-400/[0.08] hover:border-red-200/30 dark:hover:border-red-400/[0.12] hover:text-red-600 dark:hover:text-red-400',
            'hover:shadow-[inset_0_1px_2px_rgba(255,255,255,0.3),0_2px_6px_rgba(239,68,68,0.06)] dark:hover:shadow-[inset_0_1px_2px_rgba(255,255,255,0.06),0_2px_6px_rgba(239,68,68,0.12)]'
          )}
        >
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/20 dark:bg-white/[0.05] group-hover:bg-red-200/30 dark:group-hover:bg-red-400/15 transition-colors">
            <LogOut className="h-4 w-4" />
          </div>
          <span>Cerrar Sesión</span>
        </button>

        <p className="text-[9px] text-gray-300 dark:text-gray-600 text-center mt-2">CRM Disfero v1.0</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-3 py-2">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className={cn(
            'p-2 rounded-xl active:scale-95 transition-transform',
            glassBase
          )}
          aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
        >
          {mobileOpen ? <X className="h-5 w-5 text-gray-600 dark:text-white" /> : <Menu className="h-5 w-5 text-gray-600 dark:text-white" />}
        </button>
        <NotificationBell />
      </div>

      <div className="hidden md:block fixed top-3 right-4 z-50">
        <NotificationBell />
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 bg-black/10 backdrop-blur-sm z-30" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-full w-[240px] sm:w-64',
          'bg-gray-100/60 dark:bg-dark-900/70 backdrop-blur-2xl',
          'border-r border-white/20 dark:border-white/[0.05]',
          'z-40 transition-transform duration-300',
          'md:translate-x-0',
          'shadow-[1px_0_20px_rgba(0,0,0,0.03)] dark:shadow-[1px_0_20px_rgba(0,0,0,0.3)]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
