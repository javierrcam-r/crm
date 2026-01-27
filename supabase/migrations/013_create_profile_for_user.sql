-- =====================================================
-- CREAR PERFIL PARA USUARIO ESPECÍFICO
-- =====================================================
-- Usa este script para crear un perfil para cualquier usuario
-- que no tenga uno
-- =====================================================

-- Reemplaza 'EMAIL_DEL_USUARIO' con el email real del usuario

DO $$
DECLARE
    target_user_id UUID;
    target_email TEXT := 'maujroja@espol.edu.ec'; -- CAMBIAR ESTE EMAIL
BEGIN
    -- Buscar el usuario por email
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = target_email
    LIMIT 1;

    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario con email % no encontrado en auth.users', target_email;
    END IF;

    RAISE NOTICE 'Usuario encontrado: % (%)', target_email, target_user_id;

    -- Crear o actualizar perfil
    INSERT INTO users_profile (
        user_id,
        nombre_completo,
        email,
        telefono,
        rol,
        activo
    ) VALUES (
        target_user_id,
        SPLIT_PART(target_email, '@', 1), -- Usar la parte antes del @ como nombre
        target_email,
        NULL,
        'vendedor',
        TRUE
    )
    ON CONFLICT (user_id) DO UPDATE SET
        email = EXCLUDED.email,
        activo = TRUE,
        updated_at = NOW();

    RAISE NOTICE 'Perfil creado/actualizado para %', target_email;
    RAISE NOTICE 'Rol asignado: vendedor';
    RAISE NOTICE 'Estado: activo';
END $$;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- SELECT * FROM users_profile WHERE email = 'maujroja@espool.edu.ec';
