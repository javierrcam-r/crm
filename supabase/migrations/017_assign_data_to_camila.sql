-- =====================================================
-- ASIGNAR DATOS A CAMILA USANDO SU ID DE USERS_PROFILE
-- =====================================================

-- Primero ver los IDs de users_profile
SELECT id, email, nombre_completo FROM users_profile;

-- Asignar todos los datos existentes a Camila usando su ID de users_profile
DO $$
DECLARE
    camila_id UUID;
BEGIN
    -- Obtener el ID de Camila de users_profile
    SELECT id INTO camila_id
    FROM users_profile
    WHERE email = 'cami.isabel22@gmail.com'
    LIMIT 1;

    IF camila_id IS NULL THEN
        RAISE EXCEPTION 'No se encontró a Camila en users_profile';
    END IF;

    RAISE NOTICE 'ID de Camila: %', camila_id;

    -- Asignar todos los datos a Camila
    UPDATE customers SET user_id = camila_id;
    UPDATE visits SET user_id = camila_id;
    UPDATE products SET user_id = camila_id;
    UPDATE orders SET user_id = camila_id;
    UPDATE order_items SET user_id = camila_id;

    -- Actualizar el user_id en su propio perfil para que coincida
    UPDATE users_profile SET user_id = camila_id WHERE id = camila_id;

    RAISE NOTICE 'Todos los datos asignados a Camila';
END $$;

-- Verificar la asignación
SELECT 'customers' as tabla, COUNT(*) as total, COUNT(DISTINCT user_id) as usuarios FROM customers
UNION ALL
SELECT 'visits', COUNT(*), COUNT(DISTINCT user_id) FROM visits
UNION ALL
SELECT 'products', COUNT(*), COUNT(DISTINCT user_id) FROM products
UNION ALL
SELECT 'orders', COUNT(*), COUNT(DISTINCT user_id) FROM orders;
