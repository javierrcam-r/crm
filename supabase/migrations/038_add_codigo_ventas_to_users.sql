-- Agrega campos de cruce con la base de ventas (sistema contable)
ALTER TABLE users_profile
ADD COLUMN IF NOT EXISTS codigo_ventas INTEGER,
ADD COLUMN IF NOT EXISTS codempleado VARCHAR(10);

-- Tabla de resumen mensual de ventas (sincronizada desde base ventas)
CREATE TABLE IF NOT EXISTS ventas_resumen_mensual (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  anio INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  codigo_vendedor INTEGER NOT NULL,
  num_ventas INTEGER DEFAULT 0,
  total_ventas DECIMAL(14,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(anio, mes, codigo_vendedor)
);

ALTER TABLE ventas_resumen_mensual DISABLE ROW LEVEL SECURITY;
