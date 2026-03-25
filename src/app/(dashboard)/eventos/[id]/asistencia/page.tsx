'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Camera, Search, Users, CheckCircle, XCircle,
  User, Mail, Phone, Building2, CreditCard, Tag, FileText, MapPin,
  Award, ScanLine, X, ChevronUp, UserCheck, AlertTriangle,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { InvitationDownloadButton } from '@/components/events/InvitationPDF';
import { useAuth } from '@/contexts/AuthContext';
import {
  getEvent, getEventParticipants, updateParticipant, getActiveUsers,
  type Event, type EventParticipant,
} from '@/lib/services/events';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

export default function EventAssistancePage() {
  const params = useParams();
  const { userProfile } = useAuth();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'scanner' | 'list'>('scanner');
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedParticipant, setSelectedParticipant] = useState<EventParticipant | null>(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [scanResult, setScanResult] = useState<'success' | 'already' | 'not_found' | null>(null);
  const scannerRef = useRef<any>(null);
  const scannerContainerId = 'qr-reader';

  useEffect(() => { loadData(); }, [eventId, userProfile]);

  const loadData = async () => {
    if (!userProfile) return;
    setLoading(true);
    try {
      const [ev, parts, usrs] = await Promise.all([
        getEvent(eventId),
        getEventParticipants(eventId),
        getActiveUsers().catch(() => []),
      ]);
      setEvent(ev);
      setParticipants(parts);
      setUsers(usrs);
    } catch (e) { console.error(e); toast.error('Error cargando evento'); }
    finally { setLoading(false); }
  };

  const getUserName = (id: string) => users.find(u => u.id === id)?.nombre_completo || 'Desconocido';

  const getCatColor = (catName: string | null) => {
    if (!catName || !event) return null;
    const cat = (event.categorias_participantes || []).find((c: any) => c.nombre === catName);
    return cat?.color || null;
  };

  const attendedCount = participants.filter(p => p.asistencia).length;

  const startScanner = useCallback(async () => {
    setScanResult(null);
    setSelectedParticipant(null);
    setScannerActive(true);

    await new Promise(r => setTimeout(r, 100));

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const html5QrCode = new Html5Qrcode(scannerContainerId);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          handleScanResult(decodedText);
          html5QrCode.stop().catch(() => {});
          setScannerActive(false);
        },
        () => {}
      );
    } catch (err) {
      console.error('Scanner error:', err);
      toast.error('No se pudo acceder a la cámara');
      setScannerActive(false);
    }
  }, [participants]);

  const stopScanner = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setScannerActive(false);
  }, []);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleScanResult = (decodedText: string) => {
    const match = decodedText.match(/\/eventos\/[^/]+\/checkin\/([a-f0-9-]+)/i);
    if (!match) {
      toast.error('QR no válido');
      setScanResult('not_found');
      return;
    }
    const participantId = match[1];
    const found = participants.find(p => p.id === participantId);
    if (!found) {
      toast.error('Participante no encontrado');
      setScanResult('not_found');
      return;
    }

    setSelectedParticipant(found);
    if (found.asistencia) {
      setScanResult('already');
      try { navigator.vibrate?.(200); } catch {}
    } else {
      setScanResult('success');
      try { navigator.vibrate?.([100, 50, 100]); } catch {}
    }
  };

  const toggleAttendance = async (p: EventParticipant) => {
    try {
      const newVal = !p.asistencia;
      await updateParticipant(p.id, { asistencia: newVal });
      const updated = participants.map(x => x.id === p.id ? { ...x, asistencia: newVal } : x);
      setParticipants(updated);
      if (selectedParticipant?.id === p.id) {
        setSelectedParticipant({ ...p, asistencia: newVal });
      }
      toast.success(newVal ? 'Asistencia marcada' : 'Asistencia removida');
    } catch { toast.error('Error al actualizar asistencia'); }
  };

  const toggleCertificate = async (p: EventParticipant) => {
    try {
      await updateParticipant(p.id, { certificado_emitido: !p.certificado_emitido });
      const updated = participants.map(x => x.id === p.id ? { ...x, certificado_emitido: !x.certificado_emitido } : x);
      setParticipants(updated);
      if (selectedParticipant?.id === p.id) {
        setSelectedParticipant({ ...p, certificado_emitido: !p.certificado_emitido });
      }
      toast.success(p.certificado_emitido ? 'Certificado removido' : 'Certificado emitido');
    } catch { toast.error('Error'); }
  };

  const filteredParticipants = participants.filter(p => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return p.nombre.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.telefono?.includes(q) ||
      p.empresa?.toLowerCase().includes(q) ||
      p.categoria?.toLowerCase().includes(q);
  });

  if (loading || !event) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  );

  const inscStatusColor = (s: string) =>
    s === 'confirmado' ? 'bg-green-100 text-green-700' :
    s === 'cancelado' ? 'bg-red-100 text-red-700' :
    s === 'lista_espera' ? 'bg-amber-100 text-amber-700' :
    'bg-gray-100 text-gray-700';

  const payStatusColor = (s: string) =>
    s === 'pagado' ? 'bg-green-100 text-green-700' :
    s === 'parcial' ? 'bg-amber-100 text-amber-700' :
    s === 'exento' ? 'bg-blue-100 text-blue-700' :
    'bg-gray-100 text-gray-700';

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/eventos">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>Eventos</Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">{event.nombre}</h1>
          <p className="text-xs text-gray-500">
            {format(new Date(event.fecha_inicio), "d MMM yyyy", { locale: es })}
            {event.ubicacion && ` • ${event.ubicacion}`}
          </p>
        </div>
      </div>

      {/* Attendance counter */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-indigo-200 uppercase">Asistencia</p>
            <p className="text-3xl font-bold">{attendedCount}<span className="text-lg text-indigo-200">/{participants.length}</span></p>
          </div>
          <div className="bg-white/20 rounded-full p-3">
            <UserCheck className="h-6 w-6" />
          </div>
        </div>
        <div className="mt-2 w-full bg-white/20 rounded-full h-2">
          <div
            className="h-2 rounded-full bg-white transition-all"
            style={{ width: `${participants.length > 0 ? (attendedCount / participants.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => { setTab('scanner'); setSelectedParticipant(null); setScanResult(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === 'scanner' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600'}`}
        >
          <ScanLine className="h-4 w-4" /> Escanear
        </button>
        <button
          onClick={() => { setTab('list'); stopScanner(); setSelectedParticipant(null); setScanResult(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === 'list' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600'}`}
        >
          <Users className="h-4 w-4" /> Lista ({participants.length})
        </button>
      </div>

      {/* Scanner Tab */}
      {tab === 'scanner' && (
        <div className="space-y-4">
          {!scannerActive && !selectedParticipant && (
            <div className="text-center py-8">
              <div className="bg-indigo-50 rounded-full p-6 inline-block mb-4">
                <Camera className="h-12 w-12 text-indigo-500" />
              </div>
              <p className="text-gray-600 mb-4">Escanea el código QR del participante</p>
              <Button onClick={startScanner} className="px-8 py-3 text-base">
                <Camera className="h-5 w-5 mr-2" /> Abrir Cámara
              </Button>
            </div>
          )}

          {scannerActive && (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden border-2 border-indigo-200 bg-black">
                <div id={scannerContainerId} className="w-full" />
              </div>
              <Button variant="secondary" onClick={stopScanner} className="w-full">
                <X className="h-4 w-4 mr-1" /> Cerrar Cámara
              </Button>
            </div>
          )}

          {/* Scan Result */}
          {scanResult && !scannerActive && (
            <div className="space-y-4">
              {scanResult === 'not_found' && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
                  <XCircle className="h-10 w-10 text-red-500 mx-auto mb-2" />
                  <p className="font-semibold text-red-700">Participante no encontrado</p>
                  <p className="text-xs text-red-500 mt-1">El QR no corresponde a un participante de este evento</p>
                </div>
              )}

              {scanResult === 'already' && selectedParticipant && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
                  <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-2" />
                  <p className="font-semibold text-amber-700">Ya Registrado</p>
                  <p className="text-sm text-amber-600 mt-1">{selectedParticipant.nombre}</p>
                  {selectedParticipant.categoria && (
                    <span className="inline-block text-[10px] px-2 py-0.5 rounded-full font-medium text-white mt-2" style={{ backgroundColor: getCatColor(selectedParticipant.categoria) || '#0d9488' }}>
                      {selectedParticipant.categoria}
                    </span>
                  )}
                  {selectedParticipant.numero_asiento && (
                    <div className="mt-3 bg-white rounded-xl p-3 border border-amber-200">
                      <div className="flex items-center justify-center gap-1.5 mb-0.5">
                        <MapPin className="h-4 w-4 text-indigo-500" />
                        <span className="text-[10px] text-indigo-600 font-semibold uppercase">Ubicación</span>
                      </div>
                      <p className="text-2xl font-bold text-indigo-700 tracking-wide">{selectedParticipant.numero_asiento}</p>
                    </div>
                  )}
                </div>
              )}

              {scanResult === 'success' && selectedParticipant && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
                  <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-2" />
                  <p className="font-semibold text-green-700">Participante Encontrado</p>
                  <p className="text-sm text-green-600 mt-1">{selectedParticipant.nombre}</p>
                  {selectedParticipant.categoria && (
                    <span className="inline-block text-[10px] px-2 py-0.5 rounded-full font-medium text-white mt-2" style={{ backgroundColor: getCatColor(selectedParticipant.categoria) || '#0d9488' }}>
                      {selectedParticipant.categoria}
                    </span>
                  )}
                  {selectedParticipant.numero_asiento && (
                    <div className="mt-3 bg-white rounded-xl p-3 border border-green-200">
                      <div className="flex items-center justify-center gap-1.5 mb-0.5">
                        <MapPin className="h-4 w-4 text-indigo-500" />
                        <span className="text-[10px] text-indigo-600 font-semibold uppercase">Ubicación</span>
                      </div>
                      <p className="text-2xl font-bold text-indigo-700 tracking-wide">{selectedParticipant.numero_asiento}</p>
                    </div>
                  )}
                </div>
              )}

              <Button onClick={startScanner} variant="secondary" className="w-full">
                <ScanLine className="h-4 w-4 mr-1" /> Escanear Otro
              </Button>
            </div>
          )}

          {/* Participant detail after scan */}
          {selectedParticipant && !scannerActive && (
            <ParticipantDetail
              participant={selectedParticipant}
              event={event}
              getCatColor={getCatColor}
              getUserName={getUserName}
              onToggleAttendance={() => toggleAttendance(selectedParticipant)}
              onToggleCertificate={() => toggleCertificate(selectedParticipant)}
              inscStatusColor={inscStatusColor}
              payStatusColor={payStatusColor}
            />
          )}
        </div>
      )}

      {/* List Tab */}
      {tab === 'list' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, email, teléfono..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Filter buttons */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSearchTerm('')}
              className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-all ${!searchTerm ? 'bg-indigo-100 text-indigo-700 font-semibold' : 'bg-gray-100 text-gray-600'}`}
            >
              Todos ({participants.length})
            </button>
            <button
              onClick={() => setSearchTerm('__attended__')}
              className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-all ${searchTerm === '__attended__' ? 'bg-green-100 text-green-700 font-semibold' : 'bg-gray-100 text-gray-600'}`}
            >
              Asistieron ({attendedCount})
            </button>
            <button
              onClick={() => setSearchTerm('__pending__')}
              className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-all ${searchTerm === '__pending__' ? 'bg-amber-100 text-amber-700 font-semibold' : 'bg-gray-100 text-gray-600'}`}
            >
              Pendientes ({participants.length - attendedCount})
            </button>
          </div>

          <div className="space-y-2">
            {(searchTerm === '__attended__'
              ? participants.filter(p => p.asistencia)
              : searchTerm === '__pending__'
              ? participants.filter(p => !p.asistencia)
              : filteredParticipants
            ).map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedParticipant(p)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  selectedParticipant?.id === p.id
                    ? 'border-indigo-300 bg-indigo-50 ring-1 ring-indigo-200'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                    p.asistencia ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {p.asistencia ? <CheckCircle className="h-5 w-5" /> : p.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">{p.nombre}</p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      {p.numero_asiento && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
                          Asiento {p.numero_asiento}
                        </span>
                      )}
                      {p.categoria && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium text-white" style={{ backgroundColor: getCatColor(p.categoria) || '#0d9488' }}>
                          {p.categoria}
                        </span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${inscStatusColor(p.estado_inscripcion)}`}>
                        {p.estado_inscripcion.replace('_', ' ')}
                      </span>
                      {p.empresa && <span className="text-[10px] text-gray-400">{p.empresa}</span>}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {p.asistencia ? (
                      <span className="text-[10px] font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">Presente</span>
                    ) : (
                      <span className="text-[10px] font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-full">Pendiente</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
            {filteredParticipants.length === 0 && searchTerm && searchTerm !== '__attended__' && searchTerm !== '__pending__' && (
              <p className="text-center py-8 text-gray-500 text-sm">No se encontraron participantes</p>
            )}
          </div>

          {/* Participant detail */}
          {selectedParticipant && (
            <div className="mt-4">
              <ParticipantDetail
                participant={selectedParticipant}
                event={event}
                getCatColor={getCatColor}
                getUserName={getUserName}
                onToggleAttendance={() => toggleAttendance(selectedParticipant)}
                onToggleCertificate={() => toggleCertificate(selectedParticipant)}
                inscStatusColor={inscStatusColor}
                payStatusColor={payStatusColor}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ParticipantDetail({
  participant: p,
  event,
  getCatColor,
  getUserName,
  onToggleAttendance,
  onToggleCertificate,
  inscStatusColor,
  payStatusColor,
}: {
  participant: EventParticipant;
  event: Event;
  getCatColor: (cat: string | null) => string | null;
  getUserName: (id: string) => string;
  onToggleAttendance: () => void;
  onToggleCertificate: () => void;
  inscStatusColor: (s: string) => string;
  payStatusColor: (s: string) => string;
}) {
  return (
    <Card className="border-2 border-indigo-100">
      <div className="space-y-4">
        {/* Name and category */}
        <div className="text-center pb-3 border-b">
          <p className="text-xl font-bold text-gray-900">{p.nombre}</p>
          <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
            {p.categoria && (
              <span className="text-xs px-3 py-1 rounded-full font-semibold text-white" style={{ backgroundColor: getCatColor(p.categoria) || '#0d9488' }}>
                {p.categoria}
              </span>
            )}
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${inscStatusColor(p.estado_inscripcion)}`}>
              {p.estado_inscripcion.replace('_', ' ')}
            </span>
          </div>
        </div>

        {p.numero_asiento ? (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <MapPin className="h-4 w-4 text-indigo-600" />
              <span className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wide">Ubicación asignada</span>
            </div>
            <p className="text-3xl font-bold text-indigo-700 tracking-wide">{p.numero_asiento}</p>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-400">Sin asiento asignado</p>
          </div>
        )}

        {/* Main action: Attendance */}
        <button
          onClick={onToggleAttendance}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
            p.asistencia
              ? 'bg-green-500 text-white hover:bg-green-600 active:bg-green-700'
              : 'bg-indigo-500 text-white hover:bg-indigo-600 active:bg-indigo-700'
          }`}
        >
          {p.asistencia ? (
            <><CheckCircle className="h-6 w-6" /> Asistencia Confirmada</>
          ) : (
            <><UserCheck className="h-6 w-6" /> Marcar Asistencia</>
          )}
        </button>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-3">
          {p.email && (
            <div className="flex items-start gap-2 bg-gray-50 rounded-xl p-3">
              <Mail className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 uppercase font-semibold">Email</p>
                <p className="text-xs text-gray-700 truncate">{p.email}</p>
              </div>
            </div>
          )}
          {p.telefono && (
            <div className="flex items-start gap-2 bg-gray-50 rounded-xl p-3">
              <Phone className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 uppercase font-semibold">Teléfono</p>
                <p className="text-xs text-gray-700">{p.telefono}</p>
              </div>
            </div>
          )}
          {p.empresa && (
            <div className="flex items-start gap-2 bg-gray-50 rounded-xl p-3">
              <Building2 className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 uppercase font-semibold">Empresa</p>
                <p className="text-xs text-gray-700">{p.empresa}</p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-2 bg-gray-50 rounded-xl p-3">
            <CreditCard className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-gray-400 uppercase font-semibold">Pago</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${payStatusColor(p.estado_pago)}`}>
                {p.estado_pago} — ${Number(p.monto_pagado).toLocaleString()}
              </span>
            </div>
          </div>
          {p.cupos_adicionales > 0 && (
            <div className="flex items-start gap-2 bg-gray-50 rounded-xl p-3">
              <Users className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 uppercase font-semibold">Cupos Adicionales</p>
                <p className="text-xs text-gray-700 font-semibold">{p.cupos_adicionales}</p>
              </div>
            </div>
          )}
          {p.registered_by && (
            <div className="flex items-start gap-2 bg-gray-50 rounded-xl p-3">
              <User className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 uppercase font-semibold">Registrado por</p>
                <p className="text-xs text-gray-700">{getUserName(p.registered_by)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        {p.notas && (
          <div className="bg-amber-50 rounded-xl p-3">
            <p className="text-[10px] text-amber-600 uppercase font-semibold mb-1">Notas</p>
            <p className="text-xs text-gray-700">{p.notas}</p>
          </div>
        )}

        {/* Certificate */}
        <button
          onClick={onToggleCertificate}
          className={`w-full py-2.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 border ${
            p.certificado_emitido
              ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
              : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
          }`}
        >
          <Award className="h-4 w-4" />
          {p.certificado_emitido ? 'Certificado Emitido' : 'Emitir Certificado'}
        </button>

        {/* Download invitation */}
        <InvitationDownloadButton
          participant={p}
          event={event}
          getCatColor={getCatColor}
          baseUrl={typeof window !== 'undefined' ? window.location.origin : ''}
          className="w-full py-2.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 border bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
        >
          <FileText className="h-4 w-4" /> Descargar Invitación PDF
        </InvitationDownloadButton>
      </div>
    </Card>
  );
}
