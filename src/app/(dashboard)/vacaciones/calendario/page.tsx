'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Palmtree,
  Loader2,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Select from '@/components/ui/Select';
import { useAuth } from '@/contexts/AuthContext';
import { getAllVacationRequests } from '@/lib/services/vacations';
import { getAllUsersForSelection } from '@/lib/services/activities';
import type { VacationRequest } from '@/types/database';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  isWithinInterval,
  parseISO,
} from 'date-fns';
import { es } from 'date-fns/locale';

export default function VacacionesCalendarioPage() {
  const { userProfile } = useAuth();
  const [vacations, setVacations] = useState<VacationRequest[]>([]);
  const [users, setUsers] = useState<{ id: string; nombre_completo: string }[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterUser, setFilterUser] = useState('');
  const [showPending, setShowPending] = useState(true);

  const isSupervisor =
    userProfile?.rol === 'admin' ||
    userProfile?.rol === 'supervisor' ||
    userProfile?.rol === 'supervisor_nivel1' ||
    userProfile?.rol === 'supervisor_vendedor';

  useEffect(() => {
    if (isSupervisor) loadData();
    else setLoading(false);
  }, [isSupervisor]);

  useEffect(() => {
    if (isSupervisor) loadVacations();
  }, [isSupervisor, currentDate, filterUser]);

  const loadData = async () => {
    try {
      const u = await getAllUsersForSelection();
      setUsers(u);
      const map: Record<string, string> = {};
      u.forEach((us) => { map[us.id] = us.nombre_completo || ''; });
      setUsersMap(map);
    } catch {
      setUsers([]);
      setUsersMap({});
    }
  };

  const loadVacations = async () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const dateFrom = format(monthStart, 'yyyy-MM-dd');
    const dateTo = format(monthEnd, 'yyyy-MM-dd');
    try {
      const data = await getAllVacationRequests({
        dateFrom,
        dateTo,
        userProfileId: filterUser || undefined,
      });
      setVacations(data);
    } catch (e) {
      console.error(e);
      setVacations([]);
    } finally {
      setLoading(false);
    }
  };

  const calendarStart = startOfWeek(startOfMonth(currentDate), { locale: es });
  const calendarEnd = endOfWeek(endOfMonth(currentDate), { locale: es });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Para cada día, obtener las vacaciones que lo incluyen
  const getVacationsForDay = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return vacations.filter((v) => {
      if (showPending === false && v.estado !== 'aprobado') return false;
      const start = parseISO(v.fecha_inicio + 'T12:00:00');
      const end = parseISO(v.fecha_fin + 'T23:59:59');
      return isWithinInterval(parseISO(dayStr + 'T12:00:00'), { start, end });
    });
  };

  const userColors: Record<string, string> = {};
  const colorPalette = [
    'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 border-emerald-400',
    'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border-blue-400',
    'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 border-purple-400',
    'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-400',
    'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 border-rose-400',
  ];
  vacations.forEach((v, i) => {
    const id = v.user_profile_id;
    if (!userColors[id]) {
      userColors[id] = colorPalette[Object.keys(userColors).length % colorPalette.length];
    }
  });

  if (!isSupervisor) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Link href="/vacaciones">
          <button className="text-indigo-600 dark:text-indigo-400 text-sm font-medium hover:underline">
            ← Volver a Vacaciones
          </button>
        </Link>
        <Card>
          <p className="text-gray-600 dark:text-gray-400">
            Solo supervisores y supervisor N1 pueden ver el calendario de vacaciones del equipo.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/vacaciones">
            <button className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-sm font-medium hover:underline">
              <ArrowLeft className="h-4 w-4" /> Volver
            </button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Palmtree className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              Calendario de vacaciones
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Vacaciones del equipo</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="w-48 text-sm"
          >
            <option value="">Todos</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre_completo}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showPending}
              onChange={(e) => setShowPending(e.target.checked)}
              className="rounded"
            />
            Incluir pendientes
          </label>
        </div>
      </div>

      <Card padding="none">
        <div className="p-3 flex items-center justify-between border-b border-gray-200 dark:border-dark-500">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {format(currentDate, "MMMM yyyy", { locale: es })}
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="p-2 hover:bg-gray-100 dark:hover:bg-dark-600 rounded-lg transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg"
            >
              Hoy
            </button>
            <button
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="p-2 hover:bg-gray-100 dark:hover:bg-dark-600 rounded-lg transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 border-b border-gray-200 dark:border-dark-500">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
                <div
                  key={d}
                  className="p-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-dark-700"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((day, idx) => {
                const dayVacations = getVacationsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const today = isToday(day);
                return (
                  <div
                    key={idx}
                    className={`min-h-[100px] p-2 border-r border-b border-gray-100 dark:border-dark-600 ${
                      !isCurrentMonth ? 'bg-gray-50/50 dark:bg-dark-800/50' : ''
                    } ${today ? 'ring-1 ring-indigo-400 ring-inset' : ''}`}
                  >
                    <span
                      className={`text-sm font-medium ${
                        today ? 'bg-indigo-500 text-white px-2 py-0.5 rounded' : ''
                      }`}
                    >
                      {format(day, 'd')}
                    </span>
                    <div className="mt-1 space-y-1">
                      {dayVacations.slice(0, 3).map((v) => (
                        <div
                          key={`${v.id}-${format(day, 'yyyy-MM-dd')}`}
                          className={`text-xs px-1.5 py-0.5 rounded truncate border-l-2 ${
                            userColors[v.user_profile_id] || 'bg-gray-100 dark:bg-gray-700'
                          } ${v.estado === 'pendiente' ? 'opacity-75' : ''}`}
                          title={`${usersMap[v.user_profile_id] || '?'}${v.estado === 'pendiente' ? ' (pendiente)' : ''}`}
                        >
                          {usersMap[v.user_profile_id]?.split(' ')[0] || '?'}
                          {v.estado === 'pendiente' && ' ⏳'}
                        </div>
                      ))}
                      {dayVacations.length > 3 && (
                        <span className="text-xs text-gray-400">+{dayVacations.length - 3}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
