-- =====================================================
-- PROTECCIÓN DE DATOS EXISTENTES
-- =====================================================
-- Esta migración asegura que los usuarios existentes
-- puedan seguir accediendo a sus datos incluso si no tienen
-- un perfil en users_profile todavía
-- =====================================================

-- Política temporal para usuarios sin perfil
-- Permite que usuarios existentes accedan a sus datos
-- incluso si no tienen registro en users_profile
-- Esta política se puede eliminar una vez que todos los usuarios tengan perfil

-- CUSTOMERS: Permitir acceso a usuarios sin perfil (solo sus propios datos)
CREATE POLICY IF NOT EXISTS "Users without profile can view own customers"
    ON customers FOR SELECT
    USING (
        auth.uid() = user_id 
        AND deleted_at IS NULL
        AND NOT EXISTS (
            SELECT 1 FROM users_profile WHERE user_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS "Users without profile can insert own customers"
    ON customers FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND NOT EXISTS (
            SELECT 1 FROM users_profile WHERE user_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS "Users without profile can update own customers"
    ON customers FOR UPDATE
    USING (
        auth.uid() = user_id
        AND NOT EXISTS (
            SELECT 1 FROM users_profile WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        auth.uid() = user_id
        AND NOT EXISTS (
            SELECT 1 FROM users_profile WHERE user_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS "Users without profile can delete own customers"
    ON customers FOR DELETE
    USING (
        auth.uid() = user_id
        AND NOT EXISTS (
            SELECT 1 FROM users_profile WHERE user_id = auth.uid()
        )
    );

-- VISITS: Permitir acceso a usuarios sin perfil
CREATE POLICY IF NOT EXISTS "Users without profile can view own visits"
    ON visits FOR SELECT
    USING (
        auth.uid() = user_id 
        AND deleted_at IS NULL
        AND NOT EXISTS (
            SELECT 1 FROM users_profile WHERE user_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS "Users without profile can insert own visits"
    ON visits FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND NOT EXISTS (
            SELECT 1 FROM users_profile WHERE user_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS "Users without profile can update own visits"
    ON visits FOR UPDATE
    USING (
        auth.uid() = user_id
        AND NOT EXISTS (
            SELECT 1 FROM users_profile WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        auth.uid() = user_id
        AND NOT EXISTS (
            SELECT 1 FROM users_profile WHERE user_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS "Users without profile can delete own visits"
    ON visits FOR DELETE
    USING (
        auth.uid() = user_id
        AND NOT EXISTS (
            SELECT 1 FROM users_profile WHERE user_id = auth.uid()
        )
    );

-- PRODUCTS: Permitir acceso a usuarios sin perfil
CREATE POLICY IF NOT EXISTS "Users without profile can view own products"
    ON products FOR SELECT
    USING (
        auth.uid() = user_id 
        AND deleted_at IS NULL
        AND NOT EXISTS (
            SELECT 1 FROM users_profile WHERE user_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS "Users without profile can insert own products"
    ON products FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND NOT EXISTS (
            SELECT 1 FROM users_profile WHERE user_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS "Users without profile can update own products"
    ON products FOR UPDATE
    USING (
        auth.uid() = user_id
        AND NOT EXISTS (
            SELECT 1 FROM users_profile WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        auth.uid() = user_id
        AND NOT EXISTS (
            SELECT 1 FROM users_profile WHERE user_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS "Users without profile can delete own products"
    ON products FOR DELETE
    USING (
        auth.uid() = user_id
        AND NOT EXISTS (
            SELECT 1 FROM users_profile WHERE user_id = auth.uid()
        )
    );

-- ORDERS: Permitir acceso a usuarios sin perfil
CREATE POLICY IF NOT EXISTS "Users without profile can view own orders"
    ON orders FOR SELECT
    USING (
        auth.uid() = user_id 
        AND deleted_at IS NULL
        AND NOT EXISTS (
            SELECT 1 FROM users_profile WHERE user_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS "Users without profile can insert own orders"
    ON orders FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND NOT EXISTS (
            SELECT 1 FROM users_profile WHERE user_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS "Users without profile can update own orders"
    ON orders FOR UPDATE
    USING (
        auth.uid() = user_id
        AND NOT EXISTS (
            SELECT 1 FROM users_profile WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        auth.uid() = user_id
        AND NOT EXISTS (
            SELECT 1 FROM users_profile WHERE user_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS "Users without profile can delete own orders"
    ON orders FOR DELETE
    USING (
        auth.uid() = user_id
        AND NOT EXISTS (
            SELECT 1 FROM users_profile WHERE user_id = auth.uid()
        )
    );

-- ORDER_ITEMS: Permitir acceso a usuarios sin perfil
CREATE POLICY IF NOT EXISTS "Users without profile can view own order items"
    ON order_items FOR SELECT
    USING (
        auth.uid() = user_id
        AND NOT EXISTS (
            SELECT 1 FROM users_profile WHERE user_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS "Users without profile can insert own order items"
    ON order_items FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND NOT EXISTS (
            SELECT 1 FROM users_profile WHERE user_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS "Users without profile can update own order items"
    ON order_items FOR UPDATE
    USING (
        auth.uid() = user_id
        AND NOT EXISTS (
            SELECT 1 FROM users_profile WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        auth.uid() = user_id
        AND NOT EXISTS (
            SELECT 1 FROM users_profile WHERE user_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS "Users without profile can delete own order items"
    ON order_items FOR DELETE
    USING (
        auth.uid() = user_id
        AND NOT EXISTS (
            SELECT 1 FROM users_profile WHERE user_id = auth.uid()
        )
    );

-- =====================================================
-- FUNCIÓN: Crear perfil automático para usuarios existentes
-- =====================================================
-- Esta función crea automáticamente un perfil con rol 'vendedor'
-- para usuarios que existen en auth.users pero no tienen perfil
-- =====================================================
CREATE OR REPLACE FUNCTION create_profile_for_existing_users()
RETURNS void AS $$
DECLARE
    user_record RECORD;
BEGIN
    -- Para cada usuario en auth.users que no tenga perfil
    FOR user_record IN 
        SELECT id, email, raw_user_meta_data
        FROM auth.users
        WHERE NOT EXISTS (
            SELECT 1 FROM users_profile WHERE user_id = auth.users.id
        )
    LOOP
        -- Crear perfil con rol 'vendedor' por defecto
        INSERT INTO users_profile (
            user_id,
            nombre_completo,
            email,
            telefono,
            rol,
            activo
        ) VALUES (
            user_record.id,
            COALESCE(
                user_record.raw_user_meta_data->>'nombre_completo',
                user_record.raw_user_meta_data->>'full_name',
                user_record.email,
                'Usuario'
            ),
            user_record.email,
            NULL,
            'vendedor',
            TRUE
        )
        ON CONFLICT (user_id) DO NOTHING;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- NOTA IMPORTANTE
-- =====================================================
-- Esta función se puede ejecutar manualmente después de aplicar
-- las migraciones para crear perfiles para usuarios existentes:
--
-- SELECT create_profile_for_existing_users();
--
-- O puedes crear los perfiles manualmente desde la interfaz web
-- =====================================================
