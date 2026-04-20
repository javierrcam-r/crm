-- Agrega columnas de IVA y tipo de comprobante al resumen de ventas
ALTER TABLE ventas_resumen_mensual
ADD COLUMN IF NOT EXISTS total_sin_iva DECIMAL(14,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_iva DECIMAL(14,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS codcomprobante INTEGER DEFAULT 1;

-- Actualizar constraint único para incluir codcomprobante
ALTER TABLE ventas_resumen_mensual
DROP CONSTRAINT IF EXISTS ventas_resumen_mensual_anio_mes_codigo_vendedor_key;

ALTER TABLE ventas_resumen_mensual
ADD CONSTRAINT ventas_resumen_mensual_anio_mes_cod_comp_key
UNIQUE(anio, mes, codigo_vendedor, codcomprobante);
