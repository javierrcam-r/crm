-- Migración: Vincular actividades diarias y visitas a objetivos estratégicos
-- Permite anclar opcionalmente una actividad diaria o visita a un objetivo estratégico

-- Agregar columna objetivo_estrategico_id a activities (para actividades diarias)
ALTER TABLE activities 
ADD COLUMN IF NOT EXISTS objetivo_estrategico_id UUID REFERENCES activities(id) ON DELETE SET NULL;

-- Agregar columna objetivo_estrategico_id a visits
ALTER TABLE visits 
ADD COLUMN IF NOT EXISTS objetivo_estrategico_id UUID REFERENCES activities(id) ON DELETE SET NULL;

-- Índices para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_activities_objetivo_estrategico ON activities(objetivo_estrategico_id) WHERE objetivo_estrategico_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_visits_objetivo_estrategico ON visits(objetivo_estrategico_id) WHERE objetivo_estrategico_id IS NOT NULL;

-- Comentarios
COMMENT ON COLUMN activities.objetivo_estrategico_id IS 'Referencia opcional a un objetivo estratégico (actividad tipo reunion/capacitacion/seguimiento)';
COMMENT ON COLUMN visits.objetivo_estrategico_id IS 'Referencia opcional a un objetivo estratégico al que contribuye esta visita';
