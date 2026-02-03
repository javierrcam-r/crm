-- Agregar campo de recordatorio a activities
ALTER TABLE activities ADD COLUMN IF NOT EXISTS recordatorio_minutos INTEGER DEFAULT NULL;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS recordatorio_enviado BOOLEAN DEFAULT FALSE;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS correo_enviado BOOLEAN DEFAULT FALSE;

-- Comentarios
COMMENT ON COLUMN activities.recordatorio_minutos IS 'Minutos antes del evento para enviar recordatorio (5, 10, 15, 30, 60, 1440=1día, 10080=1semana)';
COMMENT ON COLUMN activities.recordatorio_enviado IS 'Indica si ya se envió la notificación del recordatorio';
COMMENT ON COLUMN activities.correo_enviado IS 'Indica si ya se envió el correo a los participantes';

-- Índice para búsqueda de recordatorios pendientes
CREATE INDEX IF NOT EXISTS idx_activities_recordatorio 
ON activities(fecha_inicio, recordatorio_minutos, recordatorio_enviado) 
WHERE recordatorio_minutos IS NOT NULL AND recordatorio_enviado = FALSE;
