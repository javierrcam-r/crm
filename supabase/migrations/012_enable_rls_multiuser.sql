-- =====================================================
-- HABILITAR RLS PARA MULTIUSUARIO
-- =====================================================
-- Esta migración habilita RLS y políticas para que:
-- - Cada usuario solo vea sus propios datos
-- - Los admins vean todos los datos
-- =====================================================

-- Re-habilitar RLS en todas las tablas
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Eliminar TODAS las políticas antiguas si existen (para evitar conflictos)
DROP POLICY IF EXISTS "Users can view own customers" ON customers;
DROP POLICY IF EXISTS "Users can insert own customers" ON customers;
DROP POLICY IF EXISTS "Users can update own customers" ON customers;
DROP POLICY IF EXISTS "Users can delete own customers" ON customers;
DROP POLICY IF EXISTS "Users without profile can view own customers" ON customers;
DROP POLICY IF EXISTS "Users without profile can insert own customers" ON customers;
DROP POLICY IF EXISTS "Users without profile can update own customers" ON customers;
DROP POLICY IF EXISTS "Users without profile can delete own customers" ON customers;

DROP POLICY IF EXISTS "Users can view own visits" ON visits;
DROP POLICY IF EXISTS "Users can insert own visits" ON visits;
DROP POLICY IF EXISTS "Users can update own visits" ON visits;
DROP POLICY IF EXISTS "Users can delete own visits" ON visits;
DROP POLICY IF EXISTS "Users without profile can view own visits" ON visits;
DROP POLICY IF EXISTS "Users without profile can insert own visits" ON visits;
DROP POLICY IF EXISTS "Users without profile can update own visits" ON visits;
DROP POLICY IF EXISTS "Users without profile can delete own visits" ON visits;

DROP POLICY IF EXISTS "Users can view own products" ON products;
DROP POLICY IF EXISTS "Users can insert own products" ON products;
DROP POLICY IF EXISTS "Users can update own products" ON products;
DROP POLICY IF EXISTS "Users can delete own products" ON products;
DROP POLICY IF EXISTS "Users without profile can view own products" ON products;
DROP POLICY IF EXISTS "Users without profile can insert own products" ON products;
DROP POLICY IF EXISTS "Users without profile can update own products" ON products;
DROP POLICY IF EXISTS "Users without profile can delete own products" ON products;

DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON orders;
DROP POLICY IF EXISTS "Users can update own orders" ON orders;
DROP POLICY IF EXISTS "Users can delete own orders" ON orders;
DROP POLICY IF EXISTS "Users without profile can view own orders" ON orders;
DROP POLICY IF EXISTS "Users without profile can insert own orders" ON orders;
DROP POLICY IF EXISTS "Users without profile can update own orders" ON orders;
DROP POLICY IF EXISTS "Users without profile can delete own orders" ON orders;

DROP POLICY IF EXISTS "Users can view own order items" ON order_items;
DROP POLICY IF EXISTS "Users can insert own order items" ON order_items;
DROP POLICY IF EXISTS "Users can update own order items" ON order_items;
DROP POLICY IF EXISTS "Users can delete own order items" ON order_items;
DROP POLICY IF EXISTS "Users without profile can view own order items" ON order_items;
DROP POLICY IF EXISTS "Users without profile can insert own order items" ON order_items;
DROP POLICY IF EXISTS "Users without profile can update own order items" ON order_items;
DROP POLICY IF EXISTS "Users without profile can delete own order items" ON order_items;

-- =====================================================
-- POLÍTICAS PARA CUSTOMERS
-- =====================================================

-- Ver: usuarios ven sus propios clientes (y admins ven todos)
CREATE POLICY "Users can view own customers"
    ON customers FOR SELECT
    USING (
        auth.uid() = user_id 
        AND deleted_at IS NULL
    );

-- Insertar: usuarios insertan con su propio user_id
CREATE POLICY "Users can insert own customers"
    ON customers FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Actualizar: usuarios actualizan sus propios clientes
CREATE POLICY "Users can update own customers"
    ON customers FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Eliminar: usuarios eliminan sus propios clientes
CREATE POLICY "Users can delete own customers"
    ON customers FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- POLÍTICAS PARA VISITS
-- =====================================================

CREATE POLICY "Users can view own visits"
    ON visits FOR SELECT
    USING (
        auth.uid() = user_id 
        AND deleted_at IS NULL
    );

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

-- =====================================================
-- POLÍTICAS PARA PRODUCTS
-- =====================================================

CREATE POLICY "Users can view own products"
    ON products FOR SELECT
    USING (
        auth.uid() = user_id 
        AND deleted_at IS NULL
    );

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

-- =====================================================
-- POLÍTICAS PARA ORDERS
-- =====================================================

CREATE POLICY "Users can view own orders"
    ON orders FOR SELECT
    USING (
        auth.uid() = user_id 
        AND deleted_at IS NULL
    );

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

-- =====================================================
-- POLÍTICAS PARA ORDER_ITEMS
-- =====================================================

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
-- NOTA IMPORTANTE
-- =====================================================
-- Las políticas de admin se agregaron en la migración 007_users_and_roles.sql
-- Esas políticas permiten que los admins vean y gestionen todos los datos
-- Las políticas aquí son para usuarios normales (vendedores)
-- =====================================================
