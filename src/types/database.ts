// =====================================================
// TIPOS DE BASE DE DATOS - CRM VENDEDORA
// =====================================================

export type CustomerType = 'cliente' | 'prospecto';
export type FunnelStage = 'nuevo' | 'contactado' | 'interesado' | 'negociacion' | 'ganado' | 'perdido';
export type VisitStatus = 'programada' | 'completada' | 'cancelada' | 'no_atendio' | 'reprogramada';
export type OrderStatus = 'borrador' | 'enviado' | 'confirmado' | 'entregado' | 'cancelado';
export type FormaPago = 'contado' | 'cheque' | 'plazos_cortos' | 'plazos_medios' | 'plazos_largos';
export type CalidadPago = 'buena' | 'regular' | 'mala';
export type UserRole = 'admin' | 'vendedor' | 'supervisor' | 'supervisor_nivel1' | 'supervisor_vendedor' | 'vendedor_tecnico' | 'marketing' | 'tecnico' | 'event_assistant' | 'ruleta';
export type ThemePreference = 'light' | 'dark' | 'auto';
export type ActivityType = 'reunion' | 'tarea' | 'seguimiento' | 'capacitacion' | 'tecnico' | 'otro';
export type ActivityStatus = 'planificacion' | 'haciendo' | 'realizado' | 'cancelado';
export type ActivityPriority = 'baja' | 'media' | 'alta' | 'urgente';
export type ParticipantConfirmation = 'pendiente' | 'confirmado' | 'rechazado' | 'tentativo';
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly' | 'weekdays';
export type AgendaRecommendationStatus = 'generated' | 'accepted' | 'rejected' | 'created' | 'completed' | 'cancelled' | 'no_show' | 'reprogrammed';

