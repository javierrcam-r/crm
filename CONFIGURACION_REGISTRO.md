# Configuración: Deshabilitar Registro Público

## Instrucciones para Deshabilitar el Registro Público en Supabase

Para asegurar que solo los administradores puedan crear usuarios, debes deshabilitar el registro público en Supabase:

### Pasos:

1. **Accede al Dashboard de Supabase**
   - Ve a tu proyecto en [supabase.com](https://supabase.com)
   - Inicia sesión con tu cuenta

2. **Ve a Authentication Settings**
   - En el menú lateral, haz clic en **Authentication**
   - Luego haz clic en **Settings** (Configuración)

3. **Deshabilita el Registro Público**
   - Busca la sección **"Enable email signup"** o **"Enable sign ups"**
   - **Desactiva** esta opción (toggle OFF)
   - Esto impedirá que los usuarios se registren públicamente

4. **Guarda los Cambios**
   - Haz clic en **Save** o **Guardar**

### Configuración Adicional Recomendada:

1. **Email Templates (Opcional)**
   - Puedes personalizar los emails de invitación en **Authentication > Email Templates**
   - Esto permite enviar emails personalizados cuando creas usuarios desde el panel de administración

2. **URLs Permitidas**
   - En **Authentication > URL Configuration**
   - Asegúrate de que tu dominio esté en la lista de URLs permitidas

## Flujo de Usuario

### Para Usuarios Nuevos:

1. El usuario visita la aplicación
2. Ve el mensaje: "Para crear una cuenta, debes contactar con el administrador"
3. Puede hacer clic en "Solicitar acceso"
4. Se completa un formulario que envía un email al administrador (javierrcam@gmail.com)
5. El administrador crea la cuenta desde el panel de administración
6. El usuario recibe una invitación por email para establecer su contraseña

### Para Usuarios Existentes:

1. El usuario visita `/login`
2. Ingresa su email y contraseña
3. Accede al sistema normalmente

## Notas Importantes

- ✅ El registro público está deshabilitado
- ✅ Solo los administradores pueden crear usuarios
- ✅ Los usuarios pueden solicitar acceso mediante el formulario
- ✅ El email del administrador es: **javierrcam@gmail.com**

## Verificación

Para verificar que el registro está deshabilitado:

1. Intenta acceder a la URL de registro de Supabase (si existe)
2. Deberías ver un error o mensaje indicando que el registro está deshabilitado
3. En la aplicación, los usuarios solo verán el botón de "Solicitar acceso"
