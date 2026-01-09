-- Migración: Agregar campos de pago a clientes
-- Fecha: 2026-01-09

-- Agregar campos de pago y categoría a la tabla customers
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS forma_pago TEXT CHECK (forma_pago IN ('contado', 'cheque', 'plazos_cortos', 'plazos_medios', 'plazos_largos')),
ADD COLUMN IF NOT EXISTS calidad_pago TEXT CHECK (calidad_pago IN ('buena', 'regular', 'mala')),
ADD COLUMN IF NOT EXISTS categoria_compra TEXT;

-- Comentarios para documentación
COMMENT ON COLUMN customers.forma_pago IS 'Forma de pago preferida: contado, cheque, plazos_cortos, plazos_medios, plazos_largos';
COMMENT ON COLUMN customers.calidad_pago IS 'Calidad de pago del cliente: buena, regular, mala';
COMMENT ON COLUMN customers.categoria_compra IS 'Categoría de compra principal del cliente';

