CREATE TABLE IF NOT EXISTS ventas_cliente_mensual (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    anio INTEGER NOT NULL,
    mes INTEGER NOT NULL,
    codigo_cliente INTEGER NOT NULL,
    codigo_vendedor INTEGER NOT NULL,
    num_ventas INTEGER DEFAULT 0,
    total_ventas DECIMAL(14,2) DEFAULT 0,
    total_sin_iva DECIMAL(14,2) DEFAULT 0,
    total_iva DECIMAL(14,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT ventas_cliente_mensual_unique UNIQUE(anio, mes, codigo_cliente, codigo_vendedor)
);

CREATE INDEX IF NOT EXISTS idx_vcm_cliente ON ventas_cliente_mensual(codigo_cliente);
CREATE INDEX IF NOT EXISTS idx_vcm_vendedor ON ventas_cliente_mensual(codigo_vendedor);
CREATE INDEX IF NOT EXISTS idx_vcm_anio_mes ON ventas_cliente_mensual(anio, mes);
