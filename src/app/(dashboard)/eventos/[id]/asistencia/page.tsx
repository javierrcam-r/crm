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
import SeatMapView from '@/components/events/SeatMapView';
import { useAuth } from '@/contexts/AuthContext';
import { fuzzySearch } from '@/lib/search';
import VoiceSearch from '@/components/ui/VoiceSearch';
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
  const [manualSearch, setManualSearch] = useState('');
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

  const getParticipantSearchText = (p: EventParticipant) => [
    p.nombre,
    p.email,
    p.telefono,
    p.empresa,
    p.categoria,
    p.estado_inscripcion,
    p.estado_inscripcion.replace('_', ' '),
    p.estado_pago,
    p.numero_asiento,
    p.numero_asiento ? `asiento ${p.numero_asiento}` : 'sin asiento',
    String(p.monto_pagado),
    Number(p.monto_pagado).toLocaleString(),
    String(p.cupos_adicionales),
    p.cupos_adicionales > 0 ? `${p.cupos_adicionales} cupos adicionales` : 'sin cupos adicionales',
    p.asistencia ? 'asistio presente asistencia confirmada' : 'pendiente sin asistencia',
    p.certificado_emitido ? 'certificado emitido' : 'certificado pendiente',
    p.registered_by ? getUserName(p.registered_by) : null,
    p.notas,
  ].filter(Boolean).join(' ');

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

  const handleManualCheckin = (p: EventParticipant) => {
    setManualSearch('');
    setSelectedParticipant(p);
    if (p.asistencia) {
      setScanResult('already');
      try { navigator.vibrate?.(200); } catch {}
    } else {
      setScanResult('success');
      try { navigator.vibrate?.([100, 50, 100]); } catch {}
    }
  };

  const manualResults = (() => {
    const q = manualSearch.trim();
    if (q.length === 0) return [];
    const norm = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return participants.filter(p => {
      const text = `${p.nombre} ${p.email || ''} ${p.telefono || ''} ${p.empresa || ''} ${p.categoria || ''}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (text.includes(norm)) return true;
      return fuzzySearch(q, text) > 0;
    }).slice(0, 15);
  })();

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

  const filteredParticipants = (() => {
    if (!searchTerm.trim()) return participants;
    return participants.filter(p => fuzzySearch(searchTerm, getParticipantSearchText(p)) > 0);
  })();

  if (loading || !event) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  );

  const inscStatusColor = (s: string) =>
    s === 'confirmado' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
    s === 'cancelado' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
    s === 'lista_espera' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
    'bg-gray-100 dark:bg-dark-600 text-gray-700 dark:text-gray-300';

  const payStatusColor = (s: string) =>
    s === 'pagado' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
    s === 'parcial' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
    s === 'exento' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
    'bg-gray-100 dark:bg-dark-600 text-gray-700 dark:text-gray-300';

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/eventos">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>Eventos</Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate">{event.nombre}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
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
      <div className="flex gap-1 bg-gray-100 dark:bg-dark-700 rounded-xl p-1">
        <button
          onClick={() => { setTab('scanner'); setSelectedParticipant(null); setScanResult(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === 'scanner' ? 'bg-white dark:bg-dark-600 text-indigo-700 dark:text-indigo-400 shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}
        >
          <ScanLine className="h-4 w-4" /> Escanear
        </button>
        <button
          onClick={() => { setTab('list'); stopScanner(); setSelectedParticipant(null); setScanResult(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === 'list' ? 'bg-white dark:bg-dark-600 text-indigo-700 dark:text-indigo-400 shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}
        >
          <Users className="h-4 w-4" /> Lista ({participants.length})
        </button>
      </div>

      {/* Scanner Tab */}
      {tab === 'scanner' && (
        <div className="space-y-4">
          {!scannerActive && !selectedParticipant && (
            <div className="space-y-4">
              <div className="text-center py-6">
                <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-full p-6 inline-block mb-4">
                  <Camera className="h-12 w-12 text-indigo-500 dark:text-indigo-400" />
                </div>
                <p className="text-gray-600 dark:text-gray-300 mb-4">Escanea el código QR del participante</p>
                <Button onClick={startScanner} className="px-8 py-3 text-base">
                  <Camera className="h-5 w-5 mr-2" /> Abrir Cámara
                </Button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200 dark:bg-dark-600" />
                <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium">o buscar por nombre</span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-dark-600" />
              </div>

              {/* Manual search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                <input
                  type="search"
                  inputMode="search"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder="Escribe el nombre del participante..."
                  value={manualSearch}
                  onChange={e => setManualSearch(e.target.value)}
                  className="w-full pl-10 pr-9 py-2.5 border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-700 text-gray-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
                {manualSearch && (
                  <button
                    type="button"
                    onClick={() => setManualSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {manualResults.length > 0 && (
                <div className="space-y-1.5">
                  {manualResults.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleManualCheckin(p)}
                      className="w-full text-left p-3 rounded-xl border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-all flex items-center gap-3"
                    >
                      <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                        p.asistencia ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-dark-600 text-gray-400 dark:text-gray-500'
                      }`}>
                        {p.asistencia ? <CheckCircle className="h-4 w-4" /> : p.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{p.nombre}</p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                          {[p.empresa, p.categoria, p.numero_asiento ? `Asiento ${p.numero_asiento}` : null].filter(Boolean).join(' · ') || p.email || ''}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        {p.asistencia ? (
                          <span className="text-[10px] font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-full">Presente</span>
                        ) : (
                          <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-full">Check-in</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {manualSearch.trim().length >= 1 && manualResults.length === 0 && (
                <p className="text-center py-3 text-sm text-gray-400 dark:text-gray-500">No se encontró ningún participante</p>
              )}
            </div>
          )}

          {scannerActive && (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden border-2 border-indigo-200 dark:border-indigo-800 bg-black">
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
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 text-center">
                  <XCircle className="h-10 w-10 text-red-500 mx-auto mb-2" />
                  <p className="font-semibold text-red-700 dark:text-red-400">Participante no encontrado</p>
                  <p className="text-xs text-red-500 dark:text-red-400/70 mt-1">El QR no corresponde a un participante de este evento</p>
                </div>
              )}

              {scanResult === 'already' && selectedParticipant && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-3 text-center">
                  <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-1" />
                  <p className="font-semibold text-amber-700 dark:text-amber-400">Ya Registrado</p>
                  <p className="text-sm text-amber-600 dark:text-amber-300">{selectedParticipant.nombre}</p>
                </div>
              )}

              {scanResult === 'success' && selectedParticipant && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-3 text-center">
                  <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-1" />
                  <p className="font-semibold text-green-700 dark:text-green-400">Check-in Exitoso</p>
                  <p className="text-sm text-green-600 dark:text-green-300">{selectedParticipant.nombre}</p>
                </div>
              )}

              <Button onClick={() => { setScanResult(null); setSelectedParticipant(null); setManualSearch(''); }} variant="secondary" className="w-full">
                <ScanLine className="h-4 w-4 mr-1" /> Buscar Otro
              </Button>
            </div>
          )}

          {/* Participant detail after scan */}
          {selectedParticipant && !scannerActive && (
            <ParticipantDetail
              participant={selectedParticipant}
              event={event}
              participants={participants}
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
          {/* Show checkin result + detail when a participant is selected */}
          {selectedParticipant ? (
            <div className="space-y-4">
              {scanResult === 'already' && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-3 text-center">
                  <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-1" />
                  <p className="font-semibold text-amber-700 dark:text-amber-400">Ya Registrado</p>
                  <p className="text-sm text-amber-600 dark:text-amber-300">{selectedParticipant.nombre}</p>
                </div>
              )}
              {scanResult === 'success' && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-3 text-center">
                  <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-1" />
                  <p className="font-semibold text-green-700 dark:text-green-400">Check-in Exitoso</p>
                  <p className="text-sm text-green-600 dark:text-green-300">{selectedParticipant.nombre}</p>
                </div>
              )}

              <ParticipantDetail
                participant={selectedParticipant}
                event={event}
                participants={participants}
                getCatColor={getCatColor}
                getUserName={getUserName}
                onToggleAttendance={() => toggleAttendance(selectedParticipant)}
                onToggleCertificate={() => toggleCertificate(selectedParticipant)}
                inscStatusColor={inscStatusColor}
                payStatusColor={payStatusColor}
              />

              <Button
                onClick={() => { setSelectedParticipant(null); setScanResult(null); }}
                variant="secondary"
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> Volver a la lista
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                  <input
                    type="search"
                    inputMode="search"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    placeholder="Buscar por nombre, email, asiento..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-9 py-2.5 border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-700 text-gray-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  />
                  {searchTerm && searchTerm !== '__attended__' && searchTerm !== '__pending__' && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <VoiceSearch onResult={(text) => setSearchTerm(text)} />
              </div>

              {/* Filter buttons */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setSearchTerm('')}
                  className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-all ${!searchTerm ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 font-semibold' : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-400'}`}
                >
                  Todos ({participants.length})
                </button>
                <button
                  onClick={() => setSearchTerm('__attended__')}
                  className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-all ${searchTerm === '__attended__' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 font-semibold' : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-400'}`}
                >
                  Asistieron ({attendedCount})
                </button>
                <button
                  onClick={() => setSearchTerm('__pending__')}
                  className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-all ${searchTerm === '__pending__' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-semibold' : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-400'}`}
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
                    onClick={() => handleManualCheckin(p)}
                    className="w-full text-left p-3 rounded-xl border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                        p.asistencia ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-dark-600 text-gray-400 dark:text-gray-500'
                      }`}>
                        {p.asistencia ? <CheckCircle className="h-5 w-5" /> : p.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{p.nombre}</p>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          {p.numero_asiento && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 font-semibold">
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
                          {p.empresa && <span className="text-[10px] text-gray-400 dark:text-gray-500">{p.empresa}</span>}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {p.asistencia ? (
                          <span className="text-[10px] font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-full">Presente</span>
                        ) : (
                          <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-full">Check-in</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
                {filteredParticipants.length === 0 && searchTerm && searchTerm !== '__attended__' && searchTerm !== '__pending__' && (
                  <p className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">No se encontraron participantes</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ParticipantDetail({
  participant: p,
  event,
  participants,
  getCatColor,
  getUserName,
  onToggleAttendance,
  onToggleCertificate,
  inscStatusColor,
  payStatusColor,
}: {
  participant: EventParticipant;
  event: Event;
  participants: EventParticipant[];
  getCatColor: (cat: string | null) => string | null;
  getUserName: (id: string) => string;
  onToggleAttendance: () => void;
  onToggleCertificate: () => void;
  inscStatusColor: (s: string) => string;
  payStatusColor: (s: string) => string;
}) {
  return (
    <Card className="border-2 border-indigo-100 dark:border-indigo-900/50">
      <div className="space-y-4">
        {/* Name and category */}
        <div className="text-center pb-3 border-b dark:border-dark-600">
          <p className="text-xl font-bold text-gray-900 dark:text-white">{p.nombre}</p>
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
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <MapPin className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold uppercase tracking-wide">Ubicación asignada</span>
            </div>
            <p className="text-3xl font-bold text-indigo-700 dark:text-indigo-300 tracking-wide">{p.numero_asiento}</p>
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-400 dark:text-gray-500">Sin asiento asignado</p>
          </div>
        )}

        {p.numero_asiento && (
          <SeatMapView event={event} highlightSeatId={p.numero_asiento} participants={participants} />
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
            <div className="flex items-start gap-2 bg-gray-50 dark:bg-dark-700 rounded-xl p-3">
              <Mail className="h-4 w-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-semibold">Email</p>
                <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{p.email}</p>
              </div>
            </div>
          )}
          {p.telefono && (
            <div className="flex items-start gap-2 bg-gray-50 dark:bg-dark-700 rounded-xl p-3">
              <Phone className="h-4 w-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-semibold">Teléfono</p>
                <p className="text-xs text-gray-700 dark:text-gray-300">{p.telefono}</p>
              </div>
            </div>
          )}
          {p.empresa && (
            <div className="flex items-start gap-2 bg-gray-50 dark:bg-dark-700 rounded-xl p-3">
              <Building2 className="h-4 w-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-semibold">Empresa</p>
                <p className="text-xs text-gray-700 dark:text-gray-300">{p.empresa}</p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-2 bg-gray-50 dark:bg-dark-700 rounded-xl p-3">
            <CreditCard className="h-4 w-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-semibold">Pago</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${payStatusColor(p.estado_pago)}`}>
                {p.estado_pago} — ${Number(p.monto_pagado).toLocaleString()}
              </span>
            </div>
          </div>
          {p.cupos_adicionales > 0 && (
            <div className="flex items-start gap-2 bg-gray-50 dark:bg-dark-700 rounded-xl p-3">
              <Users className="h-4 w-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-semibold">Cupos Adicionales</p>
                <p className="text-xs text-gray-700 dark:text-gray-300 font-semibold">{p.cupos_adicionales}</p>
              </div>
            </div>
          )}
          {p.registered_by && (
            <div className="flex items-start gap-2 bg-gray-50 dark:bg-dark-700 rounded-xl p-3">
              <User className="h-4 w-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-semibold">Registrado por</p>
                <p className="text-xs text-gray-700 dark:text-gray-300">{getUserName(p.registered_by)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        {p.notas && (
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
            <p className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-semibold mb-1">Notas</p>
            <p className="text-xs text-gray-700 dark:text-gray-300">{p.notas}</p>
          </div>
        )}

        {/* Certificate */}
        <button
          onClick={onToggleCertificate}
          className={`w-full py-2.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 border ${
            p.certificado_emitido
              ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/30'
              : 'bg-gray-50 dark:bg-dark-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-dark-600 hover:bg-gray-100 dark:hover:bg-dark-600'
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
          className="w-full py-2.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 border bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
        >
          <FileText className="h-4 w-4" /> Descargar Invitación PDF
        </InvitationDownloadButton>
      </div>
    </Card>
  );
}
