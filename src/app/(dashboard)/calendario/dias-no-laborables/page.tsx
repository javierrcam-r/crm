'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarOff, Plus, Trash2, Loader2 } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { useAuth } from '@/contexts/AuthContext';
import {
  getAllBlockedDays,
  createBlockedDay,
  deleteBlockedDay,
  isDateBlocked,
} from '@/lib/services/blockedDays';
import type { CalendarBlockedDay } from '@/types/database';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

export default function DiasNoLaborablesPage() {
  const { userProfile } = useAuth();
  const [blockedDays, setBlockedDays] = useState<CalendarBlockedDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newMotivo, setNewMotivo] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isSupervisor =
    userProfile?.rol === 'admin' ||
    userProfile?.rol === 'supervisor' ||
    userProfile?.rol === 'supervisor_nivel1' ||
    userProfile?.rol === 'supervisor_vendedor';

  useEffect(() => {
    if (isSupervisor) loadBlockedDays();
    else setLoading(false);
  }, [isSupervisor]);

  const loadBlockedDays = async () => {
    try {
      const data = await getAllBlockedDays();
      setBlockedDays(data);
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar días no laborables');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate.trim()) {
      toast.error('Selecciona una fecha');
      return;
    }
    setSaving(true);
    try {
      const alreadyBlocked = await isDateBlocked(newDate);
      if (alreadyBlocked) {
        toast.error('Este día ya está bloqueado');
        setSaving(false);
        return;
      }
      await createBlockedDay({
        fecha: newDate,
        motivo: newMotivo.trim() || null,
      });
      toast.success('Día bloqueado correctamente');
      setNewDate('');
      setNewMotivo('');
      setShowModal(false);
      loadBlockedDays();
    } catch (err: unknown) {
      console.error(err);
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Error al bloquear el día';
      if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('23505')) {
        toast.error('Este día ya está bloqueado');
      } else if (msg.includes('relation') || msg.includes('does not exist') || msg.includes('42P01')) {
        toast.error('Falta aplicar la migración de días no laborables. Ejecuta: supabase db push');
      } else if (msg.includes('policy') || msg.includes('permission') || msg.includes('42501')) {
        toast.error('No tienes permiso para bloquear días. Solo supervisores y admin.');
      } else {
        toast.error(msg || 'Error al bloquear el día');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteBlockedDay(id);
      toast.success('Día desbloqueado');
      loadBlockedDays();
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar');
    } finally {
      setDeletingId(null);
    }
  };

  if (!isSupervisor) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Link href="/calendario">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>
            Volver al calendario
          </Button>
        </Link>
        <Card>
          <p className="text-gray-600 dark:text-gray-400">
            Solo supervisores y administradores pueden gestionar los días no laborables.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/calendario">
            <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>
              Volver
            </Button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <CalendarOff className="h-6 w-6 text-amber-500" />
              Días no laborables
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              En estos días no se puede programar visitas ni actividades (feriados, cierres, etc.).
            </p>
          </div>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setShowModal(true)}
        >
          Bloquear día
        </Button>
      </div>

      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          </div>
        ) : blockedDays.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <CalendarOff className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No hay días bloqueados.</p>
            <p className="text-sm mt-1">Usa &quot;Bloquear día&quot; para agregar feriados o días no laborables.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-dark-500">
            {blockedDays.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {format(new Date(d.fecha + 'T12:00:00'), "EEEE d 'de' MMMM yyyy", { locale: es })}
                  </span>
                  {d.motivo && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{d.motivo}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={deletingId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  onClick={() => handleDelete(d.id)}
                  disabled={deletingId !== null}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Quitar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Bloquear día"
      >
        <form onSubmit={handleAdd} className="space-y-4">
          <Input
            label="Fecha"
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            required
          />
          <Input
            label="Motivo (opcional)"
            placeholder="Ej. Feriado nacional, Cierre por inventario"
            value={newMotivo}
            onChange={(e) => setNewMotivo(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Bloquear día'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
