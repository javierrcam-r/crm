-- =====================================================
-- Módulo de vacaciones
-- =====================================================
-- Cada persona solicita vacaciones; supervisores y supervisor_nivel1
-- pueden aprobar/rechazar y ver todas las vacaciones en calendario.
-- =====================================================

CREATE TABLE IF NOT EXISTS vacation_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_profile_id UUID NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  motivo TEXT,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')), 
  aprobado_por UUID REFERENCES users_profile(id) ON DELETE SET NULL,
  aprobado_at TIMESTAMPTZ,
  rechazo_motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fecha_fin_mayor_o_igual CHECK (fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS idx_vacation_requests_user ON vacation_requests(user_profile_id);
CREATE INDEX IF NOT EXISTS idx_vacation_requests_estado ON vacation_requests(estado);
CREATE INDEX IF NOT EXISTS idx_vacation_requests_fechas ON vacation_requests(fecha_inicio, fecha_fin);

COMMENT ON TABLE vacation_requests IS 'Solicitudes de vacaciones. Supervisores y supervisor_nivel1 aprueban/rechazan.';

-- RLS deshabilitado (auth desde users_profile, igual que otras tablas)
ALTER TABLE vacation_requests DISABLE ROW LEVEL SECURITY;
