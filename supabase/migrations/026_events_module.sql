-- =====================================================
-- MIGRACIÓN 026: Módulo de Gestión de Eventos / Cursos
-- =====================================================
-- Sistema completo de planificación, ejecución y cierre de eventos
-- con control financiero, actividades, Gantt, proveedores y KPIs

-- =====================================================
-- ENUMS
-- =====================================================
DO $$ BEGIN
  CREATE TYPE event_type AS ENUM ('curso', 'taller', 'conferencia', 'evento_corporativo', 'seminario', 'otro');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE event_modality AS ENUM ('presencial', 'virtual', 'hibrido');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE event_status AS ENUM ('planeado', 'en_ejecucion', 'finalizado', 'cancelado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE expense_status AS ENUM ('cotizado', 'aprobado', 'pagado', 'cancelado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE event_activity_status AS ENUM ('pendiente', 'en_progreso', 'bloqueada', 'completada', 'cancelada');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE event_activity_type AS ENUM ('operativa', 'estrategica');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE inscription_status AS ENUM ('pre_inscrito', 'confirmado', 'cancelado', 'lista_espera');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pendiente', 'parcial', 'pagado', 'reembolsado', 'exento');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- =====================================================
-- 1. TABLA: events (Eventos)
-- =====================================================
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(500) NOT NULL,
  descripcion TEXT,
  tipo event_type NOT NULL DEFAULT 'curso',
  modalidad event_modality NOT NULL DEFAULT 'presencial',
  estado event_status NOT NULL DEFAULT 'planeado',
  fecha_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
  fecha_fin TIMESTAMP WITH TIME ZONE,
  ubicacion VARCHAR(500),
  plataforma VARCHAR(500),
  objetivo TEXT,
  
  -- Responsable general
  responsable_id UUID NOT NULL,
  
  -- Presupuesto
  presupuesto_total DECIMAL(12,2) DEFAULT 0,
  margen_objetivo DECIMAL(5,2) DEFAULT 0,
  
  -- Costeo por persona
  costo_fijo_total DECIMAL(12,2) DEFAULT 0,
  costo_variable_por_persona DECIMAL(12,2) DEFAULT 0,
  cupo_minimo INTEGER DEFAULT 0,
  cupo_maximo INTEGER DEFAULT 0,
  precio_por_persona DECIMAL(12,2) DEFAULT 0,
  
  -- Cierre
  informe_final TEXT,
  lecciones_aprendidas TEXT,
  recomendaciones TEXT,
  satisfaccion_promedio DECIMAL(3,2),
  
  -- Auditoría
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. TABLA: event_expenses (Gastos del evento)
-- =====================================================
CREATE TABLE IF NOT EXISTS event_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  categoria VARCHAR(200) NOT NULL,
  descripcion TEXT,
  proveedor VARCHAR(500),
  monto DECIMAL(12,2) NOT NULL DEFAULT 0,
  fecha DATE,
  estado expense_status NOT NULL DEFAULT 'cotizado',
  comprobante VARCHAR(50),
  comprobante_url VARCHAR(1000),
  notas TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. TABLA: event_providers (Proveedores)
-- =====================================================
CREATE TABLE IF NOT EXISTS event_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(500) NOT NULL,
  tipo_servicio VARCHAR(200),
  contacto_nombre VARCHAR(300),
  contacto_email VARCHAR(300),
  contacto_telefono VARCHAR(100),
  direccion TEXT,
  notas TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. TABLA: event_activities (Actividades del evento)
-- =====================================================
CREATE TABLE IF NOT EXISTS event_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  nombre VARCHAR(500) NOT NULL,
  descripcion TEXT,
  tipo event_activity_type NOT NULL DEFAULT 'operativa',
  responsable_id UUID NOT NULL,
  fecha_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
  fecha_fin TIMESTAMP WITH TIME ZONE,
  dependencia_id UUID REFERENCES event_activities(id) ON DELETE SET NULL,
  prioridad VARCHAR(20) NOT NULL DEFAULT 'media' CHECK (prioridad IN ('alta', 'media', 'baja')),
  estado event_activity_status NOT NULL DEFAULT 'pendiente',
  porcentaje_avance INTEGER DEFAULT 0 CHECK (porcentaje_avance >= 0 AND porcentaje_avance <= 100),
  es_hito BOOLEAN DEFAULT FALSE,
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 5. TABLA: event_participants (Participantes/Inscripciones)
-- =====================================================
CREATE TABLE IF NOT EXISTS event_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  nombre VARCHAR(500) NOT NULL,
  email VARCHAR(300),
  telefono VARCHAR(100),
  empresa VARCHAR(300),
  estado_inscripcion inscription_status NOT NULL DEFAULT 'pre_inscrito',
  estado_pago payment_status NOT NULL DEFAULT 'pendiente',
  monto_pagado DECIMAL(12,2) DEFAULT 0,
  asistencia BOOLEAN DEFAULT FALSE,
  certificado_emitido BOOLEAN DEFAULT FALSE,
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- ÍNDICES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_events_estado ON events(estado);
CREATE INDEX IF NOT EXISTS idx_events_responsable ON events(responsable_id);
CREATE INDEX IF NOT EXISTS idx_events_fecha ON events(fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_event_expenses_event ON event_expenses(event_id);
CREATE INDEX IF NOT EXISTS idx_event_activities_event ON event_activities(event_id);
CREATE INDEX IF NOT EXISTS idx_event_activities_responsable ON event_activities(responsable_id);
CREATE INDEX IF NOT EXISTS idx_event_activities_estado ON event_activities(estado);
CREATE INDEX IF NOT EXISTS idx_event_participants_event ON event_participants(event_id);

-- =====================================================
-- DESHABILITAR RLS (consistente con el proyecto)
-- =====================================================
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE event_expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE event_providers DISABLE ROW LEVEL SECURITY;
ALTER TABLE event_activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE event_participants DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- COMENTARIOS
-- =====================================================
COMMENT ON TABLE events IS 'Eventos/cursos del CRM con control financiero y operativo';
COMMENT ON TABLE event_expenses IS 'Gastos asociados a un evento con categorías y estados';
COMMENT ON TABLE event_providers IS 'Proveedores de servicios para eventos';
COMMENT ON TABLE event_activities IS 'Actividades operativas y estratégicas de un evento (base para Gantt)';
COMMENT ON TABLE event_participants IS 'Inscripciones y asistentes a eventos';
