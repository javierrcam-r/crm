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
  Shield,
  Settings,
  LogOut,
  TrendingUp,
  ClipboardList,
  UserCheck,
} from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import Badge from '@/components/ui/Badge';
import toast from 'react-hot-toast';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Clientes', href: '/clientes', icon: Users },
  { name: 'Calendario', href: '/calendario', icon: Calendar },
  { name: 'Mapa Visitas', href: '/mapa', icon: Map },
  { name: 'Productos', href: '/productos', icon: Package },
  { name: 'Pedidos', href: '/pedidos', icon: ShoppingCart },
  { name: 'Reportes', href: '/reportes', icon: BarChart3 },
];

const adminNavigation = [
  { name: 'Usuarios', href: '/usuarios', icon: Shield },
];

const supervisorNavigation = [
  { name: 'Panel Supervisor', href: '/supervisores', icon: TrendingUp },
  { name: 'Ver Vendedores', href: '/supervisores/vendedores', icon: Users },
];

// Actividades estratégicas - disponible para todos
const actividadesEstrategicas = [
  { name: 'Actividades Estratégicas', href: '/actividades', icon: ClipboardList },
];

const quickActions = [
  { name: 'Nueva Visita', href: '/calendario/nueva', icon: Calendar },
  { name: 'Nuevo Pedido', href: '/pedidos/nuevo', icon: ShoppingCart },
  { name: 'Nuevo Cliente', href: '/clientes/nuevo', icon: Users },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isUserAdmin, userProfile, logout } = useAuth();

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
      <div className="flex-shrink-0 p-3 sm:p-4 md:p-5 border-b border-gray-100">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm sm:text-base">D</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 tracking-tight truncate">
              CRM <span className="text-indigo-600">Disfero</span>
            </h1>
            <p className="text-[10px] sm:text-xs text-gray-400">Sistema de Gestión</p>
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
        {/* Quick Actions - Solo para vendedores */}
        {userProfile?.rol === 'vendedor' && (
          <div className="p-3 sm:p-4 border-b border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 sm:mb-3">
              Acciones Rápidas
            </p>
            <div className="space-y-1">
              {quickActions.map((action) => (
                <Link
                  key={action.name}
                  href={action.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 sm:gap-2.5 px-2 sm:px-3 py-2 text-xs sm:text-sm text-gray-600 rounded-xl
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
        )}

        {/* Navigation */}
        <nav className="p-3 sm:p-4 space-y-1">
          {/* Menú Principal - Solo para vendedores */}
          {userProfile?.rol === 'vendedor' && (
            <>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 sm:mb-3">
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
                      'flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all duration-200',
                      'animate-slide-in opacity-0 text-sm',
                      active
                        ? 'bg-indigo-50 text-indigo-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )}
                    style={{ animationDelay: `${index * 0.05}s`, animationFillMode: 'forwards' }}
                  >
                    <Icon className={cn('h-4 w-4 sm:h-5 sm:w-5', active ? 'text-indigo-600' : 'text-gray-400')} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </>
          )}

          {/* Actividades Estratégicas - Disponible para todos */}
          {userProfile && (
            <>
              {userProfile.rol === 'vendedor' && <div className="my-3 sm:my-4 border-t border-gray-100"></div>}
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 sm:mb-3">
                {userProfile.rol === 'supervisor_nivel1' || userProfile.rol === 'supervisor' ? 'Menú Principal' : 'Gestión'}
              </p>
              {actividadesEstrategicas.map((item, index) => {
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
                        ? 'bg-indigo-50 text-indigo-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )}
                    style={{ animationDelay: `${index * 0.05}s`, animationFillMode: 'forwards' }}
                  >
                    <Icon className={cn('h-4 w-4 sm:h-5 sm:w-5', active ? 'text-indigo-600' : 'text-gray-400')} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
              {(userProfile.rol === 'vendedor' || userProfile.rol === 'supervisor_nivel1') && (
                <div className="my-3 sm:my-4 border-t border-gray-100"></div>
              )}
            </>
          )}
          
          {/* Supervisor Navigation - para supervisores y admins */}
          {(isUserAdmin || userProfile?.rol === 'supervisor') && (
            <>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 sm:mb-3">
                {userProfile?.rol === 'vendedor' ? 'Supervisión' : 'Menú Principal'}
              </p>
              {supervisorNavigation.map((item, index) => {
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
                        ? 'bg-indigo-50 text-indigo-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )}
                    style={{ animationDelay: `${(navigation.length + index) * 0.05}s`, animationFillMode: 'forwards' }}
                  >
                    <Icon className={cn('h-4 w-4 sm:h-5 sm:w-5', active ? 'text-indigo-600' : 'text-gray-400')} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </>
          )}

          {/* Admin Navigation */}
          {isUserAdmin && (
            <>
              <div className="my-3 sm:my-4 border-t border-gray-100"></div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 sm:mb-3">
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
                        ? 'bg-indigo-50 text-indigo-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )}
                    style={{ animationDelay: `${(navigation.length + supervisorNavigation.length + index) * 0.05}s`, animationFillMode: 'forwards' }}
                  >
                    <Icon className={cn('h-4 w-4 sm:h-5 sm:w-5', active ? 'text-indigo-600' : 'text-gray-400')} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </>
          )}

          {/* Configuración - Accesible para todos */}
          <div className="my-3 sm:my-4 border-t border-gray-100"></div>
          <Link
            href="/configuracion"
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all duration-200 text-sm',
              isActive('/configuracion')
                ? 'bg-indigo-50 text-indigo-700 font-medium'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <Settings className={cn('h-4 w-4 sm:h-5 sm:w-5', isActive('/configuracion') ? 'text-indigo-600' : 'text-gray-400')} />
            <span>Configuración</span>
          </Link>
        </nav>
      </div>

      {/* Footer - Fixed */}
      <div className="flex-shrink-0 p-3 sm:p-4 border-t border-gray-100 bg-white">
        {userProfile && (
          <div className="mb-2 sm:mb-3 pb-2 sm:pb-3 border-b border-gray-100">
            <p className="text-[10px] sm:text-xs font-medium text-gray-500 mb-0.5">
              Usuario:
            </p>
            <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
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
          </div>
        )}
        
        {/* Botón de Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-2 sm:px-3 py-2 text-xs sm:text-sm text-gray-600 rounded-xl
                   hover:bg-red-50 hover:text-red-700 transition-all duration-200
                   group mb-2"
        >
          <div className="p-1 rounded-lg bg-gray-100 group-hover:bg-red-100 transition-colors">
            <LogOut className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          </div>
          <span>Cerrar Sesión</span>
        </button>

        <p className="text-[9px] sm:text-[10px] text-gray-400 text-center">
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
          'fixed left-0 top-0 h-full w-[240px] sm:w-64 bg-white border-r border-gray-100',
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
