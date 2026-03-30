'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Palmtree,
  Filter,
  Calendar,
  User,
  Download,
  Search,
  X,
} from 'lucide-react';
import { fuzzySearch } from '@/lib/search';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import { useAuth } from '@/contexts/AuthContext';
import { getAllVacationRequests } from '@/lib/services/vacations';
import { getAllUsersForSelection } from '@/lib/services/activities';
import type { VacationRequest, UserProfile } from '@/types/database';
import { format, differenceInCalendarDays, startOfYear, endOfYear } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

const estadoLabels: Record<string, string> = {
  pendiente: 'Pendiente',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
};

const estadoColors: Record<string, 'yellow' | 'green' | 'gray'> = {
  pendiente: 'yellow',
  aprobado: 'green',
  rechazado: 'gray',
};

export default function HistorialVacacionesPage() {
  const { userProfile } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<VacationRequest[]>([]);
  const [users, setUsers] = useState<Pick<UserProfile, 'id' | 'nombre_completo' | 'email' | 'rol'>[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [filterUser, setFilterUser] = useState('');
  const [filterEstado, setFilterEstado] = useState('aprobado');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const isSupervisor =
    userProfile?.rol === 'admin' ||
    userProfile?.rol === 'supervisor' ||
    userProfile?.rol === 'supervisor_nivel1' ||
    userProfile?.rol === 'supervisor_vendedor';

  useEffect(() => {
    if (!isSupervisor) {
      router.replace('/vacaciones');
      return;
    }
    loadData();
  }, [isSupervisor]);

  const loadData = async () => {
    try {
      const [vacations, usersList] = await Promise.all([
        getAllVacationRequests(),
        getAllUsersForSelection(),
      ]);
      setRequests(vacations);
      setUsers(usersList);
    } catch (e: unknown) {
      console.error(e);
      toast.error('Error al cargar historial de vacaciones');
    } finally {
      setLoading(false);
    }
  };

  const usersMap = useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach((u) => {
      map[u.id] = u.nombre_completo || u.email || '';
    });
    return map;
  }, [users]);

  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      if (filterUser && req.user_profile_id !== filterUser) return false;
      if (filterEstado && req.estado !== filterEstado) return false;
      if (filterDateFrom && req.fecha_fin < filterDateFrom) return false;
      if (filterDateTo && req.fecha_inicio > filterDateTo) return false;
      if (searchTerm) {
        const userName = usersMap[req.user_profile_id] || '';
        if (fuzzySearch(searchTerm, userName) === 0 && fuzzySearch(searchTerm, req.motivo || '') === 0) return false;
      }
      return true;
    });
  }, [requests, filterUser, filterEstado, filterDateFrom, filterDateTo, searchTerm, usersMap]);

  const calcDays = (inicio: string, fin: string) => {
    return differenceInCalendarDays(new Date(fin + 'T12:00:00'), new Date(inicio + 'T12:00:00')) + 1;
  };

  const totalDays = useMemo(() => {
    return filteredRequests.reduce((acc, req) => acc + calcDays(req.fecha_inicio, req.fecha_fin), 0);
  }, [filteredRequests]);

  const statsPerUser = useMemo(() => {
    const stats: Record<string, { name: string; days: number; count: number }> = {};
    filteredRequests.forEach((req) => {
      const id = req.user_profile_id;
      if (!stats[id]) {
        stats[id] = { name: usersMap[id] || 'Usuario', days: 0, count: 0 };
      }
      stats[id].days += calcDays(req.fecha_inicio, req.fecha_fin);
      stats[id].count += 1;
    });
    return Object.values(stats).sort((a, b) => b.days - a.days);
  }, [filteredRequests, usersMap]);

  const clearFilters = () => {
    setFilterUser('');
    setFilterEstado('aprobado');
    setFilterDateFrom('');
    setFilterDateTo('');
    setSearchTerm('');
  };

  const setCurrentYear = () => {
    const now = new Date();
    setFilterDateFrom(format(startOfYear(now), 'yyyy-MM-dd'));
    setFilterDateTo(format(endOfYear(now), 'yyyy-MM-dd'));
  };

  const exportCSV = () => {
    const headers = ['Usuario', 'Fecha Inicio', 'Fecha Fin', 'Días', 'Estado', 'Motivo'];
    const rows = filteredRequests.map((req) => [
      usersMap[req.user_profile_id] || '',
      req.fecha_inicio,
      req.fecha_fin,
      calcDays(req.fecha_inicio, req.fecha_fin).toString(),
      estadoLabels[req.estado],
      req.motivo || '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historial_vacaciones_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!isSupervisor) {
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/vacaciones">
            <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>
              Volver
            </Button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Palmtree className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              Historial de Vacaciones
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Consulta las vacaciones tomadas por el equipo
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Download className="h-4 w-4" />}
          onClick={exportCSV}
          disabled={filteredRequests.length === 0}
        >
          Exportar CSV
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-gray-500" />
          <h2 className="font-semibold text-gray-900 dark:text-white">Filtros</h2>
          <button
            onClick={clearFilters}
            className="ml-auto text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            <X className="h-3.5 w-3.5" />
            Limpiar filtros
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 dark:border-dark-500 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-dark-700 text-sm"
            />
          </div>
          <Select
            label=""
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            options={[
              { value: '', label: '👥 Todos los usuarios' },
              ...users.map((u) => ({ value: u.id, label: u.nombre_completo || u.email || '' })),
            ]}
          />
          <Select
            label=""
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            options={[
              { value: '', label: '📋 Todos los estados' },
              { value: 'aprobado', label: '✅ Aprobadas' },
              { value: 'pendiente', label: '⏳ Pendientes' },
              { value: 'rechazado', label: '❌ Rechazadas' },
            ]}
          />
          <Input
            label=""
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            placeholder="Desde"
          />
          <div className="flex gap-2">
            <Input
              label=""
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              placeholder="Hasta"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={setCurrentYear}
              title="Año actual"
              className="shrink-0"
            >
              <Calendar className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card padding="sm" className="text-center">
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{filteredRequests.length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Solicitudes</p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totalDays}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Días totales</p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{statsPerUser.length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Personas</p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {statsPerUser.length > 0 ? (totalDays / statsPerUser.length).toFixed(1) : 0}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Días promedio</p>
        </Card>
      </div>

      {/* Resumen por usuario */}
      {statsPerUser.length > 0 && (
        <Card>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-indigo-500" />
            Resumen por persona
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-dark-500">
                  <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-300">Persona</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-600 dark:text-gray-300">Solicitudes</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-600 dark:text-gray-300">Días</th>
                </tr>
              </thead>
              <tbody>
                {statsPerUser.map((s, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-dark-600 hover:bg-gray-50 dark:hover:bg-dark-600">
                    <td className="py-2 px-3 text-gray-900 dark:text-white">{s.name}</td>
                    <td className="py-2 px-3 text-center text-gray-600 dark:text-gray-300">{s.count}</td>
                    <td className="py-2 px-3 text-center font-medium text-indigo-600 dark:text-indigo-400">{s.days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Lista de solicitudes */}
      <Card>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
          Detalle de vacaciones ({filteredRequests.length})
        </h3>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Palmtree className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No se encontraron vacaciones con los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-dark-500">
                  <th className="text-left py-3 px-3 font-medium text-gray-600 dark:text-gray-300">Persona</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-600 dark:text-gray-300">Fechas</th>
                  <th className="text-center py-3 px-3 font-medium text-gray-600 dark:text-gray-300">Días</th>
                  <th className="text-center py-3 px-3 font-medium text-gray-600 dark:text-gray-300">Estado</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-600 dark:text-gray-300">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req) => (
                  <tr
                    key={req.id}
                    className="border-b border-gray-100 dark:border-dark-600 hover:bg-gray-50 dark:hover:bg-dark-600"
                  >
                    <td className="py-3 px-3 text-gray-900 dark:text-white font-medium">
                      {usersMap[req.user_profile_id] || 'Usuario'}
                    </td>
                    <td className="py-3 px-3 text-gray-600 dark:text-gray-300">
                      {format(new Date(req.fecha_inicio + 'T12:00:00'), "d MMM", { locale: es })} –{' '}
                      {format(new Date(req.fecha_fin + 'T12:00:00'), "d MMM yyyy", { locale: es })}
                    </td>
                    <td className="py-3 px-3 text-center font-medium text-indigo-600 dark:text-indigo-400">
                      {calcDays(req.fecha_inicio, req.fecha_fin)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Badge variant={estadoColors[req.estado]}>
                        {estadoLabels[req.estado]}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-gray-500 dark:text-gray-400 max-w-[200px] truncate">
                      {req.motivo || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
