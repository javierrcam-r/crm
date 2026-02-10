-- =====================================================
-- MIGRACIÓN 027: Configuración de visibilidad del Sidebar
-- =====================================================
-- Permite al admin ocultar/mostrar ítems del menú por rol

CREATE TABLE IF NOT EXISTS sidebar_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_key VARCHAR(100) NOT NULL,
  menu_label VARCHAR(200) NOT NULL,
  rol VARCHAR(50) NOT NULL,
  visible BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(menu_key, rol)
);

ALTER TABLE sidebar_config DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE sidebar_config IS 'Configuración de visibilidad de ítems del sidebar por rol';
