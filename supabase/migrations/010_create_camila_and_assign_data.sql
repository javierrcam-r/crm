-- =====================================================
-- CREAR USUARIO CAMILA FERNANDEZ Y ASIGNAR TODOS LOS DATOS
-- =====================================================
-- Este script crea el perfil de Camila Fernandez y asigna
-- todos los datos existentes a ella
-- =====================================================

DO $$
DECLARE
    camila_user_id UUID := '424646b2-c612-4ffc-b974-f01e42902082';
    camila_email TEXT := 'camila.fernandez@crm.com';
BEGIN
    -- Verificar que el usuario existe
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = camila_user_id) THEN
        RAISE EXCEPTION 'Usuario con ID % no encontrado en auth.users', camila_user_id;
    END IF;

    RAISE NOTICE 'Usuario encontrado: %', camila_user_id;

    -- Crear o actualizar perfil en users_profile
    INSERT INTO users_profile (
        user_id,
        nombre_completo,
        email,
        telefono,
        rol,
        activo
    ) VALUES (
        camila_user_id,
        'Camila Fernandez',
        camila_email,
        NULL,
        'vendedor',
        TRUE
    )
    ON CONFLICT (user_id) DO UPDATE SET
        nombre_completo = EXCLUDED.nombre_completo,
        email = EXCLUDED.email,
        rol = EXCLUDED.rol,
        activo = EXCLUDED.activo,
        updated_at = NOW();

    RAISE NOTICE 'Perfil creado/actualizado para Camila Fernandez';

    -- Actualizar todos los customers (asignar a Camila)
    UPDATE customers
    SET user_id = camila_user_id
    WHERE user_id IS NULL OR user_id != camila_user_id;

    RAISE NOTICE 'Customers actualizados: %', (SELECT COUNT(*) FROM customers WHERE user_id = camila_user_id);

    -- Actualizar todas las visits
    UPDATE visits
    SET user_id = camila_user_id
    WHERE user_id IS NULL OR user_id != camila_user_id;

    RAISE NOTICE 'Visits actualizadas: %', (SELECT COUNT(*) FROM visits WHERE user_id = camila_user_id);

    -- Actualizar todos los products
    UPDATE products
    SET user_id = camila_user_id
    WHERE user_id IS NULL OR user_id != camila_user_id;

    RAISE NOTICE 'Products actualizados: %', (SELECT COUNT(*) FROM products WHERE user_id = camila_user_id);

    -- Actualizar todos los orders
    UPDATE orders
    SET user_id = camila_user_id
    WHERE user_id IS NULL OR user_id != camila_user_id;

    RAISE NOTICE 'Orders actualizados: %', (SELECT COUNT(*) FROM orders WHERE user_id = camila_user_id);

    -- Actualizar todos los order_items
    UPDATE order_items
    SET user_id = camila_user_id
    WHERE user_id IS NULL OR user_id != camila_user_id;

    RAISE NOTICE 'Order items actualizados: %', (SELECT COUNT(*) FROM order_items WHERE user_id = camila_user_id);

    RAISE NOTICE '¡Proceso completado! Todos los datos han sido asignados a Camila Fernandez';
END $$;

-- =====================================================
-- VERIFICACIÓN (ejecuta después para verificar)
-- =====================================================
/*
-- Ver perfil de Camila
SELECT * FROM users_profile WHERE email = 'camila.fernandez@crm.com';

-- Ver conteo de datos asignados
SELECT 
    (SELECT COUNT(*) FROM customers WHERE user_id = (SELECT user_id FROM users_profile WHERE email = 'camila.fernandez@crm.com')) as total_customers,
    (SELECT COUNT(*) FROM visits WHERE user_id = (SELECT user_id FROM users_profile WHERE email = 'camila.fernandez@crm.com')) as total_visits,
    (SELECT COUNT(*) FROM products WHERE user_id = (SELECT user_id FROM users_profile WHERE email = 'camila.fernandez@crm.com')) as total_products,
    (SELECT COUNT(*) FROM orders WHERE user_id = (SELECT user_id FROM users_profile WHERE email = 'camila.fernandez@crm.com')) as total_orders,
    (SELECT COUNT(*) FROM order_items WHERE user_id = (SELECT user_id FROM users_profile WHERE email = 'camila.fernandez@crm.com')) as total_order_items;
*/
