# Instrucciones para Ejecutar las Migraciones

## Paso 1: Ejecutar la Migración de Usuarios y Roles

1. **Abre Supabase Dashboard**
   - Ve a tu proyecto en [supabase.com](https://supabase.com)
   - Inicia sesión

2. **Ve al SQL Editor**
   - En el menú lateral, haz clic en **SQL Editor**
   - Haz clic en **New query** (Nueva consulta)

3. **Copia y pega la migración 007**
   - Abre el archivo `supabase/migrations/007_users_and_roles.sql`
   - Copia TODO el contenido
   - Pégalo en el SQL Editor de Supabase
   - Haz clic en **Run** (Ejecutar) o presiona `Ctrl+Enter`

4. **Verifica que se creó la tabla**
   - Ve a **Table Editor** en el menú lateral
   - Deberías ver la tabla `users_profile` en la lista

## Paso 2: Ejecutar la Migración de Protección de Datos

1. **Abre una nueva consulta en SQL Editor**
   - Haz clic en **New query**

2. **Copia y pega la migración 009**
   - Abre el archivo `supabase/migrations/009_protect_existing_data.sql`
   - Copia TODO el contenido
   - Pégalo en el SQL Editor
   - Haz clic en **Run**

## Paso 3: Verificar que todo funciona

1. **Verifica la tabla users_profile**
   - Ve a **Table Editor**
   - Deberías ver `users_profile` en la lista
   - Haz clic en ella para ver su estructura

2. **Verifica las políticas RLS**
   - En la tabla `users_profile`, deberías ver que RLS está habilitado
   - Las otras tablas también deberían tener RLS habilitado (si no está deshabilitado por la migración 003)

## Nota Importante

Si tienes la migración `003_disable_rls_dev.sql` ejecutada, las tablas mostrarán "RLS disabled". Esto es normal para desarrollo. En producción, deberías tener RLS habilitado.

## Orden de Ejecución Recomendado

1. ✅ `007_users_and_roles.sql` - Crea la tabla users_profile y políticas
2. ✅ `009_protect_existing_data.sql` - Protege datos existentes
3. ⚠️ `008_seed_camila_fernandez.sql` - Solo si quieres crear el usuario de Camila (opcional, mejor hacerlo desde la interfaz web)
