-- =====================================================
-- Días no laborables / Bloqueo de calendario
-- =====================================================
-- Los supervisores y admin pueden marcar días (feriados, no laborables)
-- en los que no se puede programar visitas ni actividades.
-- =====================================================

-- Tabla: días bloqueados (por fecha, sin hora)
CREATE TABLE IF NOT EXISTS calendar_blocked_days (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fecha DATE NOT NULL UNIQUE,
  motivo TEXT,
  created_by_user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_blocked_days_fecha ON calendar_blocked_days(fecha);

COMMENT ON TABLE calendar_blocked_days IS 'Días no laborables: feriados, etc. No se puede programar visitas ni actividades en estas fechas.';

-- Función: es supervisor o admin (para RLS)
CREATE OR REPLACE FUNCTION is_supervisor_or_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT EXISTS (
      SELECT 1 FROM users_profile
      WHERE user_id = user_uuid AND activo = TRUE
      AND rol IN ('admin', 'supervisor', 'supervisor_nivel1', 'supervisor_vendedor')
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS
ALTER TABLE calendar_blocked_days ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden ver los días bloqueados (para validar al programar)
CREATE POLICY "Authenticated can view blocked days"
  ON calendar_blocked_days FOR SELECT
  TO authenticated
  USING (true);

-- Solo supervisores y admin pueden insertar/actualizar/eliminar
CREATE POLICY "Supervisors can insert blocked days"
  ON calendar_blocked_days FOR INSERT
  TO authenticated
  WITH CHECK (is_supervisor_or_admin(auth.uid()));

CREATE POLICY "Supervisors can update blocked days"
  ON calendar_blocked_days FOR UPDATE
  TO authenticated
  USING (is_supervisor_or_admin(auth.uid()))
  WITH CHECK (is_supervisor_or_admin(auth.uid()));

CREATE POLICY "Supervisors can delete blocked days"
  ON calendar_blocked_days FOR DELETE
  TO authenticated
  USING (is_supervisor_or_admin(auth.uid()));
