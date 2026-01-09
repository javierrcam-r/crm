-- =====================================================
-- CRM VENDEDORA - Esquema Inicial de Base de Datos
-- =====================================================
-- Este script crea todas las tablas, índices, políticas RLS
-- y funciones necesarias para el sistema CRM.
-- =====================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLA: customers (Clientes y Prospectos)
-- =====================================================
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Tipo y estado
    tipo VARCHAR(20) NOT NULL DEFAULT 'prospecto' CHECK (tipo IN ('cliente', 'prospecto')),
    etapa_embudo VARCHAR(50) DEFAULT 'nuevo' CHECK (etapa_embudo IN ('nuevo', 'contactado', 'interesado', 'negociacion', 'ganado', 'perdido')),
    
    -- Datos de contacto
    nombre VARCHAR(255) NOT NULL,
    telefono VARCHAR(50),
    email VARCHAR(255),
    direccion TEXT,
    zona VARCHAR(100),
    ciudad VARCHAR(100),
    
    -- Información adicional
    etiquetas TEXT[] DEFAULT '{}',
    notas TEXT,
    
    -- Auditoría
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- Índices para customers
CREATE INDEX idx_customers_user_id ON customers(user_id);
CREATE INDEX idx_customers_tipo ON customers(user_id, tipo);
CREATE INDEX idx_customers_etapa ON customers(user_id, etapa_embudo);
CREATE INDEX idx_customers_ciudad ON customers(user_id, ciudad);
CREATE INDEX idx_customers_zona ON customers(user_id, zona);
CREATE INDEX idx_customers_nombre ON customers(user_id, nombre);
CREATE INDEX idx_customers_deleted ON customers(deleted_at) WHERE deleted_at IS NULL;

-- =====================================================
-- TABLA: visits (Visitas/Agenda)
-- =====================================================
CREATE TABLE IF NOT EXISTS visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    
    -- Programación
    scheduled_at TIMESTAMPTZ NOT NULL,
    
    -- Estado y detalles
    status VARCHAR(30) NOT NULL DEFAULT 'programada' CHECK (status IN ('programada', 'completada', 'cancelada', 'no_atendio', 'reprogramada')),
    objetivo TEXT,
    location_text TEXT,
    
    -- Resultado (al completar)
    resultado TEXT,
    observaciones TEXT,
    
    -- Seguimiento
    next_action TEXT,
    next_visit_at TIMESTAMPTZ,
    
    -- Auditoría
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- Índices para visits
CREATE INDEX idx_visits_user_id ON visits(user_id);
CREATE INDEX idx_visits_customer_id ON visits(customer_id);
CREATE INDEX idx_visits_scheduled_at ON visits(user_id, scheduled_at);
CREATE INDEX idx_visits_status ON visits(user_id, status);
CREATE INDEX idx_visits_date_status ON visits(user_id, scheduled_at, status);
CREATE INDEX idx_visits_deleted ON visits(deleted_at) WHERE deleted_at IS NULL;

-- =====================================================
-- TABLA: products (Catálogo de Productos)
-- =====================================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Identificación
    sku VARCHAR(50) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    
    -- Clasificación
    categoria VARCHAR(100),
    
    -- Precio y estado
    precio DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (precio >= 0),
    activo BOOLEAN DEFAULT TRUE,
    
    -- Información adicional
    descripcion TEXT,
    
    -- Auditoría
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    
    -- SKU único por usuario
    UNIQUE(user_id, sku)
);

-- Índices para products
CREATE INDEX idx_products_user_id ON products(user_id);
CREATE INDEX idx_products_sku ON products(user_id, sku);
CREATE INDEX idx_products_categoria ON products(user_id, categoria);
CREATE INDEX idx_products_activo ON products(user_id, activo);
CREATE INDEX idx_products_nombre ON products(user_id, nombre);
CREATE INDEX idx_products_deleted ON products(deleted_at) WHERE deleted_at IS NULL;

