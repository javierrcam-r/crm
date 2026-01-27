-- =====================================================
-- TABLA: users_profile (Perfiles de Usuario con Roles)
-- =====================================================
-- Esta tabla almacena información adicional de los usuarios
-- y sus roles en el sistema CRM
-- =====================================================

CREATE TABLE IF NOT EXISTS users_profile (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Información del usuario
    nombre_completo VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    telefono VARCHAR(50),
    
    -- Rol del usuario
    rol VARCHAR(50) NOT NULL DEFAULT 'vendedor' CHECK (rol IN ('admin', 'vendedor', 'supervisor')),
    
    -- Estado
    activo BOOLEAN DEFAULT TRUE,
    
    -- Auditoría
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Email único
    UNIQUE(email)
);

-- Índices para users_profile
CREATE INDEX idx_users_profile_user_id ON users_profile(user_id);
CREATE INDEX idx_users_profile_rol ON users_profile(rol);
CREATE INDEX idx_users_profile_activo ON users_profile(activo);
CREATE INDEX idx_users_profile_email ON users_profile(email);

-- Trigger para actualizar updated_at
CREATE TRIGGER update_users_profile_updated_at
    BEFORE UPDATE ON users_profile
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS
ALTER TABLE users_profile ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para users_profile
-- Los usuarios pueden ver su propio perfil
CREATE POLICY "Users can view own profile"
    ON users_profile FOR SELECT
    USING (auth.uid() = user_id);

-- Los admins pueden ver todos los perfiles
CREATE POLICY "Admins can view all profiles"
    ON users_profile FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE user_id = auth.uid() AND rol = 'admin'
        )
    );

-- Los usuarios pueden actualizar su propio perfil (excepto rol)
-- Para prevenir cambios de rol, usamos una función
CREATE OR REPLACE FUNCTION check_role_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Si el usuario no es admin, no puede cambiar su rol
    IF OLD.rol != NEW.rol AND NOT EXISTS (
        SELECT 1 FROM users_profile
        WHERE user_id = auth.uid() AND rol = 'admin' AND activo = TRUE
    ) THEN
        RAISE EXCEPTION 'Solo los administradores pueden cambiar roles';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para prevenir cambios de rol
CREATE TRIGGER prevent_role_change
    BEFORE UPDATE ON users_profile
    FOR EACH ROW
    WHEN (OLD.rol IS DISTINCT FROM NEW.rol)
    EXECUTE FUNCTION check_role_change();

-- Política simple para actualización
CREATE POLICY "Users can update own profile"
    ON users_profile FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Los admins pueden insertar nuevos perfiles
CREATE POLICY "Admins can insert profiles"
    ON users_profile FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE user_id = auth.uid() AND rol = 'admin'
        )
    );

-- Los usuarios pueden crear su propio perfil si no tienen uno
CREATE POLICY "Users can create own profile"
    ON users_profile FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND NOT EXISTS (
            SELECT 1 FROM users_profile WHERE user_id = auth.uid()
        )
    );

-- Solo los admins pueden eliminar perfiles
CREATE POLICY "Admins can delete profiles"
    ON users_profile FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE user_id = auth.uid() AND rol = 'admin'
        )
    );

-- =====================================================
-- FUNCIÓN: Obtener rol del usuario actual
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_role(user_uuid UUID DEFAULT auth.uid())
RETURNS VARCHAR(50) AS $$
BEGIN
    RETURN (
        SELECT rol FROM users_profile
        WHERE user_id = user_uuid AND activo = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: Verificar si el usuario es admin
-- =====================================================
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT EXISTS (
            SELECT 1 FROM users_profile
            WHERE user_id = user_uuid AND rol = 'admin' AND activo = TRUE
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: Verificar si el usuario es vendedor o superior
-- =====================================================
CREATE OR REPLACE FUNCTION is_vendedor_or_above(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT EXISTS (
            SELECT 1 FROM users_profile
            WHERE user_id = user_uuid 
            AND rol IN ('admin', 'vendedor', 'supervisor')
            AND activo = TRUE
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ACTUALIZAR POLÍTICAS RLS EXISTENTES PARA CONSIDERAR ROLES
-- =====================================================

-- Los vendedores pueden ver sus propios datos
-- Los admins pueden ver todos los datos
-- Actualizamos las políticas existentes para que los admins tengan acceso completo

-- Política adicional para admins en customers
CREATE POLICY "Admins can view all customers"
    ON customers FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE user_id = auth.uid() AND rol = 'admin' AND activo = TRUE
        )
    );

CREATE POLICY "Admins can insert customers for any user"
    ON customers FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE user_id = auth.uid() AND rol = 'admin' AND activo = TRUE
        )
    );

