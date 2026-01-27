# Verificar Problema de Loading

## El problema puede ser:

1. **El usuario no tiene perfil en `users_profile`**
2. **RLS está bloqueando el acceso**
3. **Error en la consulta de perfil**

## Pasos para diagnosticar:

### 1. Verifica en la consola del navegador
Abre las herramientas de desarrollador (F12) y ve a la pestaña "Console". Busca errores en rojo.

### 2. Verifica si el usuario tiene perfil

Ejecuta en Supabase SQL Editor:

```sql
-- Ver todos los usuarios en auth
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC;

-- Ver todos los perfiles
SELECT * FROM users_profile ORDER BY created_at DESC;

-- Buscar perfil para maujroja@espool.edu.ec
SELECT 
    au.id as auth_user_id,
    au.email,
    up.id as profile_id,
    up.nombre_completo,
    up.rol
FROM auth.users au
LEFT JOIN users_profile up ON up.user_id = au.id
WHERE au.email = 'maujroja@espool.edu.ec';
```

### 3. Crear perfil manualmente si no existe

Si el usuario NO tiene perfil, ejecútalo:

```sql
DO $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Buscar el usuario
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = 'maujroja@espool.edu.ec'
    LIMIT 1;

    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no encontrado';
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
        target_user_id,
        'Usuario Nuevo',
        'maujroja@espool.edu.ec',
        NULL,
        'vendedor',
        TRUE
    )
    ON CONFLICT (user_id) DO UPDATE SET
        activo = TRUE,
        updated_at = NOW();

    RAISE NOTICE 'Perfil creado/actualizado';
END $$;
```

### 4. Verifica el estado de RLS

```sql
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public' 
AND tablename IN ('customers', 'visits', 'products', 'orders', 'order_items', 'users_profile');
```

Deberías ver `rowsecurity = true` en todas las tablas.

### 5. Solución temporal (si persiste el problema)

Si aún se queda cargando, temporalmente deshabilita RLS:

```sql
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE visits DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;
```

Esto te permitirá acceder mientras diagnosticamos el problema.

## Solución recomendada:

1. Ejecuta la consulta 3 para crear el perfil del usuario
2. Recarga la página del CRM
3. Debería cargar correctamente

Si aún no funciona, comparte el error de la consola del navegador.