-- =====================================================
-- TABLA: orders (Pedidos)
-- =====================================================
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    
    -- Fecha y estado
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador', 'enviado', 'confirmado', 'entregado', 'cancelado')),
    
    -- Información adicional
    observacion_general TEXT,
    
    -- Totales calculados (se actualizan con triggers o en aplicación)
    subtotal DECIMAL(12, 2) DEFAULT 0,
    total_bonificado DECIMAL(12, 2) DEFAULT 0,
    total DECIMAL(12, 2) DEFAULT 0,
    
    -- Auditoría
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- Índices para orders
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_date ON orders(user_id, order_date);
CREATE INDEX idx_orders_status ON orders(user_id, status);
CREATE INDEX idx_orders_date_status ON orders(user_id, order_date, status);
CREATE INDEX idx_orders_deleted ON orders(deleted_at) WHERE deleted_at IS NULL;

-- =====================================================
-- TABLA: order_items (Ítems de Pedido)
-- =====================================================
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    
    -- Cantidades y precios
    qty INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0),
    unit_price DECIMAL(12, 2) NOT NULL CHECK (unit_price >= 0),
    
    -- Bonificación
    bonificado BOOLEAN DEFAULT FALSE,
    motivo_bonificado TEXT,
    
    -- Observaciones
    observacion_item TEXT,
    
    -- Subtotal del ítem
    line_total DECIMAL(12, 2) GENERATED ALWAYS AS (
        CASE WHEN bonificado THEN 0 ELSE qty * unit_price END
    ) STORED,
    
    -- Auditoría
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para order_items
CREATE INDEX idx_order_items_user_id ON order_items(user_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- =====================================================
-- FUNCIONES Y TRIGGERS
-- =====================================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_visits_updated_at
    BEFORE UPDATE ON visits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_items_updated_at
    BEFORE UPDATE ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Función para recalcular totales del pedido
CREATE OR REPLACE FUNCTION recalculate_order_totals()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE orders
    SET 
        subtotal = COALESCE((
            SELECT SUM(qty * unit_price)
            FROM order_items
            WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
        ), 0),
        total_bonificado = COALESCE((
            SELECT SUM(CASE WHEN bonificado THEN qty * unit_price ELSE 0 END)
            FROM order_items
            WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
        ), 0),
        total = COALESCE((
            SELECT SUM(line_total)
            FROM order_items
            WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
        ), 0)
    WHERE id = COALESCE(NEW.order_id, OLD.order_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers para recalcular totales
CREATE TRIGGER recalculate_order_totals_insert
    AFTER INSERT ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_order_totals();

CREATE TRIGGER recalculate_order_totals_update
    AFTER UPDATE ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_order_totals();

CREATE TRIGGER recalculate_order_totals_delete
    AFTER DELETE ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_order_totals();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Políticas para CUSTOMERS
CREATE POLICY "Users can view own customers"
    ON customers FOR SELECT
    USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can insert own customers"
    ON customers FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own customers"
    ON customers FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own customers"
    ON customers FOR DELETE
    USING (auth.uid() = user_id);

-- Políticas para VISITS
CREATE POLICY "Users can view own visits"
    ON visits FOR SELECT
    USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can insert own visits"
    ON visits FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own visits"
    ON visits FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own visits"
    ON visits FOR DELETE
    USING (auth.uid() = user_id);

-- Políticas para PRODUCTS
CREATE POLICY "Users can view own products"
    ON products FOR SELECT
    USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can insert own products"
    ON products FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own products"
    ON products FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own products"
    ON products FOR DELETE
    USING (auth.uid() = user_id);

-- Políticas para ORDERS
CREATE POLICY "Users can view own orders"
    ON orders FOR SELECT
    USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can insert own orders"
    ON orders FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own orders"
    ON orders FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own orders"
    ON orders FOR DELETE
    USING (auth.uid() = user_id);

-- Políticas para ORDER_ITEMS
CREATE POLICY "Users can view own order items"
    ON order_items FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own order items"
    ON order_items FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own order items"
    ON order_items FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own order items"
    ON order_items FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- FIN DEL ESQUEMA INICIAL
-- =====================================================

