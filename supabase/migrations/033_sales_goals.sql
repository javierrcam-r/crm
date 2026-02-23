-- Migración: Metas de ventas por marca y vendedor
-- Los supervisores pueden asignar metas mensuales a cada vendedor por marca

-- Tabla de marcas (si no existe)
CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(100) NOT NULL UNIQUE,
  orden INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de metas de ventas
CREATE TABLE IF NOT EXISTS sales_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id UUID NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  anio INTEGER NOT NULL,
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  meta_cantidad INTEGER DEFAULT 0,
  meta_valor DECIMAL(12,2) DEFAULT 0,
  created_by UUID REFERENCES users_profile(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_profile_id, brand_id, anio, mes)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_sales_goals_user ON sales_goals(user_profile_id);
CREATE INDEX IF NOT EXISTS idx_sales_goals_period ON sales_goals(anio, mes);
CREATE INDEX IF NOT EXISTS idx_sales_goals_brand ON sales_goals(brand_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_sales_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sales_goals_updated_at ON sales_goals;
CREATE TRIGGER trigger_sales_goals_updated_at
  BEFORE UPDATE ON sales_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_goals_updated_at();

-- Comentarios
COMMENT ON TABLE brands IS 'Marcas de productos para metas de ventas';
COMMENT ON TABLE sales_goals IS 'Metas de ventas mensuales por vendedor y marca';
COMMENT ON COLUMN sales_goals.meta_cantidad IS 'Meta en cantidad de unidades';
COMMENT ON COLUMN sales_goals.meta_valor IS 'Meta en valor monetario';

-- Habilitar RLS
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_goals ENABLE ROW LEVEL SECURITY;

-- Políticas para brands (todos pueden leer, supervisores pueden modificar)
DROP POLICY IF EXISTS "brands_select_all" ON brands;
CREATE POLICY "brands_select_all" ON brands FOR SELECT USING (true);

DROP POLICY IF EXISTS "brands_insert_supervisors" ON brands;
CREATE POLICY "brands_insert_supervisors" ON brands FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "brands_update_supervisors" ON brands;
CREATE POLICY "brands_update_supervisors" ON brands FOR UPDATE USING (true);

DROP POLICY IF EXISTS "brands_delete_supervisors" ON brands;
CREATE POLICY "brands_delete_supervisors" ON brands FOR DELETE USING (true);

-- Políticas para sales_goals (todos pueden leer, supervisores pueden modificar)
DROP POLICY IF EXISTS "sales_goals_select_all" ON sales_goals;
CREATE POLICY "sales_goals_select_all" ON sales_goals FOR SELECT USING (true);

DROP POLICY IF EXISTS "sales_goals_insert_supervisors" ON sales_goals;
CREATE POLICY "sales_goals_insert_supervisors" ON sales_goals FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "sales_goals_update_supervisors" ON sales_goals;
CREATE POLICY "sales_goals_update_supervisors" ON sales_goals FOR UPDATE USING (true);

DROP POLICY IF EXISTS "sales_goals_delete_supervisors" ON sales_goals;
CREATE POLICY "sales_goals_delete_supervisors" ON sales_goals FOR DELETE USING (true);