// =====================================================
// CUSTOMER
// =====================================================
export interface Customer {
  id: string;
  user_id: string;
  tipo: CustomerType;
  etapa_embudo: FunnelStage;
  nombre: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  zona: string | null;
  ciudad: string | null;
  etiquetas: string[];
  notas: string | null;
  forma_pago: FormaPago | null;
  calidad_pago: CalidadPago | null;
  categoria_compra: string | null;
  latitud: number | null;
  longitud: number | null;
  codigo_cliente_ventas: number | null;
  num_identificacion: string | null;
  tipo_identificacion: string | null;
  fecha_nacimiento: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CustomerInsert {
  tipo?: CustomerType;
  etapa_embudo?: FunnelStage;
  nombre: string;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  zona?: string | null;
  ciudad?: string | null;
  etiquetas?: string[];
  notas?: string | null;
  forma_pago?: FormaPago | null;
  calidad_pago?: CalidadPago | null;
  categoria_compra?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  codigo_cliente_ventas?: number | null;
  num_identificacion?: string | null;
  tipo_identificacion?: string | null;
  fecha_nacimiento?: string | null;
}

export interface CustomerUpdate extends Partial<CustomerInsert> {}

// =====================================================
// VISIT
// =====================================================
export interface Visit {
  id: string;
  user_id: string;
  customer_id: string;
  scheduled_at: string;
  status: VisitStatus;
  objetivo: string | null;
  location_text: string | null;
  resultado: string | null;
  observaciones: string | null;
  next_action: string | null;
  next_visit_at: string | null;
  objetivo_estrategico_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Relaciones
  customer?: Customer;
  objetivo_estrategico?: Activity;
  creator?: UserProfile;
}

export interface VisitInsert {
  customer_id: string;
  scheduled_at: string;
  status?: VisitStatus;
  objetivo?: string | null;
  location_text?: string | null;
  resultado?: string | null;
  observaciones?: string | null;
  next_action?: string | null;
  next_visit_at?: string | null;
  objetivo_estrategico_id?: string | null;
}

export interface VisitUpdate extends Partial<VisitInsert> {}

// =====================================================
// AGENDA RECOMMENDATIONS
// =====================================================
export interface AgendaRecommendation {
  id: string;
  generation_id: string;
  user_id: string;
  customer_id: string;
  created_visit_id: string | null;
  recommended_date: string;
  recommended_time: string;
  status: AgendaRecommendationStatus;
  score_total: number;
  score_breakdown: Record<string, unknown>;
  features: Record<string, unknown>;
  reason: string | null;
  reasons: string[];
  feedback_reason: string | null;
  responded_at: string | null;
  outcome_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgendaRecommendationInsert {
  generation_id?: string;
  user_id: string;
  customer_id: string;
  created_visit_id?: string | null;
  recommended_date: string;
  recommended_time: string;
  status?: AgendaRecommendationStatus;
  score_total?: number;
  score_breakdown?: Record<string, unknown>;
  features?: Record<string, unknown>;
  reason?: string | null;
  reasons?: string[];
  feedback_reason?: string | null;
  responded_at?: string | null;
  outcome_at?: string | null;
}

export interface AgendaRecommendationUpdate extends Partial<Omit<AgendaRecommendationInsert, 'user_id' | 'customer_id' | 'recommended_date' | 'recommended_time'>> {}

// =====================================================
// CALENDAR BLOCKED DAYS (días no laborables)
// =====================================================
export interface CalendarBlockedDay {
  id: string;
  fecha: string; // YYYY-MM-DD
  motivo: string | null;
  created_by_user_id: string | null;
  created_at: string;
}

export interface CalendarBlockedDayInsert {
  fecha: string;
  motivo?: string | null;
  created_by_user_id?: string | null;
}

// =====================================================
// VACATION REQUESTS (vacaciones)
// =====================================================
export type VacationRequestStatus = 'pendiente' | 'aprobado' | 'rechazado';

export interface VacationRequest {
  id: string;
  user_profile_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  motivo: string | null;
  estado: VacationRequestStatus;
  aprobado_por: string | null;
  aprobado_at: string | null;
  rechazo_motivo: string | null;
  created_at: string;
  updated_at: string;
  user_profile?: Pick<UserProfile, 'id' | 'nombre_completo' | 'email' | 'rol'>;
  aprobado_por_profile?: Pick<UserProfile, 'id' | 'nombre_completo'>;
}

export interface VacationRequestInsert {
  user_profile_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  motivo?: string | null;
}

// =====================================================
// PRODUCT
// =====================================================
export interface Product {
  id: string;
  user_id: string;
  sku: string;
  nombre: string;
  categoria: string | null;
  precio: number;
  activo: boolean;
  descripcion: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ProductInsert {
  sku: string;
  nombre: string;
  categoria?: string | null;
  precio: number;
  activo?: boolean;
  descripcion?: string | null;
}

export interface ProductUpdate extends Partial<ProductInsert> {}

// =====================================================
// ORDER
// =====================================================
export interface Order {
  id: string;
  user_id: string;
  customer_id: string;
  order_date: string;
  status: OrderStatus;
  observacion_general: string | null;
  subtotal: number;
  total_bonificado: number;
  total: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Relaciones
  customer?: Customer;
  items?: OrderItem[];
}

export interface OrderInsert {
  customer_id: string;
  order_date?: string;
  status?: OrderStatus;
  observacion_general?: string | null;
}

export interface OrderUpdate extends Partial<OrderInsert> {}

// =====================================================
// ORDER ITEM
// =====================================================
export interface OrderItem {
  id: string;
  user_id: string;
  order_id: string;
  product_id: string;
  qty: number;
  unit_price: number;
  bonificado: boolean;
  motivo_bonificado: string | null;
  observacion_item: string | null;
  line_total: number;
  created_at: string;
  updated_at: string;
  // Relación
  product?: Product;
}

export interface OrderItemInsert {
  order_id: string;
  product_id: string;
  qty: number;
  unit_price: number;
  bonificado?: boolean;
  motivo_bonificado?: string | null;
  observacion_item?: string | null;
}

export interface OrderItemUpdate extends Partial<Omit<OrderItemInsert, 'order_id' | 'product_id'>> {}

// =====================================================
// TIPOS PARA QUERIES
// =====================================================
export interface CustomerWithStats extends Customer {
  total_orders?: number;
  total_visits?: number;
  last_order_date?: string | null;
  last_visit_date?: string | null;
}

export interface DailySummary {
  date: string;
  total_orders: number;
  total_amount: number;
  total_visits: number;
  completed_visits: number;
}

export interface ProductSummary {
  product_id: string;
  product_name: string;
  total_qty: number;
  total_amount: number;
}

// =====================================================
// TIPOS PARA FILTROS
// =====================================================
export interface CustomerFilters {
  tipo?: CustomerType;
  etapa_embudo?: FunnelStage;
  ciudad?: string;
  zona?: string;
  search?: string;
}

export interface VisitFilters {
  status?: VisitStatus;
  customer_id?: string;
  date_from?: string;
  date_to?: string;
}

export interface OrderFilters {
  status?: OrderStatus;
  customer_id?: string;
  date_from?: string;
  date_to?: string;
}

export interface ProductFilters {
  categoria?: string;
  activo?: boolean;
  search?: string;
}

// =====================================================
// USER PROFILE
// =====================================================
export interface UserProfile {
  id: string;
  user_id: string;
  username: string | null;
  nombre_completo: string;
  email: string;
  telefono: string | null;
  rol: UserRole;
  activo: boolean;
  password: string | null;
  password_temp: string | null;
  debe_cambiar_password: boolean;
  theme_preference: ThemePreference;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface UserProfileInsert {
  user_id: string;
  username?: string | null;
  nombre_completo: string;
  email: string;
  telefono?: string | null;
  rol?: UserRole;
  activo?: boolean;
  password?: string | null;
  password_temp?: string | null;
  debe_cambiar_password?: boolean;
  theme_preference?: ThemePreference;
  created_by?: string | null;
}

export interface UserProfileUpdate extends Partial<Omit<UserProfileInsert, 'user_id'>> {}

export interface UserFilters {
  rol?: UserRole;
  activo?: boolean;
  search?: string;
}

// =====================================================
// ACTIVITY (Actividades y Reuniones - Supervisor Nivel 1)
// =====================================================
export interface Activity {
  id: string;
  created_by_user_id: string;
  titulo: string;
  descripcion: string | null;
  tipo: ActivityType;
  estado: ActivityStatus;
  prioridad: ActivityPriority;
  fecha_inicio: string;
  fecha_fin: string | null;
  fecha_limite: string | null;
  ubicacion: string | null;
  es_virtual: boolean;
  enlace_reunion: string | null;
  notas: string | null;
  resultado: string | null;
  recordatorio_minutos: number | null;
  recordatorio_enviado: boolean;
  correo_enviado: boolean;
  recurrencia: RecurrenceType | null;
  recurrencia_fin: string | null;
  recurrencia_parent_id: string | null;
  objetivo_estrategico_id: string | null;
  created_at: string;
  updated_at: string;
  // Relaciones
  participants?: ActivityParticipant[];
  comments?: ActivityComment[];
  creator?: UserProfile;
  objetivo_estrategico?: Activity;
}

export interface ActivityInsert {
  titulo: string;
  descripcion?: string | null;
  tipo?: ActivityType;
  estado?: ActivityStatus;
  prioridad?: ActivityPriority;
  fecha_inicio: string;
  fecha_fin?: string | null;
  fecha_limite?: string | null;
  ubicacion?: string | null;
  es_virtual?: boolean;
  enlace_reunion?: string | null;
  notas?: string | null;
  recordatorio_minutos?: number | null;
  recurrencia?: RecurrenceType | null;
  recurrencia_fin?: string | null;
  objetivo_estrategico_id?: string | null;
}

export interface ActivityUpdate extends Partial<ActivityInsert> {
  resultado?: string | null;
}

export interface ActivityParticipant {
  id: string;
  activity_id: string;
  user_profile_id: string;
  estado_confirmacion: ParticipantConfirmation;
  notas: string | null;
  asistio: boolean | null;
  created_at: string;
  updated_at: string;
  // Relación
  user_profile?: UserProfile;
}

export interface ActivityParticipantInsert {
  activity_id: string;
  user_profile_id: string;
  estado_confirmacion?: ParticipantConfirmation;
  notas?: string | null;
}

export interface ActivityComment {
  id: string;
  activity_id: string;
  user_profile_id: string;
  comentario: string;
  created_at: string;
  updated_at: string;
  // Relación
  user_profile?: UserProfile;
}

export interface ActivityCommentInsert {
  activity_id: string;
  comentario: string;
}

export interface ActivityFilters {
  tipo?: ActivityType;
  estado?: ActivityStatus;
  prioridad?: ActivityPriority;
  date_from?: string;
  date_to?: string;
  participant_id?: string;
}

// =====================================================
// BRANDS (Marcas)
// =====================================================
export interface Brand {
  id: string;
  nombre: string;
  logo_url: string | null;
  orden: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface BrandInsert {
  nombre: string;
  logo_url?: string | null;
  orden?: number;
  activo?: boolean;
}

// =====================================================
// SALES GOALS (Metas de ventas)
// =====================================================
export interface SalesGoal {
  id: string;
  user_profile_id: string;
  brand_id: string;
  anio: number;
  mes: number;
  meta_cantidad: number;
  meta_valor: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Relaciones
  user_profile?: UserProfile;
  brand?: Brand;
}

export interface SalesGoalInsert {
  user_profile_id: string;
  brand_id: string;
  anio: number;
  mes: number;
  meta_cantidad?: number;
  meta_valor?: number;
}

export interface SalesGoalUpdate {
  meta_cantidad?: number;
  meta_valor?: number;
}

// =====================================================
// VENTAS RESUMEN MENSUAL (sincronizado desde base ventas)
// =====================================================
export interface VentasResumenMensual {
  id: string;
  anio: number;
  mes: number;
  codigo_vendedor: number;
  codcomprobante: number;
  num_ventas: number;
  total_ventas: number;
  total_sin_iva: number;
  total_iva: number;
  created_at: string;
  updated_at: string;
}

export interface VentasResumenConVendedor extends VentasResumenMensual {
  vendedor_nombre?: string;
  vendedor_id?: string;
}

export interface VentasClienteMensual {
  id: string;
  anio: number;
  mes: number;
  codigo_cliente: number;
  codigo_vendedor: number;
  num_ventas: number;
  total_ventas: number;
  total_sin_iva: number;
  total_iva: number;
  created_at: string;
  updated_at: string;
}

export interface VentasClienteConNombre extends VentasClienteMensual {
  cliente_nombre?: string;
  vendedor_nombre?: string;
}
