# Crear Usuario Administrador

## Pasos para crear el usuario administrador

### Paso 1: Crear el usuario en Supabase Auth

1. **Ve a Supabase Dashboard**
   - Accede a tu proyecto en [supabase.com](https://supabase.com)

2. **Ve a Authentication > Users**
   - En el menú lateral, haz clic en **Authentication**
   - Luego haz clic en **Users**

3. **Crea el nuevo usuario**
   - Haz clic en **"Add User"** o el botón **"+"**
   - Completa el formulario:
     - **Email**: `admin` o `admin@crm.com` (el script buscará automáticamente)
     - **Password**: `admin11213`
     - **Auto Confirm User**: ✅ Activa esta opción
   - Haz clic en **"Create User"** o **"Save"**

4. **Copia el UUID del usuario** (opcional, el script lo buscará automáticamente)
   - El UUID aparece en la lista de usuarios
   - Se ve como: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

### Paso 2: Ejecutar el script SQL

1. **Ve al SQL Editor en Supabase**
   - En el menú lateral, haz clic en **SQL Editor**
   - Haz clic en **"New query"**

2. **Ejecuta la migración**
   - Abre el archivo `supabase/migrations/011_create_admin_user.sql`
   - Copia TODO el contenido
   - Pégalo en el SQL Editor
   - Haz clic en **"Run"** o presiona `Ctrl+Enter`

3. **Verifica que funcionó**
   - Deberías ver mensajes de éxito en la consola
   - El script buscará automáticamente el usuario por email

### Paso 3: Verificar el usuario admin

Ejecuta esta consulta para verificar:

```sql
SELECT 
    up.nombre_completo,
    up.email,
    up.rol,
    up.activo
FROM users_profile up
WHERE up.rol = 'admin';
```

Deberías ver:
- **nombre_completo**: Administrador
- **email**: admin (o el email que hayas usado)
- **rol**: admin
- **activo**: true

## Credenciales del Administrador

- **Email**: `admin` (o el email que hayas usado al crear el usuario)
- **Contraseña**: `admin11213`
- **Rol**: `admin` (todos los permisos)

## Permisos del Administrador

El usuario con rol `admin` tiene acceso a:
- ✅ Ver y gestionar todos los usuarios
- ✅ Ver todos los datos (clientes, pedidos, visitas, productos) de todos los usuarios
- ✅ Crear, editar y eliminar usuarios
- ✅ Resetear contraseñas de usuarios
- ✅ Acceso completo al sistema

## Notas Importantes

- ⚠️ **Cambia la contraseña después del primer inicio de sesión** por seguridad
- ⚠️ El email puede ser diferente, el script lo buscará automáticamente
- ⚠️ Si el script no encuentra el usuario, verifica que el email coincida exactamente

## Solución de Problemas

### Error: "Usuario admin no encontrado"
- Verifica que creaste el usuario en Supabase Auth primero
- Verifica que el email sea correcto
- Si usas un email diferente, edita el script y cambia `admin_email` en la línea correspondiente

### Error: "Ya existe un usuario con ese email"
- El usuario ya existe, el script lo actualizará automáticamente
- Verifica que el rol sea 'admin' después de ejecutar el script
