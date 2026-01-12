-- Migración: Agregar coordenadas a clientes para mapa
-- Fecha: 2026-01-11

-- Agregar campos de coordenadas a la tabla customers
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS latitud DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitud DECIMAL(11, 8);

-- Comentarios para documentación
COMMENT ON COLUMN customers.latitud IS 'Latitud de la ubicación del cliente';
COMMENT ON COLUMN customers.longitud IS 'Longitud de la ubicación del cliente';

-- Índice para búsquedas geográficas
CREATE INDEX IF NOT EXISTS idx_customers_coordinates ON customers(latitud, longitud) WHERE latitud IS NOT NULL AND longitud IS NOT NULL;
