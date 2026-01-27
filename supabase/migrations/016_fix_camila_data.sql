-- =====================================================
-- ARREGLAR DATOS DE CAMILA Y DESHABILITAR RLS
-- =====================================================

-- 1. Deshabilitar RLS en TODAS las tablas
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE visits DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE users_profile DISABLE ROW LEVEL SECURITY;

-- 2. Obtener el user_id de Camila y asignar todos los datos a ella
DO $$
DECLARE
    camila_user_id UUID;
BEGIN
    -- Obtener el user_id de Camila desde users_profile
    SELECT user_id INTO camila_user_id
    FROM users_profile
    WHERE email = 'cami.isabel22@gmail.com'
    LIMIT 1;

    -- Si no tiene user_id, usar su id como user_id
    IF camila_user_id IS NULL THEN
        SELECT id INTO camila_user_id
        FROM users_profile
        WHERE email = 'cami.isabel22@gmail.com'
        LIMIT 1;
        
        -- Actualizar su user_id
        UPDATE users_profile
        SET user_id = camila_user_id
        WHERE email = 'cami.isabel22@gmail.com';
    END IF;

    IF camila_user_id IS NOT NULL THEN
        RAISE NOTICE 'User ID de Camila: %', camila_user_id;

        -- Asignar todos los clientes a Camila
        UPDATE customers SET user_id = camila_user_id WHERE user_id IS NULL OR user_id != camila_user_id;
        RAISE NOTICE 'Clientes actualizados';

        -- Asignar todas las visitas a Camila
        UPDATE visits SET user_id = camila_user_id WHERE user_id IS NULL OR user_id != camila_user_id;
        RAISE NOTICE 'Visitas actualizadas';

        -- Asignar todos los productos a Camila
        UPDATE products SET user_id = camila_user_id WHERE user_id IS NULL OR user_id != camila_user_id;
        RAISE NOTICE 'Productos actualizados';

        -- Asignar todos los pedidos a Camila
        UPDATE orders SET user_id = camila_user_id WHERE user_id IS NULL OR user_id != camila_user_id;
        RAISE NOTICE 'Pedidos actualizados';

        -- Asignar todos los items de pedidos a Camila
        UPDATE order_items SET user_id = camila_user_id WHERE user_id IS NULL OR user_id != camila_user_id;
        RAISE NOTICE 'Items de pedidos actualizados';

        RAISE NOTICE 'Todos los datos han sido asignados a Camila';
    ELSE
        RAISE EXCEPTION 'No se encontró el perfil de Camila';
    END IF;
END $$;

-- 3. Verificar los datos
SELECT 'customers' as tabla, COUNT(*) as total FROM customers
UNION ALL
SELECT 'visits', COUNT(*) FROM visits
UNION ALL
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
SELECT 'order_items', COUNT(*) FROM order_items;
