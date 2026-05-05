'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Eye, EyeOff, Save, Shield, Check } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import {
  getSidebarConfig, bulkSetSidebarVisibility,
  ALL_MENU_ITEMS, ALL_ROLES,
  type SidebarConfigItem,
} from '@/lib/services/sidebarConfig';
import toast from 'react-hot-toast';

export default function SidebarConfigPage() {
  const { userProfile } = useAuth();
  const [config, setConfig] = useState<SidebarConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isAdmin = userProfile?.rol === 'admin';

  useEffect(() => {
    if (isAdmin) loadConfig();
  }, [isAdmin]);

  const loadConfig = async () => {
    try {
      const data = await getSidebarConfig();
      setConfig(data);
    } catch (e) {
      console.error('Error loading config:', e);
    } finally {
      setLoading(false);
    }
  };

  const isVisible = (menuKey: string, rol: string) => {
    const entry = config.find(c => c.menu_key === menuKey && c.rol === rol);
    return entry ? entry.visible : true; // Default visible
  };

  const toggle = (menuKey: string, menuLabel: string, rol: string) => {
    const current = isVisible(menuKey, rol);
    setConfig(prev => {
      const existing = prev.find(c => c.menu_key === menuKey && c.rol === rol);
      if (existing) {
        return prev.map(c => c.menu_key === menuKey && c.rol === rol ? { ...c, visible: !current } : c);
      }
      return [...prev, { menu_key: menuKey, menu_label: menuLabel, rol, visible: !current }];
    });
  };

  const toggleAllForRole = (rol: string, visible: boolean) => {
    setConfig(prev => {
      const newConfig = [...prev];
      ALL_MENU_ITEMS.forEach(item => {
        const idx = newConfig.findIndex(c => c.menu_key === item.key && c.rol === rol);
        if (idx >= 0) {
          newConfig[idx] = { ...newConfig[idx], visible };
        } else {
          newConfig.push({ menu_key: item.key, menu_label: item.label, rol, visible });
        }
      });
      return newConfig;
    });
  };

  const toggleAllForMenu = (menuKey: string, menuLabel: string, visible: boolean) => {
    setConfig(prev => {
      const newConfig = [...prev];
      ALL_ROLES.forEach(role => {
        const idx = newConfig.findIndex(c => c.menu_key === menuKey && c.rol === role.key);
        if (idx >= 0) {
          newConfig[idx] = { ...newConfig[idx], visible };
        } else {
          newConfig.push({ menu_key: menuKey, menu_label: menuLabel, rol: role.key, visible });
        }
      });
      return newConfig;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save all entries that differ from default (visible=true)
      const items = config.map(c => ({
        menu_key: c.menu_key,
        menu_label: c.menu_label || ALL_MENU_ITEMS.find(m => m.key === c.menu_key)?.label || c.menu_key,
        rol: c.rol,
        visible: c.visible,
      }));
      
      // Also save entries for items not in config (to ensure full coverage)
      ALL_MENU_ITEMS.forEach(item => {
        ALL_ROLES.forEach(role => {
          if (!items.find(i => i.menu_key === item.key && i.rol === role.key)) {
            items.push({ menu_key: item.key, menu_label: item.label, rol: role.key, visible: true });
          }
        });
      });

      await bulkSetSidebarVisibility(items);
      toast.success('Configuración guardada exitosamente');
    } catch (e: any) {
      console.error('Error saving:', e);
      toast.error(e?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <Card className="max-w-md text-center p-6 sm:p-8">
          <Shield className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Acceso Denegado</h2>
          <p className="text-gray-600 dark:text-gray-300">Solo administradores pueden configurar el menú.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/configuracion"><Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>Volver</Button></Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Shield className="h-6 w-6 sm:h-7 sm:w-7 text-indigo-600 dark:text-indigo-400" />
              Configurar Menú
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-300 mt-1">Controla qué ítems del menú ve cada rol</p>
          </div>
        </div>
        <Button onClick={handleSave} loading={saving} className="w-full sm:w-auto">
          <Save className="h-4 w-4 mr-2" />
          Guardar Cambios
        </Button>
      </div>

      {/* Legend */}
      <Card>
        <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs sm:text-sm">
          <span className="flex items-center gap-2"><span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center"><Eye className="h-4 w-4 text-green-600 dark:text-green-400" /></span> <span className="text-gray-700 dark:text-gray-200">Visible</span></span>
          <span className="flex items-center gap-2"><span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center"><EyeOff className="h-4 w-4 text-red-400 dark:text-red-300" /></span> <span className="text-gray-700 dark:text-gray-200">Oculto</span></span>
          <span className="text-gray-400 dark:text-gray-500 hidden sm:inline">|</span>
          <span className="text-gray-500 dark:text-gray-400">Haz clic en cualquier celda para alternar. Los cambios no se aplican hasta que guardes.</span>
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400" />
        </div>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-dark-800 border-b border-gray-200 dark:border-dark-500">
                  <th className="text-left px-3 sm:px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 sticky left-0 bg-gray-50 dark:bg-dark-800 z-10 min-w-[160px] sm:min-w-[180px]">
                    Ítem del Menú
                  </th>
                  {ALL_ROLES.map(role => (
                    <th key={role.key} className="text-center px-2 sm:px-3 py-3 font-semibold text-gray-600 dark:text-gray-300 min-w-[100px]">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs">{role.label}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => toggleAllForRole(role.key, true)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/60"
                            title="Mostrar todo"
                          >
                            Todo
                          </button>
                          <button
                            onClick={() => toggleAllForRole(role.key, false)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60"
                            title="Ocultar todo"
                          >
                            Nada
                          </button>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-dark-600">
                {ALL_MENU_ITEMS.map(item => (
                  <tr key={item.key} className="hover:bg-gray-50 dark:hover:bg-dark-800 group">
                    <td className="px-3 sm:px-4 py-3 font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-dark-700 group-hover:bg-gray-50 dark:group-hover:bg-dark-800 z-10">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{item.label}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => toggleAllForMenu(item.key, item.label, true)}
                            className="text-[10px] px-1 py-0.5 rounded bg-green-50 dark:bg-green-900/40 text-green-600 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/60 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Mostrar para todos"
                          >
                            <Eye className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => toggleAllForMenu(item.key, item.label, false)}
                            className="text-[10px] px-1 py-0.5 rounded bg-red-50 dark:bg-red-900/40 text-red-500 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/60 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Ocultar para todos"
                          >
                            <EyeOff className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </td>
                    {ALL_ROLES.map(role => {
                      const visible = isVisible(item.key, role.key);
                      return (
                        <td key={role.key} className="px-2 sm:px-3 py-3 text-center">
                          <button
                            onClick={() => toggle(item.key, item.label, role.key)}
                            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all mx-auto ${
                              visible
                                ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/60'
                                : 'bg-red-100 dark:bg-red-900/40 text-red-400 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60'
                            }`}
                            title={visible ? `Visible para ${role.label}` : `Oculto para ${role.label}`}
                          >
                            {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
