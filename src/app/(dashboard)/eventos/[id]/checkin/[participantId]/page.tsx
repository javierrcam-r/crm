'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, XCircle, AlertTriangle, Loader2, MapPin } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getEvent, getEventParticipants, updateParticipant,
  type Event, type EventParticipant,
} from '@/lib/services/events';
import toast from 'react-hot-toast';

type CheckinState = 'loading' | 'success' | 'already' | 'error';

export default function CheckinPage() {
  const params = useParams();
  const { userProfile } = useAuth();
  const eventId = params.id as string;
  const participantId = params.participantId as string;

  const [state, setState] = useState<CheckinState>('loading');
  const [event, setEvent] = useState<Event | null>(null);
  const [participant, setParticipant] = useState<EventParticipant | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!userProfile) return;
    doCheckin();
  }, [userProfile]);

  const doCheckin = async () => {
    try {
      const [ev, parts] = await Promise.all([
        getEvent(eventId),
        getEventParticipants(eventId),
      ]);
      setEvent(ev);

      const found = parts.find(p => p.id === participantId);
      if (!found) {
        setErrorMsg('Participante no encontrado en este evento.');
        setState('error');
        return;
      }
      setParticipant(found);

      if (found.asistencia) {
        setState('already');
        return;
      }

      await updateParticipant(found.id, { asistencia: true });
      setParticipant({ ...found, asistencia: true });
      setState('success');
      toast.success('Check-in exitoso');
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message || 'Error al realizar check-in');
      setState('error');
    }
  };

  const getCatColor = (catName: string | null) => {
    if (!catName || !event) return null;
    const cat = (event.categorias_participantes || []).find((c: any) => c.nombre === catName);
    return cat?.color || null;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-50 to-white">
      <div className="max-w-md w-full">
        <div className="text-center mb-6">
          <img src="/logo-disfero.png" alt="Disfero" className="h-12 mx-auto mb-2" />
        </div>

        <div className="bg-white rounded-2xl shadow-xl border p-6 space-y-5">
          {state === 'loading' && (
            <div className="flex flex-col items-center py-10 space-y-3">
              <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
              <p className="text-gray-500 font-medium">Procesando check-in...</p>
            </div>
          )}

          {state === 'success' && participant && (
            <div className="flex flex-col items-center space-y-4">
              <div className="bg-green-100 rounded-full p-4">
                <CheckCircle className="h-12 w-12 text-green-600" />
              </div>
              <h1 className="text-xl font-bold text-green-700">Check-in Exitoso</h1>
              <div className="text-center space-y-1">
                <p className="text-lg font-semibold text-gray-900">{participant.nombre}</p>
                {participant.empresa && <p className="text-sm text-gray-500">{participant.empresa}</p>}
                <div className="flex items-center justify-center gap-2 mt-2">
                  {participant.categoria && (
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium text-white" style={{ backgroundColor: getCatColor(participant.categoria) || '#0d9488' }}>
                      {participant.categoria}
                    </span>
                  )}
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${participant.estado_inscripcion === 'confirmado' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {participant.estado_inscripcion.replace('_', ' ')}
                  </span>
                </div>
              </div>
              {event && (
                <div className="bg-indigo-50 rounded-xl p-3 w-full text-center">
                  <p className="text-xs text-indigo-600 font-semibold uppercase">Evento</p>
                  <p className="text-sm font-medium text-gray-900">{event.nombre}</p>
                </div>
              )}
              {participant.numero_asiento ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 w-full text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <MapPin className="h-4 w-4 text-amber-600" />
                    <p className="text-xs text-amber-700 font-semibold uppercase">Tu ubicación</p>
                  </div>
                  <p className="text-2xl font-bold text-amber-800 tracking-wide">{participant.numero_asiento}</p>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 w-full text-center">
                  <p className="text-xs text-gray-500">Sin asiento asignado</p>
                </div>
              )}
            </div>
          )}

          {state === 'already' && participant && (
            <div className="flex flex-col items-center space-y-4">
              <div className="bg-amber-100 rounded-full p-4">
                <AlertTriangle className="h-12 w-12 text-amber-600" />
              </div>
              <h1 className="text-xl font-bold text-amber-700">Ya Registrado</h1>
              <p className="text-sm text-gray-600 text-center">Este participante ya fue registrado previamente.</p>
              <div className="text-center space-y-1">
                <p className="text-lg font-semibold text-gray-900">{participant.nombre}</p>
                {participant.empresa && <p className="text-sm text-gray-500">{participant.empresa}</p>}
                {participant.categoria && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium text-white inline-block mt-1" style={{ backgroundColor: getCatColor(participant.categoria) || '#0d9488' }}>
                    {participant.categoria}
                  </span>
                )}
              </div>
              {event && (
                <div className="bg-indigo-50 rounded-xl p-3 w-full text-center">
                  <p className="text-xs text-indigo-600 font-semibold uppercase">Evento</p>
                  <p className="text-sm font-medium text-gray-900">{event.nombre}</p>
                </div>
              )}
              {participant.numero_asiento ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 w-full text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <MapPin className="h-4 w-4 text-amber-600" />
                    <p className="text-xs text-amber-700 font-semibold uppercase">Tu ubicación</p>
                  </div>
                  <p className="text-2xl font-bold text-amber-800 tracking-wide">{participant.numero_asiento}</p>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 w-full text-center">
                  <p className="text-xs text-gray-500">Sin asiento asignado</p>
                </div>
              )}
            </div>
          )}

          {state === 'error' && (
            <div className="flex flex-col items-center space-y-4">
              <div className="bg-red-100 rounded-full p-4">
                <XCircle className="h-12 w-12 text-red-600" />
              </div>
              <h1 className="text-xl font-bold text-red-700">Error</h1>
              <p className="text-sm text-gray-600 text-center">{errorMsg}</p>
            </div>
          )}

          <div className="pt-4 border-t text-center">
            <Link href={`/eventos/${eventId}/vendedor`} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
              Ver evento completo →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
