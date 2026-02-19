'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Calendar,
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
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import Badge from '@/components/ui/Badge';
import toast from 'react-hot-toast';
import { getSidebarConfig, isMenuVisible, type SidebarConfigItem } from '@/lib/services/sidebarConfig';

// Menú principal para VENDEDORES (único rol con dashboard)
const vendedorNavigation = [
  { key: 'dashboard', name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { key: 'clientes', name: 'Clientes', href: '/clientes', icon: Users },
  { key: 'calendario', name: 'Calendario', href: '/calendario', icon: Calendar },
  { key: 'mapa', name: 'Mapa Visitas', href: '/mapa', icon: Map },
  { key: 'productos', name: 'Productos', href: '/productos', icon: Package },
  { key: 'eventos', name: 'Eventos', href: '/eventos', icon: Calendar },
  { key: 'reportes', name: 'Reportes', href: '/reportes', icon: BarChart3 },
];

const adminNavigation = [
  { key: 'usuarios', name: 'Usuarios', href: '/usuarios', icon: Shield },
];

// Panel de supervisión - para supervisor y supervisor_nivel1
const supervisorNavigation = [
  { key: 'calendario', name: 'Calendario', href: '/calendario', icon: Calendar },
  { key: 'supervisores', name: 'Panel Supervisor', href: '/supervisores', icon: TrendingUp },
  { key: 'vendedores', name: 'Ver Vendedores', href: '/supervisores/vendedores', icon: Users },
  { key: 'gestion_clientes', name: 'Gestión Clientes', href: '/supervisores/clientes', icon: UserCheck },
  { key: 'eventos', name: 'Eventos', href: '/eventos', icon: Calendar },
];

// Navegación específica para supervisor_nivel1
const supervisorN1Navigation = [
  { key: 'calendario', name: 'Calendario', href: '/calendario', icon: Calendar },
  { key: 'supervisores', name: 'Panel Supervisor', href: '/supervisores', icon: TrendingUp },
  { key: 'vendedores', name: 'Ver Vendedores', href: '/supervisores/vendedores', icon: Users },
  { key: 'gestion_clientes', name: 'Gestión Clientes', href: '/supervisores/clientes', icon: UserCheck },
  { key: 'eventos', name: 'Eventos', href: '/eventos', icon: Calendar },
];

// Actividades estratégicas - disponible para todos los roles
const actividadesEstrategicas = [
  { key: 'actividades', name: 'Actividades Estratégicas', href: '/actividades', icon: ClipboardList },
];

const quickActions = [
  { name: 'Nueva Visita', href: '/calendario/nueva', icon: Calendar },
  { name: 'Nuevo Cliente', href: '/clientes/nuevo', icon: Users },
];

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
    return items.filter(item => isMenuVisible(sidebarConfig, item.key, userProfile.rol));
  };

  const handleLogout = () => {
    localStorage.removeItem('crm_user_profile');
    localStorage.clear();
    sessionStorage.clear();
    
    if (logout) {
      logout();
    }
    
    window.location.href = '/login';
  };

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo - Fixed */}
      <div className="flex-shrink-0 px-3 sm:px-4 md:px-5 py-4 border-b border-gray-100 dark:border-dark-700">
        <div className="flex items-center gap-3 sm:gap-4">
          <Image
            src="/logo-disfero.png"
            alt="Disfero"
            width={40}
            height={40}
            className="w-9 h-9 sm:w-10 sm:h-10 object-contain flex-shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-white tracking-tight truncate leading-tight">
              CRM <span className="text-indigo-600 dark:text-indigo-400">Disfero</span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 dark:text-gray-300 leading-tight">Sistema de Gestión</p>
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
        {/* Quick Actions - Solo para vendedores */}
        {userProfile?.rol === 'vendedor' && (
          <div className="p-3 sm:p-4 border-b border-gray-100 dark:border-dark-700">
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-300 uppercase tracking-wider mb-2 sm:mb-3">
              Acciones Rápidas
            </p>
            <div className="space-y-1">
              {quickActions.map((action) => (
                <Link
                  key={action.name}
                  href={action.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 sm:gap-2.5 px-2 sm:px-3 py-2 text-xs sm:text-sm text-gray-600 dark:text-white rounded-xl
                           hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300 transition-all duration-200
                           group"
                >
                  <div className="p-1 rounded-lg bg-gray-100 dark:bg-dark-700 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-800 transition-colors">
                    <Plus className="h-3 w-3" />
                  </div>
                  {action.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="p-3 sm:p-4 space-y-1">
          {/* Menú Principal - Para VENDEDORES y SUPERVISOR+VENDEDOR */}
          {(userProfile?.rol === 'vendedor' || userProfile?.rol === 'supervisor_vendedor') && (
            <>
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-300 uppercase tracking-wider mb-2 sm:mb-3">
                Menú Principal
              </p>
              {filterByConfig(vendedorNavigation).map((item, index) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all duration-200',
                      'animate-slide-in opacity-0 text-sm',
                      active
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium'
                        : 'text-gray-600 dark:text-white hover:bg-gray-50 dark:hover:bg-dark-700 hover:text-gray-900 dark:hover:text-white'
                    )}
                    style={{ animationDelay: `${index * 0.05}s`, animationFillMode: 'forwards' }}
                  >
                    <Icon className={cn('h-4 w-4 sm:h-5 sm:w-5', active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-300')} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
              <div className="my-3 sm:my-4 border-t border-gray-100 dark:border-dark-700"></div>
            </>
          )}

          {/* Panel Supervisor - para supervisor, supervisor_nivel1, supervisor_vendedor y admin */}
          {(isUserAdmin || userProfile?.rol === 'supervisor' || userProfile?.rol === 'supervisor_nivel1' || userProfile?.rol === 'supervisor_vendedor') && (
            <>
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-300 uppercase tracking-wider mb-2 sm:mb-3">
                Supervisión
              </p>
              {filterByConfig(userProfile?.rol === 'supervisor_nivel1' ? supervisorN1Navigation : supervisorNavigation).map((item, index) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all duration-200',
                      'animate-slide-in opacity-0 text-sm',
                      active
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium'
                        : 'text-gray-600 dark:text-white hover:bg-gray-50 dark:hover:bg-dark-700 hover:text-gray-900 dark:hover:text-white'
                    )}
                    style={{ animationDelay: `${index * 0.05}s`, animationFillMode: 'forwards' }}
                  >
                    <Icon className={cn('h-4 w-4 sm:h-5 sm:w-5', active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-300')} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
              <div className="my-3 sm:my-4 border-t border-gray-100 dark:border-dark-700"></div>
            </>
          )}

          {/* Calendario para Marketing y Técnico */}
          {(userProfile?.rol === 'marketing' || userProfile?.rol === 'tecnico') && isMenuVisible(sidebarConfig, 'calendario', userProfile?.rol || '') && (
            <Link
              href="/calendario"
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all duration-200 text-sm mb-1',
                isActive('/calendario')
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium'
                  : 'text-gray-600 dark:text-white hover:bg-gray-50 dark:hover:bg-dark-700 hover:text-gray-900 dark:hover:text-white'
              )}
            >
              <Calendar className={cn('h-4 w-4 sm:h-5 sm:w-5', isActive('/calendario') ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-300')} />
              <span>Calendario</span>
            </Link>
          )}

          {/* Eventos para Marketing */}
          {userProfile?.rol === 'marketing' && isMenuVisible(sidebarConfig, 'eventos', userProfile?.rol || '') && (
            <Link
              href="/eventos"
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all duration-200 text-sm mb-1',
                isActive('/eventos')
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium'
                  : 'text-gray-600 dark:text-white hover:bg-gray-50 dark:hover:bg-dark-700 hover:text-gray-900 dark:hover:text-white'
              )}
            >
              <Calendar className={cn('h-4 w-4 sm:h-5 sm:w-5', isActive('/eventos') ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-300')} />
              <span>Eventos</span>
            </Link>
          )}

          {/* Actividades Estratégicas - Disponible para TODOS los roles */}
          {userProfile && (
            <>
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-300 uppercase tracking-wider mb-2 sm:mb-3">
                {(userProfile.rol === 'marketing' || userProfile.rol === 'tecnico') ? 'Menú Principal' : 'Gestión'}
              </p>
              {filterByConfig(actividadesEstrategicas).map((item, index) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all duration-200',
                      'animate-slide-in opacity-0 text-sm',
                      active
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium'
                        : 'text-gray-600 dark:text-white hover:bg-gray-50 dark:hover:bg-dark-700 hover:text-gray-900 dark:hover:text-white'
                    )}
                    style={{ animationDelay: `${index * 0.05}s`, animationFillMode: 'forwards' }}
                  >
                    <Icon className={cn('h-4 w-4 sm:h-5 sm:w-5', active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-300')} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </>
          )}

          {/* Admin Navigation */}
          {isUserAdmin && (
            <>
              <div className="my-3 sm:my-4 border-t border-gray-100 dark:border-dark-700"></div>
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-300 uppercase tracking-wider mb-2 sm:mb-3">
                Administración
              </p>
              {adminNavigation.map((item, index) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all duration-200',
                      'animate-slide-in opacity-0 text-sm',
                      active
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium'
                        : 'text-gray-600 dark:text-white hover:bg-gray-50 dark:hover:bg-dark-700 hover:text-gray-900 dark:hover:text-white'
                    )}
                    style={{ animationDelay: `${(supervisorNavigation.length + index) * 0.05}s`, animationFillMode: 'forwards' }}
                  >
                    <Icon className={cn('h-4 w-4 sm:h-5 sm:w-5', active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-300')} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </>
          )}

          {/* Configuración - Accesible para todos */}
          <div className="my-3 sm:my-4 border-t border-gray-100 dark:border-dark-700"></div>
          <Link
            href="/configuracion"
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all duration-200 text-sm',
              isActive('/configuracion')
                ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium'
                : 'text-gray-600 dark:text-white hover:bg-gray-50 dark:hover:bg-dark-700 hover:text-gray-900 dark:hover:text-white'
            )}
          >
            <Settings className={cn('h-4 w-4 sm:h-5 sm:w-5', isActive('/configuracion') ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-300')} />
            <span>Configuración</span>
          </Link>
        </nav>
      </div>

      {/* Footer - Fixed */}
      <div className="flex-shrink-0 p-3 sm:p-4 border-t border-gray-100 dark:border-dark-700 bg-white dark:bg-dark-900">
        {userProfile && (
          <div className="mb-2 sm:mb-3 pb-2 sm:pb-3 border-b border-gray-100 dark:border-dark-700">
            <p className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-300 mb-0.5">
              Usuario:
            </p>
            <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">
              {userProfile.nombre_completo}
            </p>
            {isUserAdmin && (
              <Badge variant="red" className="mt-1 text-[10px]">
                Admin
              </Badge>
            )}
            {userProfile?.rol === 'supervisor' && (
              <Badge variant="blue" className="mt-1 text-[10px]">
                Supervisor
              </Badge>
            )}
            {userProfile?.rol === 'supervisor_nivel1' && (
              <Badge variant="purple" className="mt-1 text-[10px]">
                Supervisor N1
              </Badge>
            )}
            {userProfile?.rol === 'supervisor_vendedor' && (
              <Badge variant="blue" className="mt-1 text-[10px]">
                Sup. + Vendedor
              </Badge>
            )}
            {userProfile?.rol === 'marketing' && (
              <Badge variant="green" className="mt-1 text-[10px]">
                Marketing
              </Badge>
            )}
            {userProfile?.rol === 'tecnico' && (
              <Badge variant="yellow" className="mt-1 text-[10px]">
                Técnico
              </Badge>
            )}
          </div>
        )}
        
        {/* Botón de Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-2 sm:px-3 py-2 text-xs sm:text-sm text-gray-600 dark:text-white rounded-xl
                   hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-400 transition-all duration-200
                   group mb-2"
        >
          <div className="p-1 rounded-lg bg-gray-100 dark:bg-dark-700 group-hover:bg-red-100 dark:group-hover:bg-red-900/50 transition-colors">
            <LogOut className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          </div>
          <span>Cerrar Sesión</span>
        </button>

        <p className="text-[9px] sm:text-[10px] text-gray-400 dark:text-gray-400 text-center">
          CRM Disfero v1.0
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="md:hidden fixed top-3 left-3 z-50 p-2.5 rounded-xl bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 shadow-md active:scale-95 transition-transform"
        aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
      >
        {mobileOpen ? (
          <X className="h-5 w-5 text-gray-600 dark:text-white" />
        ) : (
          <Menu className="h-5 w-5 text-gray-600 dark:text-white" />
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
          'fixed left-0 top-0 h-full w-[240px] sm:w-64 bg-white dark:bg-dark-900 border-r border-gray-100 dark:border-dark-800',
          'z-40 transition-transform duration-300',
          'md:translate-x-0 shadow-sm',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
