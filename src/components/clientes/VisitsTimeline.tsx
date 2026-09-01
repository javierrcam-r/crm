'use client';

import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Brush,
  ResponsiveContainer,
} from 'recharts';
import {
  parseISO,
  format,
  startOfMonth,
  startOfYear,
  addMonths,
  addYears,
  isValid,
} from 'date-fns';
import { es } from 'date-fns/locale';
import type { Visit } from '@/types/database';

type Granularity = 'mes' | 'año';

const STATUS_META: { key: string; label: string; color: string }[] = [
  { key: 'completada', label: 'Completada', color: '#10b981' },
  { key: 'programada', label: 'Programada', color: '#3b82f6' },
  { key: 'reprogramada', label: 'Reprogramada', color: '#f59e0b' },
  { key: 'no_atendio', label: 'No atendió', color: '#f97316' },
  { key: 'cancelada', label: 'Cancelada', color: '#ef4444' },
];

interface Row {
  key: string;
  label: string;
  total: number;
  [status: string]: string | number;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const rows = payload.filter((p: any) => p.value > 0);
  const total = rows.reduce((acc: number, p: any) => acc + p.value, 0);
  return (
    <div className="rounded-lg border border-gray-200 dark:border-dark-500 bg-white dark:bg-dark-700 px-3 py-2 shadow-md">
      <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1 capitalize">{label}</p>
      {rows.map((p: any) => (
        <p key={p.dataKey} className="text-[11px] flex items-center gap-1.5" style={{ color: p.color }}>
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          {p.name}: <span className="font-medium">{p.value}</span>
        </p>
      ))}
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 pt-1 border-t border-gray-100 dark:border-dark-500">
        Total: <span className="font-semibold">{total}</span>
      </p>
    </div>
  );
}

export default function VisitsTimeline({ visits }: { visits: Visit[] }) {
  const [gran, setGran] = useState<Granularity>('mes');

  const data = useMemo<Row[]>(() => {
    const dates = visits
      .map((v) => (v.scheduled_at ? parseISO(v.scheduled_at) : null))
      .filter((d): d is Date => !!d && isValid(d));
    if (dates.length === 0) return [];

    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));

    const bucketKey = (d: Date) =>
      gran === 'mes' ? format(startOfMonth(d), 'yyyy-MM') : format(startOfYear(d), 'yyyy');
    const bucketLabel = (d: Date) =>
      gran === 'mes' ? format(d, 'MMM yyyy', { locale: es }) : format(d, 'yyyy');

    const buckets: { key: string; label: string }[] = [];
    let cur = gran === 'mes' ? startOfMonth(min) : startOfYear(min);
    const end = gran === 'mes' ? startOfMonth(max) : startOfYear(max);
    // límite de seguridad para evitar bucles largos con datos corruptos
    let guard = 0;
    while (cur <= end && guard < 1000) {
      buckets.push({ key: bucketKey(cur), label: bucketLabel(cur) });
      cur = gran === 'mes' ? addMonths(cur, 1) : addYears(cur, 1);
      guard++;
    }

    const map = new Map<string, Row>();
    buckets.forEach((b) => {
      const row: Row = { key: b.key, label: b.label, total: 0 };
      STATUS_META.forEach((s) => (row[s.key] = 0));
      map.set(b.key, row);
    });

    visits.forEach((v) => {
      if (!v.scheduled_at) return;
      const d = parseISO(v.scheduled_at);
      if (!isValid(d)) return;
      const row = map.get(bucketKey(d));
      if (!row) return;
      const st = STATUS_META.some((s) => s.key === v.status) ? v.status : 'programada';
      row[st] = (row[st] as number) + 1;
      row.total += 1;
    });

    return buckets.map((b) => map.get(b.key) as Row);
  }, [visits, gran]);

  if (data.length === 0) {
    return (
      <p className="text-center text-gray-500 dark:text-gray-300 py-8">
        No hay visitas para graficar
      </p>
    );
  }

  const windowSize = gran === 'mes' ? 12 : 6;
  const startIndex = Math.max(0, data.length - windowSize);

  return (
    <div>
      <div className="flex items-center justify-end gap-1 mb-3">
        {(['mes', 'año'] as Granularity[]).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGran(g)}
            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
              gran === g
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white dark:bg-dark-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-dark-500 hover:bg-gray-50 dark:hover:bg-dark-600'
            }`}
          >
            {g === 'mes' ? 'Por mes' : 'Por año'}
          </button>
        ))}
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickMargin={6} minTickGap={8} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
            {STATUS_META.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={s.color} maxBarSize={48} />
            ))}
            <Brush
              dataKey="label"
              height={24}
              stroke="#6366f1"
              travellerWidth={8}
              startIndex={startIndex}
              tickFormatter={() => ''}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-center text-[11px] text-gray-400 dark:text-gray-500">
        Arrastra la barra inferior para desplazarte por el tiempo
      </p>
    </div>
  );
}
