-- =====================================================
-- AUTENTICACIÓN DESDE TABLA users_profile
-- =====================================================
-- Agregar campo de contraseña directamente en la tabla
-- Sin usar Supabase Auth
-- =====================================================

-- Agregar campo de contraseña (texto plano para simplicidad)
ALTER TABLE users_profile
ADD COLUMN IF NOT EXISTS password VARCHAR(255);

-- Actualizar contraseñas existentes
-- Camila Fernandez
UPDATE users_profile 
SET password = 'camila123'
WHERE email = 'cami.isabel22@gmail.com';

-- Admin (si existe)
UPDATE users_profile 
SET password = 'admin123'
WHERE rol = 'admin' AND password IS NULL;

-- Cualquier otro usuario sin contraseña
UPDATE users_profile 
SET password = 'temporal123'
WHERE password IS NULL;

-- Asegurar que password_temp también esté actualizado
UPDATE users_profile 
SET password_temp = password
WHERE password_temp IS NULL AND password IS NOT NULL;

-- Deshabilitar RLS temporalmente para que el login funcione
ALTER TABLE users_profile DISABLE ROW LEVEL SECURITY;
