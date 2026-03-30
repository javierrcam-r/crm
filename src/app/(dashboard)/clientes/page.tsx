'use client';

import { useEffect, useState } from 'react';
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
import type { CustomerType, FunnelStage } from '@/types/database';

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
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState<string>('');
  const [filterCiudad, setFilterCiudad] = useState<string>('');
  const [cities, setCities] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

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
      </Card>

      {/* Customer List */}
      {customers.length === 0 ? (
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