CREATE POLICY "Admins can update all customers"
    ON customers FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE user_id = auth.uid() AND rol = 'admin' AND activo = TRUE
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE user_id = auth.uid() AND rol = 'admin' AND activo = TRUE
        )
    );

CREATE POLICY "Admins can delete all customers"
    ON customers FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE user_id = auth.uid() AND rol = 'admin' AND activo = TRUE
        )
    );

-- Política adicional para admins en visits
CREATE POLICY "Admins can view all visits"
    ON visits FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE user_id = auth.uid() AND rol = 'admin' AND activo = TRUE
        )
    );

CREATE POLICY "Admins can insert visits for any user"
    ON visits FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE user_id = auth.uid() AND rol = 'admin' AND activo = TRUE
        )
    );

CREATE POLICY "Admins can update all visits"
    ON visits FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE user_id = auth.uid() AND rol = 'admin' AND activo = TRUE
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE user_id = auth.uid() AND rol = 'admin' AND activo = TRUE
        )
    );

CREATE POLICY "Admins can delete all visits"
    ON visits FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE user_id = auth.uid() AND rol = 'admin' AND activo = TRUE
        )
    );

-- Política adicional para admins en products
CREATE POLICY "Admins can view all products"
    ON products FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE user_id = auth.uid() AND rol = 'admin' AND activo = TRUE
        )
    );

CREATE POLICY "Admins can insert products for any user"
    ON products FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE user_id = auth.uid() AND rol = 'admin' AND activo = TRUE
        )
    );

CREATE POLICY "Admins can update all products"
    ON products FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE user_id = auth.uid() AND rol = 'admin' AND activo = TRUE
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE user_id = auth.uid() AND rol = 'admin' AND activo = TRUE
        )
    );

CREATE POLICY "Admins can delete all products"
    ON products FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE user_id = auth.uid() AND rol = 'admin' AND activo = TRUE
        )
    );

-- Política adicional para admins en orders
CREATE POLICY "Admins can view all orders"
    ON orders FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE user_id = auth.uid() AND rol = 'admin' AND activo = TRUE
        )
    );

CREATE POLICY "Admins can insert orders for any user"
    ON orders FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE user_id = auth.uid() AND rol = 'admin' AND activo = TRUE
        )
    );

CREATE POLICY "Admins can update all orders"
    ON orders FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE user_id = auth.uid() AND rol = 'admin' AND activo = TRUE
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE user_id = auth.uid() AND rol = 'admin' AND activo = TRUE
        )
    );

CREATE POLICY "Admins can delete all orders"
    ON orders FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE user_id = auth.uid() AND rol = 'admin' AND activo = TRUE
        )
    );

-- Política adicional para admins en order_items
CREATE POLICY "Admins can view all order items"
    ON order_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE user_id = auth.uid() AND rol = 'admin' AND activo = TRUE
        )
    );

CREATE POLICY "Admins can insert order items for any user"
    ON order_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE user_id = auth.uid() AND rol = 'admin' AND activo = TRUE
        )
    );

CREATE POLICY "Admins can update all order items"
    ON order_items FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE user_id = auth.uid() AND rol = 'admin' AND activo = TRUE
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE user_id = auth.uid() AND rol = 'admin' AND activo = TRUE
        )
    );

CREATE POLICY "Admins can delete all order items"
    ON order_items FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE user_id = auth.uid() AND rol = 'admin' AND activo = TRUE
        )
    );
