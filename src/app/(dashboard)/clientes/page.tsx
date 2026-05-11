'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Filter,
  Users,
  Phone,
  Mail,
  MapPin,
  Building,
  UserPlus,
  UserX,
  IdCard,
  Sparkles,
  Loader2,
  Info,
  X,
  TrendingUp,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import VoiceSearch from '@/components/ui/VoiceSearch';
import {
  getCustomers,
  getCities,
  type Customer,
} from '@/lib/services/customers';
import { cn } from '@/lib/utils';
import { searchCustomers } from '@/lib/search';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import type { CustomerType, FunnelStage } from '@/types/database';

interface SmartResult {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  ciudad: string | null;
  zona: string | null;
  etiquetas: string[];
  categoria_compra: string | null;
  reasons: string[];
  score: number;
  matchType: 'etiqueta' | 'gestion' | 'mixto';
}

// Helper para obtener el estado simplificado
const getEstadoCliente = (customer: Customer) => {
  if (customer.etapa_embudo === 'perdido') {
    return { label: 'Perdido', variant: 'red' as const, icon: UserX };
  }
  if (customer.tipo === 'cliente' || customer.etapa_embudo === 'ganado') {
    return { label: 'Cliente', variant: 'green' as const, icon: Building };
  }
  return { label: 'Prospecto', variant: 'blue' as const, icon: UserPlus };
};

