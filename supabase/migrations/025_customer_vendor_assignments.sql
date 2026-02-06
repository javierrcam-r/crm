-- =====================================================
-- MIGRACIÓN 025: Asignación de Clientes a Vendedores
-- =====================================================
-- Permite que supervisores asignen clientes a múltiples vendedores

-- Tabla de asignaciones cliente-vendedor
CREATE TABLE IF NOT EXISTS customer_vendor_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  vendor_user_id UUID NOT NULL, -- user_id del vendedor (referencia a users_profile.id)
  assigned_by UUID, -- user_id del supervisor que hizo la asignación
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(customer_id, vendor_user_id)
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_cva_customer ON customer_vendor_assignments(customer_id);
CREATE INDEX IF NOT EXISTS idx_cva_vendor ON customer_vendor_assignments(vendor_user_id);

-- Desactivar RLS para desarrollo (consistente con el resto del proyecto)
ALTER TABLE customer_vendor_assignments DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE customer_vendor_assignments IS 'Asignaciones de clientes a vendedores - permite que un cliente sea visible para múltiples vendedores';
COMMENT ON COLUMN customer_vendor_assignments.vendor_user_id IS 'ID del perfil del vendedor (users_profile.id)';
COMMENT ON COLUMN customer_vendor_assignments.assigned_by IS 'ID del supervisor que realizó la asignación';
