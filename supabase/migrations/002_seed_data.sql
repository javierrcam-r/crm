-- =====================================================
-- CRM VENDEDORA - Datos de Ejemplo (Seed)
-- =====================================================
-- NOTA: Este script debe ejecutarse DESPUÉS de crear un usuario
-- Reemplaza 'TU_USER_ID' con el UUID real del usuario
-- =====================================================

-- Para usar este seed:
-- 1. Crea un usuario en Supabase Auth
-- 2. Obtén su UUID desde la tabla auth.users
-- 3. Reemplaza 'TU_USER_ID' con ese UUID
-- 4. Ejecuta este script

-- Ejemplo de cómo obtener el user_id después de registrarte:
-- SELECT id FROM auth.users WHERE email = 'tu@email.com';

-- =====================================================
-- FUNCIÓN HELPER PARA INSERTAR DATOS DE SEED
-- =====================================================
-- Esta función permite insertar datos de ejemplo para un usuario específico

CREATE OR REPLACE FUNCTION seed_demo_data(p_user_id UUID)
RETURNS void AS $$
DECLARE
    v_customer_1 UUID;
    v_customer_2 UUID;
    v_customer_3 UUID;
    v_prospect_1 UUID;
    v_prospect_2 UUID;
    v_prospect_3 UUID;
    v_product_1 UUID;
    v_product_2 UUID;
    v_product_3 UUID;
    v_product_4 UUID;
    v_product_5 UUID;
    v_product_6 UUID;
    v_product_7 UUID;
    v_product_8 UUID;
    v_product_9 UUID;
    v_product_10 UUID;
    v_order_1 UUID;
    v_order_2 UUID;
    v_order_3 UUID;