export default function ClientesPage() {
  const { userProfile } = useAuth();
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState<string>('');
  const [filterCiudad, setFilterCiudad] = useState<string>('');
  const [cities, setCities] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const [smartQuery, setSmartQuery] = useState('');
  const [smartResults, setSmartResults] = useState<SmartResult[]>([]);
  const [smartLoading, setSmartLoading] = useState(false);
  const [smartActive, setSmartActive] = useState(false);
  const [smartTotal, setSmartTotal] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [customersData, citiesData] = await Promise.all([
        getCustomers(),
        getCities(),
      ]);
      setAllCustomers(customersData);
      setCities(citiesData);
    } catch (error) {
      console.error('Error cargando clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  const runSmartFilter = async () => {
    if (!smartQuery.trim() || !userProfile) return;
    setSmartLoading(true);
    try {
      const res = await fetch('/api/smart-filter-clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userProfile.user_id || userProfile.id,
          query: smartQuery.trim(),
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSmartResults(data.results || []);
      setSmartTotal(data.total || 0);
      setSmartActive(true);
      if ((data.results || []).length === 0) {
        toast('No se encontraron clientes que coincidan con esa búsqueda', { icon: '🔍' });
      }
    } catch (err: any) {
      toast.error(err.message || 'Error en búsqueda inteligente');
    } finally {
      setSmartLoading(false);
    }
  };

  const clearSmartFilter = () => {
    setSmartActive(false);
    setSmartResults([]);
    setSmartQuery('');
    setSmartTotal(0);
  };

  const customers = (() => {
    let list = allCustomers;

    if (filterEstado === 'cliente') {
      list = list.filter(c => c.tipo === 'cliente' || c.etapa_embudo === 'ganado');
    } else if (filterEstado === 'prospecto') {
      list = list.filter(c => c.etapa_embudo !== 'perdido' && c.tipo === 'prospecto');
    } else if (filterEstado === 'perdido') {
      list = list.filter(c => c.etapa_embudo === 'perdido');
    }

    if (filterCiudad) {
      list = list.filter(c => c.ciudad === filterCiudad);
    }

    if (search.trim()) {
      list = searchCustomers(list, search);
    }

    return list;
  })();

  const clearFilters = () => {
    setSearch('');
    setFilterEstado('');
    setFilterCiudad('');
    clearSmartFilter();
  };

  const estadoOptions = [
    { value: 'cliente', label: 'Clientes' },
    { value: 'prospecto', label: 'Prospectos' },
    { value: 'perdido', label: 'Perdidos' },
  ];

  const ciudadOptions = cities.map((c) => ({ value: c, label: c }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-300">Cargando clientes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white">Clientes</h1>
          <p className="text-gray-500 dark:text-gray-300 text-sm md:text-base mt-1">
            Gestiona tu cartera de clientes
          </p>
        </div>
        <Link href="/clientes/nuevo" className="w-full md:w-auto">
          <Button icon={<Plus className="h-4 w-4" />} className="w-full md:w-auto">
            Nuevo Cliente
          </Button>
        </Link>
      </div>

      {/* Search and Filters */}
      <Card padding="sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1">
              <Input
                placeholder="Buscar por nombre, teléfono o email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<Search className="h-4 w-4" />}
              />
            </div>
            <VoiceSearch onResult={(text) => setSearch(text)} />
          </div>
          <Button
            variant="secondary"
            onClick={() => setShowFilters(!showFilters)}
            icon={<Filter className="h-4 w-4" />}
          >
            Filtros
          </Button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-dark-500">
            <Select
              options={estadoOptions}
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              placeholder="Todos los estados"
            />
            <Select
              options={ciudadOptions}
              value={filterCiudad}
              onChange={(e) => setFilterCiudad(e.target.value)}
              placeholder="Todas las ciudades"
            />
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          </div>
        )}

        {/* Smart AI Filter */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-500">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Búsqueda Inteligente</span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">Busca en etiquetas, notas, resultados de visitas...</span>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="text"
                value={smartQuery}
                onChange={(e) => setSmartQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSmartFilter()}
                placeholder="Ej: alisado, keratina, premium, mayorista..."
                className="w-full px-3 py-2 text-sm rounded-xl border border-violet-200 dark:border-violet-500/30 bg-violet-50/50 dark:bg-violet-900/10 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={runSmartFilter}
              disabled={smartLoading || !smartQuery.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white text-sm font-medium hover:from-violet-600 hover:to-indigo-700 transition-all disabled:opacity-50 shadow-sm"
            >
              {smartLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar
            </button>
            {smartActive && (
              <button
                onClick={clearSmartFilter}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-dark-500 text-gray-500 dark:text-gray-400 text-sm hover:bg-gray-50 dark:hover:bg-dark-600 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Smart Filter Results */}
      {smartActive && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {smartTotal} cliente{smartTotal !== 1 ? 's' : ''} encontrado{smartTotal !== 1 ? 's' : ''}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">para &ldquo;{smartQuery}&rdquo;</span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">Etiqueta</span>
              <span className="px-2 py-0.5 rounded bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-500/30">Etiqueta + Gestión</span>
              <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">Gestión</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {smartResults.map((result, idx) => (
              <SmartResultCard key={result.id} result={result} rank={idx + 1} />
            ))}
          </div>
        </div>
      )}

      {/* Customer List (hidden when smart filter active) */}
      {smartActive ? null : customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No hay clientes"
          description="Comienza agregando tu primer cliente o prospecto"
          action={{
            label: 'Nuevo Cliente',
            onClick: () => (window.location.href = '/clientes/nuevo'),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((customer, index) => {
            const estadoInfo = getEstadoCliente(customer);
            const IconoEstado = estadoInfo.icon;
            
            return (
              <Link key={customer.id} href={`/clientes/${customer.id}`}>
                <Card
                  hover
                  className={cn(
                    'h-full animate-fade-in cursor-pointer',
                    `stagger-${(index % 5) + 1}`
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'p-2 rounded-lg',
                          estadoInfo.variant === 'green' ? 'bg-emerald-50 dark:bg-emerald-900/30' : 
                          estadoInfo.variant === 'red' ? 'bg-red-50 dark:bg-red-900/30' : 'bg-blue-50 dark:bg-blue-900/30'
                        )}
                      >
                        <IconoEstado className={cn(
                          'h-5 w-5',
                          estadoInfo.variant === 'green' ? 'text-emerald-600 dark:text-emerald-400' : 
                          estadoInfo.variant === 'red' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                        )} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{customer.nombre}</h3>
                        <Badge variant={estadoInfo.variant}>
                          {estadoInfo.label}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    {customer.telefono && (
                      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-300">
                        <Phone className="h-4 w-4" />
                        <span>{customer.telefono}</span>
                      </div>
                    )}
                    {customer.email && (
                      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-300">
                        <Mail className="h-4 w-4" />
                        <span className="truncate">{customer.email}</span>
                      </div>
                    )}
                    {(customer.ciudad || customer.zona) && (
                      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-300">
                        <MapPin className="h-4 w-4" />
                        <span>
                          {[customer.zona, customer.ciudad].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>

                  {customer.num_identificacion && (
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-300">
                      <IdCard className="h-4 w-4" />
                      <span className="font-mono text-xs">{customer.num_identificacion}</span>
                      {customer.tipo_identificacion && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-dark-600 text-gray-500 dark:text-gray-400 font-medium">
                          {customer.tipo_identificacion === 'R' ? 'RUC' : customer.tipo_identificacion === 'C' ? 'CI' : customer.tipo_identificacion}
                        </span>
                      )}
                    </div>
                  )}

                  {customer.etiquetas && customer.etiquetas.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-dark-500">
                      <span className="text-xs text-gray-400 dark:text-gray-300">
                        {customer.etiquetas.slice(0, 3).join(', ')}
                        {customer.etiquetas.length > 3 && ` +${customer.etiquetas.length - 3} más`}
                      </span>
                    </div>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

const MATCH_TYPE_CFG = {
  etiqueta: { label: 'Etiqueta', bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-500/30' },
  mixto: { label: 'Etiqueta + Gestión', bg: 'bg-violet-50 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-500/30' },
  gestion: { label: 'Gestión', bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-500/30' },
};

function SmartResultCard({ result, rank }: { result: SmartResult; rank: number }) {
  const [showReasons, setShowReasons] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const mt = MATCH_TYPE_CFG[result.matchType];

  useEffect(() => {
    if (!showReasons) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowReasons(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [showReasons]);

  const tagReasons = result.reasons.filter(r => r.startsWith('🏷️') || r.startsWith('📦'));
  const visitReasons = result.reasons.filter(r => r.startsWith('✅') || r.startsWith('👁️') || r.startsWith('🎯'));
  const otherReasons = result.reasons.filter(r => r.startsWith('📝'));

  return (
    <div className="relative rounded-xl border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-700 p-4 hover:shadow-md transition-all">
      {/* Rank badge */}
      <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center shadow">
        {rank}
      </div>

      {/* Header: name + match type + info */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <Link href={`/clientes/${result.id}`}>
            <h3 className="font-semibold text-gray-900 dark:text-white hover:text-violet-600 dark:hover:text-violet-400 transition-colors truncate">
              {result.nombre}
            </h3>
          </Link>
          <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${mt.bg} ${mt.text} ${mt.border}`}>
            {mt.label}
          </span>
        </div>
        <div ref={ref} className="relative">
          <button
            onClick={() => setShowReasons(!showReasons)}
            className="p-2 rounded-full bg-violet-50 dark:bg-violet-900/30 text-violet-500 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-800/40 active:bg-violet-200 transition-colors"
            aria-label="¿Por qué aparece?"
          >
            <Info className="h-5 w-5" />
          </button>
          {showReasons && (
            <div className="absolute top-full right-0 mt-2 z-50 w-80 sm:w-96 animate-in fade-in-0 zoom-in-95">
              <div className="bg-gray-900 dark:bg-dark-800 text-white text-xs rounded-xl px-4 py-3.5 shadow-xl border border-gray-700 dark:border-dark-500 max-h-[60vh] overflow-y-auto">
                <p className="font-semibold text-violet-400 mb-3 flex items-center gap-1.5 text-sm">
                  <TrendingUp className="h-4 w-4" />
                  ¿Por qué aparece?
                </p>

                {tagReasons.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider mb-1.5">Etiquetas</p>
                    <ul className="space-y-1.5">
                      {tagReasons.map((r, i) => (
                        <li key={i} className="text-gray-200 leading-relaxed text-[13px]">{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {visitReasons.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] uppercase font-bold text-blue-400 tracking-wider mb-1.5">Gestión / Visitas</p>
                    <ul className="space-y-1.5">
                      {visitReasons.map((r, i) => (
                        <li key={i} className="text-gray-200 leading-relaxed text-[13px]">{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {otherReasons.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase font-bold text-amber-400 tracking-wider mb-1.5">Otros</p>
                    <ul className="space-y-1.5">
                      {otherReasons.map((r, i) => (
                        <li key={i} className="text-gray-200 leading-relaxed text-[13px]">{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reasons preview (show up to 3) */}
      <div className="space-y-1 mb-2.5">
        {result.reasons.slice(0, 3).map((r, i) => (
          <div key={i} className={`rounded-lg px-2.5 py-1.5 ${
            r.startsWith('🏷️') || r.startsWith('📦')
              ? 'bg-emerald-50 dark:bg-emerald-900/15'
              : r.startsWith('✅') || r.startsWith('👁️') || r.startsWith('🎯')
                ? 'bg-blue-50 dark:bg-blue-900/15'
                : 'bg-gray-50 dark:bg-dark-600'
          }`}>
            <p className={`text-[11px] font-medium leading-relaxed line-clamp-2 ${
              r.startsWith('🏷️') || r.startsWith('📦')
                ? 'text-emerald-700 dark:text-emerald-300'
                : r.startsWith('✅') || r.startsWith('👁️') || r.startsWith('🎯')
                  ? 'text-blue-700 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-300'
            }`}>
              {r}
            </p>
          </div>
        ))}
        {result.reasons.length > 3 && (
          <button onClick={() => setShowReasons(true)} className="text-[10px] text-violet-500 hover:text-violet-700 dark:hover:text-violet-300 font-medium pl-1">
            +{result.reasons.length - 3} razón{result.reasons.length - 3 > 1 ? 'es' : ''} más...
          </button>
        )}
      </div>

      {/* Details */}
      <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
        {result.ciudad && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3" />
            <span>{[result.zona, result.ciudad].filter(Boolean).join(', ')}</span>
          </div>
        )}
        {result.telefono && (
          <div className="flex items-center gap-1.5">
            <Phone className="h-3 w-3" />
            <span>{result.telefono}</span>
          </div>
        )}
      </div>

      {/* Tags */}
      {result.etiquetas.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-gray-100 dark:border-dark-500">
          {result.etiquetas.slice(0, 5).map((t) => (
            <span key={t} className="px-1.5 py-0.5 rounded text-[10px] bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/30">
              {t}
            </span>
          ))}
          {result.etiquetas.length > 5 && (
            <span className="text-[10px] text-gray-400">+{result.etiquetas.length - 5}</span>
          )}
        </div>
      )}
    </div>
  );
}
