'use client';

import { useEffect, useState } from 'react';
import {
  Users,
  Mail,
  Phone,
  Calendar,
  Eye,
  UserCheck,
  UserX,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { UserProfile } from '@/types/database';
import Link from 'next/link';

export default function VendedoresListPage() {
  const { userProfile, isUserAdmin } = useAuth();
  const [vendedores, setVendedores] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const canView = userProfile?.rol === 'admin' || userProfile?.rol === 'supervisor' || userProfile?.rol === 'supervisor_nivel1' || userProfile?.rol === 'supervisor_vendedor';

  useEffect(() => {
    if (canView) {
      loadVendedores();
    }
  }, [canView]);

  const loadVendedores = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      
      const { data, error } = await supabase
        .from('users_profile')
        .select('*')
        .eq('rol', 'vendedor')
        .order('nombre_completo');

      if (error) throw error;
      setVendedores(data || []);
    } catch (error) {
      console.error('Error cargando vendedores:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!canView) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md text-center p-8">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Acceso Denegado
          </h2>
          <p className="text-gray-600">
            Solo supervisores y administradores pueden ver esta página.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-6 w-6 sm:h-7 sm:w-7 text-indigo-600" />
            Vendedores
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Lista de vendedores del equipo
          </p>
        </div>
        <Badge variant="blue">{vendedores.length} vendedores</Badge>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : vendedores.length === 0 ? (
        <Card className="text-center py-12">
          <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No hay vendedores registrados</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {vendedores.map((vendedor) => (
            <Card key={vendedor.id} className="hover:shadow-md transition-shadow" padding="sm">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm sm:text-lg flex-shrink-0">
                  {vendedor.nombre_completo.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate text-sm sm:text-base">
                    {vendedor.nombre_completo}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-500">@{vendedor.username || vendedor.email?.split('@')[0]}</p>
                  
                  <div className="mt-2 sm:mt-3 space-y-1 text-xs sm:text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{vendedor.email}</span>
                    </div>
                    {vendedor.telefono && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400 flex-shrink-0" />
                        <span>{vendedor.telefono}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-2 sm:mt-3 flex items-center gap-2">
                    {vendedor.activo ? (
                      <Badge variant="green" className="flex items-center gap-1 text-[10px] sm:text-xs">
                        <UserCheck className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        Activo
                      </Badge>
                    ) : (
                      <Badge variant="red" className="flex items-center gap-1 text-[10px] sm:text-xs">
                        <UserX className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        Inactivo
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
