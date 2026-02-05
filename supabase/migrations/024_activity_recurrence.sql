-- =====================================================
-- MIGRACIÓN 024: Campos de Recurrencia para Actividades
-- =====================================================
-- Agrega soporte para actividades recurrentes estilo Google Calendar

-- Agregar tipo ENUM para recurrencia (si no existe)
DO $$ BEGIN
    CREATE TYPE recurrence_type AS ENUM ('none', 'daily', 'weekly', 'biweekly', 'monthly', 'yearly', 'weekdays');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Agregar campos de recurrencia a la tabla activities
ALTER TABLE activities
ADD COLUMN IF NOT EXISTS recurrencia recurrence_type DEFAULT 'none',
ADD COLUMN IF NOT EXISTS recurrencia_fin TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS recurrencia_parent_id UUID REFERENCES activities(id) ON DELETE SET NULL;

-- Índice para buscar actividades recurrentes
CREATE INDEX IF NOT EXISTS idx_activities_recurrencia ON activities(recurrencia) WHERE recurrencia != 'none';

-- Índice para buscar actividades hijas de una recurrente
CREATE INDEX IF NOT EXISTS idx_activities_recurrencia_parent ON activities(recurrencia_parent_id) WHERE recurrencia_parent_id IS NOT NULL;

COMMENT ON COLUMN activities.recurrencia IS 'Tipo de recurrencia: none, daily, weekly, biweekly, monthly, yearly, weekdays';
COMMENT ON COLUMN activities.recurrencia_fin IS 'Fecha hasta la cual se repite la actividad (opcional)';
COMMENT ON COLUMN activities.recurrencia_parent_id IS 'ID de la actividad padre si es una instancia de una actividad recurrente';
