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
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md text-center p-8">
          <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Acceso Denegado</h2>
          <p className="text-gray-600">Solo administradores pueden configurar el menú.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/configuracion"><Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>Volver</Button></Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Shield className="h-7 w-7 text-indigo-600" />
              Configurar Menú
            </h1>
            <p className="text-gray-500 mt-1">Controla qué ítems del menú ve cada rol</p>
          </div>
        </div>
        <Button onClick={handleSave} loading={saving}>
          <Save className="h-4 w-4 mr-2" />
          Guardar Cambios
        </Button>
      </div>

      {/* Legend */}
      <Card>
        <div className="flex items-center gap-6 text-sm">
          <span className="flex items-center gap-2"><span className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center"><Eye className="h-4 w-4 text-green-600" /></span> Visible</span>
          <span className="flex items-center gap-2"><span className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center"><EyeOff className="h-4 w-4 text-red-400" /></span> Oculto</span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-500">Haz clic en cualquier celda para alternar. Los cambios no se aplican hasta que guardes.</span>
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 sticky left-0 bg-gray-50 z-10 min-w-[180px]">
                    Ítem del Menú
                  </th>
                  {ALL_ROLES.map(role => (
                    <th key={role.key} className="text-center px-3 py-3 font-semibold text-gray-600 min-w-[100px]">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs">{role.label}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => toggleAllForRole(role.key, true)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200"
                            title="Mostrar todo"
                          >
                            Todo
                          </button>
                          <button
                            onClick={() => toggleAllForRole(role.key, false)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 hover:bg-red-200"
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
              <tbody className="divide-y divide-gray-100">
                {ALL_MENU_ITEMS.map(item => (
                  <tr key={item.key} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900 sticky left-0 bg-white z-10">
                      <div className="flex items-center justify-between">
                        <span>{item.label}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => toggleAllForMenu(item.key, item.label, true)}
                            className="text-[10px] px-1 py-0.5 rounded bg-green-50 text-green-600 hover:bg-green-100 opacity-0 group-hover:opacity-100"
                            title="Mostrar para todos"
                          >
                            <Eye className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => toggleAllForMenu(item.key, item.label, false)}
                            className="text-[10px] px-1 py-0.5 rounded bg-red-50 text-red-500 hover:bg-red-100 opacity-0 group-hover:opacity-100"
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
                        <td key={role.key} className="px-3 py-3 text-center">
                          <button
                            onClick={() => toggle(item.key, item.label, role.key)}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all mx-auto ${
                              visible
                                ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                : 'bg-red-100 text-red-400 hover:bg-red-200'
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
