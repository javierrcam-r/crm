'use client';

import { useEffect, useState } from 'react';
import { Target, ChevronLeft, ChevronRight } from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { getMySalesGoals } from '@/lib/services/salesGoals';
import type { SalesGoal } from '@/types/database';
import { format, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

export default function SalesGoalsCard() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [goals, setGoals] = useState<SalesGoal[]>([]);
  const [loading, setLoading] = useState(true);

  const anio = selectedDate.getFullYear();
  const mes = selectedDate.getMonth() + 1;

  useEffect(() => {
    loadGoals();
  }, [anio, mes]);

  const loadGoals = async () => {
    setLoading(true);
    try {
      const data = await getMySalesGoals(anio, mes);
      setGoals(data);
    } catch (error) {
      console.error('Error cargando metas:', error);
    } finally {
      setLoading(false);
    }
  };

  const goToPreviousMonth = () => setSelectedDate(subMonths(selectedDate, 1));
  const goToNextMonth = () => setSelectedDate(addMonths(selectedDate, 1));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
            <Target className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Mis Metas</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Por marca</p>
          </div>
        </div>
        
        {/* Selector de mes */}
        <div className="flex items-center gap-1">
          <button
            onClick={goToPreviousMonth}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
          >
            <ChevronLeft className="h-4 w-4 text-gray-500" />
          </button>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[100px] text-center capitalize">
            {format(selectedDate, 'MMMM yyyy', { locale: es })}
          </span>
          <button
            onClick={goToNextMonth}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
          >
            <ChevronRight className="h-4 w-4 text-gray-500" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
        </div>
      ) : goals.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            No hay metas asignadas para este mes
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => (
            <div
              key={goal.id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-700 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-8 rounded-full bg-emerald-500" />
                <p className="font-medium text-gray-900 dark:text-white">
                  {goal.brand?.nombre || 'Marca'}
                </p>
              </div>
              <Badge variant="green" className="text-sm font-semibold">
                {formatCurrency(goal.meta_valor)}
              </Badge>
            </div>
          ))}
          
          {/* Total */}
          <div className="pt-3 border-t border-gray-200 dark:border-dark-600">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total del mes
              </span>
              <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(goals.reduce((sum, g) => sum + (g.meta_valor || 0), 0))}
              </span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