BEGIN
    -- =====================================================
    -- CLIENTES (3)
    -- =====================================================
    INSERT INTO customers (user_id, tipo, nombre, telefono, email, direccion, zona, ciudad, etapa_embudo, etiquetas, notas)
    VALUES (
        p_user_id, 'cliente', 'Farmacia San José', '+595 21 555 1234', 'contacto@farmaciasanjose.com',
        'Av. España 1234', 'Centro', 'Asunción', 'ganado',
        ARRAY['farmacia', 'mayorista'], 'Cliente frecuente, paga puntual. Prefiere entregas los martes.'
    ) RETURNING id INTO v_customer_1;

    INSERT INTO customers (user_id, tipo, nombre, telefono, email, direccion, zona, ciudad, etapa_embudo, etiquetas, notas)
    VALUES (
        p_user_id, 'cliente', 'Minimarket El Sol', '+595 21 555 2345', 'minimarketsol@gmail.com',
        'Calle Palma 567', 'Microcentro', 'Asunción', 'ganado',
        ARRAY['minimarket', 'minorista'], 'Compras pequeñas pero constantes.'
    ) RETURNING id INTO v_customer_2;

    INSERT INTO customers (user_id, tipo, nombre, telefono, email, direccion, zona, ciudad, etapa_embudo, etiquetas, notas)
    VALUES (
        p_user_id, 'cliente', 'Distribuidora Norte', '+595 61 555 3456', 'ventas@distnorte.com',
        'Ruta 3 Km 5', 'Industrial', 'San Lorenzo', 'ganado',
        ARRAY['distribuidor', 'mayorista'], 'Gran volumen. Negociar descuentos por cantidad.'
    ) RETURNING id INTO v_customer_3;

    -- =====================================================
    -- PROSPECTOS (3)
    -- =====================================================
    INSERT INTO customers (user_id, tipo, nombre, telefono, email, direccion, zona, ciudad, etapa_embudo, etiquetas, notas)
    VALUES (
        p_user_id, 'prospecto', 'Supermercado Central', '+595 21 555 4567', 'compras@supercentral.com',
        'Av. Artigas 890', 'Villa Morra', 'Asunción', 'interesado',
        ARRAY['supermercado', 'potencial_grande'], 'Interesados en línea de limpieza. Llamar próxima semana.'
    ) RETURNING id INTO v_prospect_1;

    INSERT INTO customers (user_id, tipo, nombre, telefono, email, direccion, zona, ciudad, etapa_embudo, etiquetas, notas)
    VALUES (
        p_user_id, 'prospecto', 'Tienda Doña María', '+595 21 555 5678', NULL,
        'Mercado 4, Puesto 123', 'Mercado 4', 'Asunción', 'contactado',
        ARRAY['tienda', 'minorista'], 'Primera visita realizada. Necesita ver catálogo completo.'
    ) RETURNING id INTO v_prospect_2;

    INSERT INTO customers (user_id, tipo, nombre, telefono, email, direccion, zona, ciudad, etapa_embudo, etiquetas, notas)
    VALUES (
        p_user_id, 'prospecto', 'Kiosco La Esquina', '+595 981 555 6789', 'kioscoesquina@hotmail.com',
        'Calle 14 de Mayo esq. Chile', 'Centro', 'Fernando de la Mora', 'nuevo',
        ARRAY['kiosco', 'minorista'], 'Referido por Minimarket El Sol.'
    ) RETURNING id INTO v_prospect_3;

    -- =====================================================
    -- PRODUCTOS (10)
    -- =====================================================
    INSERT INTO products (user_id, sku, nombre, categoria, precio, activo, descripcion)
    VALUES (p_user_id, 'LIM-001', 'Detergente Líquido 1L', 'Limpieza', 25000, true, 'Detergente multiusos concentrado')
    RETURNING id INTO v_product_1;

    INSERT INTO products (user_id, sku, nombre, categoria, precio, activo, descripcion)
    VALUES (p_user_id, 'LIM-002', 'Lavandina 2L', 'Limpieza', 15000, true, 'Lavandina concentrada')
    RETURNING id INTO v_product_2;

    INSERT INTO products (user_id, sku, nombre, categoria, precio, activo, descripcion)
    VALUES (p_user_id, 'LIM-003', 'Jabón en Polvo 800g', 'Limpieza', 18000, true, 'Jabón para ropa')
    RETURNING id INTO v_product_3;

    INSERT INTO products (user_id, sku, nombre, categoria, precio, activo, descripcion)
    VALUES (p_user_id, 'HIG-001', 'Papel Higiénico x4', 'Higiene', 12000, true, 'Pack de 4 rollos doble hoja')
    RETURNING id INTO v_product_4;

    INSERT INTO products (user_id, sku, nombre, categoria, precio, activo, descripcion)
    VALUES (p_user_id, 'HIG-002', 'Jabón Tocador x3', 'Higiene', 8500, true, 'Pack 3 jabones 90g')
    RETURNING id INTO v_product_5;

    INSERT INTO products (user_id, sku, nombre, categoria, precio, activo, descripcion)
    VALUES (p_user_id, 'HIG-003', 'Shampoo 400ml', 'Higiene', 22000, true, 'Shampoo familiar')
    RETURNING id INTO v_product_6;

    INSERT INTO products (user_id, sku, nombre, categoria, precio, activo, descripcion)
    VALUES (p_user_id, 'COC-001', 'Aceite Vegetal 900ml', 'Cocina', 28000, true, 'Aceite de girasol')
    RETURNING id INTO v_product_7;

    INSERT INTO products (user_id, sku, nombre, categoria, precio, activo, descripcion)
    VALUES (p_user_id, 'COC-002', 'Arroz 1kg', 'Cocina', 9500, true, 'Arroz tipo 1')
    RETURNING id INTO v_product_8;

    INSERT INTO products (user_id, sku, nombre, categoria, precio, activo, descripcion)
    VALUES (p_user_id, 'COC-003', 'Azúcar 1kg', 'Cocina', 7500, true, 'Azúcar blanca')
    RETURNING id INTO v_product_9;

    INSERT INTO products (user_id, sku, nombre, categoria, precio, activo, descripcion)
    VALUES (p_user_id, 'BEB-001', 'Gaseosa 2L', 'Bebidas', 11000, true, 'Gaseosa cola')
    RETURNING id INTO v_product_10;

    -- =====================================================
    -- VISITAS (5)
    -- =====================================================
    -- Visita completada ayer
    INSERT INTO visits (user_id, customer_id, scheduled_at, status, objetivo, location_text, resultado, observaciones, next_action)
    VALUES (
        p_user_id, v_customer_1,
        NOW() - INTERVAL '1 day',
        'completada',
        'Presentar nuevos productos de limpieza',
        'Av. España 1234, Asunción',
        'Exitosa - Interesados en 3 productos nuevos',
        'El encargado pidió muestras. Enviar cotización formal.',
        'Enviar cotización por email'
    );

    -- Visita de hoy
    INSERT INTO visits (user_id, customer_id, scheduled_at, status, objetivo, location_text)
    VALUES (
        p_user_id, v_customer_2,
        NOW() + INTERVAL '2 hours',
        'programada',
        'Entrega de pedido y cobro',
        'Calle Palma 567, Asunción'
    );

    -- Visita mañana
    INSERT INTO visits (user_id, customer_id, scheduled_at, status, objetivo, location_text)
    VALUES (
        p_user_id, v_prospect_1,
        NOW() + INTERVAL '1 day',
        'programada',
        'Primera presentación comercial',
        'Av. Artigas 890, Villa Morra'
    );

    -- Visita próxima semana
    INSERT INTO visits (user_id, customer_id, scheduled_at, status, objetivo, location_text)
    VALUES (
        p_user_id, v_customer_3,
        NOW() + INTERVAL '5 days',
        'programada',
        'Renovación de contrato anual',
        'Ruta 3 Km 5, San Lorenzo'
    );

    -- Visita vencida (no atendió)
    INSERT INTO visits (user_id, customer_id, scheduled_at, status, objetivo, location_text, observaciones, next_action, next_visit_at)
    VALUES (
        p_user_id, v_prospect_2,
        NOW() - INTERVAL '3 days',
        'no_atendio',
        'Seguimiento de interés',
        'Mercado 4, Puesto 123',
        'Local cerrado. Vecinos dicen que viajó.',
        'Llamar antes de próxima visita',
        NOW() + INTERVAL '7 days'
    );

    -- =====================================================
    -- PEDIDOS (3)
    -- =====================================================
    -- Pedido 1: Entregado
    INSERT INTO orders (user_id, customer_id, order_date, status, observacion_general)
    VALUES (
        p_user_id, v_customer_1,
        CURRENT_DATE - 7,
        'entregado',
        'Pedido mensual regular'
    ) RETURNING id INTO v_order_1;

    INSERT INTO order_items (user_id, order_id, product_id, qty, unit_price, bonificado, motivo_bonificado)
    VALUES 
        (p_user_id, v_order_1, v_product_1, 12, 25000, false, NULL),
        (p_user_id, v_order_1, v_product_2, 24, 15000, false, NULL),
        (p_user_id, v_order_1, v_product_3, 6, 18000, true, 'Promoción mes de enero'),
        (p_user_id, v_order_1, v_product_4, 48, 12000, false, NULL);

    -- Pedido 2: Confirmado para entregar hoy
    INSERT INTO orders (user_id, customer_id, order_date, status, observacion_general)
    VALUES (
        p_user_id, v_customer_2,
        CURRENT_DATE,
        'confirmado',
        'Entregar antes de las 14:00'
    ) RETURNING id INTO v_order_2;

    INSERT INTO order_items (user_id, order_id, product_id, qty, unit_price, bonificado, observacion_item)
    VALUES 
        (p_user_id, v_order_2, v_product_7, 6, 28000, false, NULL),
        (p_user_id, v_order_2, v_product_8, 10, 9500, false, NULL),
        (p_user_id, v_order_2, v_product_9, 10, 7500, false, NULL),
        (p_user_id, v_order_2, v_product_10, 12, 11000, false, '2 packs de 6 unidades');

    -- Pedido 3: Borrador
    INSERT INTO orders (user_id, customer_id, order_date, status, observacion_general)
    VALUES (
        p_user_id, v_customer_3,
        CURRENT_DATE,
        'borrador',
        'Pendiente confirmar cantidades'
    ) RETURNING id INTO v_order_3;

    INSERT INTO order_items (user_id, order_id, product_id, qty, unit_price, bonificado, motivo_bonificado)
    VALUES 
        (p_user_id, v_order_3, v_product_1, 48, 23000, false, NULL),
        (p_user_id, v_order_3, v_product_2, 96, 14000, false, NULL),
        (p_user_id, v_order_3, v_product_5, 24, 8500, true, 'Bonificación por volumen');

    RAISE NOTICE 'Datos de ejemplo insertados correctamente para el usuario %', p_user_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- INSTRUCCIONES DE USO
-- =====================================================
-- Después de registrar tu usuario, ejecuta:
-- SELECT seed_demo_data('tu-user-id-aqui');
--
-- Por ejemplo:
-- SELECT seed_demo_data('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
-- =====================================================

