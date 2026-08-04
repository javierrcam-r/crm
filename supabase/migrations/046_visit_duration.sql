-- Duración de las visitas (en minutos) para poder mostrarlas y "estirarlas" en la rejilla horaria.
ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS duracion_minutos INTEGER NOT NULL DEFAULT 60;

-- La duración debe ser de al menos 15 minutos (paso de snap del calendario).
ALTER TABLE visits
  DROP CONSTRAINT IF EXISTS visits_duracion_minutos_check;
ALTER TABLE visits
  ADD CONSTRAINT visits_duracion_minutos_check CHECK (duracion_minutos >= 15);
