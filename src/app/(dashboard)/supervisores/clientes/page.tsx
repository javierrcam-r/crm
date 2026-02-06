'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import {
  Users,
  Search,
  Upload,
  Download,
  CheckCircle,
  X,
  FileSpreadsheet,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { useAuth } from '@/contexts/AuthContext';
import {
  getAllCustomersForSupervisor,
  getCustomerVendorAssignments,
  assignVendorsToCustomer,
  reassignCustomerOwner,
  getVendors,
  bulkCreateCustomers,
} from '@/lib/services/customers';
import type { Customer, CustomerInsert } from '@/types/database';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

interface VendorOption {
  id: string;
  user_id: string;
  nombre_completo: string;
  email: string;
  rol: string;
}

interface AssignmentMap {
  [customerId: string]: string[]; // customer_id -> vendor profile ids
}

export default function SupervisorClientesPage() {
  const { userProfile } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [assignments, setAssignments] = useState<AssignmentMap>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVendor, setFilterVendor] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [editingOwnerId, setEditingOwnerId] = useState<string>('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const canView = userProfile?.rol === 'admin' || userProfile?.rol === 'supervisor' || userProfile?.rol === 'supervisor_nivel1' || userProfile?.rol === 'supervisor_vendedor';

  useEffect(() => {
    if (canView) loadData();
  }, [canView]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [customersData, vendorsData, assignmentsData] = await Promise.all([
        getAllCustomersForSupervisor(),
        getVendors(),
        getCustomerVendorAssignments(),
      ]);

      setCustomers(customersData);
      setVendors(vendorsData);

      // Build assignments map
      const map: AssignmentMap = {};
      assignmentsData.forEach((a: any) => {
        if (!map[a.customer_id]) map[a.customer_id] = [];
        map[a.customer_id].push(a.vendor_user_id);
      });
      setAssignments(map);
    } catch (error) {
      console.error('Error cargando datos:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  // Get vendor name by user_id (for the owner column)
  const getVendorByUserId = (userId: string) => {
    return vendors.find(v => v.user_id === userId || v.id === userId);
  };

  const getVendorById = (id: string) => {
    return vendors.find(v => v.id === id);
  };

  // Toggle vendor assignment
  const toggleVendor = (customerId: string, vendorId: string) => {
    setAssignments(prev => {
      const current = prev[customerId] || [];
      const newAssignments = current.includes(vendorId)
        ? current.filter(id => id !== vendorId)
        : [...current, vendorId];
      return { ...prev, [customerId]: newAssignments };
    });
  };

  const saveAssignment = async (customerId: string) => {
    setSavingId(customerId);
    try {
      // Guardar asignaciones de vendedores
      await assignVendorsToCustomer(customerId, assignments[customerId] || []);
      
      // Reasignar dueño si cambió
      const customer = customers.find(c => c.id === customerId);
      if (customer && editingOwnerId && editingOwnerId !== customer.user_id) {
        await reassignCustomerOwner(customerId, editingOwnerId);
      }
      
      toast.success('Cliente actualizado correctamente');
      setEditingCustomerId(null);
      loadData(); // Recargar para ver los cambios de dueño
    } catch (error: any) {
      console.error('Error guardando:', error);
      toast.error(error?.message || 'Error al guardar cambios');
    } finally {
      setSavingId(null);
    }
  };

  // Excel import
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (jsonData.length === 0) {
          toast.error('El archivo está vacío');
          return;
        }

        setImportData(jsonData);
        setImportErrors([]);
        setShowImportModal(true);
      } catch (err) {
        console.error('Error leyendo archivo:', err);
        toast.error('Error al leer el archivo Excel');
      }
    };
    reader.readAsBinaryString(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processImport = async () => {
    setImportLoading(true);
    const errors: string[] = [];
    const validCustomers: CustomerInsert[] = [];

    importData.forEach((row, index) => {
      const nombre = (row['nombre'] || row['Nombre'] || row['NOMBRE'] || row['Cliente'] || row['cliente'] || '').toString().trim();
      if (!nombre) {
        errors.push(`Fila ${index + 2}: Nombre vacío, se omitió`);
        return;
      }

      validCustomers.push({
        nombre,
        telefono: (row['telefono'] || row['Teléfono'] || row['Telefono'] || row['TELEFONO'] || row['tel'] || '').toString().trim() || null,
        email: (row['email'] || row['Email'] || row['EMAIL'] || row['correo'] || row['Correo'] || '').toString().trim() || null,
        direccion: (row['direccion'] || row['Dirección'] || row['Direccion'] || row['DIRECCION'] || '').toString().trim() || null,
        zona: (row['zona'] || row['Zona'] || row['ZONA'] || '').toString().trim() || null,
        ciudad: (row['ciudad'] || row['Ciudad'] || row['CIUDAD'] || '').toString().trim() || null,
        tipo: ((row['tipo'] || row['Tipo'] || row['TIPO'] || '').toString().trim().toLowerCase() === 'prospecto' ? 'prospecto' : 'cliente') as any,
        notas: (row['notas'] || row['Notas'] || row['NOTAS'] || row['observaciones'] || row['Observaciones'] || '').toString().trim() || null,
        etiquetas: [],
      });
    });

    if (validCustomers.length === 0) {
      toast.error('No se encontraron clientes válidos para importar');
      setImportErrors(errors);
      setImportLoading(false);
      return;
    }

    try {
      // Import in batches of 50
      const batchSize = 50;
      let imported = 0;
      for (let i = 0; i < validCustomers.length; i += batchSize) {
        const batch = validCustomers.slice(i, i + batchSize);
        await bulkCreateCustomers(batch);
        imported += batch.length;
      }

      toast.success(`${imported} clientes importados exitosamente`);
      setImportErrors(errors);
      if (errors.length === 0) {
        setShowImportModal(false);
        setImportData([]);
      }
      loadData();
    } catch (error: any) {
      console.error('Error importando:', error);
      toast.error(error?.message || 'Error al importar clientes');
    } finally {
      setImportLoading(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      { nombre: 'Juan Pérez', telefono: '5551234567', email: 'juan@email.com', direccion: 'Calle 1 #100', zona: 'Norte', ciudad: 'CDMX', tipo: 'cliente', notas: 'Cliente VIP' },
      { nombre: 'María López', telefono: '5559876543', email: 'maria@email.com', direccion: 'Av. Principal #200', zona: 'Sur', ciudad: 'Guadalajara', tipo: 'prospecto', notas: '' },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
    XLSX.writeFile(wb, 'plantilla_clientes.xlsx');
  };

  // Cities list from customers
  const cities = useMemo(() => {
    const citySet = new Set<string>();
    customers.forEach(c => { if (c.ciudad) citySet.add(c.ciudad); });
    return Array.from(citySet).sort();
  }, [customers]);

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchesSearch = !searchTerm ||
        c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.telefono?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.ciudad?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.zona?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesVendor = !filterVendor || 
        c.user_id === filterVendor ||
        (assignments[c.id] || []).some(vid => {
          const v = getVendorById(vid);
          return v?.user_id === filterVendor || v?.id === filterVendor;
        });

      const matchesCity = !filterCity || c.ciudad === filterCity;

      return matchesSearch && matchesVendor && matchesCity;
    });
  }, [customers, searchTerm, filterVendor, filterCity, assignments, vendors]);

  if (!canView) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md text-center p-8">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Acceso Denegado</h2>
          <p className="text-gray-600">Solo supervisores y administradores pueden ver esta página.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-7 w-7 text-indigo-600" />
            Gestión de Clientes
          </h1>
          <p className="text-gray-500 mt-1">
            Asigna clientes a vendedores e importa desde Excel
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Plantilla Excel
          </Button>
          <Button onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Importar Excel
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-blue-50 border border-blue-200">
          <div className="p-4">
            <p className="text-sm font-medium text-blue-600">Total Clientes</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{customers.length}</p>
          </div>
        </Card>
        <Card className="bg-green-50 border border-green-200">
          <div className="p-4">
            <p className="text-sm font-medium text-green-600">Con Asignación</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {customers.filter(c => (assignments[c.id] || []).length > 0).length}
            </p>
          </div>
        </Card>
        <Card className="bg-amber-50 border border-amber-200">
          <div className="p-4">
            <p className="text-sm font-medium text-amber-600">Sin Asignación Extra</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {customers.filter(c => (assignments[c.id] || []).length === 0).length}
            </p>
          </div>
        </Card>
        <Card className="bg-purple-50 border border-purple-200">
          <div className="p-4">
            <p className="text-sm font-medium text-purple-600">Vendedores</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{vendors.length}</p>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, teléfono, email, ciudad..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={filterVendor}
              onChange={e => setFilterVendor(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            >
              <option value="">Todos los vendedores</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.nombre_completo}</option>
              ))}
            </select>
            <select
              value={filterCity}
              onChange={e => setFilterCity(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            >
              <option value="">Todas las ciudades</option>
              {cities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>
          <Badge variant="blue">{filteredCustomers.length} clientes</Badge>
        </div>
      </Card>

      {/* Customers Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Cliente</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Contacto</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Ciudad / Zona</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Dueño</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Vendedores Asignados</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 w-24">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-500">
                      No se encontraron clientes
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map(customer => {
                    const ownerVendor = getVendorByUserId(customer.user_id);
                    const extraAssignedIds = assignments[customer.id] || [];
                    // El dueño siempre está asignado por defecto + los extras
                    const ownerProfileId = ownerVendor?.id;
                    const allAssignedIds = ownerProfileId 
                      ? [ownerProfileId, ...extraAssignedIds.filter(id => id !== ownerProfileId)]
                      : extraAssignedIds;
                    const isEditing = editingCustomerId === customer.id;
                    const isExpanded = expandedRow === customer.id;

                    return (
                      <tr
                        key={customer.id}
                        className={`hover:bg-gray-50 transition-colors ${isEditing ? 'bg-indigo-50/50' : ''}`}
                      >
                        {/* Cliente */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="font-medium text-gray-900">{customer.nombre}</p>
                              <p className="text-xs text-gray-500 md:hidden">
                                {customer.telefono || customer.email || '—'}
                              </p>
                            </div>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                              customer.tipo === 'cliente' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {customer.tipo}
                            </span>
                          </div>
                        </td>

                        {/* Contacto */}
                        <td className="px-4 py-3 hidden md:table-cell">
                          <p className="text-gray-700">{customer.telefono || '—'}</p>
                          <p className="text-xs text-gray-500">{customer.email || ''}</p>
                        </td>

                        {/* Ciudad / Zona */}
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <p className="text-gray-700">{customer.ciudad || '—'}</p>
                          <p className="text-xs text-gray-500">{customer.zona || ''}</p>
                        </td>

                        {/* Dueño */}
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <select
                              value={editingOwnerId}
                              onChange={e => setEditingOwnerId(e.target.value)}
                              className="text-xs px-2 py-1.5 border border-indigo-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full max-w-[160px]"
                            >
                              <option value="">Sin asignar</option>
                              {vendors.map(v => (
                                <option key={v.id} value={v.user_id}>{v.nombre_completo}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                              {ownerVendor?.nombre_completo || 'Sin asignar'}
                            </span>
                          )}
                        </td>

                        {/* Vendedores asignados */}
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-1.5 max-w-xs">
                                {vendors.map(v => {
                                  const isOwner = v.id === ownerProfileId;
                                  const isAssigned = extraAssignedIds.includes(v.id);
                                  return (
                                    <button
                                      key={v.id}
                                      onClick={() => { if (!isOwner) toggleVendor(customer.id, v.id); }}
                                      disabled={isOwner}
                                      className={`text-xs px-2 py-1 rounded-full border transition-all ${
                                        isOwner
                                          ? 'bg-indigo-200 text-indigo-800 border-indigo-400 font-semibold cursor-default'
                                          : isAssigned
                                          ? 'bg-indigo-100 text-indigo-700 border-indigo-300 font-medium'
                                          : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                                      }`}
                                      title={isOwner ? 'Dueño (siempre asignado)' : ''}
                                    >
                                      {(isOwner || isAssigned) && <CheckCircle className="h-3 w-3 inline mr-1" />}
                                      {v.nombre_completo}
                                      {isOwner && ' (dueño)'}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {allAssignedIds.length === 0 ? (
                                <span className="text-xs text-gray-400">Sin asignaciones</span>
                              ) : (
                                <>
                                  {allAssignedIds.slice(0, isExpanded ? undefined : 3).map(vid => {
                                    const v = getVendorById(vid);
                                    const isOwner = vid === ownerProfileId;
                                    return (
                                      <span key={vid} className={`text-xs px-2 py-0.5 rounded-full ${
                                        isOwner 
                                          ? 'bg-indigo-100 text-indigo-700 font-medium' 
                                          : 'bg-green-100 text-green-700'
                                      }`}>
                                        {v?.nombre_completo || 'Desconocido'}
                                      </span>
                                    );
                                  })}
                                  {allAssignedIds.length > 3 && !isExpanded && (
                                    <button
                                      onClick={() => setExpandedRow(customer.id)}
                                      className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    >
                                      +{allAssignedIds.length - 3} más
                                    </button>
                                  )}
                                  {isExpanded && allAssignedIds.length > 3 && (
                                    <button
                                      onClick={() => setExpandedRow(null)}
                                      className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    >
                                      Ver menos
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Acción */}
                        <td className="px-4 py-3 text-center">
                          {isEditing ? (
                            <div className="flex gap-1 justify-center">
                              <Button
                                size="sm"
                                onClick={() => saveAssignment(customer.id)}
                                loading={savingId === customer.id}
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setEditingCustomerId(null);
                                  loadData(); // Reset assignments
                                }}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setEditingCustomerId(customer.id);
                                setEditingOwnerId(customer.user_id);
                              }}
                            >
                              Asignar
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Import Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => { setShowImportModal(false); setImportData([]); setImportErrors([]); }}
        title="Importar Clientes desde Excel"
        size="lg"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-800">
                  {importData.length} registros encontrados
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Columnas detectadas: {importData.length > 0 ? Object.keys(importData[0]).join(', ') : 'ninguna'}
                </p>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="max-h-64 overflow-auto border rounded-xl">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">#</th>
                  {importData.length > 0 && Object.keys(importData[0]).map(key => (
                    <th key={key} className="px-3 py-2 text-left font-semibold text-gray-600">{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {importData.slice(0, 10).map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="px-3 py-2 text-gray-700 max-w-[150px] truncate">
                        {String(val)}
                      </td>
                    ))}
                  </tr>
                ))}
                {importData.length > 10 && (
                  <tr>
                    <td colSpan={Object.keys(importData[0] || {}).length + 1} className="px-3 py-2 text-center text-gray-500">
                      ... y {importData.length - 10} registros más
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Errors */}
          {importErrors.length > 0 && (
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
              <h4 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" />
                Advertencias ({importErrors.length})
              </h4>
              <div className="max-h-32 overflow-auto space-y-1">
                {importErrors.map((err, i) => (
                  <p key={i} className="text-xs text-amber-700">{err}</p>
                ))}
              </div>
            </div>
          )}

          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Columnas reconocidas</h4>
            <p className="text-xs text-gray-600">
              <strong>nombre</strong> (obligatorio), telefono, email, direccion, zona, ciudad, tipo (cliente/prospecto), notas
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => { setShowImportModal(false); setImportData([]); }}>
              Cancelar
            </Button>
            <Button onClick={processImport} loading={importLoading}>
              <Upload className="h-4 w-4 mr-2" />
              Importar {importData.length} clientes
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
