-- =====================================================
-- CREAR USUARIO ADMINISTRADOR
-- =====================================================
-- Este script crea el perfil del usuario administrador
-- =====================================================
-- INSTRUCCIONES:
-- 1. PRIMERO: Crea el usuario en Supabase Auth:
--    - Ve a Authentication > Users > Add User
--    - Email: admin@crm.com (o el email que prefieras)
--    - Password: admin11213
--    - Auto Confirm User: Sí
--    - Copia el UUID del usuario creado
-- 2. LUEGO: Ejecuta este script reemplazando el UUID si es necesario
-- =====================================================

DO $$
DECLARE
    admin_user_id UUID;
    admin_email TEXT;
BEGIN
    -- Buscar el usuario por email (intenta varios emails comunes)
    -- Primero busca 'admin@crm.com'
    SELECT id, email INTO admin_user_id, admin_email
    FROM auth.users
    WHERE email = 'admin@crm.com'
    LIMIT 1;

    -- Si no se encuentra, busca 'admin'
    IF admin_user_id IS NULL THEN
        SELECT id, email INTO admin_user_id, admin_email
        FROM auth.users
        WHERE email = 'admin'
        LIMIT 1;
    END IF;

    -- Si no se encuentra, busca cualquier email que contenga 'admin'
    IF admin_user_id IS NULL THEN
        SELECT id, email INTO admin_user_id, admin_email
        FROM auth.users
        WHERE email LIKE '%admin%'
        ORDER BY created_at DESC
        LIMIT 1;
    END IF;

    IF admin_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario admin no encontrado. Por favor crea el usuario primero en Supabase Auth (Authentication > Users) con email: admin (o admin@crm.com) y contraseña: admin11213';
    END IF;

    RAISE NOTICE 'Usuario admin encontrado: % (email: %)', admin_user_id, admin_email;

    -- Crear o actualizar perfil en users_profile con rol admin
    INSERT INTO users_profile (
        user_id,
        nombre_completo,
        email,
        telefono,
        rol,
        activo
    ) VALUES (
        admin_user_id,
        'Administrador',
        admin_email,
        NULL,
        'admin',
        TRUE
    )
    ON CONFLICT (user_id) DO UPDATE SET
        nombre_completo = 'Administrador',
        email = admin_email,
        rol = 'admin',
        activo = TRUE,
        updated_at = NOW();

    RAISE NOTICE 'Perfil de administrador creado/actualizado correctamente';
    RAISE NOTICE 'Email: %', admin_email;
    RAISE NOTICE 'Contraseña: admin11213';
    RAISE NOTICE 'Rol: admin (todos los permisos)';
END $$;

-- =====================================================
-- ALTERNATIVA: Si conoces el UUID del usuario admin
-- =====================================================
-- Descomenta y reemplaza 'ADMIN_UUID_AQUI' con el UUID real:

/*
DO $$
DECLARE
    admin_user_id UUID := 'ADMIN_UUID_AQUI'; -- Reemplazar con UUID real
    admin_email TEXT;
BEGIN
    -- Obtener el email del usuario
    SELECT email INTO admin_email
    FROM auth.users
    WHERE id = admin_user_id;

    IF admin_email IS NULL THEN
        RAISE EXCEPTION 'Usuario con ID % no encontrado en auth.users', admin_user_id;
    END IF;

    -- Crear perfil
    INSERT INTO users_profile (
        user_id,
        nombre_completo,
        email,
        telefono,
        rol,
        activo
    ) VALUES (
        admin_user_id,
        'Administrador',
        admin_email,
        NULL,
        'admin',
        TRUE
    )
    ON CONFLICT (user_id) DO UPDATE SET
        nombre_completo = 'Administrador',
        email = admin_email,
        rol = 'admin',
        activo = TRUE,
        updated_at = NOW();

    RAISE NOTICE 'Perfil de administrador creado/actualizado correctamente';
END $$;
*/

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Ejecuta esta consulta para verificar que el admin fue creado:

-- SELECT 
--     up.id,
--     up.nombre_completo,
--     up.email,
--     up.rol,
--     up.activo,
--     au.id as auth_user_id
-- FROM users_profile up
-- JOIN auth.users au ON au.id = up.user_id
-- WHERE up.rol = 'admin';
